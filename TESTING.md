# Omni-Agent Testing Guide

## Overview

We now have a comprehensive test suite to ensure all Omni-Agent functionality works as expected. The test suite covers:

- **Blueprint System**: Creation, status checking, and deployment
- **Function Calling**: Groq integration with tool capabilities
- **Runloop Services**: Command execution, web browsing, file operations
- **Voice Services**: STT and TTS functionality
- **Shared Context**: Persistent memory across sessions
- **Deployment**: Scripts and health endpoints

## Test Files

### `test_blueprints.py`
Tests the Runloop blueprint system:
- Blueprint creation and status checking
- Blueprint deployment from existing templates
- Environment variable persistence
- API endpoint functionality

### `test_omni_agent.py`
Tests the complete Omni-Agent system:
- Cloudflare Worker health and function calling
- Runloop service endpoints (execute, browse, file ops)
- Voice services (STT/TTS)
- Shared context storage and retrieval
- Deployment script functionality

### `run_tests.sh`
Convenience script to run all tests with proper environment setup.

## Running Tests

### Run All Tests
```bash
./run_tests.sh
```

### Run Individual Test Suites
```bash
python3 test_blueprints.py    # Test blueprint functionality
python3 test_omni_agent.py    # Test full system functionality
```

## Test Results Interpretation

### ✅ PASS
- Feature is working correctly
- All expected functionality is operational

### ❌ FAIL
- Feature has issues that need attention
- Check the error message for specific problems

## Common Issues and Solutions

### Runloop Services Not Accessible
**Error**: `Failed to resolve 'dbx_xxx.runloop.dev'`
**Solution**:
- Run a fresh deployment: `./deploy.sh`
- Check that Runloop services are running
- Verify the `.runloop_url` file has the correct URL

### Cloudflare Worker Issues
**Error**: `Status code: 500` or `Expecting value: line 1 column 1`
**Solution**:
- Check worker deployment: `cd cloudflare-worker && npx wrangler deploy`
- Verify environment variables are set correctly
- Check worker logs in Cloudflare dashboard

### Blueprint Creation Failures
**Error**: `Invalid or malformed api key`
**Solution**:
- Verify `RUNLOOP_API_KEY` is correct in `.env`
- Check that the API key has proper permissions
- Ensure GitHub token is set for repository access

### Function Calling Not Working
**Error**: `Status code: 500` on `/chat` endpoint
**Solution**:
- Verify Groq API key is set correctly
- Check that function definitions are properly configured
- Ensure Runloop services are accessible from the worker

## Test Coverage

The test suite covers:

1. **Infrastructure Tests**
   - Worker health and accessibility
   - Runloop service health and capabilities
   - Deployment script functionality

2. **Core Functionality Tests**
   - Function calling setup and execution
   - Command execution via Runloop
   - Web browsing with Playwright
   - File operations (read/write/list)

3. **Advanced Features Tests**
   - Voice services (STT/TTS)
   - Shared context storage and retrieval
   - Blueprint creation and reuse

4. **Integration Tests**
   - End-to-end function calling workflows
   - Cross-service communication
   - Error handling and fallbacks

## Continuous Testing

### Before Deployment
Always run tests before deploying:
```bash
./run_tests.sh
```

### After Deployment
Verify all functionality after deployment:
```bash
python3 test_omni_agent.py
```

### Blueprint Testing
Test blueprint functionality when making changes:
```bash
python3 test_blueprints.py
```

## Test Environment Setup

The tests automatically:
- Load environment variables from `.env`
- Check for required API keys and URLs
- Handle missing dependencies gracefully
- Provide detailed error messages

## Adding New Tests

To add new tests:

1. **For Blueprint Tests**: Add methods to `BlueprintTester` class in `test_blueprints.py`
2. **For System Tests**: Add methods to `OmniAgentTester` class in `test_omni_agent.py`
3. **Use the `log_test()` method** to record results
4. **Follow the naming convention**: `test_feature_name()`

## Test Results Summary

The test suite provides:
- ✅/❌ status for each test
- Detailed error messages
- Overall pass/fail summary
- Suggestions for fixing common issues

This ensures that all Omni-Agent functionality is working correctly and helps identify issues quickly during development and deployment.
