"""Development / LAN host server for the Tactical Survival FPS.

Usage
-----
    py server.py            # serves on http://127.0.0.1:8000/
    py server.py 8080       # serves on 8080 (walks forward if that port is busy)

Then open the printed URL in a browser.

Why a server is required
------------------------
index.html loads large binary assets from disk -- castle.glb, the weapon pack,
the zombie pack, images/backgroundsky.jpg and audio/firing.mp3. Opening the
page straight from the filesystem (file://) breaks all of them: Chrome blocks
cross-origin XHR for file:// URLs, so GLTFLoader never receives the model data
and the map, weapons and enemies silently fail to appear. Serving the folder
over HTTP makes every request same-origin and everything loads.

Binding to 0.0.0.0 (rather than 127.0.0.1) also lets other machines on the
same network open the game, which is what the LAN multiplayer mode needs.

No third-party packages and no build step are required.
"""

import http.server
import os
import socket
import socketserver
import sys

HOST = "0.0.0.0"
DEFAULT_PORT = 8000
PORT_SEARCH_RANGE = 20


class GameRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Static file handler with caching disabled, so code edits show on reload."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Default handler writes to stderr without flushing; make it immediate.
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


class ReusableThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Threaded HTTP server that releases its port cleanly on restart."""

    daemon_threads = True
    allow_reuse_address = True


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
        "No free port between %d and %d." % (start, start + PORT_SEARCH_RANGE - 1)
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


def main():
    requested = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    port = find_free_port(requested)

    # Always serve the folder this script lives in, never the caller's cwd.
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    with ReusableThreadingServer((HOST, port), GameRequestHandler) as httpd:
        print("Serving %s" % project_root, flush=True)
        print("Local:   http://127.0.0.1:%d/index.html" % port, flush=True)
        for address in local_ip_addresses():
            print("Sharing: http://%s:%d/index.html" % (address, port), flush=True)
        print("Press Ctrl+C to stop.", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
