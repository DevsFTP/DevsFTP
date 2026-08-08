import os
import math
from PIL import Image, ImageDraw

def render_smooth_d_icon(size=4096):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 512.0
    def s(val):
        return int(round(val * scale))

    # Exact colors
    d_color = (230, 230, 230, 255)       # --text-primary (#E6E6E6)
    prompt_color = (125, 131, 140, 255)   # --text-muted (#7D838C)
    accent_color = (104, 160, 99, 255)    # --accent-primary (#68a063)

    stroke_w = s(36)

    # Cubic bezier curve evaluation for continuous D outer loop
    def cubic_bezier(p0, p1, p2, p3, steps=200):
        points = []
        for i in range(steps + 1):
            t = i / float(steps)
            u = 1 - t
            x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
            y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
            points.append((int(round(x)), int(round(y))))
        return points

    # Build continuous D outline contour:
    # 1. Top horizontal line: (130, 110) -> (250, 110)
    # 2. Smooth right curve: (250, 110) -> (390, 256) -> (250, 402) via cubic control points
    # 3. Bottom horizontal line: (250, 402) -> (130, 402)
    # 4. Left vertical line: (130, 402) -> (130, 110)

    d_path = []
    # Top line
    for t in range(0, 101):
        x = s(130 + (250 - 130) * (t / 100.0))
        y = s(110)
        d_path.append((x, y))

    # Right smooth bezier arc
    curve_points = cubic_bezier(
        (s(250), s(110)),
        (s(390), s(110)),
        (s(390), s(402)),
        (s(250), s(402)),
        steps=300
    )
    d_path.extend(curve_points)

    # Bottom line
    for t in range(0, 101):
        x = s(250 - (250 - 130) * (t / 100.0))
        y = s(402)
        d_path.append((x, y))

    # Left line
    for t in range(0, 101):
        x = s(130)
        y = s(402 - (402 - 110) * (t / 100.0))
        d_path.append((x, y))

    # Draw continuous thick D path
    draw.line(d_path, fill=d_color, width=stroke_w, joint="round")

    # Round caps for all key vertices
    r_cap = stroke_w // 2
    for p in [(s(130), s(110)), (s(250), s(110)), (s(250), s(402)), (s(130), s(402))]:
        draw.ellipse([p[0] - r_cap, p[1] - r_cap, p[0] + r_cap, p[1] + r_cap], fill=d_color)

    # 2. Terminal Prompt '>'
    p1 = (s(170), s(190))
    p2 = (s(245), s(256))
    p3 = (s(170), s(322))

    draw.line([p1, p2], fill=prompt_color, width=stroke_w)
    draw.line([p2, p3], fill=prompt_color, width=stroke_w)
    for p in [p1, p2, p3]:
        draw.ellipse([p[0] - r_cap, p[1] - r_cap, p[0] + r_cap, p[1] + r_cap], fill=prompt_color)

    # 3. Connection Node '──●'
    n1 = (s(250), s(256))
    n2 = (s(325), s(256))
    draw.line([n1, n2], fill=accent_color, width=stroke_w)
    draw.ellipse([n1[0] - r_cap, n1[1] - r_cap, n1[0] + r_cap, n1[1] + r_cap], fill=accent_color)
    draw.ellipse([n2[0] - r_cap, n2[1] - r_cap, n2[0] + r_cap, n2[1] + r_cap], fill=accent_color)

    r_circle = s(26)
    cx, cy = s(338), s(256)
    draw.ellipse([cx - r_circle, cy - r_circle, cx + r_circle, cy + r_circle], fill=accent_color)

    return img

def build_assets():
    assets_dir = r"c:\xampp\htdocs\DevsFTP\assets"
    os.makedirs(assets_dir, exist_ok=True)

    print("Generating cubic-bezier smooth master icon at 4096x4096...")
    master = render_smooth_d_icon(4096)

    # Downscale with Lanczos anti-aliased subpixel filtering
    png_path = os.path.join(assets_dir, "icon.png")
    png_512 = master.resize((512, 512), Image.Resampling.LANCZOS)
    png_512.save(png_path, "PNG")
    print(f"Saved smooth PNG: {png_path}")

    # Build multi-resolution Windows ICO
    ico_path = os.path.join(assets_dir, "icon.ico")
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    master.save(ico_path, format="ICO", sizes=sizes)
    print(f"Saved multi-res ICO: {ico_path}")

if __name__ == "__main__":
    build_assets()
