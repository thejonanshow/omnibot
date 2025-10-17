# 🤖 Qwen on Runloop - Implementation Plan

## Overview

Integrate Qwen (running on Runloop) as a free-tier LLM provider that handles code generation tasks locally, with optional polishing by premium APIs.

---

## Architecture

### Flow Diagram

```
User Query
    ↓
Is it a code/implementation request?
    ├─ NO  → Groq/Gemini (fast, cheap, general chat)
    │
    └─ YES → Qwen on Runloop (FREE, local, code-focused)
              ↓
              Generate response with Qwen
              ↓
              Quality Check:
              ├─ Good quality → Return directly
              └─ Needs polish → Send to Groq/Claude for cleanup
                                 ↓
                                 Return polished response
```

---

## Available Resources

From `.env` file:
- `RUNLOOP_API_KEY`: Configured
- `RUNLOOP_DEVOX_ID`: `dbx_31JZQlbSZIKUOLEIeyaIW`
- `QWEN_MCP_BLUEPRINT_ID`: `bpt_31JYaaMFYdjZOwqWjjbCj` (MCP server)
- `QWEN_OLLAMA_BLUEPRINT_ID`: `bpt_31JZBaDR6jnwqB8EzVISC` (Ollama)

**Recommendation:** Start with `QWEN_OLLAMA_BLUEPRINT_ID` for simplicity.

---

## Implementation Steps

### Phase 1: Basic Integration (30 min)

**Goal:** Get Qwen working with basic responses

1. **Update `callQwen()` function**
   ```javascript
   // cloudflare-worker/src/llm-providers.js
   
   export async function callQwen(message, conversation, env, sessionId) {
     const context = await getSharedContext(env.CONTEXT, sessionId);
     
     // Build conversation context
     const conversationText = conversation
       .map(m => `${m.role}: ${m.content}`)
       .join('\n');
     
     const prompt = `You are Qwen, a coding assistant. 
     
Context: ${JSON.stringify(context)}

Conversation:
${conversationText}

User: ${message}

Provide a helpful code-focused response with working examples.`;
     
     // Call Runloop devbox
     const response = await fetch(`https://api.runloop.ai/v1/devboxes/${env.RUNLOOP_DEVOX_ID}/execute`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${env.RUNLOOP_API_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         command: `ollama run qwen2.5-coder "${prompt.replace(/"/g, '\\"')}"`
       })
     });
     
     if (!response.ok) {
       throw new Error(`Qwen/Runloop failed: ${response.status}`);
     }
     
     const data = await response.json();
     
     return {
       choices: [{
         message: {
           content: data.stdout || data.output || 'No response from Qwen',
           role: 'assistant'
         }
       }]
     };
   }
   ```

2. **Add Runloop secrets to Cloudflare**
   ```bash
   cd cloudflare-worker
   
   # Staging
   echo "[value from .env]" | npx wrangler secret put RUNLOOP_DEVOX_ID --env staging
   echo "[value from .env]" | npx wrangler secret put QWEN_OLLAMA_BLUEPRINT_ID --env staging
   
   # Production (when ready)
   echo "[value from .env]" | npx wrangler secret put RUNLOOP_DEVOX_ID --env production
   echo "[value from .env]" | npx wrangler secret put QWEN_OLLAMA_BLUEPRINT_ID --env production
   ```

3. **Test manually**
   ```bash
   # Deploy to staging
   ./deploy.sh staging
   
   # Test via frontend or curl
   ```

---

### Phase 2: Smart Routing (1 hour)

**Goal:** Route code queries to Qwen, general queries elsewhere

1. **Enhance classifier**
   ```javascript
   // cloudflare-worker/src/lib/classifier.js
   
   export function isCodeImplementationRequest(message) {
     const codeKeywords = [
       'write', 'code', 'implement', 'create function',
       'build', 'develop', 'script', 'program',
       'algorithm', 'class', 'method', 'api',
       'python', 'javascript', 'java', 'c++', 'rust',
       'react', 'node', 'express', 'django', 'flask'
     ];
     
     const lower = message.toLowerCase();
     return codeKeywords.some(keyword => lower.includes(keyword));
   }
   ```

2. **Update router logic**
   ```javascript
   // cloudflare-worker/src/index.js
   
   import { isCodeImplementationRequest } from './lib/classifier.js';
   
   // In chat handler:
   if (isCodeImplementationRequest(message)) {
     // Use Qwen for code (free!)
     provider = { name: 'qwen', ...qwenConfig };
   } else {
     // Use existing provider selection
     provider = await selectProvider(PROVIDERS, ...);
   }
   ```

---

### Phase 3: Response Polishing (2 hours)

**Goal:** Improve Qwen responses with premium APIs when needed

1. **Add quality checker**
   ```javascript
   // cloudflare-worker/src/lib/quality.js
   
   export function needsPolish(response) {
     // Check response quality
     const issues = [];
     
     if (response.length < 50) {
       issues.push('too_short');
     }
     
     if (!response.includes('```') && response.includes('code')) {
       issues.push('missing_code_block');
     }
     
     if (response.includes('[ERROR]') || response.includes('failed')) {
       issues.push('contains_errors');
     }
     
     return issues.length > 0 ? issues : null;
   }
   ```

2. **Add polish function**
   ```javascript
   // cloudflare-worker/src/llm-providers.js
   
   async function polishResponse(rawResponse, originalQuery, env) {
     const polishPrompt = `
     The following is a code response that needs improvement.
     Please clean it up, fix any errors, and make it production-ready:
     
     Original Query: ${originalQuery}
     
     Raw Response:
     ${rawResponse}
     
     Provide an improved version with:
     - Complete, working code
     - Clear explanations
     - Proper formatting
     - Error handling
     `;
     
     // Use Groq for fast polishing
     const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${env.GROQ_API_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         model: 'llama-3.3-70b-versatile',
         messages: [
           { role: 'user', content: polishPrompt }
         ],
         max_tokens: 2000
       })
     });
     
     const data = await response.json();
     return data.choices[0].message.content;
   }
   ```

3. **Update callQwen to use polish**
   ```javascript
   export async function callQwen(message, conversation, env, sessionId) {
     // ... existing Runloop call ...
     
     const qwenResponse = data.stdout || data.output;
     
     // Check if response needs improvement
     const qualityIssues = needsPolish(qwenResponse);
     
     if (qualityIssues) {
       console.log(`Qwen response has issues: ${qualityIssues.join(', ')}`);
       const polished = await polishResponse(qwenResponse, message, env);
       
       return {
         choices: [{
           message: {
             content: `${polished}\n\n---\n_Powered by Qwen (local) + Groq (polish)_`,
             role: 'assistant'
           }
         }]
       };
     }
     
     return {
       choices: [{
         message: {
           content: `${qwenResponse}\n\n---\n_Powered by Qwen (local)_`,
           role: 'assistant'
         }
       }]
     };
   }
   ```

---

## Testing Strategy

### 1. Unit Tests

Create `tests/qwen.test.js`:
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { callQwen } from '../cloudflare-worker/src/llm-providers.js';

describe('Qwen Provider', () => {
  it('should call Runloop API', async () => {
    // Mock environment
    const env = {
      RUNLOOP_API_KEY: 'test-key',
      RUNLOOP_DEVOX_ID: 'test-devbox',
      CONTEXT: { async get() { return null; } }
    };
    
    // Test implementation
  });
  
  it('should handle code requests', async () => {
    // Test code-specific queries
  });
});
```

### 2. Integration Tests

```bash
# Test staging deployment
curl -X POST 'https://omnibot-router-staging.jonanscheffler.workers.dev/chat' \
  -H 'Content-Type: application/json' \
  -H 'X-Challenge: ...' \
  -H 'X-Signature: ...' \
  -d '{"message": "Write a Python function to sort a list"}'
```

### 3. E2E Tests

Test through the staging frontend:
1. Open https://omnibot-ui-staging.pages.dev
2. Send code request: "Write a function to reverse a string in Python"
3. Verify response comes from Qwen
4. Check quality and polish if applied

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Provider Usage**
   - Qwen requests per day
   - Polish rate (% of Qwen responses that need polishing)
   - Response time (Qwen vs other providers)

2. **Quality Indicators**
   - Average response length
   - Code block presence
   - Error rate

3. **Cost Savings**
   - API calls avoided by using Qwen
   - Cost per request comparison

### Logging

Add to router:
```javascript
console.log({
  provider: 'qwen',
  polished: qualityIssues ? true : false,
  responseLength: qwenResponse.length,
  qualityIssues: qualityIssues || 'none',
  timestamp: Date.now()
});
```

---

## Rollout Plan

### Week 1: Basic Integration
- ✅ Implement Phase 1 (basic Qwen calls)
- ✅ Deploy to staging
- ✅ Test with sample queries
- ✅ Monitor errors

### Week 2: Smart Routing
- ✅ Implement Phase 2 (classifier + routing)
- ✅ Deploy to staging
- ✅ A/B test: 50% code queries to Qwen
- ✅ Measure quality and speed

### Week 3: Polishing
- ✅ Implement Phase 3 (quality check + polish)
- ✅ Deploy to staging
- ✅ Fine-tune quality thresholds
- ✅ Optimize polish prompts

### Week 4: Production
- ✅ All metrics looking good
- ✅ Deploy to production
- ✅ Monitor closely for 48 hours
- ✅ Iterate based on real usage

---

## Fallback Strategy

If Qwen/Runloop has issues:

1. **Immediate Fallback**
   ```javascript
   try {
     return await callQwen(message, conversation, env, sessionId);
   } catch (error) {
     console.error('Qwen failed, falling back to Groq:', error);
     return await callGroq(message, conversation, env, sessionId);
   }
   ```

2. **Circuit Breaker**
   - Track Qwen error rate
   - If > 50% errors in 5 minutes → disable Qwen
   - Route all traffic to Groq temporarily
   - Auto-recover after 30 minutes

3. **Manual Override**
   - Add environment variable: `QWEN_ENABLED=true/false`
   - Can disable Qwen instantly via Cloudflare secrets

---

## Expected Benefits

### Cost Savings
- Qwen: $0 per request (runs on Runloop)
- Groq: ~$0.10 per 1M tokens
- Claude: ~$3 per 1M tokens

**If 50% of code queries use Qwen:**
- 1000 requests/day × 30 days = 30,000 requests
- Estimated savings: $50-100/month

### Performance
- Qwen response time: 2-5 seconds
- No API rate limits (local processing)
- Can handle bursts without throttling

### Quality
- Code-focused model (Qwen2.5-Coder)
- Optional polish with premium APIs
- Best of both worlds

---

## Next Actions

1. **Immediate (today):**
   - Review this plan
   - Decide on Phase 1 implementation timeline
   - Add Runloop secrets to staging environment

2. **This week:**
   - Implement Phase 1
   - Deploy to staging
   - Test manually

3. **Next week:**
   - Implement Phase 2 (smart routing)
   - Start collecting metrics

---

## Questions to Address

1. **Model Selection:** Qwen2.5-Coder vs other Ollama models?
2. **Polish Threshold:** When to polish? (length, quality, errors)
3. **Timeout:** How long to wait for Qwen before fallback?
4. **Context Window:** How much conversation history to send to Qwen?

---

## Resources

- **Runloop API Docs:** https://docs.runloop.ai
- **Qwen Model:** https://ollama.com/library/qwen2.5-coder
- **Current Devbox:** `dbx_31JZQlbSZIKUOLEIeyaIW`
- **Blueprint:** `bpt_31JZBaDR6jnwqB8EzVISC` (Ollama)
