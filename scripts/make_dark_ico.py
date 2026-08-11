import os
from PIL import Image

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dark_png = os.path.join(root_dir, 'assets', 'branding', 'icon_dark.png')
out_ico = os.path.join(root_dir, 'assets', 'icon.ico')

print(f"Loading dark mark PNG from: {dark_png}")
img = Image.open(dark_png).convert('RGBA')

sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
print(f"Generating multi-res dark ICO ({out_ico})...")
img.save(out_ico, format='ICO', sizes=sizes)
print("Generated high-contrast dark mark icon.ico successfully!")
