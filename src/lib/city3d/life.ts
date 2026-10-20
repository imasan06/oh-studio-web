// Cars, people and traffic lights of the living city (src/lib/life/cityLife.ts) drawn in 3D, from the
// very same simulation: the frame layer and this view show the same traffic. Everything is instanced
// (one draw call per kind) and only positions and lamp colours change per frame.

import {
  BoxGeometry, DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';
import { GLASS, LIGHT, cityLife } from '../life/cityLife';
import { Boards, boardMaterial, rgb, type CityUniforms } from './scene';

const CAR_VS = /* glsl */ `
attribute vec3 iPos; attribute vec2 iHead; attribute vec3 iSize; attribute vec3 iTop; attribute vec3 iLit; attribute vec3 iShade;
uniform vec3 uRight;
varying vec3 vColor;
void main() {
  vec2 h = iHead, n = vec2(-h.y, h.x);
  vec3 p = position;
  vec3 w = vec3(iPos.x + h.x * p.x * iSize.x + n.x * p.z * iSize.z, iPos.y + p.y * iSize.y, iPos.z + h.y * p.x * iSize.x + n.y * p.z * iSize.z);
  vec3 wn = vec3(h.x * normal.x + n.x * normal.z, normal.y, h.y * normal.x + n.y * normal.z);
  vColor = normal.y > 0.5 ? iTop : mix(iLit, iShade, smoothstep(-0.02, 0.02, dot(wn, uRight)));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const FLAT_FS = /* glsl */ `varying vec3 vColor; void main() { gl_FragColor = vec4(vColor, 1.); }`;

const SPOT_VS = /* glsl */ `
attribute vec3 iPos; attribute vec2 iHead; attribute vec2 iSize; attribute vec4 iColor; attribute float iRound;
varying vec2 vL; varying vec4 vC; varying float vRound;
void main() {
  vRound = iRound;
  vec2 h = iHead, n = vec2(-h.y, h.x), q = position.xy;
  vec3 w = vec3(iPos.x + h.x * q.x * iSize.x + n.x * q.y * iSize.y, iPos.y, iPos.z + h.y * q.x * iSize.x + n.y * q.y * iSize.y);
  vL = q * 2.; vC = iColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const SPOT_FS = /* glsl */ `
varying vec2 vL; varying vec4 vC; varying float vRound;
void main() { if (vRound > 0.5 && length(vL) > 1.) discard; gl_FragColor = vC; }`;

// a person, drawn like the frames' figure (legs, body, head) on an upright quad, in design units
const PERSON_VS = /* glsl */ `
attribute vec3 iPos; attribute vec3 iColor; attribute float iSwing;
uniform vec3 uRight; uniform float uPx; uniform float uZ;
varying vec2 vP; varying vec3 vColor; varying float vSwing;
void main() {
  vec3 right = normalize(vec3(uRight.x, 0., uRight.z));
  vP = vec2(position.x * 1.2, (position.y + 0.5) * 2.4);
  vec3 w = iPos + right * (vP.x / uPx) + vec3(0., vP.y / uZ, 0.);
  vColor = iColor; vSwing = iSwing;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const PERSON_FS = /* glsl */ `
varying vec2 vP; varying vec3 vColor; varying float vSwing;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
void main() {
  const vec3 dark = vec3(58., 64., 60.) / 255.;
  vec3 col;
  if (length(vP - vec2(0., 2.05)) < 0.3) col = dark;
  else if (seg(vP, vec2(0., 1.), vec2(0., 1.75)) < 0.275) col = vColor;
  else if (min(seg(vP, vec2(0., 1.), vec2(vSwing, 0.)), seg(vP, vec2(0., 1.), vec2(-vSwing, 0.))) < 0.15) col = dark;
  else discard;
  gl_FragColor = vec4(col, 1.);
}`;

export function buildLife(u: CityUniforms, A: number) {
  const PX = A * Math.SQRT2, Z = PX * Math.sqrt(3) / 2;
  const { cars, walkers, lights } = cityLife.state;
  const group = new Group();

  // ---- cars: body + cab, two instances each
  const carGeo = new InstancedBufferGeometry().copy(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0) as unknown as InstancedBufferGeometry);
  const nCar = cars.length * 2;
  carGeo.instanceCount = nCar;
  const cPos = new Float32Array(nCar * 3), cHead = new Float32Array(nCar * 2), cSize = new Float32Array(nCar * 3);
  const cTop = new Uint8Array(nCar * 3), cLit = new Uint8Array(nCar * 3), cShade = new Uint8Array(nCar * 3);
  cars.forEach((c, i) => {
    cSize.set([c.len, 1.25 / Z, c.wid, c.len * 0.55, 0.75 / Z, c.wid * 0.84], 6 * i); // body, cab
    for (const [k, shade] of [[2 * i, c.col], [2 * i + 1, GLASS]] as const) {
      cTop.set(rgb(shade[0]), k * 3); cLit.set(rgb(shade[1]), k * 3); cShade.set(rgb(shade[2]), k * 3);
    }
  });
  const attr = (a: Float32Array | Uint8Array, n: number, norm = false) => new InstancedBufferAttribute(a, n, norm);
  const aPos = attr(cPos, 3), aHead = attr(cHead, 2);
  carGeo.setAttribute('iPos', aPos); carGeo.setAttribute('iHead', aHead); carGeo.setAttribute('iSize', attr(cSize, 3));
  carGeo.setAttribute('iTop', attr(cTop, 3, true)); carGeo.setAttribute('iLit', attr(cLit, 3, true)); carGeo.setAttribute('iShade', attr(cShade, 3, true));
  const carMesh = new Mesh(carGeo, new ShaderMaterial({ uniforms: u, vertexShader: CAR_VS, fragmentShader: FLAT_FS }));

  // ---- shadows on the ground: an oblong under each car, a spot under each person
  const nSpot = cars.length + walkers.length;
  const spotGeo = new InstancedBufferGeometry().copy(new PlaneGeometry(1, 1) as unknown as InstancedBufferGeometry);
  spotGeo.instanceCount = nSpot;
  const sPos = new Float32Array(nSpot * 3), sHead = new Float32Array(nSpot * 2), sSize = new Float32Array(nSpot * 2);
  const sCol = new Uint8Array(nSpot * 4), sRound = new Float32Array(nSpot);
  for (let i = 0; i < nSpot; i++) {
    const person = i >= cars.length;
    sCol.set([31, 36, 33, Math.round((person ? 0.16 : 0.14) * 255)], i * 4);
    sHead.set([1, 0], i * 2);
    if (person) { sSize.set([0.9 / PX, 0.9 / PX], i * 2); sRound[i] = 1; }
  }
  const aSPos = attr(sPos, 3), aSHead = attr(sHead, 2), aSSize = attr(sSize, 2);
  spotGeo.setAttribute('iPos', aSPos); spotGeo.setAttribute('iHead', aSHead); spotGeo.setAttribute('iSize', aSSize); spotGeo.setAttribute('iColor', attr(sCol, 4, true)); spotGeo.setAttribute('iRound', attr(sRound, 1));
  const spotMesh = new Mesh(spotGeo, new ShaderMaterial({ vertexShader: SPOT_VS, fragmentShader: SPOT_FS, transparent: true, depthWrite: false, side: DoubleSide }));

  // ---- people
  const personGeo = new InstancedBufferGeometry().copy(new PlaneGeometry(1, 1) as unknown as InstancedBufferGeometry);
  personGeo.instanceCount = walkers.length;
  const pPos = new Float32Array(walkers.length * 3), pCol = new Uint8Array(walkers.length * 3), pSwing = new Float32Array(walkers.length);
  walkers.forEach((w, i) => pCol.set(rgb(w.col), i * 3));
  const aPPos = attr(pPos, 3), aPSwing = attr(pSwing, 1);
  personGeo.setAttribute('iPos', aPPos); personGeo.setAttribute('iColor', attr(pCol, 3, true)); personGeo.setAttribute('iSwing', aPSwing);
  const personMesh = new Mesh(personGeo, new ShaderMaterial({
    uniforms: { ...u, uPx: { value: PX }, uZ: { value: Z } }, vertexShader: PERSON_VS, fragmentShader: PERSON_FS, side: DoubleSide,
  }));

  // ---- traffic lights: pole, housing and three lamps; only the lamps change
  const boards = new Boards();
  const P = (x: number, y: number, z: number) => new Vector3(x, z / Z, y);
  const lampAt: number[] = [];
  const HW = 0.42, HH = 1.25, OFF = [0, 1, 2].map(i => HH - (HH * (i + 0.5)) / 3);
  for (const l of lights) {
    boards.add(P(l.x, l.y, 2.3), [0.16 / PX, 4.6 / Z], [0, 0], rgb('#5E6560'), 3);
    boards.add(P(l.x, l.y, 4.6), [HW / PX, HH / PX], [0, HH / 2 / PX], rgb('#2A2F2C'), 2, 0.001);
    lampAt.push(boards.add(P(l.x, l.y, 4.6), [0.3 / PX, 0.3 / PX], [0, OFF[0] / PX], rgb('#4A504C'), 0, 0.002));
    for (const o of OFF.slice(1)) boards.add(P(l.x, l.y, 4.6), [0.3 / PX, 0.3 / PX], [0, o / PX], rgb('#4A504C'), 0, 0.002);
  }
  const lightGeo = boards.geometry();
  const lightCol = lightGeo.getAttribute('iColor') as InstancedBufferAttribute;
  const lightMesh = new Mesh(lightGeo, boardMaterial(u));
  const OFF_RGB = rgb('#4A504C'), SIG = { r: rgb(LIGHT.r), a: rgb(LIGHT.a), g: rgb(LIGHT.g) };

  for (const m of [carMesh, spotMesh, personMesh, lightMesh]) m.frustumCulled = false;
  group.add(carMesh, personMesh, lightMesh, spotMesh);

  /** Copies the simulation into the instance buffers. */
  const update = () => {
    const { canal, signal } = cityLife.state;
    const r = u.uRight.value;
    cars.forEach((c, i) => {
      const z0 = c.leg?.axis === 1 && c.x > canal - 0.05 && c.x < canal + 1.05 ? 0.8 : 0; // on a bridge
      const back = -c.len * 0.08;
      cPos.set([c.x, (z0 + 0.25) / Z, c.y], 6 * i);
      cPos.set([c.x + c.hx * back, (z0 + 1.5) / Z, c.y + c.hy * back], 6 * i + 3);
      cHead.set([c.hx, c.hy, c.hx, c.hy], 4 * i);
      sPos.set([c.x + 0.03, z0 / Z + 0.0005, c.y + 0.02], 3 * i);
      sHead.set([c.hx, c.hy], 2 * i);
      sSize.set([c.len + 0.03, c.wid + 0.02], 2 * i);
    });
    walkers.forEach((w, i) => {
      pPos.set([w.x, 0, w.y], 3 * i);
      // the stride swings along the walk; seen from the side it opens, seen from behind it closes
      pSwing[i] = Math.sin(w.ph) * 0.014 * PX * (w.dx * r.x + w.dy * r.z);
      sPos.set([w.x, 0.0005, w.y], 3 * (cars.length + i));
    });
    lights.forEach((l, i) => {
      const s = signal(l), lit = s === 'r' ? 0 : s === 'a' ? 1 : 2;
      for (let k = 0; k < 3; k++) lightCol.array.set([...(k === lit ? SIG[s] : OFF_RGB), 255], (lampAt[i] + k) * 4);
    });
    for (const a of [aPos, aHead, aSPos, aSHead, aSSize, aPPos, aPSwing, lightCol]) a.needsUpdate = true;
  };

  const dispose = () => {
    for (const m of [carMesh, spotMesh, personMesh, lightMesh]) { m.geometry.dispose(); (m.material as ShaderMaterial).dispose(); }
  };
  return { group, update, dispose };
}
