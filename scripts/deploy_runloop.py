#!/usr/bin/env python3
import os
import sys
import json
import requests
import time

# Load environment variables from .env file
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

API_KEY = os.getenv('RUNLOOP_API_KEY')
BASE_URL = 'https://api.runloop.ai/v1'

def get_blueprint_id():
    """Get blueprint ID from env"""
    log_debug("get_blueprint_id() called")
    result = os.getenv('OMNI_AGENT_BLUEPRINT_ID', '').strip()
    log_debug(f"get_blueprint_id() returning: {result}")
    return result

def create_devbox_from_blueprint(blueprint_id):
    """Create devbox from existing blueprint"""
    # First check if blueprint is ready
    is_ready, blueprint_data = check_blueprint_status(blueprint_id)

    if not is_ready:
        print(f"⚠️  Blueprint {blueprint_id} is not ready (status: {blueprint_data.get('status', 'unknown') if blueprint_data else 'not found'})")
        return None, None

    print(f"🚀 Creating devbox from blueprint {blueprint_id}...")
    response = requests.post(
        f'{BASE_URL}/devboxes',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={
            'name': 'omni-agent-enhanced',
            'blueprint_id': blueprint_id
        }
    )

    if response.status_code not in [200, 201]:
        print(f"❌ Error creating devbox from blueprint: {response.text}")
        return None, None

    data = response.json()
    devbox_id = data.get('id')
    print(f"✓ Devbox created from blueprint: {devbox_id}")

    # Wait for ready
    print("⏳ Waiting for devbox to be ready...")
    for i in range(20):
        time.sleep(2)
        status_response = requests.get(
            f'{BASE_URL}/devboxes/{devbox_id}',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        if status_response.ok:
            status = status_response.json().get('status')
            print(f"  Status: {status}")
            if status == 'running':
                print("✓ Devbox ready!")
                break
        else:
            print(f"  Error checking status: {status_response.text}")
    else:
        print("⚠️  Devbox did not become ready in time")

    devbox_url = f"https://{devbox_id}.runloop.dev:8000"
    return devbox_id, devbox_url

def create_fresh_devbox():
    """Create new devbox and set it up"""
    log_debug("create_fresh_devbox() called")
    print("Creating fresh Runloop devbox...")

    log_debug(f"Making POST request to: {BASE_URL}/devboxes")
    log_debug(f"Request payload: {{'name': 'omni-agent-voice'}}")

    response = requests.post(
        f'{BASE_URL}/devboxes',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={'name': 'omni-agent-voice'}
    )

    log_debug(f"Response status: {response.status_code}")
    log_debug(f"Response text: {response.text[:200]}...")

    if response.status_code not in [200, 201]:
        print(f"Error creating devbox: {response.text}")
        sys.exit(1)

    data = response.json()
    devbox_id = data.get('id')
    print(f"✓ Devbox created: {devbox_id}")

    # Wait for devbox to be ready
    print("Waiting for devbox to be ready...")
    for i in range(30):
        time.sleep(2)
        status_response = requests.get(
            f'{BASE_URL}/devboxes/{devbox_id}',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        if status_response.ok:
            status = status_response.json().get('status')
            print(f"  Status: {status}")
            if status == 'running':
                break

    devbox_url = f"https://{devbox_id}.runloop.dev"
    return devbox_id, devbox_url

def execute_command(devbox_id, command, show_output=True):
    """Execute a command in the devbox using execute_sync"""
    if show_output:
        log_progress(f"Executing: {command}")

    response = requests.post(
        f'{BASE_URL}/devboxes/{devbox_id}/execute_sync',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={'command': command}
    )

    if response.status_code == 200:
        result = response.json()
        exit_code = result.get('exit_status', result.get('exit_code', 0))

        if show_output:
            # Always show the actual output from the devbox
            if result.get('stdout'):
                print("STDOUT:", result['stdout'])
            if result.get('stderr'):
                print("STDERR:", result['stderr'])
            print(f"EXIT STATUS: {exit_code}")

        if exit_code != 0:
            if show_output:
                print(f"⚠️  Command failed with exit code {exit_code}")
        return result
    else:
        print(f"API error: {response.text}")
        return None

def deploy_services(devbox_id):
    print("\n📦 Installing dependencies...")

    # Update and install system dependencies
    print("Installing system dependencies...")
    execute_command(devbox_id, 'sudo apt-get update && sudo apt-get install -y ffmpeg curl wget git nodejs npm')

    # Install browser dependencies for Playwright
    print("Installing browser dependencies for Playwright...")
    execute_command(devbox_id, 'sudo apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libatspi2.0-0 libxdamage1')

    # Install Python packages including web browsing tools
    print("Installing Python packages (this takes a few minutes)...")
    execute_command(devbox_id, 'pip install --user openai-whisper flask flask-cors edge-tts requests playwright beautifulsoup4 selenium')

    # Install Playwright system dependencies and browsers
    print("Installing Playwright system dependencies...")
    execute_command(devbox_id, 'export PATH=$PATH:/home/user/.local/bin && playwright install-deps chromium')

    print("Installing Playwright browsers...")
    execute_command(devbox_id, 'export PATH=$PATH:/home/user/.local/bin && playwright install chromium')

    print("\n🎤 Creating Whisper STT service...")

    whisper_code = """cat > whisper_server.py << 'WHISPER_EOF'
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import logging

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper ready!")

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'whisper'})

@app.route('/stt/whisper', methods=['POST'])
def transcribe():
    try:
        audio_data = request.data
        if not audio_data:
            return jsonify({'error': 'No audio data'}), 400

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        result = model.transcribe(tmp_path)
        os.unlink(tmp_path)

        return jsonify({'text': result['text']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9000)
WHISPER_EOF"""

    execute_command(devbox_id, whisper_code)

    print("\n🔊 Creating TTS service...")

    tts_code = """cat > tts_server.py << 'TTS_EOF'
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import edge_tts
import asyncio
import tempfile
import logging

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'tts'})

@app.route('/tts/piper', methods=['POST'])
@app.route('/tts/edge', methods=['POST'])
def tts():
    try:
        text = request.json.get('text', '')
        voice = request.json.get('voice', 'en-US-AriaNeural')

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        output = tempfile.mktemp(suffix='.mp3')

        async def generate():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output)

        asyncio.run(generate())
        return send_file(output, mimetype='audio/mpeg')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9001)
TTS_EOF"""

    execute_command(devbox_id, tts_code)

    print("\n🌐 Creating enhanced server with web browsing and command execution...")

    # Copy the enhanced server file to the devbox
    with open('scripts/enhanced_server.py', 'r') as f:
        content = f.read()

    # Use base64 encoding to avoid issues with special characters
    import base64
    encoded_content = base64.b64encode(content.encode()).decode()

    execute_command(devbox_id, f'echo "{encoded_content}" | base64 -d > enhanced_server.py')

def start_services(devbox_id):
    print("\n🚀 Starting enhanced services...")

    # Start Whisper (background)
    execute_command(devbox_id, 'nohup python whisper_server.py > whisper.log 2>&1 &')
    print("⏳ Waiting for Whisper to load model (15s)...")
    time.sleep(15)

    # Start TTS (background)
    execute_command(devbox_id, 'nohup python tts_server.py > tts.log 2>&1 &')
    time.sleep(3)

    # Start enhanced server (background) - replaces main_server.py
    execute_command(devbox_id, 'nohup python enhanced_server.py > enhanced.log 2>&1 &')
    time.sleep(3)

    print("✓ All enhanced services started!")
    print("  • Voice services (Whisper + TTS)")
    print("  • Command execution")
    print("  • Web browsing (Playwright)")
    print("  • File operations")

def check_blueprint_status(blueprint_id):
    """Check if a blueprint exists and is ready"""
    log_debug(f"check_blueprint_status() called with: {blueprint_id}")

    if not blueprint_id:
        log_debug("No blueprint ID provided")
        return False, None

    try:
        log_debug(f"Making request to: {BASE_URL}/blueprints/{blueprint_id}")
        response = requests.get(
            f'{BASE_URL}/blueprints/{blueprint_id}',
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        log_debug(f"Response status: {response.status_code}")

        if response.status_code == 200:
            blueprint_data = response.json()
            status = blueprint_data.get('status', '')
            return status == 'build_complete', blueprint_data
        else:
            return False, None
    except Exception as e:
        print(f"⚠️  Error checking blueprint status: {e}")
        return False, None

def deploy_from_blueprint(blueprint_id):
    """Deploy a new devbox from an existing blueprint"""
    print(f"\n🚀 Deploying from blueprint {blueprint_id}...")

    try:
        response = requests.post(
            f'{BASE_URL}/devboxes',
            headers={
                'Authorization': f'Bearer {API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'blueprint_id': blueprint_id
            }
        )

        if response.status_code in [200, 201]:
            devbox_data = response.json()
            devbox_id = devbox_data.get('id')
            print(f"✓ Devbox created from blueprint: {devbox_id}")
            return devbox_id
        else:
            print(f"❌ Failed to deploy from blueprint: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error deploying from blueprint: {e}")
        return None

def create_blueprint(devbox_id=None):
    """Create a blueprint from a successfully deployed devbox"""
    print("\n💾 Creating blueprint for faster future deployments...")

    # Get GitHub token from environment
    github_token = os.getenv('GITHUB_TOKEN', '')
    github_repo = os.getenv('GITHUB_REPO', 'thejonanshow/omni-agent')

    if not github_token:
        print("⚠️  GITHUB_TOKEN not set, cannot create blueprint")
        return None

    # Parse repo owner and name
    repo_parts = github_repo.split('/')
    if len(repo_parts) != 2:
        print("⚠️  Invalid GITHUB_REPO format, cannot create blueprint")
        return None

    repo_owner, repo_name = repo_parts

    # Create blueprint payload
    blueprint_payload = {
        'name': f'omni-agent-enhanced-{int(time.time())}',
        'code_mounts': [{
            'repo_name': repo_name,
            'repo_owner': repo_owner,
            'token': github_token
        }]
    }

    # Note: Runloop API doesn't support devbox_id in blueprint creation
    # Blueprints are created from code_mounts (GitHub repos) only
    if devbox_id:
        print(f"Note: Blueprint will be created from GitHub repo, not devbox {devbox_id}")

    response = requests.post(
        f'{BASE_URL}/blueprints',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json=blueprint_payload
    )

    if response.status_code in [200, 201]:
        blueprint_data = response.json()
        blueprint_id = blueprint_data.get('id')
        print(f"✓ Blueprint created: {blueprint_id}")
        print(f"Blueprint response: {blueprint_data}")

        # Wait for blueprint to be ready
        if wait_for_blueprint_ready(blueprint_id):
            # Save to .env
            env_path = '.env'
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    lines = f.readlines()

                # Update or add blueprint ID
                found = False
                for i, line in enumerate(lines):
                    if line.startswith('OMNI_AGENT_BLUEPRINT_ID='):
                        lines[i] = f'OMNI_AGENT_BLUEPRINT_ID={blueprint_id}\n'
                        found = True
                        break

                if not found:
                    lines.append(f'OMNI_AGENT_BLUEPRINT_ID={blueprint_id}\n')

                with open(env_path, 'w') as f:
                    f.writelines(lines)

                print(f"✓ Blueprint ID saved to .env")
                print(f"  Next deployment will be instant!")
            else:
                print(f"⚠️  Could not save blueprint ID to .env")
            return blueprint_id
        else:
            print(f"⚠️  Blueprint not ready, will not save to .env")
            return None
    else:
        print(f"❌ Failed to create blueprint: {response.status_code} - {response.text}")
        print(f"Request payload was: {blueprint_payload}")
        print("   (Not critical - will still work, just slower next time)")
        return None

def wait_for_blueprint_ready(blueprint_id, max_wait=300):
    """Wait for blueprint to be ready"""
    print(f"⏳ Waiting for blueprint {blueprint_id} to be ready...")

    for i in range(max_wait // 10):  # Check every 10 seconds
        is_ready, blueprint_data = check_blueprint_status(blueprint_id)

        if is_ready:
            print(f"✓ Blueprint is ready!")
            return True

        status = blueprint_data.get('status', 'unknown') if blueprint_data else 'not found'
        print(f"  Status: {status} (waiting...)")
        time.sleep(10)

    print(f"⚠️  Blueprint did not become ready within {max_wait} seconds")
    return False

def print_deployment_info(devbox_id, devbox_url):
    """Print deployment information"""
    final_url = f"{devbox_url}:8000"

    print(f"\n✅ Enhanced Runloop deployment complete!")
    print(f"📍 URL: {final_url}")
    print(f"\n💡 Available endpoints:")
    print(f"   Health: {final_url}/health")
    print(f"   Voice STT: {final_url}/stt/whisper")
    print(f"   Voice TTS: {final_url}/tts/piper")
    print(f"   Command execution: {final_url}/execute")
    print(f"   Web browsing: {final_url}/browse")
    print(f"   File operations: {final_url}/read_file, {final_url}/write_file, {final_url}/list_files")

    # Save URL for setup script
    with open('.runloop_url', 'w') as f:
        f.write(final_url)

    print(f"✓ URL saved to .runloop_url")

def log_progress(message: str, step: int = None, total: int = None):
    """Log progress with timestamps and step indicators"""
    timestamp = time.strftime("%H:%M:%S")
    if step and total:
        print(f"[{timestamp}] [{step}/{total}] {message}")
    else:
        print(f"[{timestamp}] {message}")
    sys.stdout.flush()  # Force immediate output

def log_debug(message: str):
    """Debug logging with maximum detail"""
    timestamp = time.strftime("%H:%M:%S.%f")[:-3]  # Include milliseconds
    print(f"[{timestamp}] DEBUG: {message}")
    sys.stdout.flush()

def main():
    log_debug("Starting main() function")

    if not API_KEY:
        log_debug("API_KEY is None or empty")
        print("❌ RUNLOOP_API_KEY not set")
        sys.exit(1)

    log_debug(f"API_KEY found: {API_KEY[:10]}...")
    log_debug(f"BASE_URL: {BASE_URL}")

    log_progress("🚀 STARTING RUNLOOP DEPLOYMENT")
    log_progress("=" * 50)

    try:
        log_debug("Entering try block")
        # Get blueprint ID from environment
        log_debug("Calling get_blueprint_id()")
        blueprint_id = get_blueprint_id()
        log_debug(f"Blueprint ID: {blueprint_id}")

        # Check if we have a blueprint and it's ready
        if blueprint_id:
            log_debug("Blueprint ID found, checking status")
            log_progress(f"📦 Checking existing blueprint: {blueprint_id}")
            is_ready, blueprint_data = check_blueprint_status(blueprint_id)

            if is_ready:
                log_progress("✓ Blueprint is ready, deploying from blueprint...")
                devbox_id, devbox_url = create_devbox_from_blueprint(blueprint_id)

                if devbox_id:
                    # Just start services (already installed)
                    log_progress("🚀 Starting services on blueprint devbox...")
                    start_services(devbox_id)
                    print_deployment_info(devbox_id, devbox_url)
                    return
                else:
                    log_progress("⚠️  Blueprint deployment failed, falling back to fresh install...")
            else:
                status = blueprint_data.get('status', 'unknown') if blueprint_data else 'not found'
                log_progress(f"⚠️  Blueprint not ready (status: {status}), falling back to fresh install...")

        # Fresh install (either no blueprint or blueprint failed)
        log_progress("🆕 First-time setup (will be faster next time)...")
        log_progress("Step 1/4: Creating fresh devbox...")
        devbox_id, devbox_url = create_fresh_devbox()

        log_progress("Step 2/4: Deploying services...")
        deploy_services(devbox_id)

        log_progress("Step 3/4: Starting services...")
        start_services(devbox_id)

        log_progress("Step 4/4: Creating blueprint for future deployments...")
        new_blueprint_id = create_blueprint(devbox_id)
        if new_blueprint_id:
            log_progress("✓ Blueprint created! Next deployment will be instant.")

        print_deployment_info(devbox_id, devbox_url)

    except Exception as e:
        print(f"\n❌ Deployment failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
