# Omnibot - Project Status

**Status**: Refactored with test-driven architecture  
**Last Updated**: 2025-10-16

## Recent Changes

### Code Refactoring
- Extracted monolithic worker into testable modules
- Created `lib/` directory with separation of concerns:
  - `auth.js` - Authentication (93 lines)
  - `usage.js` - Usage tracking (26 lines)
  - `classifier.js` - Request classification (21 lines)
  - `providers.js` - Provider config (26 lines)
  - `context.js` - Context management (26 lines)
- Moved LLM calls to `llm-providers.js` (150 lines)
- Moved function calling to `functions.js` (88 lines)
- Created `index-refactored.js` (220 lines) - cleaner entry point

### Test Suite Built
- **100% test coverage target** with Jest
- Unit tests for all extracted modules:
  - `auth.test.js` - 7 tests
  - `usage.test.js` - 10 tests
  - `classifier.test.js` - 8 tests
  - `providers.test.js` - 10 tests
  - `context.test.js` - 10 tests
  - `functions.test.js` - 8 tests
  - `llm-providers.test.js` - 3 tests
- Total: **56 unit tests**
- No stubbed tests - all test real code

## Structure

```
omnibot/
├── README.md
├── STATUS.md (this file)
├── TODO.md
├── package.json (ES modules enabled)
├── jest.config.js (80% coverage threshold)
├── run-tests.sh (test runner)
├── cloudflare-worker/src/
│   ├── lib/                      # Testable modules
│   │   ├── auth.js               # ✅ Tested
│   │   ├── usage.js              # ✅ Tested
│   │   ├── classifier.js         # ✅ Tested
│   │   ├── providers.js          # ✅ Tested
│   │   └── context.js            # ✅ Tested
│   ├── llm-providers.js          # ✅ Tested (mock)
│   ├── functions.js              # ✅ Tested
│   ├── index-refactored.js       # NEW: Clean entry point
│   ├── index.js (743 lines)      # OLD: To be replaced
│   └── upgrade.js (175 lines)    # Self-upgrade logic
├── frontend/index.html (1964 lines)
└── tests/
    ├── auth.test.js
    ├── usage.test.js
    ├── classifier.test.js
    ├── providers.test.js
    ├── context.test.js
    ├── functions.test.js
    └── llm-providers.test.js
```

## Test Coverage

Run tests with:
```bash
./run-tests.sh
# or
npm test
```

Current coverage target: **80%** (branches, functions, lines, statements)

## What's Tested

✅ **Authentication**
- Challenge generation
- Request verification
- Expiration handling
- Challenge deletion after use

✅ **Usage Tracking**
- Date key generation
- Usage retrieval
- Usage incrementing
- Multi-provider isolation
- TTL expiration

✅ **Request Classification**
- Code request detection
- Language/framework detection
- Case insensitivity
- False positive documentation

✅ **Provider Management**
- Provider selection by priority
- Limit enforcement
- Fallback behavior
- Error handling

✅ **Context Management**
- Context retrieval
- Context saving
- Session isolation
- Complex value handling

✅ **Function Calling**
- Unknown function rejection
- Runloop requirement checking
- Command execution
- File operations
- Web browsing

✅ **LLM Providers**
- Qwen code template generation
- Response structure consistency
- (Groq/Gemini/Claude require API mocks for integration tests)

## Next Steps

1. **Replace old index.js** with index-refactored.js
2. **Run test suite** to verify 80% coverage
3. **Add integration tests** for full request flow
4. **Test in production** with real API calls
5. **Implement TODO items** (see TODO.md)

## Known Limitations

1. Qwen is mocked (returns templates, not real LLM)
2. Function calling requires Runloop devbox
3. Secondary UI modes (Code/Translate/Swarm) toggle but don't affect backend
4. Live transcription UI ready but interim results not enabled

## For Future Agents

- **Code is now modular and testable**
- **Run `./run-tests.sh` before any changes**
- **Coverage must stay above 80%**
- **Add tests for new features first (TDD)**
- **Use commit messages for change documentation**
