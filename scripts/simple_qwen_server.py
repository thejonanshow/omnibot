#!/usr/bin/env python3
"""
Simple Qwen Server for Testing
A minimal HTTP server that responds to Qwen requests
"""

import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

class QwenHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "qwen-server",
                "timestamp": int(time.time()),
                "model": "qwen2.5:7b"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')

    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                message = data.get('message', '')
                
                # Simulate Qwen response
                response = {
                    "response": f"Qwen response to: {message}",
                    "model": "qwen2.5:7b",
                    "timestamp": int(time.time()),
                    "status": "success"
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_response = {
                    "error": str(e),
                    "status": "error"
                }
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')

    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

def start_server():
    """Start the Qwen server"""
    server = HTTPServer(('0.0.0.0', 8000), QwenHandler)
    print("🚀 Qwen server starting on port 8000...")
    print("✅ Health check: http://localhost:8000/health")
    print("✅ Chat endpoint: http://localhost:8000/chat")
    server.serve_forever()

if __name__ == '__main__':
    start_server()
