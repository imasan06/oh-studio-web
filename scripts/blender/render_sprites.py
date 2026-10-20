"""Render a real 3D model as sprites that drop into the placeholder city (scripts/city/geometry.ts).

The city is an exact orthographic 2:1 projection, L(x, y, z) = [(x - y) * 20, (x + y - N) * 10 - z],
so an orthographic Blender camera reproduces it: 1 Blender unit = 1 city cell horizontally, and the
city's height unit z is Blender Z / Z_PER_CELL. Blender's Y is the city's -y (the city is left-handed).

One sprite per orbit step (the model and its sun turn together, like the city does in the orbit).
Sprite 0 is used for the city and dive shots, sprite i for orbit frame i.

Run:
  blender --background --python scripts/blender/render_sprites.py -- \
    --glb model.glb --out assets/models/<name> [--cells 0.9 | --m-per-cell 19.6] [--yaw 0] [--steps 72] [--ppu 900] [--preview]

Writes <out>/000.png ... and <out>/sprite.json (sprite box relative to the cell centre, in city units).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(f"--{name}") + 1] if f"--{name}" in argv else default

GLB, OUT = arg("glb"), arg("out")
CELLS = float(arg("cells", 0.9))      # largest footprint side, in city cells
# Real scale instead: metres per city cell. The city draws a floor every 4 height units; at ~3.2 m a
# floor, 1 unit = 0.8 m and 1 cell = 24.5 units = 19.6 m. Needs a model in metres.
M_PER_CELL = float(arg("m-per-cell", 0)) or None
YAW = float(arg("yaw", 0))            # model rotation at theta 0, degrees
STEPS = int(arg("steps", 72))         # orbit frames (ORBIT_STEP_DEG = 360 / STEPS)
PPU = float(arg("ppu", 900))          # sprite pixels per Blender unit
PREVIEW = "--preview" in argv
WEB = arg("web")                      # also export the normalised model for the live 3D viewer
WEB_TRIS = int(arg("web-tris", 250000))
WEB_TEX = int(arg("web-tex", 2048))
if not GLB or not (OUT or WEB):
    raise SystemExit("usage: -- --glb model.glb (--out folder | --web model.glb) [--cells 0.9 | --m-per-cell 19.6] [--yaw 0] "
                     "[--steps 72] [--ppu 900] [--preview] [--web-tris 250000] [--web-tex 2048]")

S = 20 * math.sqrt(2)                 # city design units per Blender unit on screen
Z_PER_CELL = 1 / (S * math.sqrt(3) / 2)  # Blender Z per city height unit (~0.0408)
RIGHT = Vector((1, 1, 0)).normalized()
UP = Vector((-math.sqrt(2) / 4, math.sqrt(2) / 4, math.sqrt(3) / 2))
BACK = RIGHT.cross(UP)                # camera sits on +X -Y +Z: the city's "front" (bottom of the screen)
SHADOW_DIR = (0.024, 0.009)           # same as geometry.ts: cells of shadow per city height unit

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in scene.objects if o.type == "MESH"]

# --- normalise: centred on the origin, standing on z = 0, largest side = CELLS
pivot = bpy.data.objects.new("pivot", None)
scene.collection.objects.link(pivot)
model = bpy.data.objects.new("model", None)
scene.collection.objects.link(model)
model.parent = pivot
for o in scene.objects:
    if o.parent is None and o not in (pivot, model):
        o.parent = model
bpy.context.view_layer.update()
model.rotation_euler.z = math.radians(YAW)
bpy.context.view_layer.update()

def bounds():
    lo, hi = Vector((1e18,) * 3), Vector((-1e18,) * 3)
    for o in meshes:
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    return lo, hi

lo, hi = bounds()
k = 1 / M_PER_CELL if M_PER_CELL else CELLS / max(hi.x - lo.x, hi.y - lo.y)
model.scale = (k, k, k)
model.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k)
bpy.context.view_layer.update()
lo, hi = bounds()
radius = max(math.hypot(v.x, v.y) for o in meshes for v in (o.matrix_world @ p.co for p in o.data.vertices))
height = hi.z
print(f"footprint {hi.x - lo.x:.3f} x {hi.y - lo.y:.3f} cells, height {height / Z_PER_CELL:.1f} city units, radius {radius:.3f}")

if WEB:
    # the same normalised model (1 unit = 1 cell, centred, on the ground), light enough for the web:
    # decimated, textures resized to JPEG, Draco-compressed. glTF is Y-up, so three.js gets
    # x = city x, y = height, z = city y.
    tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    ratio = min(1, WEB_TRIS / max(1, tris))
    for o in meshes:
        if ratio < 1:
            dec = o.modifiers.new("decimate", "DECIMATE")
            dec.ratio = ratio
    for img in bpy.data.images:
        if max(img.size) > WEB_TEX:
            img.scale(*(round(v * WEB_TEX / max(img.size)) for v in img.size))
    # one mesh: a draw call per material instead of one per scan chunk
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    for o in scene.objects:
        o.select_set(o.type in ("MESH", "EMPTY"))
    bpy.ops.export_scene.gltf(
        filepath=WEB, export_format="GLB", use_selection=True, export_apply=True,
        export_image_format="JPEG", export_jpeg_quality=82,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_texcoord_quantization=12, export_draco_normal_quantization=10,
        export_cameras=False, export_lights=False,
    )
    print(f"web model: {tris} -> ~{round(tris * ratio)} triangles, textures <= {WEB_TEX}px, {os.path.getsize(WEB) / 1048576:.1f} MB -> {WEB}")
    if not OUT:
        raise SystemExit(0)

# --- light: a sun casting along the city's shadow direction, plus soft neutral ambient
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
scene.collection.objects.link(sun)
sun.parent = pivot
d = Vector((SHADOW_DIR[0] / Z_PER_CELL, -SHADOW_DIR[1] / Z_PER_CELL, -1)).normalized()
sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 3.2
sun.data.angle = math.radians(6)
world = bpy.data.worlds.new("world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.93, 0.91, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
scene.world = world

# --- camera: the city's projection, framed on everything the model can cover while it turns
m = 0.04
hw = radius + m
ub, ut = -0.5 * radius - m, 0.5 * radius + UP.z * height + m
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(2 * hw, ut - ub)
cam.data.clip_start, cam.data.clip_end = 0.01, 1000
centre = UP * ((ub + ut) / 2) + BACK * 50
cam.matrix_world = Matrix((
    (RIGHT.x, UP.x, BACK.x, centre.x),
    (RIGHT.y, UP.y, BACK.y, centre.y),
    (RIGHT.z, UP.z, BACK.z, centre.z),
    (0, 0, 0, 1),
))

r = scene.render
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        r.engine = engine
        break
    except TypeError:
        pass
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
ppu = PPU / 4 if PREVIEW else PPU
r.resolution_x, r.resolution_y = round(2 * hw * ppu), round((ut - ub) * ppu)
r.resolution_percentage = 100
try:
    scene.eevee.taa_render_samples = 16 if PREVIEW else 64
    scene.eevee.use_shadows = True
except AttributeError:
    pass

os.makedirs(OUT, exist_ok=True)
angles = [0, 90, 180, 270] if PREVIEW else [i * 360 / STEPS for i in range(STEPS)]
for i, theta in enumerate(angles):
    # the city turns by +theta in (x, y); Blender's Y is -y, so the model turns by -theta
    pivot.rotation_euler.z = -math.radians(theta)
    r.filepath = os.path.join(OUT, f"{'preview_' if PREVIEW else ''}{(int(theta) if PREVIEW else i):03d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"sprite {i + 1}/{len(angles)}", flush=True)

if not PREVIEW:
    # sprite box relative to the projected cell centre, in city design units (y down)
    meta = {"x": -hw * S, "y": -ut * S, "w": 2 * hw * S, "h": (ut - ub) * S,
            "height": round(height / Z_PER_CELL, 2), "steps": STEPS,
            "footprint": [round(hi.x - lo.x, 3), round(hi.y - lo.y, 3)]}
    with open(os.path.join(OUT, "sprite.json"), "w") as fh:
        json.dump(meta, fh)
    print("wrote", os.path.join(OUT, "sprite.json"), meta)
