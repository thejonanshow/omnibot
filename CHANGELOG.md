# Changelog

All notable changes to Omnibot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Enhanced Edit Pipeline**: Implemented strict model ordering for edit operations
  - Stage 1: Groq (Llama 3.3 70B) for initial planning and analysis
  - Stage 2: Kimi (Moonshot AI) for architecture review with explicit checkpoint
  - Stage 3: Qwen (3 iterations) for implementation with refinement
  - Stage 4: Claude/Gemini for final review and polish
- **Kimi Provider Integration**: Added Moonshot AI (Kimi) LLM provider support
  - New `callKimiDirect()` function for API integration
  - Architecture checkpoint stops execution for architectural review before implementation
  - Optional feature requiring `KIMI_API_KEY` environment variable
- **Code-Only Output Enforcement**: Edit responses now return pure code without markdown or prose
  - New `extractCodeOnly()` function strips markdown fences and explanatory text
  - Ensures downstream extraction succeeds in deployment pipeline
  - Critical for automated processing and PR workflows
- **Comprehensive Test Suite**: 
  - E2E tests for theme switcher functionality (`tests/e2e/theme-switcher.spec.js`)
  - API tests for edit response format (`tests/api/edit-response.test.js`)
  - Tests verify button presence, theme toggling, and persistence
- **Edit Pipeline Documentation**: 
  - Added detailed "Edit Pipeline Architecture" section to README
  - Documents enforced model ordering and rationale
  - Explains architecture checkpoint purpose
  - Describes code-only output requirement

### Fixed
- Fixed empty catch block in session validation (linting issue)
- Fixed unnecessary escape characters in regex patterns (linting issue)

### Verified
- **Theme Switcher**: Confirmed theme toggle button is visible and functional
  - Button exists in header at `frontend/index.html:1544-1546`
  - Properly styled with `.theme-toggle-btn` class
  - Connected to `toggleThemeQuick()` function
  - Theme preference persists via localStorage
  - Toggles between light (Portal) and dark (Cyberpunk) themes
  - Icon changes between 🌙 (moon) and ☀️ (sun)

### Changed
- Enhanced `prepareEdit()` function with multi-stage pipeline
- Updated environment configuration to include `KIMI_API_KEY`
- Improved edit pipeline logging with console output for each stage

## Notes

### Edit Pipeline Model Ordering Rationale

The enforced pipeline ordering ensures high-quality code changes through a structured approach:

1. **Groq (Llama)**: Strong reasoning for planning and analysis
2. **Kimi**: Architecture review checkpoint prevents implementation of flawed designs
3. **Qwen (3x)**: Iterative refinement produces robust implementations
4. **Claude/Gemini**: Final review catches edge cases and ensures quality

### Code-Only Output Requirement

Edit responses must contain only code (no markdown or prose) because:
- Downstream extraction processes require clean code input
- Markdown fences break automated patch application
- Explanatory text interferes with code parsing
- Ensures reliable deployment pipeline operation
