# -*- coding: utf-8 -*-
"""Crop + zoom regions for vision re-check; relaxed color scan of crash zone."""
from PIL import Image

DEBUG = r"E:\ZCode\.zcode\workspace\Demo\Demo_man_jump\debug"

def save_zoom(src, box, scale, out):
    img = Image.open(src).convert("RGB")
    c = img.crop(box)
    c = c.resize((c.width * scale, c.height * scale), Image.NEAREST)
    c.save(out)
    print("saved", out, c.size)

def scan_zone(src, y0, y1, label):
    img = Image.open(src).convert("RGB")
    w, h = img.size
    px = img.load()
    counts = {
        "red_loose": 0, "blue_loose": 0, "white_loose": 0,
        "gray_loose": 0, "orange": 0, "brown_dark": 0,
    }
    samples = {k: [] for k in counts}
    for y in range(y0, y1):
        for x in range(0, w):
            r, g, b = px[x, y]
            if r >= 120 and g <= 100 and b <= 100 and r - max(g, b) >= 40:
                counts["red_loose"] += 1
                if len(samples["red_loose"]) < 8: samples["red_loose"].append((x, y, (r, g, b)))
            if b >= 100 and r <= 130 and b - r >= 30 and b - g >= 15:
                counts["blue_loose"] += 1
                if len(samples["blue_loose"]) < 8: samples["blue_loose"].append((x, y, (r, g, b)))
            if r >= 215 and g >= 215 and b >= 205:
                counts["white_loose"] += 1
            if 45 <= max(r, g, b) <= 135 and max(r, g, b) - min(r, g, b) <= 30:
                counts["gray_loose"] += 1
            if r >= 180 and 90 <= g <= 165 and b <= 90:
                counts["orange"] += 1
    print("--- %s zone rows %d..%d of %d" % (label, y0, y1, h))
    for k, v in counts.items():
        print("   %-12s %5d px" % (k, v))
    for k in ("red_loose", "blue_loose"):
        if samples[k]:
            print("   %s samples:" % k, samples[k])

if __name__ == "__main__":
    crash = DEBUG + r"\shot_pelican_crash.png"
    trio = DEBUG + r"\shot_pelicans3.png"
    # burst zone crop (around patrol band y~250-400, full play width)
    save_zoom(crash, (60, 230, 480, 410), 4, DEBUG + r"\crop_crash_burst.png")
    # pelican crops in trio shot
    save_zoom(trio, (170, 285, 240, 345), 5, DEBUG + r"\crop_trio_left.png")
    save_zoom(trio, (235, 285, 305, 345), 5, DEBUG + r"\crop_trio_mid.png")
    save_zoom(trio, (305, 285, 375, 345), 5, DEBUG + r"\crop_trio_right.png")
    # relaxed scan of crash top zone (play area above bird platform)
    scan_zone(crash, 210, 410, "crash play-top")
    # baseline: same zone in trio (has live pelicans with known red frame/blue fish)
    scan_zone(trio, 210, 410, "trio play-top")
