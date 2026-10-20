"""Export per-frame screen positions of each project's roof for the website.

Setup in the .blend:
  - The scene camera is animated over the shot (frame_start..frame_end).
  - One empty per project on its roof, named anchor_00, anchor_01, ... (the number is the
    project's `cityIndex` in src/content/projects.ts).

Run (one file per sequence and orientation):
  blender city.blend --background --python scripts/blender/export_anchors.py -- --out anchors-city-d.json

Only the city sequence needs anchors (cards and route follow the buildings while the camera moves).
Output: {"frames": [[[x, y], ...per anchor], ...per frame]} with x, y normalised 0..1 from the top-left.
"""
import json
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[argv.index("--out") + 1] if "--out" in argv else "anchors.json"

scene = bpy.context.scene
cam = scene.camera
anchors = sorted((o for o in scene.objects if o.name.startswith("anchor_")), key=lambda o: int(o.name.split("_")[1]))
if not anchors:
    raise SystemExit("No objects named anchor_00, anchor_01, ... found")

frames = []
for f in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(f)
    row = []
    for o in anchors:
        co = world_to_camera_view(scene, cam, o.matrix_world.translation)
        row.append([round(co.x, 4), round(1 - co.y, 4)])  # Blender's y goes up; the web's goes down
    frames.append(row)

with open(out, "w") as fh:
    json.dump({"frames": frames}, fh)
print(f"wrote {len(frames)} frames x {len(anchors)} anchors to {out}")
