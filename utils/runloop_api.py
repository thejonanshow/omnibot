#!/usr/bin/env python3
"""
Shared Runloop API utilities
"""

import os
import requests
from typing import Optional, Dict, Any

# Load environment variables
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

API_KEY = os.getenv('RUNLOOP_API_KEY')
BASE_URL = 'https://api.runloop.ai/v1'

class RunloopAPI:
    """Shared Runloop API client"""

    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or API_KEY
        self.base_url = base_url or BASE_URL

        if not self.api_key:
            raise ValueError("RUNLOOP_API_KEY not set")

    def make_request(self, method: str, endpoint: str, data: dict = None) -> requests.Response:
        """Make API request with consistent error handling"""
        url = f'{self.base_url}{endpoint}'
        headers = {'Authorization': f'Bearer {self.api_key}'}

        if method.upper() == 'GET':
            return requests.get(url, headers=headers)
        elif method.upper() == 'POST':
            headers['Content-Type'] = 'application/json'
            return requests.post(url, headers=headers, json=data)
        elif method.upper() == 'DELETE':
            return requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

    def list_blueprints(self) -> list:
        """List all blueprints"""
        response = self.make_request('GET', '/blueprints')
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'blueprints' in data:
                return data['blueprints']
            elif isinstance(data, list):
                return data
        return []

    def list_devboxes(self) -> list:
        """List all devboxes"""
        response = self.make_request('GET', '/devboxes')
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'devboxes' in data:
                return data['devboxes']
            elif isinstance(data, list):
                return data
        return []

    def get_blueprint(self, blueprint_id: str) -> Optional[Dict[str, Any]]:
        """Get blueprint details"""
        response = self.make_request('GET', f'/blueprints/{blueprint_id}')
        if response.status_code == 200:
            return response.json()
        return None

    def create_blueprint(self, name: str, launch_parameters: dict = None) -> Optional[str]:
        """Create a new blueprint"""
        data = {'name': name}
        if launch_parameters:
            data['launch_parameters'] = launch_parameters

        response = self.make_request('POST', '/blueprints', data)
        if response.status_code in [200, 201]:
            return response.json().get('id')
        return None

    def get_devbox(self, devbox_id: str) -> Optional[Dict[str, Any]]:
        """Get devbox details"""
        response = self.make_request('GET', f'/devboxes/{devbox_id}')
        if response.status_code == 200:
            return response.json()
        return None

    def create_devbox(self, name: str, blueprint_id: str = None) -> Optional[str]:
        """Create a new devbox"""
        data = {'name': name}
        if blueprint_id:
            data['blueprint_id'] = blueprint_id

        response = self.make_request('POST', '/devboxes', data)
        if response.status_code in [200, 201]:
            return response.json().get('id')
        return None

    def resume_devbox(self, devbox_id: str) -> bool:
        """Resume a suspended devbox"""
        response = self.make_request('POST', f'/devboxes/{devbox_id}/resume')
        return response.status_code in [200, 201]

    def suspend_devbox(self, devbox_id: str) -> bool:
        """Suspend a devbox"""
        try:
            response = self.make_request('POST', f'/devboxes/{devbox_id}/suspend')
            return response.status_code in [200, 201]
        except Exception as e:
            print(f"Error suspending devbox: {e}")
            return False

    def delete_devbox(self, devbox_id: str) -> bool:
        """Delete a devbox"""
        try:
            response = self.make_request('DELETE', f'/devboxes/{devbox_id}')
            if response.status_code in [200, 204]:
                return True
            else:
                print(f"Delete failed for {devbox_id}: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"Error deleting devbox {devbox_id}: {e}")
            return False

    def execute_command(self, devbox_id: str, command: str, show_output: bool = False, timeout: int = 60) -> Dict[str, Any]:
        """Execute a command in a devbox with timeout support"""
        try:
            response = self.make_request('POST', f'/devboxes/{devbox_id}/execute_sync', {
                'command': command,
                'timeout': timeout
            })
            if response.status_code == 200:
                result = response.json()
                if show_output:
                    print(f"Command: {command}")
                    if result.get('stdout'):
                        print("STDOUT:", result['stdout'])
                    if result.get('stderr'):
                        print("STDERR:", result['stderr'])
                    print(f"EXIT STATUS: {result.get('exit_status', 0)}")
                return result
            return {'error': f'Command failed with status {response.status_code}'}
        except Exception as e:
            return {'error': f'Command execution failed: {str(e)}', 'exit_status': -1}
