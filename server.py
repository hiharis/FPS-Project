"""
Local development HTTP server for ARCADE 2.0.

Serves the entire Website/ folder so the portal and games can be tested
locally with correct MIME types and cache headers.

Usage
-----
    py server.py              # serves on http://127.0.0.1:8000/
    py server.py 8080         # tries 8080, walks forward if busy
    py server.py --verbose    # logs every request

Why a server is required
------------------------
The game loads large binary assets (.glb, .gltf, .mp3). Opening index.html
directly via file:// breaks cross-origin XHR, so GLTFLoader never receives
the data and models silently fail to appear. Serving over HTTP makes every
request same-origin.

No third-party packages needed.
"""

import http.server
import os
import socket
import socketserver
import sys

# ---------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------
HOST = "0.0.0.0"
DEFAULT_PORT = 8000
PORT_SEARCH_RANGE = 20

# Correct MIME types for files Python's http.server doesn't know
EXTRA_MIME_TYPES = {
    ".glb":  "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".bin":  "application/octet-stream",
    ".js":   "application/javascript",
    ".mjs":  "application/javascript",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".mp3":  "audio/mpeg",
    ".ogg":  "audio/ogg",
    ".wav":  "audio/wav",
    ".mp4":  "video/mp4",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf":  "font/ttf",
    ".svg":  "image/svg+xml",
}

# Cache rules (matches what vercel.json will do in production)
CACHE_RULES = {
    ".html": "no-store",
    ".css":  "no-store",
    ".js":   "no-store",
    ".json": "no-store",
    ".md":   "no-store",
    ".py":   "no-store",
    ".glb":  "public, max-age=31536000, immutable",
    ".gltf": "public, max-age=31536000, immutable",
    ".bin":  "public, max-age=31536000, immutable",
    ".mp3":  "public, max-age=31536000, immutable",
    ".wav":  "public, max-age=31536000, immutable",
    ".ogg":  "public, max-age=31536000, immutable",
    ".jpg":  "public, max-age=31536000, immutable",
    ".jpeg": "public, max-age=31536000, immutable",
    ".png":  "public, max-age=31536000, immutable",
    ".webp": "public, max-age=31536000, immutable",
    ".svg":  "public, max-age=31536000, immutable",
    ".woff":  "public, max-age=31536000, immutable",
    ".woff2": "public, max-age=31536000, immutable",
}

VERBOSE = "--verbose" in sys.argv


# ---------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------
class GameRequestHandler(http.server.SimpleHTTPRequestHandler):

    # Route clean URLs to actual files
    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.path = "/portal/index.html"
        elif self.path == "/portal" or self.path == "/portal/":
            self.path = "/portal/index.html"
        elif self.path == "/game" or self.path == "/game/":
            self.path = "/games/fps-shooter/index.html"
        elif self.path.startswith("/FPS/portal/games/audio/"):
            self.path = self.path.replace("/FPS/portal/games/audio/", "/games/fps-shooter/audio/")
        elif self.path.startswith("/portal/games/audio/"):
            self.path = self.path.replace("/portal/games/audio/", "/games/fps-shooter/audio/")
        elif self.path.startswith("/FPS/games/audio/"):
            self.path = self.path.replace("/FPS/games/audio/", "/games/fps-shooter/audio/")
        super().do_GET()

    def guess_type(self, path):
        """Override MIME detection with our custom map first."""
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTRA_MIME_TYPES:
            return EXTRA_MIME_TYPES[ext]
        return super().guess_type(path)

    def end_headers(self):
        """Inject cache + CORS headers (no gzip — let browser handle it)."""
        ext = os.path.splitext(self.path)[1].lower()
        cache = CACHE_RULES.get(ext, "no-store")
        self.send_header("Cache-Control", cache)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, fmt, *args):
        """Quiet by default. Use --verbose to log every request."""
        if VERBOSE:
            sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
            sys.stdout.flush()


# ---------------------------------------------------------------
# Server class
# ---------------------------------------------------------------
class ReusableThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Threaded server that releases its port cleanly on restart."""
    daemon_threads = True
    allow_reuse_address = True


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
def port_is_free(port):
    """Return True when nothing is listening on the loopback at `port`."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return probe.connect_ex(("127.0.0.1", port)) != 0


def find_free_port(start):
    """Prefer `start`, walking forward until a free port is found."""
    for candidate in range(start, start + PORT_SEARCH_RANGE):
        if port_is_free(candidate):
            return candidate
    raise SystemExit(
        "No free port between %d and %d."
        % (start, start + PORT_SEARCH_RANGE - 1)
    )


def local_ip_addresses():
    """Best-effort list of this machine's non-loopback IPv4 addresses."""
    addresses = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        address = probe.getsockname()[0]
        probe.close()
        if not address.startswith("127."):
            addresses.append(address)
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = info[4][0]
            if address not in addresses and not address.startswith("127."):
                addresses.append(address)
    except socket.gaierror:
        pass
    return addresses


def print_banner(project_root, port):
    """Pretty startup banner."""
    line = "=" * 62
    print()
    print(line)
    print("  ARCADE 2.0  --  Local Development Server")
    print(line)
    print()
    print("  Serving:  %s" % project_root)
    print()
    print("  Portal:   http://127.0.0.1:%d/" % port)
    print("  Game:     http://127.0.0.1:%d/game/" % port)
    for address in local_ip_addresses():
        print("  LAN:      http://%s:%d/" % (address, port))
    print()
    print("  Press Ctrl+C to stop.")
    print(line)
    print()


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------
def main():
    # Parse port (skip --verbose if present)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    requested = int(args[0]) if args else DEFAULT_PORT
    port = find_free_port(requested)

    # Always serve the folder this script lives in
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    print_banner(project_root, port)

    with ReusableThreadingServer((HOST, port), GameRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()