# -*- coding: utf-8 -*-
"""Locate colored card blobs & pelican blobs via full-image classification."""
import os
from PIL import Image

DEBUG = r"E:\ZCode\.zcode\workspace\Demo\Demo_man_jump\debug"

def classify(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 60:
        return None
    if mx - mn < 25:
        return None
    if r > g and b > g and abs(r - b) < 70 and r > 90 and g < 120:
        return "PURPLE"
    if r > 150 and g > 95 and b < 95:
        return "GOLD"
    if b > 130 and b > r + 30 and g > 80 and g < b + 20:
        return "BLUE"
    return None

def blobs(img, step=3, min_blob=200):
    w, h = img.size
    px = img.load()
    # per-row ranges per class -> then merge vertically
    boxes = {}  # cls -> list of [x0,y0,x1,y1,count]
    grid = {}
    for y in range(0, h, step):
        for x in range(0, w, step):
            c = classify(*px[x, y][:3])
            if c:
                grid[(x, y)] = c
    # union-find lite: BFS over grid cells
    seen = set()
    for (x, y), c in grid.items():
        if (x, y) in seen:
            continue
        stack = [(x, y)]
        seen.add((x, y))
        x0 = x1 = x; y0 = y1 = y; n = 0
        while stack:
            cx, cy = stack.pop()
            n += 1
            x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
            for dx in (-step, 0, step):
                for dy in (-step, 0, step):
                    p = (cx + dx, cy + dy)
                    if p in grid and p not in seen and grid[p] == c:
                        seen.add(p); stack.append(p)
        if n * step * step >= min_blob:
            boxes.setdefault(c, []).append((x0, y0, x1, y1, n * step * step))
    return boxes

for name in ("shot_ads_debuff.png", "shot_pelicans3.png"):
    im = Image.open(os.path.join(DEBUG, name)).convert("RGB")
    print("\n=====", name, im.size, "=====")
    for c, bl in sorted(blobs(im).items()):
        bl.sort(key=lambda b: (b[0], b[1]))
        print(" class", c, "blobs:", len(bl))
        for x0, y0, x1, y1, area in bl:
            print("   box x%3d-%3d y%3d-%3d  (w=%3d h=%3d area~%d)" % (x0, x1, y0, y1, x1 - x0, y1 - y0, area))
