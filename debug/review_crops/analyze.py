# -*- coding: utf-8 -*-
"""Pixel-level verification for debuff ad cards & 3-pelican screenshot."""
import os
from PIL import Image

DEBUG = r"E:\ZCode\.zcode\workspace\Demo\Demo_man_jump\debug"
OUT = os.path.join(DEBUG, "review_crops")
os.makedirs(OUT, exist_ok=True)

def hexc(c):
    return "#%02X%02X%02X" % c[:3]

def classify(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 60:
        return "near-black"
    if mx - mn < 22:
        return "gray/white" if mx > 150 else "dark-gray"
    if r > g and b > g and abs(r - b) < 60 and r > 90 and g < 110:
        return "PURPLE"
    if r > 140 and g > 90 and b < 90:
        return "GOLD/ORANGE"
    if b > 130 and b > r + 30 and g > 80:
        return "BLUE"
    if r > 170 and g < 110 and b < 110:
        return "RED"
    if g > 130 and g > r + 30 and g > b + 30:
        return "GREEN"
    return "other"

def column_profile(img, label, x_frac):
    w, h = img.size
    x = int(w * x_frac)
    px = img.load()
    prev = None
    print("\n=== %s vertical color profile at x=%d/%d (%.0f%%) ===" % (label, x, w, x_frac * 100))
    runs = []
    for y in range(0, h, 2):
        r, g, b = px[x, y][:3]
        cat = classify(r, g, b)
        if cat != prev:
            runs.append([y, y, cat, hexc((r, g, b))])
            prev = cat
        else:
            runs[-1][1] = y
    # merge tiny runs, print meaningful bands (>=14px)
    merged = []
    for s, e, c, hx in runs:
        if merged and c == merged[-1][2]:
            merged[-1][1] = e
        elif e - s < 14 and merged and c not in ("PURPLE", "GOLD/ORANGE", "BLUE"):
            # noise/antialias band: absorb into previous
            merged[-1][1] = e
        else:
            merged.append([s, e, c, hx])
    for s, e, c, hx in merged:
        if e - s >= 14 or c in ("PURPLE", "GOLD/ORANGE", "BLUE", "RED"):
            print("  y %4d-%4d h=%3d  %-12s %s" % (s, e, e - s + 1, c, hx))

def dominant_in_box(img, x0, y0, x1, y1):
    px = img.load()
    counts = {}
    for y in range(y0, y1, 4):
        for x in range(x0, x1, 4):
            c = classify(*px[x, y][:3])
            counts[c] = counts.get(c, 0) + 1
    total = sum(counts.values()) or 1
    return sorted(counts.items(), key=lambda kv: -kv[1])[:4], total

# ---------- screenshot 1: ads debuff ----------
p1 = os.path.join(DEBUG, "shot_ads_debuff.png")
im1 = Image.open(p1).convert("RGB")
w, h = im1.size
print("shot_ads_debuff.png size:", im1.size)
column_profile(im1, "LEFT ad rail", 0.05)
column_profile(im1, "RIGHT ad rail", 0.95)

# dominant colors inside detected card bands (manual boxes from profile above get printed generically)
# full-rail crops upscaled x3 for text re-check
left = im1.crop((0, 0, int(w * 0.17), h))
right = im1.crop((int(w * 0.83), 0, w, h))
left.resize((left.width * 3, left.height * 3), Image.LANCZOS).save(os.path.join(OUT, "rail_left_x3.png"))
right.resize((right.width * 3, right.height * 3), Image.LANCZOS).save(os.path.join(OUT, "rail_right_x3.png"))
print("\nsaved rail_left_x3.png", left.size, "-> x3; rail_right_x3.png", right.size, "-> x3")

# ---------- screenshot 2: 3 pelicans ----------
p2 = os.path.join(DEBUG, "shot_pelicans3.png")
im2 = Image.open(p2).convert("RGB")
w2, h2 = im2.size
print("\nshot_pelicans3.png size:", im2.size)
# upper-middle play region where pelicans fly
band = im2.crop((int(w2 * 0.15), 0, int(w2 * 0.85), int(h2 * 0.55)))
band.resize((band.width * 2, band.height * 2), Image.LANCZOS).save(os.path.join(OUT, "pelicans_band_x2.png"))
print("saved pelicans_band_x2.png from", band.size)

# white-blob row scan to estimate pelican bodies across full width (white body + orange beak + red frame)
px2 = im2.load()
for name, y0, y1 in [("upper", int(h2*0.05), int(h2*0.35)), ("mid", int(h2*0.35), int(h2*0.60))]:
    # count columns whose window contains strong orange (beak/bike) clusters
    cols = []
    for x in range(0, w2, 8):
        hits = 0
        for y in range(y0, y1, 3):
            r, g, b = px2[x, y][:3]
            if r > 200 and 90 < g < 190 and b < 110:  # orange
                hits += 1
        if hits >= 3:
            cols.append(x)
    # group adjacent columns
    groups = []
    for x in cols:
        if groups and x - groups[-1][1] <= 24:
            groups[-1][1] = x
        else:
            groups.append([x, x])
    print("%s band y%d-%d orange clusters: %d groups -> %s" % (name, y0, y1, len(groups), groups))
