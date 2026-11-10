# Builds the ROAR logo files from exact geometry.
# The O is a linac gantry: five treatment beams (weighted, like an IMRT plan) converge on the isocentre.
import math, os, json, sys

# Usage: python tools/make_logo.py website   (rewrites favicon.svg and assets/logo/*.svg;
# paste the printed inline versions into js/layout.js and council/index.html if the shapes change)
OUT = sys.argv[1] if len(sys.argv) > 1 else "website"
NAVY, AMBER, AMBER_L = '#15233f', '#e8792b', '#f3a76d'

R_GLYPH = ('M0 0H106A64 64 0 0 1 132 122L176 200H124L84 128H46V200H0Z'
           'M46 44H104A20 20 0 0 1 104 84H46Z')
A_GLYPH = 'M0 200L74 0H126L200 200H150L135 158H65L50 200ZM79 118H121L100 58Z'

def translate(path, dx):
    # shift absolute x coordinates of our simple paths (M, H, L, A, V, Z only)
    out, tokens = [], []
    import re
    for cmd, args in re.findall(r'([MHLAVZ])([^MHLAVZ]*)', path):
        nums = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', args)]
        if cmd in 'ML': nums = [n + dx if i % 2 == 0 else n for i, n in enumerate(nums)]
        elif cmd == 'H': nums = [n + dx for n in nums]
        elif cmd == 'A': nums = [n + dx if i % 7 == 5 else n for i, n in enumerate(nums)]
        out.append(cmd + ' '.join(fmt(n) for n in nums))
    return ''.join(out)

def fmt(n): return ('%.2f' % n).rstrip('0').rstrip('.')

def wedge(cx, cy, ang, r1, r2, w1, w2):
    a = math.radians(ang)
    ux, uy = math.sin(a), -math.cos(a)          # outward direction (0 deg = straight up)
    px, py = -uy, ux                            # perpendicular
    pts = [(cx + ux * r1 + px * w1, cy + uy * r1 + py * w1), (cx + ux * r2 + px * w2, cy + uy * r2 + py * w2),
           (cx + ux * r2 - px * w2, cy + uy * r2 - py * w2), (cx + ux * r1 - px * w1, cy + uy * r1 - py * w1)]
    return 'M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts) + 'Z'

# Beam angles and weights: top, the two laterals, and two posterior obliques
BEAMS = [(0, 1.0), (90, .9), (270, .9), (140, .62), (220, .62)]

def mark(cx, cy, ink, ring='currentColor', small=False):
    """The gantry O. ink = colour of the crosshair; ring = colour of the ring."""
    s = []
    for ang, w in BEAMS:
        s.append(f'<path d="{wedge(cx, cy, ang, 108, 147, 7, 18)}" fill="{AMBER}" fill-opacity="{w}"/>')
    s.append(f'<path fill="{ring}" fill-rule="evenodd" d="M{fmt(cx - 102)} {fmt(cy)}a102 102 0 1 0 204 0a102 102 0 1 0-204 0Z'
             f'M{fmt(cx - 62)} {fmt(cy)}a62 62 0 1 0 124 0a62 62 0 1 0-124 0Z"/>')
    if not small:
        for ang, w in BEAMS:
            s.append(f'<path d="{wedge(cx, cy, ang, 15, 57, 1, 5)}" fill="{AMBER}" fill-opacity="{min(1, w + .1)}"/>')
        s.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="31" fill="none" stroke="{AMBER}" stroke-opacity=".45" stroke-width="2.5" stroke-dasharray="5 6"/>')
    s.append(f'<path d="M{fmt(cx - 24)} {fmt(cy)}H{fmt(cx + 24)}M{fmt(cx)} {fmt(cy - 24)}V{fmt(cy + 24)}" stroke="{ink}" stroke-width="{6 if small else 4.5}" stroke-linecap="round"/>')
    s.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{13 if small else 10}" fill="{AMBER}"/>')
    return ''.join(s)

OX = 313
def wordmark(ink):
    return (f'<path fill="{ink}" fill-rule="evenodd" d="{R_GLYPH}{translate(A_GLYPH, 465)}{translate(R_GLYPH, 691)}"/>'
            + mark(OX, 100, ink, ink))

WM_BOX = '-6 -56 880 282'   # x y w h

def lockup(ink, sub):
    t = f'font-family="Inter, \'Helvetica Neue\', Arial, sans-serif" font-weight="500" font-size="31" letter-spacing="7.4" fill="{sub}" text-anchor="middle"'
    return (wordmark(ink)
            + f'<rect x="0" y="262" width="867" height="5" rx="2.5" fill="{ink}"/>'
            + f'<text x="434" y="326" {t}>RISING ONCOLOGISTS’ ALLIANCE</text>'
            + f'<text x="434" y="372" {t}>IN RADIATION ONCOLOGY · INDIA</text>')

TITLE = "ROAR: Rising Oncologists’ Alliance in Radiation Oncology"
def svg(box, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" role="img" aria-label="{TITLE}"{extra}><title>{TITLE}</title>{body}</svg>\n'

os.makedirs(os.path.join(OUT, 'assets', 'logo'), exist_ok=True)
W = lambda name, text: open(os.path.join(OUT, name), 'w', encoding='utf8').write(text)
W('assets/logo/roar-logo.svg', svg('-30 -76 920 490', lockup(NAVY, NAVY)))
W('assets/logo/roar-logo-white.svg', svg('-30 -76 920 490', lockup('#ffffff', '#ffffff')))
W('assets/logo/roar-logo-on-navy.svg', svg('-60 -110 980 560', f'<rect x="-60" y="-110" width="980" height="560" fill="{NAVY}"/>' + lockup('#ffffff', '#ffffff')))
W('assets/logo/roar-wordmark.svg', svg(WM_BOX, wordmark(NAVY)))
W('assets/logo/roar-mark.svg', svg('148 -65 330 330', mark(OX, 100, NAVY, NAVY)))
# Favicon / app icon: the gantry on a navy tile, simplified for small sizes
fav = (f'<rect x="148" y="-65" width="330" height="330" rx="74" fill="{NAVY}"/>' + mark(OX, 100, '#ffffff', '#ffffff', small=True))
W('favicon.svg', svg('148 -65 330 330', fav))
# Inline version for the site header and footer (letters follow the text colour, so it works in both themes)
inline = f'<svg class="logo-svg" viewBox="{WM_BOX}" aria-hidden="true" focusable="false">' + wordmark('currentColor') + '</svg>'
print(inline)
inline_lockup = f'<svg class="logo-svg" viewBox="-6 -56 880 440" aria-hidden="true" focusable="false">' + lockup('currentColor', 'currentColor') + '</svg>'
print(inline_lockup)
print('ok', len(inline), len(inline_lockup))
