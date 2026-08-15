import bpy, os

# Canonical GLB export for the playable. Use THIS one.
#
# IMPORTANT: Draco is deliberately OFF. src/scene3d.js loads with a plain GLTFLoader and
# no DRACOLoader — enabling Draco would need a WASM decoder, which fights the single-file
# bundle. (_export_glb.py and _export_final.py both request Draco and will produce a GLB
# the runtime cannot read. Prefer this script.)
#
# Settings match the known-good shipped asset: Khronos glTF Blender I/O v4.5.49,
# extensionsUsed = ["EXT_texture_webp"], Y-up, extras kept, no cameras/lights.
#
#   blender.exe -b world.blend -P _export.py

MAX_TEX = 512

base = os.path.dirname(bpy.data.filepath)

# keep textures inside the size budget, then pack so they embed in the GLB
for img in bpy.data.images:
    if img.size[0] > MAX_TEX or img.size[1] > MAX_TEX:
        w, h = img.size
        s = MAX_TEX / max(w, h)
        img.scale(max(1, int(w * s)), max(1, int(h * s)))
        print("SCALED", img.name, "->", tuple(img.size))
    try:
        img.pack()
    except Exception as e:
        print("pack skipped for", img.name, e)

# everything visible, or it won't export
for o in bpy.data.objects:
    o.hide_set(False)
    o.hide_viewport = False
    o.hide_render = False

out = os.path.join(base, "world.glb")
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
    export_draco_mesh_compression_enable=False,   # <- must stay False
    export_materials='EXPORT',
    export_image_format='WEBP',
    export_image_quality=80,
)
print("WROTE", out, os.path.getsize(out), "bytes")

# report the marker empties so a rename is caught immediately
names = sorted(o.name for o in bpy.data.objects if o.type == 'EMPTY')
print("EMPTIES:", ", ".join(names))
