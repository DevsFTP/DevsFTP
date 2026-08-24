import os
from PIL import Image

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
light_png = os.path.join(root_dir, 'assets', 'branding', 'icon_light.png')
out_ico = os.path.join(root_dir, 'assets', 'icon.ico')

print(f"Loading high-contrast light mark PNG from: {light_png}")
img = Image.open(light_png).convert('RGBA')

sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
print(f"Generating multi-res high-contrast ICO ({out_ico})...")
img.save(out_ico, format='ICO', sizes=sizes)
print("Generated high-contrast bright mark icon.ico successfully!")
