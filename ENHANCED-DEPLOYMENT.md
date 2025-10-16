# 🚀 Enhanced Omni-Agent Deployment

## Overview

The enhanced deployment adds powerful function calling capabilities to Omni-Agent, transforming it from a simple text proxy into a full-featured AI assistant with tool access.

## 🆕 New Capabilities

### Function Calling
- **Groq Integration**: Native function calling support with system prompts
- **Tool Awareness**: LLMs know exactly what tools they have available
- **Automatic Tool Selection**: AI decides when and how to use tools

### Command Execution
- **Safe Shell Commands**: Execute commands in sandboxed environment
- **Allowlist Security**: Only approved commands can be executed
- **Working Directory Support**: Commands run in specified directories

### Web Browsing
- **Playwright Integration**: Full headless browser capabilities
- **Page Interaction**: Click, type, and interact with web pages
- **Content Extraction**: Get page content and text for analysis
- **Screenshot Support**: Capture page screenshots

### File Operations
- **Read Files**: Read file contents safely
- **Write Files**: Create and modify files
- **List Directory**: Browse directory contents
- **Security**: Prevents directory traversal attacks

### Shared Context
- **Persistent Memory**: Information persists across sessions
- **Session Management**: Context tied to user sessions
- **KV Storage**: Fast, reliable context storage

## 🛠️ Deployment Options

### Standard Deployment
```bash
./deploy.sh
```
Deploys the current working system with voice capabilities.

### Enhanced Deployment
```bash
./deploy.sh --enhanced
```
Deploys with all new function calling capabilities.

## 🔧 Enhanced Deployment Process

### 1. Backup Creation
- Creates timestamped backup of current deployment
- Backs up worker config, deployment URLs, and environment
- Ensures safe rollback capability

### 2. KV Namespace Setup
- Creates CONTEXT namespace for shared context storage
- Updates wrangler.toml with new namespace binding
- Maintains existing USAGE and CHALLENGES namespaces

### 3. Enhanced Runloop Deployment
- Installs Playwright and web browsing tools
- Adds command execution endpoints
- Creates enhanced server with all new capabilities
- Maintains backward compatibility with voice services

### 4. Cloudflare Worker Enhancement
- Adds function calling support for Groq
- Implements system prompts with tool definitions
- Adds function execution handlers
- Maintains compatibility with existing providers

### 5. Testing and Verification
- Local worker testing before deployment
- Deployed worker verification
- Health check validation
- Automatic rollback on failure

## 🔄 Rollback Mechanism

### Automatic Rollback
The enhanced deployment automatically rolls back if:
- Local worker test fails
- Deployed worker test fails
- Runloop deployment fails
- Any critical step fails

### Manual Rollback
```bash
./rollback.sh backup-YYYYMMDD-HHMMSS
```

### Rollback Process
1. Restores worker configuration
2. Restores deployment URLs
3. Restores environment configuration
4. Redeploys restored worker
5. Verifies restored functionality

## 🎯 Available Functions

### execute_command
Execute shell commands safely
```json
{
  "command": "ls -la",
  "working_directory": "/workspace"
}
```

### browse_web
Browse and interact with web pages
```json
{
  "url": "https://example.com",
  "action": "get"
}
```

### read_file
Read file contents
```json
{
  "path": "filename.txt"
}
```

### write_file
Write content to file
```json
{
  "path": "filename.txt",
  "content": "Hello, World!"
}
```

### list_files
List directory contents
```json
{
  "path": "."
}
```

### save_context
Save information for future sessions
```json
{
  "key": "user_preference",
  "value": "dark_mode"
}
```

## 🔐 Security Features

### Command Execution Security
- **Allowlist**: Only approved commands can be executed
- **Timeout**: Commands timeout after 30 seconds
- **Working Directory**: Commands run in safe directories
- **No Root Access**: Commands run with limited privileges

### File Operation Security
- **Path Validation**: Prevents directory traversal attacks
- **Relative Paths**: Only relative paths allowed
- **Size Limits**: File operations have reasonable limits

### Web Browsing Security
- **Headless Mode**: No GUI access
- **Timeout**: Page loads timeout after 10 seconds
- **Sandboxed**: Browser runs in isolated environment

## 📊 System Architecture

```
Frontend (Cloudflare Pages)
    ↓
Cloudflare Worker (Enhanced)
    ↓
┌─────────────────┬─────────────────┐
│   LLM Providers │  Runloop Server │
│   (Groq/Gemini) │  (Enhanced)     │
└─────────────────┴─────────────────┘
    ↓                    ↓
Function Calls    Command Execution
System Prompts    Web Browsing
Shared Context    File Operations
```

## 🧪 Testing Enhanced Features

### 1. Basic Function Calling
```
User: "List the files in the current directory"
AI: [Calls list_files function]
Response: "Here are the files in the current directory: ..."
```

### 2. Command Execution
```
User: "Run the command 'ls -la' to see detailed file listing"
AI: [Calls execute_command function]
Response: "I ran 'ls -la' and here's the output: ..."
```

### 3. Web Browsing
```
User: "Browse to https://example.com and tell me what's on the page"
AI: [Calls browse_web function]
Response: "I browsed to https://example.com and found: ..."
```

### 4. File Operations
```
User: "Create a file called 'test.txt' with the content 'Hello, World!'"
AI: [Calls write_file function]
Response: "I created test.txt with the content 'Hello, World!'"
```

### 5. Shared Context
```
User: "Remember that I prefer dark mode"
AI: [Calls save_context function]
Response: "I've saved your preference for dark mode"
```

## 🚨 Troubleshooting

### Function Calling Not Working
1. Check if Runloop is deployed and accessible
2. Verify CONTEXT KV namespace exists
3. Check worker logs for errors
4. Test individual endpoints manually

### Command Execution Failing
1. Verify command is in allowlist
2. Check Runloop server logs
3. Ensure working directory exists
4. Test with simple commands first

### Web Browsing Issues
1. Check Playwright installation
2. Verify browser binaries are installed
3. Test with simple URLs first
4. Check network connectivity

### Context Not Persisting
1. Verify CONTEXT KV namespace binding
2. Check session ID consistency
3. Verify KV storage permissions
4. Test context save/retrieve manually

## 📈 Performance Considerations

### Function Call Overhead
- Function calls add ~200-500ms latency
- Context retrieval adds ~50-100ms
- Web browsing can take 2-10 seconds

### Resource Usage
- Playwright uses ~100MB RAM
- KV storage has 100MB limit
- Worker has 128MB memory limit

### Optimization Tips
- Use simple commands when possible
- Cache frequently accessed context
- Limit web browsing to essential pages
- Use appropriate timeouts

## 🔮 Future Enhancements

### Planned Features
- **Code Execution**: Sandboxed code execution environment
- **Database Access**: Connect to databases
- **API Integrations**: Connect to external APIs
- **Image Generation**: Generate images with AI
- **Voice Commands**: Voice-activated function calls

### Potential Integrations
- **GitHub**: Direct repository access
- **Cloudinary**: Image processing and storage
- **Slack/Discord**: Chat platform integration
- **Jupyter**: Notebook execution
- **Docker**: Container management

## 📞 Support

### Getting Help
1. Check this documentation first
2. Review deployment logs
3. Test individual components
4. Use rollback if needed

### Common Issues
- **Deployment fails**: Check API keys and permissions
- **Functions not working**: Verify Runloop deployment
- **Context lost**: Check KV namespace configuration
- **Performance slow**: Optimize function calls

---

**Ready to deploy enhanced Omni-Agent?**
```bash
./deploy.sh --enhanced
```
