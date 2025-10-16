# Omnibot - TODO

## Immediate (Before Production)

### 1. Deploy Refactored Code ⚠️ HIGH PRIORITY
- [ ] Rename `index-refactored.js` to `index.js`
- [ ] Backup old `index.js` as `index-legacy.js`
- [ ] Run test suite: `./run-tests.sh`
- [ ] Deploy to dev: `npm run deploy:dev`
- [ ] Smoke test all endpoints
- [ ] Deploy to production

### 2. Verify Test Coverage
- [ ] Run `npm run test:coverage`
- [ ] Ensure 80%+ coverage across all modules
- [ ] Review coverage report in `coverage/index.html`
- [ ] Add tests for any uncovered branches

## High Priority

### 3. Live Transcription (Frontend)
**Location**: `frontend/index.html` setupSpeechRecognition function

Change:
```javascript
recognition.interimResults = false; // Line ~1600
```

To:
```javascript
recognition.interimResults = true;

recognition.onresult = (event) => {
  let finalTranscript = '';
  let interimTranscript = '';
  
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      finalTranscript += transcript;
    } else {
      interimTranscript += transcript;
    }
  }
  
  document.getElementById('transcription-text').textContent = 
    finalTranscript || interimTranscript || 'Listening...';
  
  if (finalTranscript) {
    document.getElementById('message-input').value = finalTranscript;
  }
};
```

**Test**: Click mic, speak, verify live text appears in overlay

### 4. Mode Integration (Frontend + Backend)
**Status**: UI toggles work, but modes don't affect LLM behavior

**Frontend** (`sendChat` function):
```javascript
body: JSON.stringify({ 
  message, 
  conversation,
  modes: { codeMode, translateMode, swarmMode } // ADD THIS
})
```

**Backend** (`handleChatEndpoint` in index.js):
```javascript
const { message, conversation = [], sessionId = 'default', modes = {} } = await request.json();

// Use modes in system prompts
const systemPrompt = buildSystemPrompt(modes, context);
```

**Test**: Write tests first, then implement

### 5. Real Qwen Integration
**Current**: Returns template code
**Needed**: Real LLM API integration

Options:
- Deploy Qwen on Runloop devbox
- Use Qwen API if available
- Use another provider for code (Groq with code-focused prompt)

**Test**: Add integration test with real API call

## Medium Priority

### 6. Integration Tests
Create `tests/integration.test.js`:
```javascript
describe('Full Request Flow', () => {
  test('should handle chat request end-to-end', async () => {
    // Mock all external APIs
    // Test full request flow
    // Verify response structure
  });
});
```

### 7. Error Recovery Improvements
- Add retry logic with exponential backoff
- Better error messages to users
- Graceful degradation when providers fail

### 8. Frontend Polish
- [ ] Conversation export (JSON/clipboard)
- [ ] Theme color swatches in selector
- [ ] Keyboard shortcuts (Ctrl+/ for voice, etc.)
- [ ] Voice profiles for different languages

## Low Priority

### 9. Performance Optimization
- [ ] Cache provider selection for repeated requests
- [ ] Reduce worker cold start time
- [ ] Optimize bundle size

### 10. Documentation
- [ ] API documentation for worker endpoints
- [ ] Contributing guide
- [ ] Architecture diagram

## Testing Strategy

**For each TODO item:**

1. Write test first (TDD):
```javascript
test('should [expected behavior]', async () => {
  // Arrange
  // Act
  // Assert
});
```

2. Run test (should fail):
```bash
npm test
```

3. Implement feature

4. Run test (should pass):
```bash
npm test
```

5. Check coverage:
```bash
npm run test:coverage
```

6. Commit with message describing what/why:
```bash
git commit -m "feat: add live transcription with interim results

- Enables real-time speech display during recording
- Updates overlay text as user speaks
- Improves UX with immediate feedback"
```

## Coverage Requirements

- Minimum 80% coverage (enforced by jest.config.js)
- All new functions must have tests
- Edge cases must be tested
- Error paths must be tested

## Review Checklist

Before marking any TODO as complete:
- [ ] Tests written and passing
- [ ] Coverage at or above 80%
- [ ] Code reviewed for best practices
- [ ] Documentation updated if needed
- [ ] Committed with descriptive message
- [ ] Smoke tested in dev environment
