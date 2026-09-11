# -*- coding: utf-8 -*-
"""Pixel verification helper for pelican death review. Output goes to stdout."""
import sys
from PIL import Image

def white_mask(p):
    r, g, b = p[:3]
    return r >= 225 and g >= 225 and b >= 225

def strong_red(p):
    r, g, b = p[:3]
    return r >= 150 and g <= 90 and b <= 90 and (r - max(g, b)) >= 60

def dark_gray(p):
    r, g, b = p[:3]
    mx, mn = max(r, g, b), min(r, g, b)
    return 45 <= mx <= 125 and (mx - mn) <= 28

def strong_blue(p):
    r, g, b = p[:3]
    return b >= 130 and r <= 110 and (b - r) >= 45 and (b - g) >= 30

def clusters(img, mask, step=2, pad=12, min_size=6):
    """Very small BFS connected-component on subsampled grid."""
    w, h = img.size
    px = img.load()
    seen = [[False] * w for _ in range(h)]
    out = []
    from collections import deque
    for y in range(0, h, step):
        for x in range(0, w, step):
            if seen[y][x] or not mask(px[x, y]):
                continue
            q = deque([(x, y)])
            seen[y][x] = True
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx in (-step, 0, step):
                    for dy in (-step, 0, step):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and mask(px[nx, ny]):
                            seen[ny][nx] = True
                            q.append((nx, ny))
            if len(pts) >= min_size:
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                out.append((min(xs), min(ys), max(xs), max(ys), len(pts)))
    return out

def report(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    print("=" * 70)
    print(path, "size:", w, "x", h)
    for name, mask in (("WHITE", white_mask), ("STRONG_RED", strong_red),
                       ("DARK_GRAY", dark_gray), ("STRONG_BLUE", strong_blue)):
        cl = clusters(img, mask)
        cl.sort(key=lambda c: -c[4])
        print("-- %s clusters (x0,y0,x1,y1,pts), top 12:" % name)
        for c in cl[:12]:
            print("   (%d,%d)-(%d,%d) pts=%d  [y%%=%.1f%% x%%=%.1f%%]" % (
                c[0], c[1], c[2], c[3], c[4], 100.0 * c[1] / h, 100.0 * c[0] / w))

if __name__ == "__main__":
    for p in sys.argv[1:]:
        report(p)
