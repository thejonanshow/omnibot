# Test Suite Documentation

This directory contains the comprehensive test suite for Omnibot.

## Test Organization

### Structure Tests
- **`structure-basic.test.js`** - Basic code structure validation (Mocha)
- **`structure-functional.test.js`** - Functional requirements validation (Mocha)

### Unit Tests (Node.js Test Runner)
Tests for individual modules and functions:

- **`auth.test.js`** - Authentication utilities (`lib/auth.js`)
- **`usage.test.js`** - Usage tracking (`lib/usage.js`)
- **`classifier.test.js`** - Request classification (`lib/classifier.js`)
- **`providers.test.js`** - LLM provider selection (`lib/providers.js`)
- **`context.test.js`** - Context management (`lib/context.js`)
- **`functions.test.js`** - Function calling system (`functions.js`)
- **`upgrade.test.js`** - Self-upgrade system (`upgrade.js`)
- **`swarm.test.js`** - Swarm orchestration (`swarm.js`)
- **`llm-providers.test.js`** - LLM API clients (`llm-providers.js`)
- **`index.test.js`** - Main worker entry point (`index.js`)
- **`core.test.js`** - Core functionality integration

### Integration Tests
- **`integration/cross-module.spec.js`** - Cross-module interactions

### End-to-End Tests (Playwright)
Full user journey tests:

- **`e2e/ui-functionality.spec.js`** - UI interactions (18 tests)
- **`e2e/chat.spec.js`** - Chat functionality
- **`e2e/auth.spec.js`** - Authentication flow
- **`e2e/api.spec.js`** - API endpoints
- **`e2e/llm-providers.spec.js`** - LLM provider integration
- **`e2e/performance.spec.js`** - Performance benchmarks

### Security Tests
- **`security/vulnerabilities.spec.js`** - Security vulnerability checks

### Smoke Tests
- **`smoke/critical-path.spec.js`** - Critical path validation

### API Tests
- **`api/endpoints.spec.js`** - API endpoint validation

### Qwen Integration Tests
- **`qwen-local.test.js`** - Local Qwen testing
- **`qwen-local-development.test.js`** - Qwen development mode
- **`qwen-smart-routing.test.js`** - Qwen routing logic
- **`qwen-blueprint-optimization.test.js`** - Qwen blueprint optimization

## Running Tests

### Run All Structure Tests (Mocha)
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:structure   # Structure validation
npm run test:safety      # Safety checks
npm run test:e2e         # Playwright E2E tests
npm run test:unit        # Node.js unit tests
```

### Run Individual Tests
```bash
# Mocha tests
mocha tests/structure-basic.test.js

# Node.js tests
node --test tests/auth.test.js

# Playwright tests
npx playwright test tests/e2e/ui-functionality.spec.js
```

## Test Coverage

Current coverage:
- ✅ All lib/ modules have unit tests
- ✅ Core functionality tested
- ✅ E2E tests for user flows
- ✅ Security and smoke tests
- ✅ Integration tests

### Coverage by Module

| Module | Unit Tests | E2E Tests | Notes |
|--------|-----------|-----------|-------|
| lib/auth.js | ✅ | ✅ | Full coverage |
| lib/usage.js | ✅ | ✅ | Full coverage |
| lib/classifier.js | ✅ | ✅ | Full coverage |
| lib/providers.js | ✅ | ✅ | Full coverage |
| lib/context.js | ✅ | ✅ | Full coverage |
| functions.js | ✅ | ✅ | Full coverage |
| upgrade.js | ✅ | ✅ | Full coverage |
| swarm.js | ✅ | ⚠️ | Partial E2E |
| llm-providers.js | ✅ | ✅ | Full coverage |
| index.js | ✅ | ✅ | Full coverage |
| email-commit-worker.js | ⚠️ | - | Specialized feature, not used |

Legend:
- ✅ Full coverage
- ⚠️ Partial or missing
- ❌ No coverage

## Writing Tests

### Unit Test Template (Node.js)
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Module Name', () => {
  it('should do something', async () => {
    // Test implementation
    assert.equal(actual, expected);
  });
});
```

### E2E Test Template (Playwright)
```javascript
import { test, expect } from '@playwright/test';

test('feature name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button')).toBeVisible();
});
```

## Test Environment

Tests use mocked environments to avoid real API calls:
- Mock KV stores
- Mock LLM responses
- Mock GitHub API
- Mock authentication

## CI/CD Integration

Tests run automatically on:
- Push to `main` (staging deployment)
- Pull requests
- Production promotion

See `.github/workflows/` for CI configuration.

## Best Practices

1. **Test Isolation** - Each test should be independent
2. **Mock External Services** - Don't make real API calls
3. **Clear Test Names** - Describe what's being tested
4. **Fast Execution** - Keep unit tests under 100ms
5. **Meaningful Assertions** - Test actual behavior, not implementation
6. **Error Cases** - Test both success and failure paths

## Troubleshooting

### Mocha Tests Failing
- Ensure `npm install` has been run
- Check that `cloudflare-worker/src/index.js` exists
- Verify Node.js version (v18+)

### Playwright Tests Failing
- Run `npx playwright install` to install browsers
- Check `E2E_BASE_URL` environment variable
- Verify staging/production deployment is accessible

### Test Timeouts
- Increase timeout with `--timeout` flag
- Check for slow async operations
- Use mocks instead of real API calls
