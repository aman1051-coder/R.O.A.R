"""Preview the ROAR website on your computer: python tools/serve.py  ->  http://localhost:8790

Like `python -m http.server`, but tells the browser never to cache, so every
edit shows up on reload. Netlify handles caching properly for the live site.
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'website')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'ROAR preview: http://localhost:{PORT}  (Ctrl+C to stop)')
        httpd.serve_forever()
