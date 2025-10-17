#!/usr/bin/env python3
"""
Swarm Orchestrator
Manages multiple Qwen instances for parallel processing and response collation
"""

import os
import sys
import time
import json
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.runloop_api import RunloopAPI
from utils.devbox_lifecycle import DevboxLifecycleManager

class SwarmStatus(Enum):
    IDLE = "idle"
    DEPLOYING = "deploying"
    READY = "ready"
    PROCESSING = "processing"
    COLLATING = "collating"
    COMPLETE = "complete"
    ERROR = "error"

@dataclass
class SwarmInstance:
    devbox_id: str
    devbox_url: str
    status: str
    health: bool
    last_used: Optional[datetime] = None
    response_count: int = 0
    error_count: int = 0

@dataclass
class SwarmResponse:
    instance_id: str
    response: str
    quality_score: float
    response_time_ms: int
    timestamp: datetime
    metadata: Dict[str, Any]

@dataclass
class SwarmResult:
    task: str
    responses: List[SwarmResponse]
    consensus_response: str
    quality_analysis: Dict[str, Any]
    processing_time_ms: int
    swarm_size: int
    successful_instances: int

class SwarmOrchestrator:
    """Orchestrates multiple Qwen instances for parallel processing"""

    def __init__(self, runloop_api_key: str):
        self.api = RunloopAPI()
        self.manager = DevboxLifecycleManager()
        self.runloop_api_key = runloop_api_key
        
        # Swarm configuration
        self.default_swarm_size = 3
        self.max_swarm_size = 7
        self.min_swarm_size = 2
        self.response_timeout = 60  # seconds
        
        # Swarm state
        self.instances: List[SwarmInstance] = []
        self.status = SwarmStatus.IDLE
        self.current_task: Optional[str] = None
        
        # Performance tracking
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0

    def log(self, message: str, level: str = "INFO"):
        """Log with timestamp and level"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def log_error(self, message: str, error: Exception = None):
        """Error logging with context"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        error_msg = f"[{timestamp}] ERROR: {message}"
        if error:
            error_msg += f" - {str(error)}"
        print(error_msg)

    async def deploy_swarm(self, swarm_size: int = None) -> bool:
        """Deploy swarm of Qwen instances"""
        if swarm_size is None:
            swarm_size = self.default_swarm_size
        
        swarm_size = max(self.min_swarm_size, min(swarm_size, self.max_swarm_size))
        
        self.log(f"🚀 Deploying swarm of {swarm_size} Qwen instances...")
        self.status = SwarmStatus.DEPLOYING
        
        try:
            # Find suitable blueprint
            blueprint_id = await self._find_best_blueprint()
            if not blueprint_id:
                self.log_error("No suitable blueprint found")
                return False
            
            # Deploy instances in parallel
            deployment_tasks = []
            for i in range(swarm_size):
                task = self._deploy_instance(f"swarm-qwen-{i+1}", blueprint_id)
                deployment_tasks.append(task)
            
            # Wait for all deployments
            results = await asyncio.gather(*deployment_tasks, return_exceptions=True)
            
            # Process results
            successful_deployments = 0
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    self.log_error(f"Instance {i+1} deployment failed", result)
                elif result:
                    successful_deployments += 1
                    self.log(f"✅ Instance {i+1} deployed successfully")
                else:
                    self.log_error(f"Instance {i+1} deployment failed")
            
            if successful_deployments >= self.min_swarm_size:
                self.log(f"🎉 Swarm deployed successfully: {successful_deployments}/{swarm_size} instances")
                self.status = SwarmStatus.READY
                return True
            else:
                self.log_error(f"Swarm deployment failed: only {successful_deployments} instances ready")
                self.status = SwarmStatus.ERROR
                return False
                
        except Exception as e:
            self.log_error("Swarm deployment failed", e)
            self.status = SwarmStatus.ERROR
            return False

    async def _find_best_blueprint(self) -> Optional[str]:
        """Find the best blueprint for Qwen deployment"""
        try:
            blueprints = self.api.list_blueprints()
            
            if not blueprints:
                return None
            
            # Look for AI/LLM related blueprints
            ai_blueprints = []
            for bp in blueprints:
                name = bp.get('name', '').lower()
                description = bp.get('description', '').lower()
                
                if any(keyword in name or keyword in description for keyword in 
                       ['ai', 'llm', 'qwen', 'ollama', 'python', 'jupyter', 'ml']):
                    ai_blueprints.append(bp)
            
            # Prefer ready blueprints
            ready_blueprints = [bp for bp in ai_blueprints if bp.get('status') == 'build_complete']
            if ready_blueprints:
                return ready_blueprints[0].get('id')
            
            # Use first AI blueprint
            if ai_blueprints:
                return ai_blueprints[0].get('id')
            
            # Fallback to first blueprint
            return blueprints[0].get('id')
            
        except Exception as e:
            self.log_error("Failed to find blueprint", e)
            return None

    async def _deploy_instance(self, name: str, blueprint_id: str) -> bool:
        """Deploy a single Qwen instance"""
        try:
            # Create devbox
            devbox_id = self.api.create_devbox(name, blueprint_id)
            if not devbox_id:
                return False
            
            # Wait for ready
            if not await self._wait_for_instance_ready(devbox_id):
                return False
            
            # Test endpoint
            devbox_url = f"https://{devbox_id}.runloop.dev:8000"
            if not await self._test_instance_endpoint(devbox_url):
                return False
            
            # Add to swarm
            instance = SwarmInstance(
                devbox_id=devbox_id,
                devbox_url=devbox_url,
                status="running",
                health=True
            )
            self.instances.append(instance)
            
            return True
            
        except Exception as e:
            self.log_error(f"Failed to deploy instance {name}", e)
            return False

    async def _wait_for_instance_ready(self, devbox_id: str, timeout: int = 300) -> bool:
        """Wait for instance to be ready"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                devbox_data = self.api.get_devbox(devbox_id)
                if devbox_data:
                    status = devbox_data.get('status', '')
                    if status == 'running':
                        return True
                    elif status == 'failed':
                        return False
                
                await asyncio.sleep(10)
                
            except Exception as e:
                self.log_error("Error checking instance status", e)
                await asyncio.sleep(10)
        
        return False

    async def _test_instance_endpoint(self, devbox_url: str) -> bool:
        """Test if instance endpoint is accessible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{devbox_url}/health", timeout=10) as response:
                    return response.status == 200
        except Exception as e:
            self.log_error(f"Instance endpoint test failed: {devbox_url}", e)
            return False

    async def process_task(self, task: str, swarm_size: int = None) -> SwarmResult:
        """Process a task using the swarm"""
        if self.status != SwarmStatus.READY:
            raise Exception("Swarm not ready for processing")
        
        if swarm_size is None:
            swarm_size = min(len(self.instances), self.default_swarm_size)
        
        self.log(f"🔄 Processing task with swarm of {swarm_size} instances...")
        self.status = SwarmStatus.PROCESSING
        self.current_task = task
        
        start_time = time.time()
        
        try:
            # Select instances for processing
            selected_instances = self.instances[:swarm_size]
            
            # Process task in parallel
            processing_tasks = []
            for instance in selected_instances:
                task_coro = self._process_with_instance(instance, task)
                processing_tasks.append(task_coro)
            
            # Wait for all responses
            responses = await asyncio.gather(*processing_tasks, return_exceptions=True)
            
            # Process responses
            valid_responses = []
            for i, response in enumerate(responses):
                if isinstance(response, Exception):
                    self.log_error(f"Instance {i+1} processing failed", response)
                elif response:
                    valid_responses.append(response)
            
            # Collate responses
            self.status = SwarmStatus.COLLATING
            result = await self._collate_responses(task, valid_responses)
            
            processing_time = (time.time() - start_time) * 1000
            result.processing_time_ms = int(processing_time)
            result.swarm_size = swarm_size
            result.successful_instances = len(valid_responses)
            
            self.log(f"✅ Task processed successfully: {len(valid_responses)}/{swarm_size} instances")
            self.status = SwarmStatus.COMPLETE
            
            return result
            
        except Exception as e:
            self.log_error("Task processing failed", e)
            self.status = SwarmStatus.ERROR
            raise

    async def _process_with_instance(self, instance: SwarmInstance, task: str) -> Optional[SwarmResponse]:
        """Process task with a single instance"""
        try:
            start_time = time.time()
            
            # Prepare request
            payload = {
                "message": task,
                "conversation": [],
                "sessionId": f"swarm-{instance.devbox_id}"
            }
            
            # Send request
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{instance.devbox_url}/qwen/chat",
                    json=payload,
                    timeout=self.response_timeout
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get('response', '')
                        
                        response_time = (time.time() - start_time) * 1000
                        
                        # Calculate quality score
                        quality_score = self._calculate_quality_score(response_text)
                        
                        # Update instance stats
                        instance.response_count += 1
                        instance.last_used = datetime.now()
                        
                        return SwarmResponse(
                            instance_id=instance.devbox_id,
                            response=response_text,
                            quality_score=quality_score,
                            response_time_ms=int(response_time),
                            timestamp=datetime.now(),
                            metadata={"status_code": response.status}
                        )
                    else:
                        instance.error_count += 1
                        self.log_error(f"Instance {instance.devbox_id} returned status {response.status}")
                        return None
                        
        except Exception as e:
            instance.error_count += 1
            self.log_error(f"Instance {instance.devbox_id} processing failed", e)
            return None

    def _calculate_quality_score(self, response: str) -> float:
        """Calculate quality score for a response"""
        score = 0.0
        
        # Check for code presence
        if '```' in response or 'def ' in response or 'function ' in response:
            score += 0.3
        
        # Check for explanation
        if len(response) > 200:
            score += 0.2
        
        # Check for structure
        if any(keyword in response.lower() for keyword in ['implementation', 'example', 'usage', 'test']):
            score += 0.2
        
        # Check for completeness
        if len(response) > 500:
            score += 0.2
        
        # Check for formatting
        if response.count('\n') > 5:
            score += 0.1
        
        return min(score, 1.0)

    async def _collate_responses(self, task: str, responses: List[SwarmResponse]) -> SwarmResult:
        """Collate and analyze responses from multiple instances"""
        if not responses:
            raise Exception("No valid responses to collate")
        
        # Sort by quality score
        responses.sort(key=lambda x: x.quality_score, reverse=True)
        
        # Select consensus response (highest quality)
        consensus_response = responses[0].response
        
        # Analyze quality
        quality_analysis = {
            "average_quality": sum(r.quality_score for r in responses) / len(responses),
            "best_quality": responses[0].quality_score,
            "quality_range": responses[0].quality_score - responses[-1].quality_score,
            "response_count": len(responses),
            "consensus_confidence": self._calculate_consensus_confidence(responses)
        }
        
        return SwarmResult(
            task=task,
            responses=responses,
            consensus_response=consensus_response,
            quality_analysis=quality_analysis,
            processing_time_ms=0,  # Will be set by caller
            swarm_size=0,  # Will be set by caller
            successful_instances=0  # Will be set by caller
        )

    def _calculate_consensus_confidence(self, responses: List[SwarmResponse]) -> float:
        """Calculate confidence in consensus response"""
        if len(responses) < 2:
            return 1.0
        
        # Calculate similarity between top responses
        top_responses = responses[:2]
        similarity = self._calculate_similarity(
            top_responses[0].response,
            top_responses[1].response
        )
        
        return similarity

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        # Simple similarity based on common words
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0

    async def cleanup_swarm(self):
        """Clean up swarm instances"""
        self.log("🧹 Cleaning up swarm instances...")
        
        for instance in self.instances:
            try:
                # Suspend or delete devbox
                self.api.suspend_devbox(instance.devbox_id)
                self.log(f"✅ Instance {instance.devbox_id} cleaned up")
            except Exception as e:
                self.log_error(f"Failed to cleanup instance {instance.devbox_id}", e)
        
        self.instances.clear()
        self.status = SwarmStatus.IDLE
        self.log("🎉 Swarm cleanup complete")

    def get_swarm_status(self) -> Dict[str, Any]:
        """Get current swarm status"""
        return {
            "status": self.status.value,
            "instance_count": len(self.instances),
            "healthy_instances": sum(1 for i in self.instances if i.health),
            "current_task": self.current_task,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "instances": [
                {
                    "devbox_id": i.devbox_id,
                    "status": i.status,
                    "health": i.health,
                    "response_count": i.response_count,
                    "error_count": i.error_count,
                    "last_used": i.last_used.isoformat() if i.last_used else None
                }
                for i in self.instances
            ]
        }

async def main():
    """Main function for testing"""
    print("🚀 SWARM ORCHESTRATOR TEST")
    print("=" * 40)
    
    # Get API key
    runloop_api_key = input("Enter your Runloop API key: ").strip()
    if not runloop_api_key:
        print("❌ No API key provided")
        return
    
    try:
        orchestrator = SwarmOrchestrator(runloop_api_key)
        
        # Deploy swarm
        success = await orchestrator.deploy_swarm(3)
        if not success:
            print("❌ Swarm deployment failed")
            return
        
        # Test task
        test_task = "Write a Python function to calculate the factorial of a number"
        result = await orchestrator.process_task(test_task)
        
        print(f"\n🎉 SWARM TEST COMPLETE!")
        print(f"Task: {result.task}")
        print(f"Swarm size: {result.swarm_size}")
        print(f"Successful instances: {result.successful_instances}")
        print(f"Processing time: {result.processing_time_ms}ms")
        print(f"Average quality: {result.quality_analysis['average_quality']:.2f}")
        print(f"Consensus confidence: {result.quality_analysis['consensus_confidence']:.2f}")
        
        # Cleanup
        await orchestrator.cleanup_swarm()
        
    except Exception as e:
        print(f"💥 SWARM TEST FAILED: {e}")

if __name__ == '__main__':
    asyncio.run(main())