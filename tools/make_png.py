# Draws ROAR's PNG images (app icons and the link-preview image) from the logo's exact geometry,
# using only the Python standard library (no image packages needed).
# Usage: python tools/make_png.py      -> website/assets/icons/*.png and website/assets/og-image.png
import math, os, struct, zlib, re

ROOT = os.path.join(os.path.dirname(__file__), '..', 'website')
NAVY, AMBER, WHITE = (0x15, 0x23, 0x3f), (0xe8, 0x79, 0x2b), (255, 255, 255)

# ---------------------------------------------------------------- geometry (same as tools/make_logo.py)
R_GLYPH = 'M0 0H106A64 64 0 0 1 132 122L176 200H124L84 128H46V200H0Z M46 44H104A20 20 0 0 1 104 84H46Z'
A_GLYPH = 'M0 200L74 0H126L200 200H150L135 158H65L50 200Z M79 118H121L100 58Z'
OX, OY = 313, 100
BEAMS = [(0, 1.0), (90, .9), (270, .9), (140, .62), (220, .62)]

def arc_points(x1, y1, rx, ry, large, sweep, x2, y2, n=28):
    # SVG endpoint arc -> centre parameterisation (circular arcs, no rotation)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    r = rx
    lam = (dx * dx + dy * dy) / (r * r)
    if lam > 1: r *= math.sqrt(lam)
    sign = -1 if large == sweep else 1
    sq = max(0, (r * r * r * r - r * r * dy * dy - r * r * dx * dx) / (r * r * dy * dy + r * r * dx * dx))
    co = sign * math.sqrt(sq)
    cxp, cyp = co * dy, -co * dx
    cx, cy = cxp + (x1 + x2) / 2, cyp + (y1 + y2) / 2
    a1 = math.atan2((y1 - cy) / r, (x1 - cx) / r)
    a2 = math.atan2((y2 - cy) / r, (x2 - cx) / r)
    da = a2 - a1
    if sweep and da < 0: da += 2 * math.pi
    if not sweep and da > 0: da -= 2 * math.pi
    return [(cx + r * math.cos(a1 + da * i / n), cy + r * math.sin(a1 + da * i / n)) for i in range(1, n + 1)]

def path_polys(d, dx=0):
    polys, cur, x, y = [], [], 0, 0
    for cmd, args in re.findall(r'([MHLAVZ])([^MHLAVZ]*)', d):
        n = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', args)]
        if cmd == 'M': x, y = n[0], n[1]; cur = [(x, y)]
        elif cmd == 'L': x, y = n[0], n[1]; cur.append((x, y))
        elif cmd == 'H': x = n[0]; cur.append((x, y))
        elif cmd == 'V': y = n[0]; cur.append((x, y))
        elif cmd == 'A':
            cur += arc_points(x, y, n[0], n[1], int(n[3]), int(n[4]), n[5], n[6]); x, y = n[5], n[6]
        elif cmd == 'Z':
            polys.append([(px + dx, py) for px, py in cur]); cur = []
    return polys

def circle(cx, cy, r, n=96): return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
def wedge(ang, r1, r2, w1, w2, cx=OX, cy=OY):
    a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); px, py = -uy, ux
    return [(cx + ux * r1 + px * w1, cy + uy * r1 + py * w1), (cx + ux * r2 + px * w2, cy + uy * r2 + py * w2),
            (cx + ux * r2 - px * w2, cy + uy * r2 - py * w2), (cx + ux * r1 - px * w1, cy + uy * r1 - py * w1)]
def rect(x0, y0, x1, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

def mark_shapes(ink, small=False):
    s = [([wedge(a, 108, 147, 7, 18)], AMBER, w) for a, w in BEAMS]
    s.append(([circle(OX, OY, 102), circle(OX, OY, 62)], ink, 1))
    if not small:
        s += [([wedge(a, 15, 57, 1, 5)], AMBER, min(1, w + .1)) for a, w in BEAMS]
    t = 3 if small else 2.25
    s.append(([rect(OX - 24, OY - t, OX + 24, OY + t)], ink, 1))
    s.append(([rect(OX - t, OY - 24, OX + t, OY + 24)], ink, 1))
    s.append(([circle(OX, OY, 13 if small else 10, 48)], AMBER, 1))
    return s

def letters(ink):
    return [(path_polys(R_GLYPH), ink, 1), (path_polys(A_GLYPH, 465), ink, 1), (path_polys(R_GLYPH, 691), ink, 1)]

# ---------------------------------------------------------------- rasteriser (scanline, even-odd, 4x vertical supersampling)
def render(W, H, bg, shapes, tf):
    px = [list(bg) for _ in range(W * H)]
    SS = 4
    for polys, col, op in shapes:
        cov = [0.0] * (W * H)
        edges = []
        for poly in polys:
            pts = [tf(p) for p in poly]
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
                if y0 != y1: edges.append((x0, y0, x1, y1))
        if not edges: continue
        ymin = max(0, int(min(min(e[1], e[3]) for e in edges)))
        ymax = min(H - 1, int(max(max(e[1], e[3]) for e in edges)) + 1)
        for py in range(ymin, ymax + 1):
            for s in range(SS):
                sy = py + (s + .5) / SS
                xs = []
                for x0, y0, x1, y1 in edges:
                    if (y0 <= sy < y1) or (y1 <= sy < y0):
                        xs.append(x0 + (sy - y0) * (x1 - x0) / (y1 - y0))
                xs.sort()
                for i in range(0, len(xs) - 1, 2):
                    a, b = max(0.0, xs[i]), min(float(W), xs[i + 1])
                    if b <= a: continue
                    ia, ib = int(a), int(b)
                    row = py * W
                    if ia == ib:
                        cov[row + ia] += (b - a) / SS; continue
                    cov[row + ia] += (ia + 1 - a) / SS
                    for x in range(ia + 1, min(ib, W)):
                        cov[row + x] += 1 / SS
                    if ib < W: cov[row + ib] += (b - ib) / SS
        for i, c in enumerate(cov):
            if c <= 0: continue
            al = min(1.0, c) * op
            p = px[i]
            px[i] = [p[k] + (col[k] - p[k]) * al for k in range(3)]
    return px

def write_png(path, W, H, px, alpha=None):
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        for x in range(W):
            p = px[y * W + x]
            raw += bytes(int(max(0, min(255, round(v)))) for v in p)
            if alpha is not None: raw.append(alpha[y * W + x])
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6 if alpha is not None else 2, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(data)
    print('wrote', os.path.relpath(path, ROOT), len(data) // 1024, 'KB')

def rounded_alpha(W, H, r):
    a = []
    for y in range(H):
        for x in range(W):
            dx = max(r - x - .5, 0, x + .5 - (W - r)); dy = max(r - y - .5, 0, y + .5 - (H - r))
            d = math.hypot(dx, dy) if dx and dy else 0
            a.append(255 if d <= r - 1 else 0 if d >= r else int(255 * (r - d)))
    return a

def icon(size, maskable=False, rounded=True):
    # The gantry mark on a navy tile. Maskable icons keep the mark inside the central safe zone.
    span = 330 * (1.35 if maskable else 1.0)
    k = size / span
    off = (span - 330) / 2
    tf = lambda p: ((p[0] - 148 + off) * k, (p[1] + 65 + off) * k)
    px = render(size, size, NAVY, mark_shapes(WHITE, small=size < 100), tf)
    alpha = rounded_alpha(size, size, size * 74 / 330) if rounded and not maskable else None
    return px, alpha

for name, size, mask, rnd in [('icon-192.png', 192, False, True), ('icon-512.png', 512, False, True),
                              ('icon-maskable-512.png', 512, True, False), ('apple-touch-icon.png', 180, False, False)]:
    px, alpha = icon(size, mask, rnd)
    write_png(os.path.join(ROOT, 'assets', 'icons', name), size, size, px, alpha)

# Link preview (WhatsApp, LinkedIn, X): the white wordmark on navy with an amber rule
W, H = 1200, 630
k = 760 / 880
tf = lambda p: ((p[0] + 6) * k + (W - 760) / 2, (p[1] + 56) * k + 150)
shapes = letters(WHITE) + mark_shapes(WHITE)
shapes.append(([[(-6, 300), (874, 300), (874, 306), (-6, 306)]], AMBER, 1))
px = render(W, H, NAVY, shapes, tf)
write_png(os.path.join(ROOT, 'assets', 'og-image.png'), W, H, px)
