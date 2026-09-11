# -*- coding: utf-8 -*-
"""Anchor on orange clusters, cut tight crops, build a labeled contact sheet."""
import os
from PIL import Image, ImageDraw

DEBUG = r"E:\ZCode\.zcode\workspace\Demo\Demo_man_jump\debug"
OUT = os.path.join(DEBUG, "review_crops")
im = Image.open(os.path.join(DEBUG, "shot_pelicans3.png")).convert("RGB")
w, h = im.size
px = im.load()

def orange_map():
    m = {}
    for y in range(0, h):
        for x in range(0, w):
            r, g, b = px[x, y]
            if r > 195 and 80 < g < 185 and b < 115:
                m[(x, y)] = 1
    return m

m = orange_map()
# cluster via row/col projection: find connected clusters with BFS on dict
seen = set()
clusters = []
for p in m:
    if p in seen:
        continue
    stack = [p]; seen.add(p)
    x0 = x1 = p[0]; y0 = y1 = p[1]; n = 0
    while stack:
        cx, cy = stack.pop(); n += 1
        x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                q = (cx + dx, cy + dy)
                if q in m and q not in seen:
                    seen.add(q); stack.append(q)
    if n > 40:
        clusters.append((x0, y0, x1, y1, n))
clusters.sort(key=lambda c: -c[4])
print("orange clusters (n>40):")
for c in clusters:
    print("  x%3d-%3d y%3d-%3d px=%d" % c[:5])

# tight crops with margin around top clusters (candidates for pelicans)
crops = []
for i, (x0, y0, x1, y1, n) in enumerate(clusters[:6]):
    mx, my = 45, 40
    box = (max(0, x0 - mx), max(0, y0 - my), min(w, x1 + mx), min(h, y1 + my))
    c = im.crop(box)
    scale = 3 if max(c.size) < 260 else 2
    c = c.resize((c.width * scale, c.height * scale), Image.LANCZOS)
    crops.append((i, box, c, scale))

# contact sheet: stack vertically with label bars
pad, labelh = 10, 26
W = max(c.width for _, _, c, _ in crops) + pad * 2
H = sum(c.height + labelh + pad for _, _, c, _ in crops) + pad
sheet = Image.new("RGB", (W, H), (255, 255, 255))
d = ImageDraw.Draw(sheet)
y = pad
for i, box, c, scale in crops:
    d.text((pad, y + 6), "REGION %d  src-box=%s  x%d" % (i, box, scale), fill=(0, 0, 0))
    y += labelh
    sheet.paste(c, (pad, y))
    d.rectangle([pad - 1, y - 1, pad + c.width, y + c.height], outline=(200, 0, 0))
    y += c.height + pad
sheet.save(os.path.join(OUT, "pelican_candidates_sheet.png"))
print("saved pelican_candidates_sheet.png", sheet.size)
