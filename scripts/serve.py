"""Simple HTTP server for ProfScout development."""
import http.server
import os
import sys
from pathlib import Path


def main():
    port = 8080
    public_dir = Path(__file__).resolve().parent.parent / "public"
    os.chdir(public_dir)
    
    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map.update({
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
    })
    
    server = http.server.HTTPServer(('0.0.0.0', port), handler)
    print(f"ProfScout dev server running at http://localhost:{port}")
    print(f"Serving from: {public_dir}")
    print("Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == '__main__':
    main()
