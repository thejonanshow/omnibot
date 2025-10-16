#!/bin/bash

cat << 'EOF'

 ██████╗ ███╗   ███╗███╗   ██╗██╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██╔═══██╗████╗ ████║████╗  ██║██║     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
██║   ██║██╔████╔██║██╔██╗ ██║██║     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
██║   ██║██║╚██╔╝██║██║╚██╗██║██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
 ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
                                                                                     
Voice-Controlled AI • Multi-Provider • Auto-Rotation • $0-2/month

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 QUICK START:

   ./deploy.sh          Deploy everything (one command!)
   
   ./setup.sh           Setup API keys only
   
   ./test.sh            Verify installation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 WHAT IT DOES:

   • Deploys Cloudflare Worker (LLM router)
   • Deploys voice UI frontend
   • Sets up API keys (opens browser)
   • Configures security
   • Returns production URL
   • Takes ~5 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 FEATURES:

   ✓ Auto-rotates: Groq → Gemini → Claude → GPT
   ✓ Voice input/output
   ✓ HMAC security
   ✓ Usage tracking
   ✓ Matrix UI theme
   ✓ ~$2/month cost

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 REQUIREMENTS:

   • Node.js (auto-installed on Mac)
   • Cloudflare account (free)
   • API keys: Anthropic, OpenAI, Groq, Google

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready? Run:

    ./deploy.sh

EOF
