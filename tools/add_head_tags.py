# Adds the app manifest, home-screen icon, theme colour and link-preview tags to every page's <head>.
# Safe to run again: pages that already have them are skipped.
import glob, os, re
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'website'))
OG = 'https://aman1051-coder.github.io/R.O.A.R/assets/og-image.png'
n = 0
for p in glob.glob('*.html') + glob.glob('*/index.html'):
    s = open(p, encoding='utf8').read()
    if 'rel="manifest"' in s:
        continue
    root = '../' if os.sep in p or '/' in p else ''
    m = re.search(r'\s*<link rel="icon" href="[^"]*favicon\.svg" type="image/svg\+xml">', s)
    if not m:
        print('no favicon link:', p); continue
    tags = (f'\n  <link rel="manifest" href="{root}manifest.webmanifest">'
            f'\n  <link rel="apple-touch-icon" href="{root}assets/icons/apple-touch-icon.png">'
            f'\n  <meta name="theme-color" content="#15233f">'
            f'\n  <meta name="apple-mobile-web-app-title" content="ROAR">')
    if 'og:image' not in s:
        tags += (f'\n  <meta property="og:image" content="{OG}">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">'
                 f'\n  <meta property="og:type" content="website">\n  <meta name="twitter:card" content="summary_large_image">')
    s = s[:m.end()] + tags + s[m.end():]
    s = s.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',
                  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
    open(p, 'w', encoding='utf8').write(s)
    n += 1
print(n, 'pages updated')
