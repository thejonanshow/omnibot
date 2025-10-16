#!/usr/bin/env python3
"""
Qwen MCP Server with Ollama Integration
Provides local Qwen model access for coding swarm
"""

import os
import sys
import json
import time
import subprocess
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import queue

app = Flask(__name__)
CORS(app)

class QwenOllamaServer:
    def __init__(self):
        self.model_name = "qwen2.5:7b"
        self.ollama_url = "http://localhost:11434"
        self.is_ready = False
        self.startup_queue = queue.Queue()

        # Start Ollama service in background
        self.start_ollama_service()

        # Wait for Ollama to be ready
        self.wait_for_ollama()

    def start_ollama_service(self):
        """Start Ollama service in background"""
        def run_ollama():
            try:
                # Start Ollama serve
                subprocess.run(['ollama', 'serve'], check=True)
            except Exception as e:
                print(f"Error starting Ollama: {e}")
                self.startup_queue.put(False)

        ollama_thread = threading.Thread(target=run_ollama, daemon=True)
        ollama_thread.start()

    def wait_for_ollama(self):
        """Wait for Ollama service to be ready"""
        print("Waiting for Ollama service to start...")
        max_retries = 30
        retry_count = 0

        while retry_count < max_retries:
            try:
                response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
                if response.status_code == 200:
                    print("✅ Ollama service is ready")
                    self.is_ready = True
                    return True
            except:
                pass

            retry_count += 1
            time.sleep(2)
            print(f"Retry {retry_count}/{max_retries}...")

        print("❌ Ollama service failed to start")
        self.is_ready = False
        return False

    def ensure_model_loaded(self):
        """Ensure Qwen model is loaded"""
        if not self.is_ready:
            return False

        try:
            # Check if model is available
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=10)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [model['name'] for model in models]

                if self.model_name in model_names:
                    print(f"✅ Model {self.model_name} is available")
                    return True
                else:
                    print(f"⚠️  Model {self.model_name} not found, available models: {model_names}")
                    return False
        except Exception as e:
            print(f"Error checking model: {e}")
            return False

    def generate_response(self, message, conversation_history=None):
        """Generate response using Ollama Qwen model"""
        if not self.is_ready:
            return "Qwen service is not ready. Please try again."

        if not self.ensure_model_loaded():
            return "Qwen model is not available. Please check Ollama installation."

        try:
            # Prepare conversation context
            messages = []

            # Add conversation history
            if conversation_history:
                for msg in conversation_history[-5:]:  # Last 5 messages for context
                    if isinstance(msg, dict):
                        role = msg.get('role', 'user')
                        content = msg.get('content', '')
                        messages.append({"role": role, "content": content})

            # Add current message
            messages.append({"role": "user", "content": message})

            # Prepare request to Ollama
            payload = {
                "model": self.model_name,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_tokens": 2048
                }
            }

            # Make request to Ollama
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                result = response.json()
                return result.get('message', {}).get('content', 'No response generated')
            else:
                return f"Error generating response: {response.status_code}"

        except Exception as e:
            return f"Error calling Qwen model: {str(e)}"

# Initialize Qwen server
qwen_server = QwenOllamaServer()

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok' if qwen_server.is_ready else 'not_ready',
        'service': 'qwen_ollama_server',
        'model': qwen_server.model_name,
        'ollama_ready': qwen_server.is_ready
    })

@app.route('/qwen/chat', methods=['POST'])
def qwen_chat():
    """Main chat endpoint for Qwen"""
    try:
        data = request.json
        message = data.get('message', '')
        conversation = data.get('conversation', [])
        session_id = data.get('sessionId', 'default')

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        # Generate response using Qwen
        response_text = qwen_server.generate_response(message, conversation)

        return jsonify({
            'response': response_text,
            'provider': 'qwen_ollama',
            'model': qwen_server.model_name,
            'session_id': session_id
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/qwen/code', methods=['POST'])
def qwen_code():
    """Specialized coding endpoint"""
    try:
        data = request.json
        task = data.get('task', '')
        language = data.get('language', '')
        context = data.get('context', '')

        if not task:
            return jsonify({'error': 'No task provided'}), 400

        # Create specialized coding prompt
        coding_prompt = f"""You are Qwen, a specialized coding AI. Please implement the following task:

TASK: {task}
{f"LANGUAGE: {language}" if language else ""}
{f"CONTEXT: {context}" if context else ""}

Please provide:
1. Clean, well-commented code
2. Explanation of the implementation
3. Any additional notes or considerations

Focus on writing high-quality, production-ready code."""

        response_text = qwen_server.generate_response(coding_prompt)

        return jsonify({
            'code': response_text,
            'provider': 'qwen_ollama',
            'model': qwen_server.model_name,
            'task': task,
            'language': language
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/qwen/models', methods=['GET'])
def list_models():
    """List available models"""
    try:
        if not qwen_server.is_ready:
            return jsonify({'error': 'Ollama service not ready'}), 503

        response = requests.get(f"{qwen_server.ollama_url}/api/tags", timeout=10)
        if response.status_code == 200:
            models = response.json().get('models', [])
            return jsonify({
                'models': models,
                'current_model': qwen_server.model_name
            })
        else:
            return jsonify({'error': 'Failed to list models'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/qwen/status', methods=['GET'])
def status():
    """Get detailed status"""
    return jsonify({
        'service': 'qwen_ollama_server',
        'status': 'ok' if qwen_server.is_ready else 'not_ready',
        'model': qwen_server.model_name,
        'ollama_url': qwen_server.ollama_url,
        'model_loaded': qwen_server.ensure_model_loaded()
    })

if __name__ == '__main__':
    print("🚀 Starting Qwen Ollama MCP Server")
    print(f"Model: {qwen_server.model_name}")
    print(f"Ollama URL: {qwen_server.ollama_url}")
    print(f"Ready: {qwen_server.is_ready}")

    app.run(host='0.0.0.0', port=8000, debug=False)
