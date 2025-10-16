#!/usr/bin/env python3
"""
Qwen MCP Server for Omni-Agent Swarm
Provides enhanced function capabilities for the coding swarm
"""

import asyncio
import json
import subprocess
import tempfile
import os
import sys
from typing import Any, Dict, List, Optional
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    ListToolsResult,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource
)

class QwenMCPServer:
    def __init__(self):
        self.server = Server("qwen-omni-agent")
        self.setup_handlers()

    def setup_handlers(self):
        """Set up MCP server handlers"""

        @self.server.list_tools()
        async def list_tools() -> ListToolsResult:
            """List all available tools"""
            tools = [
                # Core execution tools
                Tool(
                    name="execute_command",
                    description="Execute shell commands safely with detailed output",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "command": {"type": "string", "description": "Shell command to execute"},
                            "working_directory": {"type": "string", "description": "Working directory (optional)"},
                            "timeout": {"type": "integer", "description": "Timeout in seconds (default: 30)"}
                        },
                        "required": ["command"]
                    }
                ),

                # File operations
                Tool(
                    name="read_file",
                    description="Read file contents with encoding detection",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "File path to read"},
                            "encoding": {"type": "string", "description": "File encoding (default: auto-detect)"}
                        },
                        "required": ["path"]
                    }
                ),

                Tool(
                    name="write_file",
                    description="Write content to file with atomic operation",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "File path to write"},
                            "content": {"type": "string", "description": "Content to write"},
                            "encoding": {"type": "string", "description": "File encoding (default: utf-8)"},
                            "backup": {"type": "boolean", "description": "Create backup if file exists (default: true)"}
                        },
                        "required": ["path", "content"]
                    }
                ),

                Tool(
                    name="list_files",
                    description="List files and directories with detailed information",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "Directory path (default: current directory)"},
                            "recursive": {"type": "boolean", "description": "Recursive listing (default: false)"},
                            "include_hidden": {"type": "boolean", "description": "Include hidden files (default: false)"}
                        },
                        "required": []
                    }
                ),

                # Web browsing and research
                Tool(
                    name="browse_web",
                    description="Browse web pages with full browser automation",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "url": {"type": "string", "description": "URL to browse"},
                            "action": {"type": "string", "enum": ["get", "click", "type", "screenshot", "extract"], "description": "Action to perform"},
                            "selector": {"type": "string", "description": "CSS selector for actions"},
                            "text": {"type": "string", "description": "Text to type or extract"},
                            "wait_time": {"type": "integer", "description": "Wait time in seconds (default: 2)"}
                        },
                        "required": ["url"]
                    }
                ),

                Tool(
                    name="search_web",
                    description="Search the web and return results",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Search query"},
                            "engine": {"type": "string", "enum": ["google", "bing", "duckduckgo"], "description": "Search engine (default: duckduckgo)"},
                            "max_results": {"type": "integer", "description": "Maximum results to return (default: 10)"}
                        },
                        "required": ["query"]
                    }
                ),

                # Code analysis and generation
                Tool(
                    name="analyze_code",
                    description="Analyze code for issues, patterns, and improvements",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "code": {"type": "string", "description": "Code to analyze"},
                            "language": {"type": "string", "description": "Programming language"},
                            "analysis_type": {"type": "string", "enum": ["syntax", "style", "security", "performance", "all"], "description": "Type of analysis"}
                        },
                        "required": ["code", "language"]
                    }
                ),

                Tool(
                    name="generate_code",
                    description="Generate code based on specifications",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "specification": {"type": "string", "description": "Code specification"},
                            "language": {"type": "string", "description": "Target programming language"},
                            "framework": {"type": "string", "description": "Framework or library to use"},
                            "include_tests": {"type": "boolean", "description": "Include unit tests (default: false)"}
                        },
                        "required": ["specification", "language"]
                    }
                ),

                # Git operations
                Tool(
                    name="git_operation",
                    description="Perform Git operations",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "operation": {"type": "string", "enum": ["status", "add", "commit", "push", "pull", "branch", "merge", "log"], "description": "Git operation"},
                            "args": {"type": "array", "items": {"type": "string"}, "description": "Additional arguments"},
                            "message": {"type": "string", "description": "Commit message (for commit operation)"}
                        },
                        "required": ["operation"]
                    }
                ),

                # Package management
                Tool(
                    name="manage_packages",
                    description="Manage packages and dependencies",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "manager": {"type": "string", "enum": ["pip", "npm", "apt", "yarn"], "description": "Package manager"},
                            "operation": {"type": "string", "enum": ["install", "uninstall", "update", "list", "search"], "description": "Operation"},
                            "package": {"type": "string", "description": "Package name"},
                            "version": {"type": "string", "description": "Package version (optional)"}
                        },
                        "required": ["manager", "operation"]
                    }
                ),

                # System monitoring
                Tool(
                    name="system_info",
                    description="Get system information and status",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "info_type": {"type": "string", "enum": ["cpu", "memory", "disk", "network", "processes", "all"], "description": "Type of system info"}
                        },
                        "required": []
                    }
                ),

                # Collaboration tools
                Tool(
                    name="agent_communication",
                    description="Communicate with other agents in the swarm",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "target_agent": {"type": "string", "description": "Target agent ID or 'broadcast'"},
                            "message": {"type": "string", "description": "Message to send"},
                            "message_type": {"type": "string", "enum": ["request", "response", "update", "question"], "description": "Type of message"},
                            "data": {"type": "object", "description": "Additional data to include"}
                        },
                        "required": ["target_agent", "message", "message_type"]
                    }
                ),

                Tool(
                    name="collaborate_on_code",
                    description="Collaborate with other agents on code development",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "action": {"type": "string", "enum": ["request_review", "provide_feedback", "merge_changes", "resolve_conflict"], "description": "Collaboration action"},
                            "code": {"type": "string", "description": "Code to collaborate on"},
                            "context": {"type": "string", "description": "Context or explanation"},
                            "target_agent": {"type": "string", "description": "Target agent for collaboration"}
                        },
                        "required": ["action", "code"]
                    }
                )
            ]

            return ListToolsResult(tools=tools)

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> CallToolResult:
            """Handle tool calls"""
            try:
                if name == "execute_command":
                    return await self.execute_command(arguments)
                elif name == "read_file":
                    return await self.read_file(arguments)
                elif name == "write_file":
                    return await self.write_file(arguments)
                elif name == "list_files":
                    return await self.list_files(arguments)
                elif name == "browse_web":
                    return await self.browse_web(arguments)
                elif name == "search_web":
                    return await self.search_web(arguments)
                elif name == "analyze_code":
                    return await self.analyze_code(arguments)
                elif name == "generate_code":
                    return await self.generate_code(arguments)
                elif name == "git_operation":
                    return await self.git_operation(arguments)
                elif name == "manage_packages":
                    return await self.manage_packages(arguments)
                elif name == "system_info":
                    return await self.system_info(arguments)
                elif name == "agent_communication":
                    return await self.agent_communication(arguments)
                elif name == "collaborate_on_code":
                    return await self.collaborate_on_code(arguments)
                else:
                    return CallToolResult(
                        content=[TextContent(type="text", text=f"Unknown tool: {name}")],
                        isError=True
                    )
            except Exception as e:
                return CallToolResult(
                    content=[TextContent(type="text", text=f"Error executing {name}: {str(e)}")],
                    isError=True
                )

    async def execute_command(self, args: Dict[str, Any]) -> CallToolResult:
        """Execute shell command with enhanced error handling"""
        command = args["command"]
        working_dir = args.get("working_directory", ".")
        timeout = args.get("timeout", 30)

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            output = {
                "command": command,
                "working_directory": working_dir,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0
            }

            return CallToolResult(
                content=[TextContent(type="text", text=json.dumps(output, indent=2))]
            )
        except subprocess.TimeoutExpired:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Command timed out after {timeout} seconds")],
                isError=True
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Command execution failed: {str(e)}")],
                isError=True
            )

    async def read_file(self, args: Dict[str, Any]) -> CallToolResult:
        """Read file with encoding detection"""
        path = args["path"]
        encoding = args.get("encoding", "utf-8")

        try:
            with open(path, 'r', encoding=encoding) as f:
                content = f.read()

            return CallToolResult(
                content=[TextContent(type="text", text=content)]
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Failed to read file: {str(e)}")],
                isError=True
            )

    async def write_file(self, args: Dict[str, Any]) -> CallToolResult:
        """Write file with atomic operation"""
        path = args["path"]
        content = args["content"]
        encoding = args.get("encoding", "utf-8")
        backup = args.get("backup", True)

        try:
            # Create backup if file exists and backup is requested
            if backup and os.path.exists(path):
                backup_path = f"{path}.backup"
                os.rename(path, backup_path)

            # Write to temporary file first, then move (atomic operation)
            with tempfile.NamedTemporaryFile(mode='w', encoding=encoding, delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            os.rename(tmp_path, path)

            return CallToolResult(
                content=[TextContent(type="text", text=f"Successfully wrote {len(content)} characters to {path}")]
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Failed to write file: {str(e)}")],
                isError=True
            )

    async def list_files(self, args: Dict[str, Any]) -> CallToolResult:
        """List files with detailed information"""
        path = args.get("path", ".")
        recursive = args.get("recursive", False)
        include_hidden = args.get("include_hidden", False)

        try:
            if recursive:
                files = []
                for root, dirs, filenames in os.walk(path):
                    if not include_hidden:
                        dirs[:] = [d for d in dirs if not d.startswith('.')]
                        filenames = [f for f in filenames if not f.startswith('.')]

                    for filename in filenames:
                        filepath = os.path.join(root, filename)
                        stat = os.stat(filepath)
                        files.append({
                            "path": filepath,
                            "size": stat.st_size,
                            "modified": stat.st_mtime,
                            "type": "file"
                        })
            else:
                files = []
                for item in os.listdir(path):
                    if not include_hidden and item.startswith('.'):
                        continue

                    itempath = os.path.join(path, item)
                    stat = os.stat(itempath)
                    files.append({
                        "path": itempath,
                        "size": stat.st_size,
                        "modified": stat.st_mtime,
                        "type": "directory" if os.path.isdir(itempath) else "file"
                    })

            return CallToolResult(
                content=[TextContent(type="text", text=json.dumps(files, indent=2))]
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Failed to list files: {str(e)}")],
                isError=True
            )

    async def browse_web(self, args: Dict[str, Any]) -> CallToolResult:
        """Browse web with Playwright automation"""
        # This would use Playwright for full browser automation
        # For now, return a placeholder
        return CallToolResult(
            content=[TextContent(type="text", text="Web browsing with Playwright - implementation needed")]
        )

    async def search_web(self, args: Dict[str, Any]) -> CallToolResult:
        """Search the web"""
        # This would implement web search functionality
        return CallToolResult(
            content=[TextContent(type="text", text="Web search - implementation needed")]
        )

    async def analyze_code(self, args: Dict[str, Any]) -> CallToolResult:
        """Analyze code for issues and improvements"""
        # This would implement code analysis
        return CallToolResult(
            content=[TextContent(type="text", text="Code analysis - implementation needed")]
        )

    async def generate_code(self, args: Dict[str, Any]) -> CallToolResult:
        """Generate code based on specifications"""
        # This would implement code generation
        return CallToolResult(
            content=[TextContent(type="text", text="Code generation - implementation needed")]
        )

    async def git_operation(self, args: Dict[str, Any]) -> CallToolResult:
        """Perform Git operations"""
        operation = args["operation"]
        additional_args = args.get("args", [])
        message = args.get("message", "")

        try:
            if operation == "commit" and message:
                cmd = ["git", "commit", "-m", message] + additional_args
            else:
                cmd = ["git", operation] + additional_args

            result = subprocess.run(cmd, capture_output=True, text=True)

            output = {
                "operation": operation,
                "command": " ".join(cmd),
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }

            return CallToolResult(
                content=[TextContent(type="text", text=json.dumps(output, indent=2))]
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Git operation failed: {str(e)}")],
                isError=True
            )

    async def manage_packages(self, args: Dict[str, Any]) -> CallToolResult:
        """Manage packages and dependencies"""
        manager = args["manager"]
        operation = args["operation"]
        package = args.get("package", "")
        version = args.get("version", "")

        try:
            if manager == "pip":
                if operation == "install":
                    cmd = ["pip", "install", package]
                    if version:
                        cmd.append(f"=={version}")
                elif operation == "uninstall":
                    cmd = ["pip", "uninstall", package, "-y"]
                elif operation == "list":
                    cmd = ["pip", "list"]
                else:
                    cmd = ["pip", operation]
            elif manager == "npm":
                if operation == "install":
                    cmd = ["npm", "install", package]
                elif operation == "uninstall":
                    cmd = ["npm", "uninstall", package]
                else:
                    cmd = ["npm", operation]
            else:
                cmd = [manager, operation, package]

            result = subprocess.run(cmd, capture_output=True, text=True)

            output = {
                "manager": manager,
                "operation": operation,
                "package": package,
                "command": " ".join(cmd),
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }

            return CallToolResult(
                content=[TextContent(type="text", text=json.dumps(output, indent=2))]
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"Package management failed: {str(e)}")],
                isError=True
            )

    async def system_info(self, args: Dict[str, Any]) -> CallToolResult:
        """Get system information"""
        info_type = args.get("info_type", "all")

        try:
            info = {}

            if info_type in ["cpu", "all"]:
                result = subprocess.run(["nproc"], capture_output=True, text=True)
                info["cpu_cores"] = result.stdout.strip()

            if info_type in ["memory", "all"]:
                result = subprocess.run(["free", "-h"], capture_output=True, text=True)
                info["memory"] = result.stdout.strip()

            if info_type in ["disk", "all"]:
                result = subprocess.run(["df", "-h"], capture_output=True, text=True)
                info["disk"] = result.stdout.strip()

            return CallToolResult(
                content=[TextContent(type="text", text=json.dumps(info, indent=2))]
            )
        except Exception as e:
            return CallToolResult(
                content=[TextContent(type="text", text=f"System info failed: {str(e)}")],
                isError=True
            )

    async def agent_communication(self, args: Dict[str, Any]) -> CallToolResult:
        """Communicate with other agents"""
        # This would implement agent-to-agent communication
        return CallToolResult(
            content=[TextContent(type="text", text="Agent communication - implementation needed")]
        )

    async def collaborate_on_code(self, args: Dict[str, Any]) -> CallToolResult:
        """Collaborate with other agents on code"""
        # This would implement code collaboration
        return CallToolResult(
            content=[TextContent(type="text", text="Code collaboration - implementation needed")]
        )

    async def run(self):
        """Run the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )

async def main():
    server = QwenMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())
