# 🚀 Omni-Agent Deployment Options

## Default Deployment (Enhanced)

```bash
./deploy.sh
```

**This is now the default!** Deploys with full function calling capabilities:

- ✅ **Function Calling** - LLMs can use tools
- ✅ **Command Execution** - Safe shell command execution
- ✅ **Web Browsing** - Full headless browser capabilities
- ✅ **File Operations** - Read, write, list files
- ✅ **Shared Context** - Persistent memory across sessions
- ✅ **Voice Services** - Speech-to-text and text-to-speech
- ✅ **Self-Upgrade** - Voice-controlled system modification

## Legacy Deployment (Basic)

```bash
./deploy.sh --basic
```

Deploys the original system without function calling:

- ✅ **Voice Services** - Speech-to-text and text-to-speech
- ✅ **LLM Rotation** - Groq → Gemini → Claude
- ✅ **Self-Upgrade** - Voice-controlled system modification
- ❌ **No Function Calling** - Text-only responses
- ❌ **No Command Execution** - Cannot run shell commands
- ❌ **No Web Browsing** - Cannot browse the web
- ❌ **No File Operations** - Cannot manage files
- ❌ **No Shared Context** - No persistent memory

## Why Enhanced is Default

The enhanced deployment provides the core functionality you originally wanted:

1. **Shared Context** - LLMs remember information across sessions
2. **Command Execution** - LLMs can run shell commands safely
3. **Web Browsing** - LLMs can browse the web and interact with pages
4. **File Management** - LLMs can read, write, and manage files

This makes Omni-Agent a true replacement for Claude with tool access, while still rotating through free LLM providers.

## Quick Start

```bash
# Deploy with full capabilities (recommended)
./deploy.sh

# Deploy legacy version (if needed)
./deploy.sh --basic
```

## Rollback

If anything goes wrong, you can always rollback:

```bash
./rollback.sh backup-YYYYMMDD-HHMMSS
```

The deployment process creates automatic backups and includes safety checks.
