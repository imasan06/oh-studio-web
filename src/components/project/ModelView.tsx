'use client';

// Live 3D view for projects with a real model: the whole city in 3D (src/lib/city3d, rebuilt from the
// data the frames are rendered from, with its traffic and people) and the project's model standing on
// its lot. It opens on the very view of the dive's last frame (same orthographic projection, scale
// and spot on screen) and fades in over it; from there the camera orbits the project freely: all the
// way round, from almost overhead to almost the horizon, and closer or further. The project stays put.
//
// Cost: one opaque canvas, ~15 draw calls, everything static merged and everything moving instanced;
// phones run it at 30 fps with the lighter model; with reduced motion nothing moves and it draws only
// on input. Copies of meshes and textures in RAM are dropped once they are on the GPU.

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  type BufferAttribute, Box3, Color, DirectionalLight, HemisphereLight, type Material, MathUtils, type Mesh, OrthographicCamera,
  Scene, Spherical, type Texture, Timer, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildLife } from '@/lib/city3d/life';
import { buildCity, type SceneData } from '@/lib/city3d/scene';
import { cityLife } from '@/lib/life/cityLife';
import { RENDERS_URL } from '@/lib/renders/registry';

export type ModelStart = {
  /** Cell centre the model stands on (city x, y). */
  pivot: [number, number];
  /** Camera of the dive's last frame: [k, tx, ty, theta, fz]. */
  cam: number[];
  /** That frame's pixel size and design→pixel scale. */
  frame: { w: number; h: number; s?: number };
};
export type ModelApi = {
  /** Turn back to the opening view (the dive's last frame). */
  reset(): Promise<void>;
  /** Turn by a step, in degrees (keyboard). */
  nudge(dAzimuth: number, dPolar: number): void;
  /** Zoom by a factor (buttons). */
  zoomBy(f: number): void;
};
type Props = {
  src: string; small: string; start: ModelStart; shown: boolean; spinning: boolean;
  onApi(api: ModelApi): void; onReady(): void; onGrab(): void; onAngle(deg: number): void;
};

const START_AZ = Math.PI / 4, START_POLAR = Math.PI / 3; // the city's 2:1 view: from +x +y, 30° above the ground
const MIN_POLAR = MathUtils.degToRad(10), MAX_POLAR = MathUtils.degToRad(82);
const MIN_ZOOM = 0.45, MAX_ZOOM = 3.2;
const TAU = Math.PI * 2;
const MAX_PIXELS = 2.4e6;                        // drawing-buffer budget (≈ 1080p at 1x, a phone at 2x)

/** Touch devices and low-memory machines get the lighter model (same mesh, textures at half size: a quarter of the memory). */
const wantsSmall = () =>
  matchMedia('(pointer: coarse)').matches || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

function dropArray(this: BufferAttribute) { (this as { array: unknown }).array = null; }

export default function ModelView({ src, small, start, shown, spinning, onApi, onReady, onGrab, onAngle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ spinning, onReady, onGrab, onAngle, onApi });
  useEffect(() => { live.current = { spinning, onReady, onGrab, onAngle, onApi }; });
  const ctl = useRef<{ setSpin(on: boolean): void } | null>(null);
  const [epoch, setEpoch] = useState(0); // bumped to rebuild after a lost GPU context

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const coarse = matchMedia('(pointer: coarse)').matches;
    let renderer: WebGLRenderer;
    try {
      // dense screens antialias themselves; MSAA there would only cost memory
      renderer = new WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'default' });
    } catch (err) {
      console.warn('[model] no WebGL', err);
      return;
    }

    const scene = new Scene();
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    const controls = new OrbitControls(cam, canvas);
    Object.assign(controls, {
      enablePan: false, enableZoom: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.6,
      minPolarAngle: MIN_POLAR, maxPolarAngle: MAX_POLAR, autoRotateSpeed: 2, // 2 = one turn in 30 s
    });

    const target = new Vector3();
    const [k, tx, ty] = start.cam;
    const fs = start.frame.s ?? 1;
    let city: ReturnType<typeof buildCity> | null = null, life: ReturnType<typeof buildLife> | null = null, data: SceneData | null = null;
    let ready = false, disposed = false, zoomNow = 1, tweening = false, onScreen = true, lastDeg = -1, still = false;

    // ---- framing: the project's centre stays where the frame had it; zoom scales around it
    const fit = () => {
      const vw = canvas.clientWidth, vh = canvas.clientHeight;
      if (!vw || !vh || !data || !city) return;
      const pr = Math.min(dpr, 2, Math.sqrt(MAX_PIXELS / (vw * vh)));
      renderer.setPixelRatio(pr);
      renderer.setSize(vw, vh, false);
      const { N, A, B, CX, CY } = data, Z = city.zUnit;
      const { w, h } = start.frame, sc = Math.max(vw / w, vh / h); // the stage covers the viewport
      const lx = (target.x - target.z) * A, ly = (target.x + target.z - N) * B - target.y * Z;
      const X = (tx + lx * k - (CX - w / (2 * fs))) * fs, Y = (ty + ly * k - (CY - h / (2 * fs))) * fs;
      const cx = vw / 2 + (X - w / 2) * sc, cy = vh / 2 + (Y - h / 2) * sc;
      const ppu = city.pxUnit * k * fs * sc * zoomNow;
      cam.left = -cx / ppu; cam.right = (vw - cx) / ppu; cam.top = cy / ppu; cam.bottom = -(vh - cy) / ppu;
      cam.updateProjectionMatrix();
      // outlines as thick as the frames draw them at this zoom (they thicken with √zoom)
      city.uniforms.uStroke.value = Math.max(0.35, 0.5 * Math.sqrt(k * zoomNow) * 1.6 * fs) * sc * pr;
    };
    const setView = (az: number, polar: number) => {
      cam.position.setFromSpherical(new Spherical(120, polar, az)).add(target);
      cam.lookAt(target);
    };

    // a lit model gets the city's light; scans come unlit (their light is in the texture)
    scene.add(new HemisphereLight('#ffffff', '#cdd1cb', 2));
    const sun = new DirectionalLight('#ffffff', 2.4);
    scene.add(sun, sun.target);

    // ---- loop
    const timer = new Timer();
    let raf = 0, tick = 0;
    const draw = (dt: number) => {
      const u = city!.uniforms, m = cam.matrixWorld.elements;
      u.uRight.value.set(m[0], m[1], m[2]); u.uUp.value.set(m[4], m[5], m[6]); u.uToCam.value.set(m[8], m[9], m[10]);
      const az = controls.getAzimuthalAngle();
      city!.updateGhosts(start.pivot, [Math.sin(az), Math.cos(az)], controls.getPolarAngle(), dt);
      if (!still) { cityLife.advance(performance.now() / 1000); life!.update(); }
      renderer.render(scene, cam);
      const deg = Math.round(MathUtils.radToDeg((((START_AZ - az) % TAU) + TAU) % TAU)) % 360;
      if (deg !== lastDeg) live.current.onAngle((lastDeg = deg));
    };
    const frame = (now: number) => {
      raf = 0;
      if (!ready || !onScreen || disposed) return;
      timer.update(now);
      const dt = Math.min(timer.getDelta(), 0.1);
      const moved = !tweening && controls.update(dt);
      // the city lives: keep drawing (every other frame on phones, ~30 fps); frozen, only when moved
      if ((!still || moved || tweening) && !(coarse && !moved && tick++ % 2)) draw(dt);
      if (!still || moved || tweening || controls.autoRotate) kick();
    };
    const kick = () => { if (!raf && ready && onScreen && !disposed) raf = requestAnimationFrame(frame); };
    controls.addEventListener('change', kick);
    controls.addEventListener('start', () => { live.current.onGrab(); kick(); });

    // ---- zoom: pinch on touch screens and trackpads (ctrl + wheel), and the buttons; plain wheel scrolls the page
    let zoomTween: gsap.core.Tween | null = null;
    const zoomed = () => { fit(); if (ready) { if (still) draw(0); else kick(); } };
    const zoomTo = (z: number) => {
      zoomTween?.kill();
      const st = { z: zoomNow };
      zoomTween = gsap.to(st, { z: MathUtils.clamp(z, MIN_ZOOM, MAX_ZOOM), duration: 0.45, ease: 'power2.out', onUpdate: () => { zoomNow = st.z; zoomed(); } });
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTween?.kill();
      zoomNow = MathUtils.clamp(zoomNow * Math.exp(-e.deltaY * 0.01), MIN_ZOOM, MAX_ZOOM);
      zoomed();
    };
    const touches = new Map<number, [number, number]>();
    let pinch = 0;
    const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const onPDown = (e: PointerEvent) => { if (e.pointerType !== 'touch') return; touches.set(e.pointerId, [e.clientX, e.clientY]); if (touches.size === 2) pinch = spread(); };
    const onPMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size !== 2 || !pinch) return;
      const s = spread();
      zoomTween?.kill();
      zoomNow = MathUtils.clamp(zoomNow * (s / pinch), MIN_ZOOM, MAX_ZOOM);
      pinch = s;
      zoomed();
    };
    const onPUp = (e: PointerEvent) => { touches.delete(e.pointerId); pinch = touches.size === 2 ? spread() : 0; };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPDown);
    window.addEventListener('pointermove', onPMove);
    window.addEventListener('pointerup', onPUp);
    window.addEventListener('pointercancel', onPUp);

    // ---- load: the city's data and life, and the model (the lighter one on phones)
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    Promise.all([
      fetch(`${RENDERS_URL}/city-scene.json`).then(r => r.json() as Promise<SceneData>),
      loader.loadAsync(wantsSmall() ? small : src),
      cityLife.load(),
    ]).then(([sceneData, gltf]) => {
      if (disposed) return;
      data = sceneData;
      scene.background = new Color(data.palette.bg);
      const focus = data.projects.findIndex(p => p.x + 0.5 === start.pivot[0] && p.y + 0.5 === start.pivot[1]);
      city = buildCity(data, focus);
      life = buildLife(city.uniforms, data.A);
      still = cityLife.state.frozen;
      scene.add(city.group, life.group);

      const model = gltf.scene;
      model.position.set(start.pivot[0], 0, start.pivot[1]);
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model);
      model.traverse(o => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry.computeBoundingSphere(); // culling needs it after the arrays are gone
        // once on the GPU, the CPU copies are dead weight
        for (const attr of Object.values(m.geometry.attributes)) (attr as BufferAttribute).onUpload(dropArray);
        m.geometry.index?.onUpload(dropArray);
        for (const mat of [m.material].flat()) for (const v of Object.values(mat)) {
          const tex = v as Texture;
          if (tex?.isTexture) tex.onUpdate = () => { (tex.image as ImageBitmap | undefined)?.close?.(); };
        }
      });
      scene.add(model);

      target.set(start.pivot[0], bounds.max.y / 2, start.pivot[1]); // the dive frames centre on mid-height
      const [sdx, sdy] = data.shadowDir;
      sun.position.copy(target).add(new Vector3(-sdx, 1 / city.zUnit, -sdy).normalize().multiplyScalar(30));
      sun.target.position.copy(target);
      controls.target.copy(target);
      setView(START_AZ, START_POLAR);
      controls.update();
      fit();
      ready = true;
      draw(-1); // see-through buildings start exactly as the frame has them
      live.current.onReady();
      kick();
    }).catch(err => console.warn('[model]', err));

    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; timer.reset(); kick(); });
    io.observe(canvas);
    const ro = new ResizeObserver(() => { fit(); if (ready) draw(0); });
    ro.observe(canvas);
    // textures are released after upload, so a lost context means a fresh start
    const lost = (e: Event) => e.preventDefault();
    const restored = () => setEpoch(n => n + 1);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);

    ctl.current = { setSpin: on => { controls.autoRotate = on; timer.reset(); kick(); } };
    ctl.current.setSpin(live.current.spinning);
    live.current.onApi({
      reset: () => new Promise<void>(done => {
        if (!ready) return done();
        controls.autoRotate = false;
        controls.enabled = false;
        controls.enableDamping = false;
        controls.update(); // spend any leftover momentum
        tweening = true;
        zoomTween?.kill();
        const az = controls.getAzimuthalAngle();
        let d = (START_AZ - az) % TAU;
        if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
        const st = { az, polar: controls.getPolarAngle(), z: zoomNow };
        gsap.to(st, {
          az: az + d, polar: START_POLAR, z: 1, duration: 0.8, ease: 'power2.inOut',
          onUpdate: () => { setView(st.az, st.polar); zoomNow = st.z; fit(); },
          onComplete: () => { setView(START_AZ, START_POLAR); zoomNow = 1; fit(); draw(0); done(); },
        });
        kick();
      }),
      nudge: (dAz, dPolar) => {
        controls.rotateLeft(MathUtils.degToRad(dAz));
        controls.rotateUp(MathUtils.degToRad(dPolar));
        kick();
      },
      zoomBy: f => zoomTo(zoomNow * f),
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      zoomTween?.kill();
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPDown);
      window.removeEventListener('pointermove', onPMove);
      window.removeEventListener('pointerup', onPUp);
      window.removeEventListener('pointercancel', onPUp);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      controls.dispose();
      draco.dispose();
      const own = new Set<unknown>([city?.group, life?.group]);
      city?.dispose();
      life?.dispose();
      scene.traverse(o => {
        const m = o as Mesh;
        if (!m.isMesh || own.has(m.parent)) return;
        m.geometry?.dispose();
        for (const mat of [m.material].flat() as (Material | undefined)[]) if (mat) {
          for (const v of Object.values(mat)) if ((v as Texture)?.isTexture) (v as Texture).dispose();
          mat.dispose();
        }
      });
      renderer.dispose();
      ctl.current = null;
    };
  }, [src, small, start, epoch]);

  useEffect(() => { ctl.current?.setSpin(spinning); }, [spinning]);

  return (
    <canvas ref={canvasRef} aria-hidden style={{ transitionDuration: '380ms' }}
      className={`absolute inset-0 h-full w-full cursor-grab transition-opacity ease-out active:cursor-grabbing ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
  );
}
