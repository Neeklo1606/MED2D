"""Раздаёт viewer.html, three из node_modules и папку с GLB: python3 tools/3d/serve.py <glb_dir> [port]."""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(ROOT))
GLB = os.path.abspath(sys.argv[1])
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765


class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split("?")[0]
        if p.startswith("/glb/"):
            return os.path.join(GLB, p[5:])
        if p.startswith("/three/"):
            return os.path.join(REPO, "node_modules", "three", p[7:])
        return os.path.join(ROOT, "viewer.html")

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
