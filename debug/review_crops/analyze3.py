# -*- coding: utf-8 -*-
"""Sample true colors of the 4 ad cards; white-blob detect pelicans; make 4x crops."""
import os
from collections import Counter
from PIL import Image

DEBUG = r"E:\ZCode\.zcode\workspace\Demo\Demo_man_jump\debug"
OUT = os.path.join(DEBUG, "review_crops")

im1 = Image.open(os.path.join(DEBUG, "shot_ads_debuff.png")).convert("RGB")
px1 = im1.load()

cards = {
    "L-top  (expect GOLD 无敌10秒)":   (62, 355, 185, 600),
    "L-bot  (expect PURPLE 加速2秒)":  (62, 600, 185, 800),
    "R-top  (expect BLUE 缓速5秒)":    (697, 300, 820, 500),
    "R-bot  (expect PURPLE 鹈鹕+2)":   (697, 500, 820, 800),
}
print("== shot_ads_debuff.png card color sampling ==")
for label, (x0, y0, x1, y1) in cards.items():
    cnt = Counter()
    for y in range(y0, y1, 3):
        for x in range(x0, x1, 3):
            r, g, b = px1[x, y]
            cnt[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1  # 16-level quantize
    top = cnt.most_common(6)
    tot = sum(cnt.values())
    print("\n%s  box=%s  samples=%d" % (label, (x0, y0, x1, y1), tot))
    for (r, g, b), n in top:
        print("   #~%02X%02X%02X  %5.1f%%" % (r, g, b, 100.0 * n / tot))
    # top strip color (first 8 px of card)
    strips = Counter()
    for y in range(y0, y0 + 10):
        for x in range(x0, x1, 2):
            r, g, b = px1[x, y]
            strips[(r // 24 * 24, g // 24 * 24, b // 24 * 24)] += 1
    print("   top-strip dominant:", ["#%02X%02X%02X x%d" % (c[0], c[1], c[2], n) for c, n in strips.most_common(2)])

# 4x crops of the four cards
for name, box in {
    "card_L_top_gold.png": (58, 350, 188, 605),
    "card_L_bot_purple.png": (58, 598, 188, 805),
    "card_R_top_blue.png": (693, 298, 823, 500),
    "card_R_bot_purple.png": (693, 500, 823, 805),
}.items():
    c = im1.crop(box)
    c.resize((c.width * 4, c.height * 4), Image.LANCZOS).save(os.path.join(OUT, name))
    print("saved", name, c.size, "->x4")

# ---------- pelicans: white blob detection ----------
im2 = Image.open(os.path.join(DEBUG, "shot_pelicans3.png")).convert("RGB")
w, h = im2.size
px2 = im2.load()
step = 3
grid = {}
for y in range(0, h, step):
    for x in range(0, w, step):
        r, g, b = px2[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        if mx > 210 and mx - mn < 35:
            grid[(x, y)] = 1
seen = set()
blobs = []
for p in grid:
    if p in seen:
        continue
    stack = [p]; seen.add(p)
    x0 = x1 = p[0]; y0 = y1 = p[1]; n = 0
    while stack:
        cx, cy = stack.pop(); n += 1
        x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
        for dx in (-step, 0, step):
            for dy in (-step, 0, step):
                q = (cx + dx, cy + dy)
                if q in grid and q not in seen:
                    seen.add(q); stack.append(q)
    if n * step * step > 350 and (x1 - x0) > 15 and (y1 - y0) > 12:
        blobs.append((x0, y0, x1, y1, n * step * step))
blobs.sort(key=lambda b: -b[4])
print("\n== shot_pelicans3.png white blobs (pelican bodies / UI) ==")
for x0, y0, x1, y1, a in blobs[:12]:
    # orange pixels inside/around blob (beak/bike)
    orange = 0
    for y in range(max(0, y0 - 8), min(h, y1 + 8), 2):
        for x in range(max(0, x0 - 8), min(w, x1 + 8), 2):
            r, g, b = px2[x, y]
            if r > 195 and 80 < g < 185 and b < 115:
                orange += 1
    print("  blob x%3d-%3d y%3d-%3d (w=%3d h=%3d area~%5d) orangeNear=%d" % (x0, x1, y0, y1, x1 - x0, y1 - y0, a, orange))

# 3x full upper play band for vision recheck
band = im2.crop((0, 0, w, int(h * 0.60)))
band.resize((band.width * 2, band.height * 2), Image.LANCZOS).save(os.path.join(OUT, "pelicans_upper_x2.png"))
print("saved pelicans_upper_x2.png", band.size)
