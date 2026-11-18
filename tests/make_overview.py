#!/usr/bin/env python3
"""Stitch key screenshots into shots/overview.png"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "shots"
OUT = SHOTS / "overview.png"

ITEMS = [
    ("form-step.png", "แบบฟอร์ม ขั้นตอนที่ 1"),
    ("result-a.png", "ผลลัพธ์ งานเล็กคอนโด 3 ตร.ม."),
    ("result-c.png", "ผลลัพธ์ ห้องน้ำชั้นบน 25 ตร.ม."),
    ("explainer.png", "ทำไมราคาต่อ ตร.ม. ถึงตอบไม่ได้"),
]

def fit(im, width, height):
    """Scale image to fit inside box, then pad on a paper background."""
    im = im.convert("RGB")
    ratio = min(width / im.width, height / im.height)
    nw, nh = max(1, int(im.width * ratio)), max(1, int(im.height * ratio))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), "#f4efe6")
    canvas.paste(im, ((width - nw) // 2, 0))
    return canvas

def font(size):
    candidates = [
        "/usr/share/fonts/truetype/sand-box/google/Sarabun/Sarabun-Bold.ttf",
        "/usr/share/fonts/truetype/sand-box/google/Sarabun/Sarabun-SemiBold.ttf",
        "/usr/share/fonts/truetype/sand-box/google/Sarabun/Sarabun-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def main():
    imgs = []
    for name, _ in ITEMS:
        p = SHOTS / name
        if not p.exists():
            raise SystemExit(f"missing {p}")
        imgs.append(Image.open(p))

    cell_w, cell_h = 390, 720
    pad = 24
    label_h = 48
    header_h = 72
    cols, rows = 2, 2
    W = pad + cols * (cell_w + pad)
    H = header_h + rows * (label_h + cell_h + pad) + pad

    canvas = Image.new("RGB", (W, H), "#e7dfd2")
    draw = ImageDraw.Draw(canvas)
    title_font = font(28)
    sub_font = font(18)
    label_font = font(20)

    title = "โปรโตไทป์ประเมินค่าปูกระเบื้อง"
    sub = "ราคาตัวอย่าง ยังไม่ใช่ราคาจริง  ·  ขนาดหน้าจอ 390×844"
    draw.text((pad, 18), title, fill="#2b241c", font=title_font)
    draw.text((pad, 50), sub, fill="#6a3e0c", font=sub_font)

    for i, ((name, label), im) in enumerate(zip(ITEMS, imgs)):
        r, c = divmod(i, cols) if False else (i // cols, i % cols)
        x = pad + c * (cell_w + pad)
        y = header_h + r * (label_h + cell_h + pad)
        draw.text((x, y), label, fill="#1f5c4b", font=label_font)
        fitted = fit(im, cell_w, cell_h)
        # slight rounded shadow
        shadow = Image.new("RGB", (cell_w, cell_h), "#cfc3b3")
        canvas.paste(shadow, (x + 4, y + label_h + 4))
        canvas.paste(fitted, (x, y + label_h))

    canvas.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({canvas.size[0]}x{canvas.size[1]})")

if __name__ == "__main__":
    main()
