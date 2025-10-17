# 🗺️ Omnibot Roadmap & Implementation Plan

**Last Updated:** October 16, 2025
**Status:** Planning Phase

---

## ✅ Completed

- [x] Test framework migration (Jest → Node native)
- [x] Staging environment setup
- [x] Improved error messages
- [x] Fixed duplicate UI buttons
- [x] Security audit (no secrets in docs)

---

## 📋 Next Up

### 1. Qwen on Runloop Integration

**Goal:** Free-tier code generation with smart routing

**Implementation:**
- Smart routing: Chat → Conversational model, Code → Qwen
- Two-stage processing: Fast local Qwen, optional polish with premium APIs
- Cost savings: ~$50-100/month estimated

**Details:** See `QWEN-IMPLEMENTATION-PLAN.md`

**Timeline:** 1-2 weeks

---

### 2. Swarm Mode - Multi-Devbox Orchestration

**Goal:** Activate multiple Runloop devboxes simultaneously for parallel processing

**Architecture:**
```
User Query → Swarm Coordinator
    ↓
    ├─> Devbox 1: Code implementation
    ├─> Devbox 2: Testing & validation
    ├─> Devbox 3: Documentation generation
    └─> Devbox 4: Deployment prep
    ↓
Results aggregated → Polished response
```

**Use Cases:**
- Large refactors needing multiple file changes
- Parallel test execution
- Multi-language code generation
- Complex system implementations

**Implementation Plan:**
1. **Devbox Pool Management**
   - Create/manage multiple devbox instances
   - Load balancing and health checks
   - Resource allocation per task

2. **Task Distribution**
   - Break complex queries into subtasks
   - Assign subtasks to available devboxes
   - Monitor progress and handle failures

3. **Result Aggregation**
   - Collect outputs from all devboxes
   - Synthesize coherent response
   - Polish with conversational model

**API Design:**
```javascript
// Swarm coordinator
async function executeSwarm(task, subtasks, env) {
  // Spawn devboxes
  const devboxes = await spawnDevboxPool(subtasks.length, env);

  // Execute in parallel
  const results = await Promise.all(
    subtasks.map((subtask, i) =>
      executeOnDevbox(devboxes[i], subtask, env)
    )
  );

  // Aggregate and polish
  return await aggregateResults(results, task, env);
}
```

**Challenges:**
- Cost management (multiple devboxes running)
- Coordination complexity
- Error handling across multiple instances
- Result synthesis quality

**Timeline:** 2-3 weeks after Qwen implementation

---

### 3. Conversational Planning + Qwen Implementation

**Goal:** Use conversational model for planning, Qwen for fast implementation

**Two-Stage Process:**

**Stage 1: Planning (Conversational Model)**
```
User: "Build a REST API for user management"
    ↓
Groq/Claude:
  - Analyze requirements
  - Design architecture
  - Break into implementation steps
  - Generate detailed spec
    ↓
Planning Document
```

**Stage 2: Implementation (Qwen)**
```
Planning Document
    ↓
Qwen on Runloop:
  - Generate code for each component
  - Fast, parallel execution
  - No API costs
    ↓
Implementation Complete
```

**Benefits:**
- **Better Code:** Thoughtful architecture from conversational model
- **Faster Execution:** Qwen handles implementation without rate limits
- **Lower Cost:** Minimal premium API usage
- **Scalable:** Can parallelize with Swarm

**Flow:**
```
Complex Request
    ↓
[Conversational Model] → Creates plan
    ↓
[Qwen] → Implements plan
    ↓
[Optional: Conversational Model] → Reviews & polishes
    ↓
Response to User
```

**Implementation:**
```javascript
async function handleComplexCodeRequest(query, env) {
  // 1. Plan with conversational model
  const plan = await callGroq({
    message: `Create detailed implementation plan for: ${query}`,
    systemPrompt: 'You are a software architect...'
  });

  // 2. Implement with Qwen
  const implementation = await callQwen({
    message: plan.steps,
    mode: 'implement'
  });

  // 3. Optional polish
  if (needsReview(implementation)) {
    return await callGroq({
      message: `Review and improve: ${implementation}`,
      systemPrompt: 'You are a code reviewer...'
    });
  }

  return implementation;
}
```

**Timeline:** Can integrate with Qwen implementation (week 2-3)

---

### 4. Voice Response Summary & Enhancement

**Goal:** Add intelligent voice response summarization and context-aware voice interactions

**Features:**
- **Response Summarization**: Automatically summarize long responses for voice output
- **Context-Aware Voice**: Remember previous voice interactions and adapt responses
- **Voice Command Recognition**: Enhanced voice command parsing for system control
- **Multi-language Voice Support**: Support for different languages in voice input/output
- **Voice Response Optimization**: Optimize response length and complexity for voice delivery

**Implementation:**
```javascript
// Voice response summarization
async function summarizeForVoice(response, maxLength = 200) {
  if (response.length <= maxLength) return response;

  // Use lightweight summarization for voice
  const summary = await callGroq(
    `Summarize this for voice output (max ${maxLength} chars): ${response}`,
    [], env, sessionId
  );

  return summary.choices[0].message.content;
}

// Context-aware voice responses
async function getVoiceResponse(message, conversation, env, sessionId) {
  const isVoiceContext = await getSharedContext(env.CONTEXT, sessionId);
  const voicePreferences = isVoiceContext.voice_preferences || {};

  // Adapt response based on voice interaction history
  const response = await handleChat(message, conversation, env, sessionId);

  if (voicePreferences.summarize_long_responses) {
    return await summarizeForVoice(response.response);
  }

  return response.response;
}
```

**Benefits:**
- Better voice user experience
- Reduced cognitive load for voice interactions
- Contextual voice responses
- Multi-language support

**Timeline:** 1-2 weeks (can be parallel with other features)

---

### 5. Mobile Integration - GET Request Based Service

**Problem:** Mobile Claude can't easily POST with auth headers for chat

**Solution:** Simple GET-based query interface with URL-based auth

**Architecture:**

**Option A: Simple Query Params**
```
GET /mobile/chat?q=<query>&token=<auth_token>

Response:
{
  "response": "...",
  "conversation_id": "abc123"
}

GET /mobile/chat?q=<query>&token=<auth_token>&conversation_id=abc123
```

**Option B: Shareable Links**
```
POST /mobile/create-link
Body: { message: "...", expires_in: 3600 }

Response: {
  link: "https://omnibot.../m/xyz789"
}

GET /m/xyz789 → Returns response as HTML/JSON
```

**Option C: WebSocket Connection**
```
wss://omnibot.../mobile?token=<token>

Send: { type: "message", content: "..." }
Receive: { type: "response", content: "..." }
```

**Recommendation: Option A (Simple GET)**

**Implementation:**
```javascript
// In index.js
if (url.pathname === '/mobile/chat') {
  const query = url.searchParams.get('q');
  const token = url.searchParams.get('token');
  const convId = url.searchParams.get('conversation_id');

  // Validate token (time-based or stored)
  if (!isValidMobileToken(token, env)) {
    return new Response('Invalid token', { status: 401 });
  }

  // Get conversation history
  const conversation = await getConversation(convId, env);

  // Process with LLM
  const response = await handleChat(query, conversation, env);

  // Store conversation
  const newConvId = await storeConversation(
    convId || generateId(),
    [...conversation, response],
    env
  );

  return new Response(JSON.stringify({
    response: response.text,
    conversation_id: newConvId,
    expires_at: Date.now() + 3600000
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Security:**
- Time-limited tokens (1 hour expiry)
- Rate limiting per token
- Conversation expiry (delete after 24h)
- Optional: User-specific tokens

**Mobile Usage:**
```javascript
// From mobile Claude
const query = "What's the weather?";
const token = "[user's mobile token]";
const url = `https://omnibot.../mobile/chat?q=${encodeURIComponent(query)}&token=${token}`;

fetch(url)
  .then(r => r.json())
  .then(d => console.log(d.response));
```

**Features:**
- ✅ No complex auth headers
- ✅ Simple GET requests
- ✅ Conversation continuity
- ✅ Works from any environment
- ✅ Can be used from links/bookmarks

**Timeline:** 1 week (can be done in parallel)

---

## 🎯 Priority Order

1. **Qwen Integration** (Week 1-2)
   - Immediate cost savings
   - Foundation for other features
   - High ROI

2. **Mobile GET Service** (Week 2-3)
   - Can be parallel with Qwen
   - Enables new use cases
   - Relatively simple

3. **Planning + Implementation Flow** (Week 3-4)
   - Builds on Qwen
   - Improves code quality
   - Natural evolution

4. **Swarm Mode** (Week 4-6)
   - Most complex
   - Requires stable Qwen first
   - High value for complex tasks

---

## 📊 Success Metrics

### Qwen Integration
- API cost reduction: Target 50%
- Code quality: Maintain or improve
- Response time: <5 seconds average

### Mobile Service
- Mobile usage: Track GET vs POST ratio
- User adoption: Mobile sessions per week
- Reliability: 99%+ uptime

### Planning + Implementation
- Task success rate: >90% for complex requests
- User satisfaction: Qualitative feedback
- Time to completion: Faster than baseline

### Swarm Mode
- Parallel task completion: 3x faster for complex requests
- Resource efficiency: Cost per task
- Success rate: >85% for multi-component tasks

---

## 🔄 Iteration Strategy

1. **Build MVP** → Test on staging
2. **Gather feedback** → Real usage data
3. **Iterate quickly** → Weekly improvements
4. **Promote to prod** → When stable

**Review cadence:** Every 2 weeks
**Metrics review:** Weekly
**User feedback:** Continuous

---

## 💡 Future Ideas (Backlog)

- **Voice-first interface** for mobile
- **Persistent sessions** across devices
- **Collaborative mode** (multiple users, one bot)
- **Plugin system** for custom tools
- **Analytics dashboard** for usage tracking
- **A/B testing framework** for LLM routing
- **Custom model fine-tuning** on user data
- **Integration marketplace** (GitHub, Jira, etc.)

---

## 📝 Notes

- All implementations should start with updated tests
- Deploy to staging first, always
- Document as you go (in code comments)
- Keep the README updated with major changes
- No secrets in code, ever

---

**This is a living document. Update as priorities change.**
