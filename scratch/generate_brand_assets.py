import os
from PIL import Image, ImageDraw

def create_devsftp_icon(size=1024):
    # Transparent canvas
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale helper
    def s(val):
        return int(val * (size / 512.0))

    # 1. Outer D Loop: #E6E6E6 (--text-primary)
    # Path d="M 130 110 L 260 110 C 355 110 405 165 405 256 C 405 347 355 402 260 402 L 130 402 Z"
    # Render with high-resolution line drawing
    d_stroke_width = s(32)
    d_color = (230, 230, 230, 255) # #E6E6E6

    # Points for D
    x1, y1 = s(130), s(110)
    x2, y2 = s(260), s(110)
    x3, y3 = s(260), s(402)
    x4, y4 = s(130), s(402)

    # Draw D straight lines & arc
    draw.line([(x1, y1), (x2, y1)], fill=d_color, width=d_stroke_width)
    draw.line([(x4, y4), (x1, y1)], fill=d_color, width=d_stroke_width)
    draw.line([(x3, y3), (x4, y4)], fill=d_color, width=d_stroke_width)

    # Arc for right side of D
    arc_box = [s(260 - 145), s(110), s(260 + 145), s(402)]
    draw.arc(arc_box, start=270, end=90, fill=d_color, width=d_stroke_width)

    # 2. Inner Terminal Prompt '>': #7D838C (--text-muted)
    # Path d="M 170 190 L 245 256 L 170 322"
    prompt_stroke_width = s(36)
    prompt_color = (125, 131, 140, 255) # #7D838C

    p1 = (s(170), s(190))
    p2 = (s(245), s(256))
    p3 = (s(170), s(322))

    draw.line([p1, p2], fill=prompt_color, width=prompt_stroke_width)
    draw.line([p2, p3], fill=prompt_color, width=prompt_stroke_width)

    # 3. Connection Node '──●': #68a063 (--accent-primary)
    # Line x1="250" y1="256" x2="325" y2="256"
    # Circle cx="338" cy="256" r="26"
    node_stroke_width = s(36)
    accent_color = (104, 160, 99, 255) # #68a063

    draw.line([(s(250), s(256)), (s(325), s(256))], fill=accent_color, width=node_stroke_width)
    
    r = s(26)
    cx, cy = s(338), s(256)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=accent_color)

    return img

def generate_all_assets():
    assets_dir = r"c:\xampp\htdocs\DevsFTP\assets"
    os.makedirs(assets_dir, exist_ok=True)

    print("Generating high-resolution 1024x1024 master icon...")
    master_img = create_devsftp_icon(1024)

    # 1. Save 512x512 transparent icon.png
    png_path = os.path.join(assets_dir, "icon.png")
    png_512 = master_img.resize((512, 512), Image.Resampling.LANCZOS)
    png_512.save(png_path, "PNG")
    print(f"Saved: {png_path}")

    # 2. Save multi-resolution Windows icon.ico
    ico_path = os.path.join(assets_dir, "icon.ico")
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    master_img.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"Saved: {ico_path}")

    # 3. Generate NSIS Installer Sidebar Image (164x314 px)
    sidebar_path = os.path.join(assets_dir, "installerSidebar.png")
    sidebar_img = Image.new('RGBA', (164, 314), (24, 27, 31, 255)) # Dark Graphite background #181B1F
    s_draw = ImageDraw.Draw(sidebar_img)
    # Draw subtle background accent gradient/lines
    s_draw.rectangle([0, 0, 164, 4], fill=(104, 160, 99, 255)) # #68a063 top border
    # Paste logo centered in top half
    logo_small = png_512.resize((100, 100), Image.Resampling.LANCZOS)
    sidebar_img.paste(logo_small, (32, 40), logo_small)
    sidebar_img.save(sidebar_path, "PNG")
    print(f"Saved: {sidebar_path}")

    # 4. Generate NSIS Installer Header Image (150x57 px)
    header_path = os.path.join(assets_dir, "installerHeader.png")
    header_img = Image.new('RGBA', (150, 57), (24, 27, 31, 255)) # Dark Graphite #181B1F
    h_draw = ImageDraw.Draw(header_img)
    h_draw.rectangle([0, 0, 150, 2], fill=(104, 160, 99, 255)) # Top accent border
    logo_micro = png_512.resize((36, 36), Image.Resampling.LANCZOS)
    header_img.paste(logo_micro, (104, 10), logo_micro)
    header_img.save(header_path, "PNG")
    print(f"Saved: {header_path}")

    print("All image assets generated successfully!")

if __name__ == "__main__":
    generate_all_assets()
