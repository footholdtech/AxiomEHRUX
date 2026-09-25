#!/usr/bin/env python3
"""Dev server for the prototype.

Not `python3 -m http.server`: the stdlib server sends no cache headers, so a
browser pins index.html and every edit appears to do nothing. This one sends
no-store on everything.
"""
import http.server, os, pathlib, socketserver

PORT = int(os.environ.get("PORT", "8791"))
ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args))


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {ROOT} at http://localhost:{PORT}/index.html")
    httpd.serve_forever()
