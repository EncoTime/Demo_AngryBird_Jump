# -*- coding: utf-8 -*-
"""Relaxed white/cream blob detection for pelicans."""
import os
from PIL import Image

DEBUG = r"E:\ZCode\.zcode\workspace\Demo\Demo_man_jump\debug"
im2 = Image.open(os.path.join(DEBUG, "shot_pelicans3.png")).convert("RGB")
w, h = im2.size
px2 = im2.load()
step = 3
grid = {}
for y in range(0, h, step):
    for x in range(0, w, step):
        r, g, b = px2[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        if mx > 195 and mx - mn < 70 and b < r + 50:  # cream/white, not sky-blue
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
    if n * step * step > 300 and (x1 - x0) > 18 and (y1 - y0) > 14:
        blobs.append((x0, y0, x1, y1, n * step * step))
blobs.sort(key=lambda b: -b[4])
print("relaxed white/cream blobs in", im2.size, ":", len(blobs))
for x0, y0, x1, y1, a in blobs[:15]:
    orange = dark = 0
    for y in range(max(0, y0 - 10), min(h, y1 + 10), 2):
        for x in range(max(0, x0 - 10), min(w, x1 + 10), 2):
            r, g, b = px2[x, y]
            if r > 195 and 80 < g < 185 and b < 115:
                orange += 1
            if r < 80 and g < 80 and b < 80:
                dark += 1
    print("  blob x%3d-%3d y%3d-%3d (w=%3d h=%3d area~%5d) orangeNear=%3d darkNear=%3d" % (x0, x1, y0, y1, x1 - x0, y1 - y0, a, orange, dark))
