# 🧪 Testing Strategy & BDD Approach

**Goal:** Achieve 100% test coverage with Behavior-Driven Development (BDD) methodology

## 📊 Current Test Coverage Analysis

### Coverage Report Summary
```
file                 | line % | branch % | funcs % | uncovered lines
-----------------------------------------------------------------
functions.js         |  91.03 |    75.00 |   83.33 | 20 54-59
llm-providers.js     |  32.70 |   100.00 |   25.00 | 14-46 49-85 123-159
auth.js              | 100.00 |   100.00 |  100.00 | ✅
classifier.js        | 100.00 |   100.00 |  100.00 | ✅
context.js           | 100.00 |   100.00 |  100.00 | ✅
providers.js         | 100.00 |   100.00 |  100.00 | ✅
usage.js             | 100.00 |   100.00 |  100.00 | ✅
-----------------------------------------------------------------
all files            |  69.11 |    91.07 |   80.95 |
```

### Critical Gaps Identified
1. **LLM Providers** (32.70% coverage) - Main API calls untested
2. **Functions** (91.03% coverage) - Some error paths uncovered
3. **Main Router** (index.js) - 0% coverage (not in test suite)
4. **Upgrade System** (upgrade.js) - 0% coverage (not in test suite)

---

## 🎯 BDD User Stories

### Epic 1: LLM Provider Integration

#### Story 1.1: Groq API Integration
**As a** user
**I want** the system to call Groq API for chat responses
**So that** I get fast, high-quality responses

**Acceptance Criteria:**
- ✅ Given valid API key, when calling Groq, then response is returned
- ✅ Given invalid API key, when calling Groq, then error is thrown
- ✅ Given network failure, when calling Groq, then error is handled gracefully
- ✅ Given rate limit, when calling Groq, then appropriate error is returned
- ✅ Given conversation context, when calling Groq, then context is included in request

#### Story 1.2: Gemini API Integration
**As a** user
**I want** the system to call Gemini API as fallback
**So that** I have reliable backup when Groq fails

**Acceptance Criteria:**
- ✅ Given valid API key, when calling Gemini, then response is returned in Groq format
- ✅ Given invalid API key, when calling Gemini, then error is thrown
- ✅ Given conversation history, when calling Gemini, then history is properly formatted
- ✅ Given error response, when calling Gemini, then error is parsed and thrown

#### Story 1.3: Claude API Integration
**As a** user
**I want** the system to call Claude API for premium responses
**So that** I get high-quality responses when needed

**Acceptance Criteria:**
- ✅ Given valid API key, when calling Claude, then response is returned in Groq format
- ✅ Given invalid API key, when calling Claude, then error is thrown
- ✅ Given system prompt, when calling Claude, then prompt is included
- ✅ Given conversation context, when calling Claude, then context is preserved

#### Story 1.4: Qwen Mock Implementation
**As a** user
**I want** the system to provide coding responses via Qwen
**So that** I get specialized coding assistance

**Acceptance Criteria:**
- ✅ Given coding request, when calling Qwen, then coding template is returned
- ✅ Given user message, when calling Qwen, then message is included in response
- ✅ Given any request, when calling Qwen, then consistent response structure is returned

### Epic 2: Main Router Functionality

#### Story 2.1: Challenge Endpoint
**As a** client
**I want** to get authentication challenges
**So that** I can authenticate requests

**Acceptance Criteria:**
- ✅ Given GET request to /challenge, when called, then challenge object is returned
- ✅ Given challenge request, when called, then challenge is stored in KV
- ✅ Given challenge request, when called, then challenge has expiration
- ✅ Given challenge request, when called, then CORS headers are set

#### Story 2.2: Chat Endpoint
**As a** user
**I want** to send chat messages
**So that** I can interact with the AI

**Acceptance Criteria:**
- ✅ Given authenticated request, when sending chat, then response is returned
- ✅ Given unauthenticated request, when sending chat, then 401 error is returned
- ✅ Given conversation history, when sending chat, then history is preserved
- ✅ Given function call response, when sending chat, then function is executed
- ✅ Given provider failure, when sending chat, then fallback is attempted
- ✅ Given all providers fail, when sending chat, then graceful error is returned

#### Story 2.3: Status Endpoint
**As a** user
**I want** to check system status
**So that** I can monitor usage and health

**Acceptance Criteria:**
- ✅ Given GET request to /status, when called, then usage stats are returned
- ✅ Given Runloop API key, when calling status, then credit info is included
- ✅ Given missing API key, when calling status, then error is handled gracefully
- ✅ Given status request, when called, then all provider usage is included

#### Story 2.4: Health Endpoint
**As a** monitoring system
**I want** to check service health
**So that** I can verify the service is running

**Acceptance Criteria:**
- ✅ Given GET request to /health, when called, then health status is returned
- ✅ Given health request, when called, then capabilities are listed
- ✅ Given health request, when called, then timestamp is included

#### Story 2.5: TTS/STT Endpoints
**As a** user
**I want** voice input/output capabilities
**So that** I can interact via voice

**Acceptance Criteria:**
- ✅ Given valid TTS request, when called, then audio is returned
- ✅ Given missing Runloop URL, when calling TTS, then error is returned
- ✅ Given valid STT request, when called, then transcription is returned
- ✅ Given missing Runloop URL, when calling STT, then error is returned

### Epic 3: Function Calling System

#### Story 3.1: Command Execution
**As a** user
**I want** to execute shell commands
**So that** I can interact with the system

**Acceptance Criteria:**
- ✅ Given valid command, when executing, then output is returned
- ✅ Given missing API key, when executing, then error is thrown
- ✅ Given invalid command, when executing, then error is handled
- ✅ Given command execution, when called, then Runloop API is called correctly

#### Story 3.2: File Operations
**As a** user
**I want** to read/write/list files
**So that** I can manage files through the system

**Acceptance Criteria:**
- ✅ Given valid file path, when reading, then content is returned
- ✅ Given valid file path and content, when writing, then file is created
- ✅ Given directory path, when listing, then files are returned
- ✅ Given missing path, when listing, then current directory is used
- ✅ Given file operations, when called, then commands are properly escaped

#### Story 3.3: Web Browsing
**As a** user
**I want** to browse web pages
**So that** I can access web content

**Acceptance Criteria:**
- ✅ Given valid URL, when browsing, then content is returned
- ✅ Given web browsing, when called, then curl command is constructed
- ✅ Given web browsing, when called, then Runloop API is called correctly

### Epic 4: Upgrade System

#### Story 4.1: Codebase Context Retrieval
**As a** developer
**I want** the system to fetch current codebase
**So that** upgrades can be made with full context

**Acceptance Criteria:**
- ✅ Given GitHub token, when fetching context, then files are retrieved
- ✅ Given missing token, when fetching context, then error is handled
- ✅ Given file fetch failure, when fetching context, then error is logged
- ✅ Given context request, when called, then all key files are included

#### Story 4.2: Upgrade Processing
**As a** user
**I want** to upgrade the system via voice commands
**So that** I can modify the system dynamically

**Acceptance Criteria:**
- ✅ Given valid instruction, when upgrading, then changes are made
- ✅ Given invalid instruction, when upgrading, then error is returned
- ✅ Given upgrade request, when called, then Claude API is called
- ✅ Given successful upgrade, when called, then GitHub is updated
- ✅ Given deployment needed, when upgrading, then deployment is triggered

---

## 🧪 Test Implementation Plan

### Phase 1: LLM Provider Tests (Priority: HIGH)
```javascript
// tests/llm-providers.test.js
describe('LLM Providers', () => {
  describe('callGroq', () => {
    it('should call Groq API with correct parameters', async () => {
      // Test successful API call
    });

    it('should handle API errors gracefully', async () => {
      // Test error handling
    });

    it('should include conversation context', async () => {
      // Test context inclusion
    });
  });

  describe('callGemini', () => {
    it('should format response in Groq-compatible format', async () => {
      // Test response formatting
    });

    it('should handle conversation history', async () => {
      // Test history formatting
    });
  });

  describe('callClaude', () => {
    it('should call Claude API with system prompt', async () => {
      // Test system prompt inclusion
    });
  });

  describe('callQwen', () => {
    it('should return coding template response', async () => {
      // Test mock implementation
    });
  });
});
```

### Phase 2: Main Router Tests (Priority: HIGH)
```javascript
// tests/index.test.js
describe('Main Router', () => {
  describe('Challenge Endpoint', () => {
    it('should return challenge object', async () => {
      // Test /challenge endpoint
    });
  });

  describe('Chat Endpoint', () => {
    it('should handle authenticated chat requests', async () => {
      // Test /chat endpoint
    });

    it('should handle function calls', async () => {
      // Test function call integration
    });

    it('should handle provider failures', async () => {
      // Test fallback behavior
    });
  });

  describe('Status Endpoint', () => {
    it('should return usage statistics', async () => {
      // Test /status endpoint
    });
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      // Test /health endpoint
    });
  });
});
```

### Phase 3: Function Calling Tests (Priority: MEDIUM)
```javascript
// tests/functions.test.js (extend existing)
describe('Function Calling', () => {
  describe('executeCommand', () => {
    it('should handle command execution errors', async () => {
      // Test error paths
    });
  });

  describe('browseWeb', () => {
    it('should construct curl commands correctly', async () => {
      // Test web browsing
    });
  });

  describe('fileOperations', () => {
    it('should escape content properly', async () => {
      // Test content escaping
    });
  });
});
```

### Phase 4: Upgrade System Tests (Priority: MEDIUM)
```javascript
// tests/upgrade.test.js
describe('Upgrade System', () => {
  describe('getCodebaseContext', () => {
    it('should fetch files from GitHub', async () => {
      // Test GitHub integration
    });
  });

  describe('handleUpgrade', () => {
    it('should process upgrade instructions', async () => {
      // Test upgrade processing
    });

    it('should update GitHub files', async () => {
      // Test GitHub updates
    });

    it('should trigger deployments', async () => {
      // Test deployment triggering
    });
  });
});
```

---

## 🎯 Success Metrics

### Coverage Targets
- **Line Coverage**: 100% (currently 69.11%)
- **Branch Coverage**: 100% (currently 91.07%)
- **Function Coverage**: 100% (currently 80.95%)

### Quality Metrics
- **Test Count**: 100+ tests (currently 56)
- **Test Suites**: 15+ suites (currently 22)
- **BDD Stories**: 20+ user stories covered
- **Integration Tests**: 10+ end-to-end scenarios

### Performance Metrics
- **Test Execution Time**: < 5 seconds
- **Test Reliability**: 100% pass rate
- **Test Maintainability**: Clear, readable test code

---

## 🚀 Implementation Timeline

### Week 1: Foundation
- [ ] Create BDD test structure
- [ ] Implement LLM provider tests (Stories 1.1-1.4)
- [ ] Achieve 90% coverage on llm-providers.js

### Week 2: Core Functionality
- [ ] Implement main router tests (Stories 2.1-2.5)
- [ ] Extend function calling tests (Stories 3.1-3.3)
- [ ] Achieve 95% overall coverage

### Week 3: Advanced Features
- [ ] Implement upgrade system tests (Stories 4.1-4.2)
- [ ] Add integration tests
- [ ] Achieve 100% coverage

### Week 4: Quality Assurance
- [ ] Review and refactor tests
- [ ] Add performance tests
- [ ] Document test strategy

---

## 📋 Next Actions

1. **Immediate (Today)**:
   - [ ] Review and approve user stories
   - [ ] Set up BDD test structure
   - [ ] Start with LLM provider tests

2. **This Week**:
   - [ ] Implement Phase 1 tests
   - [ ] Achieve 90% coverage
   - [ ] Validate BDD approach

3. **Next Week**:
   - [ ] Implement Phase 2 tests
   - [ ] Achieve 95% coverage
   - [ ] Prepare for Qwen implementation

---

**This testing strategy ensures we have comprehensive coverage before proceeding with Qwen implementation, following BDD principles for better test quality and maintainability.**
