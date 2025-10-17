# Testing Architecture: Paid vs Free Test Suites

## Overview

Omnibot maintains two distinct test suites to balance comprehensive testing with cost efficiency:
1. **Free Test Suite** (default) - Unit tests with mocks, safe to run thousands of times in CI
2. **Paid Test Suite** (opt-in) - Integration/E2E tests that consume API credits

## Free Test Suite (Default)

### Characteristics
- **No external API calls** - All LLM providers, Runloop, GitHub APIs are mocked
- **Fast execution** - Runs in <5 seconds
- **Unlimited runs** - Safe to run in CI, pre-commit hooks, watch mode
- **100% coverage target** - Must maintain 100% line/branch/function coverage
- **No user confirmation required** - Runs automatically

### What It Tests
- Unit tests for all modules
- Authentication and HMAC validation
- Request classification and routing logic
- Provider selection algorithms
- Error handling and fallback mechanisms
- Function calling logic
- Context management
- Usage tracking

### Commands
```bash
npm test                    # Run free test suite
npm run test:watch          # Watch mode for development
npm run test:coverage       # With coverage report and gate enforcement
```

### Example Test Structure
```javascript
// Free test - mocked external calls
it('should call Groq API with correct parameters', async () => {
  global.fetch = mock.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Test response', role: 'assistant' } }] })
  }));

  const result = await callGroq('Test message', [], mockEnv, 'session1');
  assert.ok(result.choices);
  // No actual API call made, no credits consumed
});
```

## Paid Test Suite (Opt-In)

### Characteristics
- **Real API calls** - Tests against actual LLM providers, Runloop devboxes, GitHub API
- **Slower execution** - Can take minutes depending on tests
- **Credit consumption** - Uses API credits/free tier quotas
- **Explicit confirmation** - Requires user approval before running
- **Cost estimation** - Shows estimated credit usage before running

### What It Tests
- End-to-end user flows (browser automation)
- Actual LLM provider responses
- Real Runloop devbox creation and health checks
- GitHub API integration (on test repos)
- Cloudflare deployment workflows
- Voice input/output pipelines
- Performance and latency benchmarks

### Commands
```bash
npm run test:paid                      # Run paid test suite with confirmation
npm run test:paid:groq                 # Test only Groq integration
npm run test:paid:qwen                 # Test only Qwen/Runloop integration
npm run test:paid:e2e                  # Browser-based E2E tests
npm run test:paid:estimate             # Show cost estimate without running
```

### Cost Estimation
Before running, the paid test suite shows:
```
💰 PAID TEST SUITE - COST ESTIMATION
═══════════════════════════════════════════════════════
Groq API Calls:        15 requests (~150K tokens)
  Cost: Free tier (30/day remaining)

Runloop Devboxes:      3 deployments (~5 min total)
  Cost: ~0.25 credits (22.5 remaining before reset at 2am)

GitHub API:            8 requests (test repo only)
  Cost: Free tier (unlimited)

Cloudflare API:        2 deployments (staging only)
  Cost: Free tier

TOTAL ESTIMATED COST:  ~0.25 Runloop credits
═══════════════════════════════════════════════════════

Proceed with paid tests? [y/N]:
```

### Example Paid Test Structure
```javascript
// Paid test - real API calls
describe('Paid Test Suite: Qwen Integration', () => {
  before(async () => {
    // Check for explicit approval
    if (!process.env.ALLOW_PAID_TESTS) {
      console.log('⚠️  Skipping paid tests (set ALLOW_PAID_TESTS=true to enable)');
      this.skip();
    }
  });

  it('should create real Runloop devbox and run Qwen', async () => {
    // Real API call - consumes credits
    const devbox = await createDevbox('qwen-test');
    assert.ok(devbox.id);

    const response = await callQwenOnRunloop(devbox.id, 'Write a hello world function');
    assert.ok(response.includes('def hello_world'));

    await cleanupDevbox(devbox.id);
  });
});
```

## Test Organization

```
tests/
├── unit/                       # Free tests - mocked external calls
│   ├── auth.test.js
│   ├── classifier.test.js
│   ├── context.test.js
│   ├── functions.test.js
│   ├── llm-providers.test.js
│   ├── providers.test.js
│   ├── usage.test.js
│   └── index.test.js
│
├── integration/                # Free tests - mocked but complex scenarios
│   ├── qwen-blueprint-optimization.test.js
│   ├── qwen-local-development.test.js
│   └── qwen-smart-routing.test.js
│
└── paid/                       # Paid tests - real API calls
    ├── e2e/                    # Browser-based end-to-end tests
    │   ├── voice-flow.test.js
    │   ├── chat-flow.test.js
    │   └── upgrade-flow.test.js
    │
    ├── api/                    # Real API integration tests
    │   ├── groq-integration.test.js
    │   ├── qwen-runloop.test.js
    │   ├── github-integration.test.js
    │   └── cloudflare-deployment.test.js
    │
    └── performance/            # Performance and load tests
        ├── cold-start-latency.test.js
        ├── provider-rotation-speed.test.js
        └── concurrent-requests.test.js
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  free-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Free Test Suite
        run: npm run test:coverage
      - name: Enforce 100% Coverage
        run: npm run check:coverage

  paid-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Run Paid Test Suite (Daily)
        run: npm run test:paid
        env:
          ALLOW_PAID_TESTS: true
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          RUNLOOP_API_KEY: ${{ secrets.RUNLOOP_API_KEY }}
```

### Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running free test suite..."
npm test

if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit aborted."
  exit 1
fi

echo "✅ All tests passed!"
exit 0
```

## Safety Mechanisms

### 1. Environment Detection
```javascript
// Automatically block paid services in development
if (env.NODE_ENV === 'development' && !env.ALLOW_PAID_PROVIDERS_IN_DEV) {
  throw new Error('Paid providers blocked in development for credit safety');
}
```

### 2. Explicit Confirmation
```javascript
// Require explicit flag for paid tests
if (isPaidTest() && !process.env.ALLOW_PAID_TESTS) {
  console.warn('⚠️  Skipping paid test (requires ALLOW_PAID_TESTS=true)');
  return this.skip();
}
```

### 3. Cost Tracking
```javascript
// Track and report credit usage
const creditUsage = {
  groq: { used: 15, limit: 30, resetAt: '2025-10-18T02:00:00Z' },
  runloop: { used: 2.25, limit: 25, resetAt: '2025-10-18T02:00:00Z' }
};

console.log(`Current usage: ${creditUsage.runloop.used}/${creditUsage.runloop.limit} credits`);
```

### 4. Graceful Fallback
```javascript
// Never automatically fallback to paid services
try {
  return await callLocalQwen(message);
} catch (error) {
  if (env.NODE_ENV === 'development') {
    throw new Error('Local Qwen unavailable. Set ALLOW_RUNLOOP_FALLBACK=true to use credits.');
  }
  return await callRunloopQwen(message); // Only in production
}
```

## Best Practices

### For Free Tests
1. **Mock everything external** - No real API calls
2. **Test behavior, not implementation** - Focus on what functions do, not how
3. **Fast and isolated** - Each test should run independently
4. **Comprehensive coverage** - Aim for 100% line/branch/function coverage

### For Paid Tests
1. **Use test resources** - Test repos, staging environments, isolated devboxes
2. **Clean up after yourself** - Delete devboxes, test data, deployments
3. **Run sparingly** - Daily in CI, manually before major releases
4. **Monitor costs** - Track credit usage and alert on unusual consumption

## Future Enhancements

### Phase 1 (Current)
- ✅ Free test suite with 100% mocking
- ✅ Coverage gate enforcement
- ✅ Credit safety mechanisms
- ⚠️  Paid test suite (planned but not implemented)

### Phase 2 (Roadmap)
- [ ] Implement paid test suite structure
- [ ] Add cost estimation tool
- [ ] Create E2E browser tests with Playwright/Puppeteer
- [ ] Add performance benchmarking suite
- [ ] Implement automatic credit tracking dashboard

### Phase 3 (Future)
- [ ] Synthetic monitoring in production
- [ ] Chaos engineering tests
- [ ] Load testing for concurrent users
- [ ] Security penetration testing suite

## Summary

The two-tier testing architecture ensures:
- **Rapid iteration** with free tests in development
- **High confidence** with paid tests before production
- **Cost efficiency** by limiting expensive tests
- **Safety first** with explicit confirmation requirements

This approach enables **continuous integration without continuous spending** while maintaining comprehensive test coverage and quality assurance.
