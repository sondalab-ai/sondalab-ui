#!/usr/bin/env python3
"""Serve the repo with caching off.

python3 -m http.server sends no cache headers, so Chrome caches the kit's
stylesheets and ES modules for the session. That has twice produced a false
reading here: a page served the OLD glass.css beside NEW uniforms, which
looked like a broken material, and once served an old shader beside a new
uniform layout, which looked like a broken pipeline. A probe that lies about
which code it is running is worse than no probe.

    python3 lab/_serve.py [port]      # default 8891, from the repo root
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8891
    print(f"serving {sys.path[0] or '.'} on http://localhost:{port} with caching off")
    ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
