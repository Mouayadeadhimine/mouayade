"""Local preview server with HTTP Range support (needed for video seeking).
Usage: python3 serve.py [port]  ->  http://localhost:8765/player.html"""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        m = re.match(r"bytes=(\d+)-(\d*)$", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start, end = int(m[1]), min(int(m[2] or size - 1), size - 1)
        if start >= size:
            self.send_error(416)
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.range_left = end - start + 1
        return f

    def copyfile(self, src, dst):
        left = getattr(self, "range_left", None)
        if left is None:
            return super().copyfile(src, dst)
        while left > 0 and (chunk := src.read(min(65536, left))):
            dst.write(chunk)
            left -= len(chunk)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"http://localhost:{port}/player.html")
    ThreadingHTTPServer(("", port), RangeHandler).serve_forever()
