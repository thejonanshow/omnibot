#!/usr/bin/env python3
"""
Omni-Agent Swarm Orchestrator
Coordinates multiple LLM agents for collaborative coding
"""

import asyncio
import json
import time
import uuid
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import requests
import hmac
import hashlib

class AgentRole(Enum):
    ARCHITECT = "architect"
    DEVELOPER = "developer"
    REVIEWER = "reviewer"
    TESTER = "tester"
    RESEARCHER = "researcher"
    POLISHER = "polisher"

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    REVIEWED = "reviewed"

@dataclass
class Agent:
    id: str
    name: str
    role: AgentRole
    provider: str  # groq, gemini, qwen, claude
    capabilities: List[str]
    status: str = "idle"
    current_task: Optional[str] = None
    performance_score: float = 1.0

@dataclass
class Task:
    id: str
    title: str
    description: str
    assigned_agent: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: int = 1  # 1 = highest
    dependencies: List[str] = None
    result: Optional[Dict[str, Any]] = None
    feedback: List[Dict[str, Any]] = None
    created_at: float = None
    completed_at: Optional[float] = None

    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.feedback is None:
            self.feedback = []
        if self.created_at is None:
            self.created_at = time.time()

@dataclass
class Project:
    id: str
    name: str
    description: str
    requirements: List[str]
    tasks: List[Task]
    agents: List[Agent]
    status: str = "planning"
    created_at: float = None
    updated_at: float = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()
        if self.updated_at is None:
            self.updated_at = time.time()

class SwarmOrchestrator:
    def __init__(self, cloudflare_worker_url: str, shared_secret: str):
        self.worker_url = cloudflare_worker_url
        self.shared_secret = shared_secret
        self.projects: Dict[str, Project] = {}
        self.agent_communication: Dict[str, List[Dict]] = {}

        # Initialize default agents
        self.default_agents = [
            Agent(
                id="agent_architect",
                name="Architect Agent",
                role=AgentRole.ARCHITECT,
                provider="groq",  # Use free model for planning
                capabilities=["system_design", "architecture", "planning"]
            ),
            Agent(
                id="agent_developer_1",
                name="Developer Agent 1",
                role=AgentRole.DEVELOPER,
                provider="groq",  # Use free model for development
                capabilities=["coding", "implementation", "debugging"]
            ),
            Agent(
                id="agent_developer_2",
                name="Developer Agent 2",
                role=AgentRole.DEVELOPER,
                provider="gemini",  # Use another free model
                capabilities=["coding", "implementation", "optimization"]
            ),
            Agent(
                id="agent_reviewer",
                name="Reviewer Agent",
                role=AgentRole.REVIEWER,
                provider="qwen",  # Use local model for review
                capabilities=["code_review", "quality_assurance", "best_practices"]
            ),
            Agent(
                id="agent_tester",
                name="Tester Agent",
                role=AgentRole.TESTER,
                provider="qwen",  # Use local model for testing
                capabilities=["testing", "validation", "bug_detection"]
            ),
            Agent(
                id="agent_researcher",
                name="Researcher Agent",
                role=AgentRole.RESEARCHER,
                provider="groq",  # Use free model for research
                capabilities=["research", "documentation", "learning"]
            ),
            Agent(
                id="agent_polisher",
                name="Polisher Agent",
                role=AgentRole.POLISHER,
                provider="claude",  # Use Claude only for final polish
                capabilities=["polish", "refinement", "final_review"]
            )
        ]

    async def create_project(self, name: str, description: str, requirements: List[str]) -> str:
        """Create a new project with agents and initial tasks"""
        project_id = str(uuid.uuid4())

        # Create initial tasks based on requirements
        tasks = await self._generate_initial_tasks(requirements)

        project = Project(
            id=project_id,
            name=name,
            description=description,
            requirements=requirements,
            tasks=tasks,
            agents=self.default_agents.copy()
        )

        self.projects[project_id] = project
        return project_id

    async def _generate_initial_tasks(self, requirements: List[str]) -> List[Task]:
        """Generate initial tasks based on project requirements"""
        # Use the architect agent to break down requirements into tasks
        architect_prompt = f"""
        Break down these project requirements into specific, actionable tasks:

        Requirements:
        {json.dumps(requirements, indent=2)}

        Create a list of tasks with:
        - Clear titles and descriptions
        - Priority levels (1=highest, 5=lowest)
        - Dependencies between tasks
        - Suggested agent roles for each task

        Return as JSON array of task objects.
        """

        try:
            response = await self._call_agent("agent_architect", architect_prompt)
            task_data = json.loads(response)

            tasks = []
            for i, task_info in enumerate(task_data):
                task = Task(
                    id=f"task_{i+1}",
                    title=task_info.get("title", f"Task {i+1}"),
                    description=task_info.get("description", ""),
                    priority=task_info.get("priority", 3),
                    dependencies=task_info.get("dependencies", [])
                )
                tasks.append(task)

            return tasks
        except Exception as e:
            print(f"Error generating tasks: {e}")
            # Fallback to basic tasks
            return [
                Task(
                    id="task_1",
                    title="Project Setup",
                    description="Set up project structure and initial configuration",
                    priority=1
                ),
                Task(
                    id="task_2",
                    title="Core Implementation",
                    description="Implement core functionality based on requirements",
                    priority=2
                ),
                Task(
                    id="task_3",
                    title="Testing and Validation",
                    description="Test the implementation and validate requirements",
                    priority=3
                ),
                Task(
                    id="task_4",
                    title="Documentation",
                    description="Create documentation and user guides",
                    priority=4
                )
            ]

    async def execute_project(self, project_id: str) -> Dict[str, Any]:
        """Execute a project with the swarm of agents"""
        if project_id not in self.projects:
            raise ValueError(f"Project {project_id} not found")

        project = self.projects[project_id]
        project.status = "executing"

        print(f"🚀 Starting project execution: {project.name}")
        print(f"📋 {len(project.tasks)} tasks to complete")
        print(f"👥 {len(project.agents)} agents available")

        # Execute tasks in priority order
        completed_tasks = []
        failed_tasks = []

        while True:
            # Find next available task
            next_task = self._get_next_available_task(project)
            if not next_task:
                break

            # Assign task to best available agent
            agent = self._assign_task_to_agent(project, next_task)
            if not agent:
                print(f"⚠️  No available agent for task: {next_task.title}")
                failed_tasks.append(next_task)
                continue

            print(f"📝 Assigning '{next_task.title}' to {agent.name} ({agent.provider})")

            # Execute task
            try:
                result = await self._execute_task(project, next_task, agent)
                if result["success"]:
                    next_task.status = TaskStatus.COMPLETED
                    next_task.result = result
                    next_task.completed_at = time.time()
                    completed_tasks.append(next_task)
                    print(f"✅ Task completed: {next_task.title}")
                else:
                    next_task.status = TaskStatus.FAILED
                    failed_tasks.append(next_task)
                    print(f"❌ Task failed: {next_task.title}")
            except Exception as e:
                print(f"❌ Task error: {next_task.title} - {e}")
                next_task.status = TaskStatus.FAILED
                failed_tasks.append(next_task)

            # Update project status
            project.updated_at = time.time()

        # Final polish with Claude
        if completed_tasks:
            print("🎨 Running final polish with Claude...")
            polished_result = await self._final_polish(project, completed_tasks)
            project.status = "completed"
        else:
            project.status = "failed"

        return {
            "project_id": project_id,
            "status": project.status,
            "completed_tasks": len(completed_tasks),
            "failed_tasks": len(failed_tasks),
            "total_tasks": len(project.tasks),
            "final_result": polished_result if completed_tasks else None
        }

    def _get_next_available_task(self, project: Project) -> Optional[Task]:
        """Get the next available task based on priority and dependencies"""
        available_tasks = []

        for task in project.tasks:
            if task.status != TaskStatus.PENDING:
                continue

            # Check if dependencies are met
            if task.dependencies:
                completed_task_ids = {t.id for t in project.tasks if t.status == TaskStatus.COMPLETED}
                if not all(dep in completed_task_ids for dep in task.dependencies):
                    continue

            available_tasks.append(task)

        if not available_tasks:
            return None

        # Sort by priority (1 = highest)
        available_tasks.sort(key=lambda t: t.priority)
        return available_tasks[0]

    def _assign_task_to_agent(self, project: Project, task: Task) -> Optional[Agent]:
        """Assign task to the best available agent"""
        available_agents = [a for a in project.agents if a.status == "idle"]

        if not available_agents:
            return None

        # Simple assignment based on role and capabilities
        # In a more sophisticated system, this would consider agent expertise, workload, etc.
        for agent in available_agents:
            if agent.role.value in task.title.lower() or agent.role == AgentRole.DEVELOPER:
                agent.status = "busy"
                agent.current_task = task.id
                task.assigned_agent = agent.id
                return agent

        # Fallback to any available agent
        agent = available_agents[0]
        agent.status = "busy"
        agent.current_task = task.id
        task.assigned_agent = agent.id
        return agent

    async def _execute_task(self, project: Project, task: Task, agent: Agent) -> Dict[str, Any]:
        """Execute a task with the assigned agent"""
        task.status = TaskStatus.IN_PROGRESS

        # Create task-specific prompt
        if agent.role in [AgentRole.DEVELOPER, AgentRole.ARCHITECT]:
            # For code implementation tasks, route to Qwen
            prompt = f"""
            You are {agent.name}, a {agent.role.value} agent in a coding swarm.

            Project: {project.name}
            Description: {project.description}

            Your task: {task.title}
            Description: {task.description}

            Requirements:
            {json.dumps(project.requirements, indent=2)}

            IMPORTANT: Since this involves code implementation, you should use the call_qwen_for_code function to have Qwen (our specialized coding AI) handle the actual code writing. Qwen is optimized for code generation and will provide better results.

            Please:
            1. Analyze the task and determine what code needs to be written
            2. Use call_qwen_for_code to have Qwen implement the solution
            3. Review and integrate Qwen's response
            4. Provide your final assessment and any additional considerations

            Return your response as JSON with fields: approach, qwen_code_result, final_implementation, notes, success
            """
        else:
            # For non-code tasks, handle normally
            prompt = f"""
            You are {agent.name}, a {agent.role.value} agent in a coding swarm.

            Project: {project.name}
            Description: {project.description}

            Your task: {task.title}
            Description: {task.description}

            Requirements:
            {json.dumps(project.requirements, indent=2)}

            Please complete this task. Provide:
            1. A clear explanation of your approach
            2. The implementation/solution
            3. Any notes or considerations

            Return your response as JSON with fields: approach, implementation, notes, success
            """

        try:
            response = await self._call_agent(agent.id, prompt)
            result = json.loads(response)
            result["agent_id"] = agent.id
            result["agent_provider"] = agent.provider
            result["execution_time"] = time.time() - task.created_at

            # Get feedback from other agents
            feedback = await self._get_task_feedback(project, task, result)
            result["feedback"] = feedback

            return result
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "agent_id": agent.id,
                "agent_provider": agent.provider
            }
        finally:
            # Free up the agent
            agent.status = "idle"
            agent.current_task = None

    async def _get_task_feedback(self, project: Project, task: Task, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get feedback from other agents on the task result"""
        feedback = []

        # Get feedback from reviewer agent
        reviewer = next((a for a in project.agents if a.role == AgentRole.REVIEWER), None)
        if reviewer and reviewer.status == "idle":
            review_prompt = f"""
            Review this task result:

            Task: {task.title}
            Result: {json.dumps(result, indent=2)}

            Provide constructive feedback on:
            1. Code quality and best practices
            2. Potential improvements
            3. Any issues or concerns

            Return as JSON with fields: quality_score, improvements, concerns, overall_feedback
            """

            try:
                review_response = await self._call_agent(reviewer.id, review_prompt)
                review_data = json.loads(review_response)
                feedback.append({
                    "agent_id": reviewer.id,
                    "agent_role": reviewer.role.value,
                    "feedback": review_data
                })
            except Exception as e:
                print(f"Review feedback failed: {e}")

        return feedback

    async def _final_polish(self, project: Project, completed_tasks: List[Task]) -> Dict[str, Any]:
        """Use Claude for final polish and integration"""
        polisher = next((a for a in project.agents if a.role == AgentRole.POLISHER), None)
        if not polisher:
            return {"error": "No polisher agent available"}

        # Compile all task results
        all_results = []
        for task in completed_tasks:
            all_results.append({
                "task": task.title,
                "description": task.description,
                "result": task.result
            })

        polish_prompt = f"""
        You are the final polisher in a coding swarm. Your job is to:

        1. Review all completed work
        2. Integrate and polish the final solution
        3. Ensure consistency and quality
        4. Provide the final, production-ready result

        Project: {project.name}
        Requirements: {json.dumps(project.requirements, indent=2)}

        Completed Tasks and Results:
        {json.dumps(all_results, indent=2)}

        Please provide:
        1. Final integrated solution
        2. Quality assessment
        3. Deployment instructions
        4. Any final recommendations

        Return as JSON with fields: final_solution, quality_assessment, deployment_instructions, recommendations
        """

        try:
            response = await self._call_agent(polisher.id, polish_prompt)
            return json.loads(response)
        except Exception as e:
            return {"error": f"Final polish failed: {e}"}

    async def _call_agent(self, agent_id: str, prompt: str) -> str:
        """Call an agent through the Cloudflare Worker"""
        # Get challenge
        challenge_response = requests.get(f"{self.worker_url}/challenge")
        challenge_data = challenge_response.json()
        challenge = challenge_data["challenge"]
        timestamp = challenge_data["timestamp"]

        # Generate signature
        signature = hmac.new(
            self.shared_secret.encode(),
            f"{timestamp}{challenge}".encode(),
            hashlib.sha256
        ).hexdigest()

        # Make request
        response = requests.post(
            f"{self.worker_url}/chat",
            headers={
                'Content-Type': 'application/json',
                'X-Timestamp': str(timestamp),
                'X-Challenge': challenge,
                'X-Signature': signature
            },
            json={
                "message": prompt,
                "sessionId": f"swarm_{agent_id}",
                "agent_id": agent_id
            }
        )

        if response.status_code == 200:
            data = response.json()
            return data["response"]
        else:
            raise Exception(f"Agent call failed: {response.status_code} - {response.text}")

    def get_project_status(self, project_id: str) -> Dict[str, Any]:
        """Get current project status"""
        if project_id not in self.projects:
            return {"error": "Project not found"}

        project = self.projects[project_id]

        return {
            "project_id": project_id,
            "name": project.name,
            "status": project.status,
            "tasks": {
                "total": len(project.tasks),
                "completed": len([t for t in project.tasks if t.status == TaskStatus.COMPLETED]),
                "in_progress": len([t for t in project.tasks if t.status == TaskStatus.IN_PROGRESS]),
                "pending": len([t for t in project.tasks if t.status == TaskStatus.PENDING]),
                "failed": len([t for t in project.tasks if t.status == TaskStatus.FAILED])
            },
            "agents": {
                "total": len(project.agents),
                "idle": len([a for a in project.agents if a.status == "idle"]),
                "busy": len([a for a in project.agents if a.status == "busy"])
            },
            "created_at": project.created_at,
            "updated_at": project.updated_at
        }

async def main():
    """Example usage of the swarm orchestrator"""
    # Initialize orchestrator
    orchestrator = SwarmOrchestrator(
        cloudflare_worker_url="https://omni-agent-router.jonanscheffler.workers.dev",
        shared_secret=os.getenv("SHARED_SECRET", "test-secret-for-development-only")
    )

    # Create a sample project
    project_id = await orchestrator.create_project(
        name="Sample Web App",
        description="A simple web application with user authentication",
        requirements=[
            "Create a web application with user registration and login",
            "Implement secure password handling",
            "Add a dashboard for authenticated users",
            "Include basic CRUD operations for user data",
            "Add responsive design for mobile devices"
        ]
    )

    print(f"Created project: {project_id}")

    # Execute the project
    result = await orchestrator.execute_project(project_id)
    print(f"Project execution result: {json.dumps(result, indent=2)}")

    # Get final status
    status = orchestrator.get_project_status(project_id)
    print(f"Final project status: {json.dumps(status, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())
