from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import subprocess
import json
import os
import tempfile
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import logging

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

# Security: Allowed commands for execution
ALLOWED_COMMANDS = [
    'ls', 'pwd', 'cat', 'grep', 'find', 'git', 'npm', 'node', 'python', 'python3',
    'curl', 'wget', 'mkdir', 'rmdir', 'touch', 'echo', 'head', 'tail', 'wc',
    'ps', 'top', 'df', 'du', 'free', 'uname', 'whoami', 'date', 'uptime'
]

@app.route('/health')
def health():
    whisper_ok = False
    tts_ok = False

    try:
        r = requests.get('http://localhost:9000/health', timeout=2)
        whisper_ok = r.ok
    except: pass

    try:
        r = requests.get('http://localhost:9001/health', timeout=2)
        tts_ok = r.ok
    except: pass

    return {
        'status': 'ok',
        'whisper': whisper_ok,
        'tts': tts_ok,
        'capabilities': ['voice', 'command_execution', 'web_browsing', 'file_operations']
    }

# Voice endpoints (existing)
@app.route('/stt/whisper', methods=['POST'])
def stt():
    r = requests.post('http://localhost:9000/stt/whisper', data=request.data)
    return r.json(), r.status_code

@app.route('/tts/piper', methods=['POST'])
@app.route('/tts/edge', methods=['POST'])
def tts():
    r = requests.post('http://localhost:9001/tts/piper', json=request.json)
    return r.content, r.status_code, {'Content-Type': 'audio/mpeg'}

# New function calling endpoints
@app.route('/execute', methods=['POST'])
def execute_command():
    """Execute shell commands safely"""
    try:
        data = request.json
        command = data.get('command', '')
        working_dir = data.get('working_directory', '/workspace')

        if not command:
            return jsonify({'error': 'No command provided'}), 400

        # Security check
        command_parts = command.split()
        base_command = command_parts[0] if command_parts else ''

        if base_command not in ALLOWED_COMMANDS:
            return jsonify({
                'error': f'Command "{base_command}" not allowed',
                'allowed_commands': ALLOWED_COMMANDS
            }), 403

        # Execute command
        result = subprocess.run(
            command,
            shell=True,
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=30
        )

        return jsonify({
            'stdout': result.stdout,
            'stderr': result.stderr,
            'exit_code': result.returncode,
            'command': command
        })

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Command timed out after 30 seconds'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/browse', methods=['POST'])
def browse_web():
    """Browse web pages and interact with them"""
    try:
        data = request.json
        url = data.get('url', '')
        action = data.get('action', 'get')
        selector = data.get('selector')
        text = data.get('text')

        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            try:
                page.goto(url, timeout=10000)

                if action == 'get':
                    content = page.content()
                    title = page.title()
                    # Extract text content for easier processing
                    soup = BeautifulSoup(content, 'html.parser')
                    text_content = soup.get_text()

                    return jsonify({
                        'content': content,
                        'text_content': text_content,
                        'title': title,
                        'url': page.url,
                        'status': 'success'
                    })

                elif action == 'click' and selector:
                    page.click(selector)
                    return jsonify({
                        'success': True,
                        'action': 'clicked',
                        'selector': selector,
                        'url': page.url
                    })

                elif action == 'type' and selector and text:
                    page.fill(selector, text)
                    return jsonify({
                        'success': True,
                        'action': 'typed',
                        'selector': selector,
                        'text': text,
                        'url': page.url
                    })

                elif action == 'screenshot':
                    screenshot = page.screenshot()
                    return jsonify({
                        'success': True,
                        'action': 'screenshot',
                        'screenshot_size': len(screenshot),
                        'url': page.url
                    })

                else:
                    return jsonify({'error': 'Invalid action or missing parameters'}), 400

            except Exception as e:
                return jsonify({'error': f'Browser error: {str(e)}'}), 500
            finally:
                browser.close()

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/read_file', methods=['POST'])
def read_file():
    """Read file contents"""
    try:
        data = request.json
        path = data.get('path', '')

        if not path:
            return jsonify({'error': 'No file path provided'}), 400

        # Security: prevent directory traversal
        if '..' in path or path.startswith('/'):
            return jsonify({'error': 'Invalid file path'}), 403

        with open(path, 'r') as f:
            content = f.read()

        return jsonify({
            'content': content,
            'path': path,
            'size': len(content)
        })

    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/write_file', methods=['POST'])
def write_file():
    """Write content to file"""
    try:
        data = request.json
        path = data.get('path', '')
        content = data.get('content', '')

        if not path:
            return jsonify({'error': 'No file path provided'}), 400

        # Security: prevent directory traversal
        if '..' in path or path.startswith('/'):
            return jsonify({'error': 'Invalid file path'}), 403

        with open(path, 'w') as f:
            f.write(content)

        return jsonify({
            'success': True,
            'path': path,
            'size': len(content)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/list_files', methods=['POST'])
def list_files():
    """List files in directory"""
    try:
        data = request.json
        path = data.get('path', '.')

        # Security: prevent directory traversal
        if '..' in path:
            return jsonify({'error': 'Invalid path'}), 403

        files = []
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            files.append({
                'name': item,
                'is_directory': os.path.isdir(item_path),
                'size': os.path.getsize(item_path) if os.path.isfile(item_path) else 0
            })

        return jsonify({
            'files': files,
            'path': path
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
