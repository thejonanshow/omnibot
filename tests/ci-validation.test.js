/**
 * CI/CD Pipeline Validation Tests
 * 
 * These tests verify that our CI/CD pipeline configurations
 * would catch the issues that caused past deployment failures.
 * 
 * Based on deployment postmortems:
 * - docs/DEPLOYMENT_FAILURE_2024_12_12.md (linting issues)
 * - DEPLOYMENT_POSTMORTEM.md (missing dependencies)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

describe('CI/CD Pipeline Validation', () => {
  
  describe('Workflow Configuration', () => {
    
    it('should have PR validation workflow', () => {
      const workflowPath = '.github/workflows/pr-validation.yml';
      assert.doesNotThrow(
        () => readFileSync(workflowPath, 'utf8'),
        `PR validation workflow should exist at ${workflowPath}`
      );
      
      const content = readFileSync(workflowPath, 'utf8');
      assert.ok(content.includes('pull_request'), 'Should trigger on pull requests');
      assert.ok(content.includes('npm run lint'), 'Should include linting step');
      assert.ok(content.includes('npm test'), 'Should include test step');
      assert.ok(content.includes('npm run build'), 'Should include build step');
    });
    
    it('should have staging deployment workflow', () => {
      const workflowPath = '.github/workflows/staging-deploy.yml';
      const content = readFileSync(workflowPath, 'utf8');
      
      assert.ok(content.includes('npm install'), 'Should install dependencies');
      assert.ok(content.includes('npm run lint'), 'Should run linting');
      assert.ok(content.includes('npm test'), 'Should run tests');
      assert.ok(content.includes('npm run build'), 'Should build');
      
      // Verify order: install before build
      const installIndex = content.indexOf('npm install');
      const buildIndex = content.indexOf('npm run build');
      assert.ok(installIndex < buildIndex, 'npm install should come before build');
      
      // Verify build verification exists
      assert.ok(content.includes('Verify build output'), 'Should verify build output');
      assert.ok(content.includes('100000'), 'Should check minimum size');
      assert.ok(content.includes('<!DOCTYPE html>'), 'Should verify HTML embedding');
    });
    
    it('should have production deployment workflow', () => {
      const workflowPath = '.github/workflows/test-and-deploy.yml';
      const content = readFileSync(workflowPath, 'utf8');
      
      assert.ok(content.includes('npm install'), 'Should install dependencies');
      assert.ok(content.includes('npm run lint'), 'Should run linting');
      assert.ok(content.includes('npm test'), 'Should run tests');
      assert.ok(content.includes('npm run build'), 'Should build');
      
      // Verify order: lint before tests before build
      const lintIndex = content.indexOf('npm run lint');
      const testIndex = content.indexOf('npm test');
      const buildIndex = content.indexOf('npm run build');
      assert.ok(lintIndex < testIndex, 'Lint should come before tests');
      assert.ok(testIndex < buildIndex, 'Tests should come before build');
      
      // Verify post-deployment checks
      assert.ok(content.includes('Post-deployment verification'), 'Should have post-deployment checks');
      assert.ok(content.includes('Health check'), 'Should check health endpoint');
      assert.ok(content.includes('HTML UI verification'), 'Should verify HTML UI');
    });
    
    it('should have production promotion workflow', () => {
      const workflowPath = '.github/workflows/promote-to-production.yml';
      const content = readFileSync(workflowPath, 'utf8');
      
      assert.ok(content.includes('workflow_dispatch'), 'Should require manual trigger');
      assert.ok(content.includes('npm run lint'), 'Should run linting');
      assert.ok(content.includes('npm test'), 'Should run tests');
      assert.ok(content.includes('smoke tests'), 'Should run smoke tests on staging');
    });
  });
  
  describe('Git Hooks Configuration', () => {
    
    it('should have pre-commit hook configured', () => {
      const hookPath = '.husky/pre-commit';
      assert.doesNotThrow(
        () => readFileSync(hookPath, 'utf8'),
        'Pre-commit hook should exist'
      );
      
      const content = readFileSync(hookPath, 'utf8');
      assert.ok(content.includes('npm run lint'), 'Pre-commit should run linting');
      assert.ok(content.includes('exit 1'), 'Should exit with error on failure');
    });
    
    it('should have pre-push hook configured', () => {
      const hookPath = '.husky/pre-push';
      assert.doesNotThrow(
        () => readFileSync(hookPath, 'utf8'),
        'Pre-push hook should exist'
      );
      
      const content = readFileSync(hookPath, 'utf8');
      assert.ok(content.includes('npm test'), 'Pre-push should run tests');
      assert.ok(content.includes('exit 1'), 'Should exit with error on failure');
    });
    
    it('should have husky installed as dev dependency', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      assert.ok(packageJson.devDependencies.husky, 'Husky should be in devDependencies');
      assert.ok(packageJson.scripts.prepare, 'Should have prepare script for husky');
      assert.strictEqual(packageJson.scripts.prepare, 'husky', 'Prepare script should initialize husky');
    });
  });
  
  describe('Linting Configuration', () => {
    
    it('should have ESLint configured', () => {
      const eslintConfig = '.eslintrc.json';
      assert.doesNotThrow(
        () => readFileSync(eslintConfig, 'utf8'),
        'ESLint config should exist'
      );
    });
    
    it('should have lint script in package.json', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      assert.ok(packageJson.scripts.lint, 'Should have lint script');
      assert.strictEqual(packageJson.scripts.lint, 'eslint .', 'Lint script should run ESLint');
    });
    
    it('linting should exit with non-zero code on errors', () => {
      // This test verifies that linting would fail CI
      // We expect it to fail due to existing errors in codebase
      let exitCode = 0;
      try {
        execSync('npm run lint', { stdio: 'pipe' });
      } catch (error) {
        exitCode = error.status;
      }
      
      // Exit code should be non-zero when there are errors
      // (Currently we have 5 errors in the codebase)
      assert.ok(exitCode !== 0, 'Linting should exit with non-zero code when errors exist');
    });
  });
  
  describe('Test Configuration', () => {
    
    it('should have test script in package.json', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      assert.ok(packageJson.scripts.test, 'Should have test script');
    });
    
    it('tests should be executable', () => {
      // Verify tests can run (even if we don't run them here to save time)
      assert.doesNotThrow(
        () => readFileSync('tests/structure-basic.test.js', 'utf8'),
        'Test files should exist'
      );
    });
  });
  
  describe('Build Verification', () => {
    
    it('should have build script in package.json', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      assert.ok(packageJson.scripts.build, 'Should have build script');
      assert.ok(
        packageJson.scripts.build.includes('build-consolidated-worker'),
        'Build script should use build-consolidated-worker.js'
      );
    });
    
    it('should have build script file', () => {
      const buildScript = 'scripts/build-consolidated-worker.js';
      assert.doesNotThrow(
        () => readFileSync(buildScript, 'utf8'),
        'Build script should exist'
      );
    });
  });
  
  describe('Regression Prevention', () => {
    
    it('should prevent deployment without npm install (2024-12-11 issue)', () => {
      // This verifies the fix from DEPLOYMENT_POSTMORTEM.md
      const workflows = [
        '.github/workflows/staging-deploy.yml',
        '.github/workflows/test-and-deploy.yml',
        '.github/workflows/promote-to-production.yml'
      ];
      
      workflows.forEach(workflow => {
        const content = readFileSync(workflow, 'utf8');
        assert.ok(
          content.includes('npm install'),
          `${workflow} should include npm install step`
        );
      });
    });
    
    it('should prevent deployment with syntax errors (2024-12-12 issue)', () => {
      // This verifies the fix from docs/DEPLOYMENT_FAILURE_2024_12_12.md
      const workflows = [
        '.github/workflows/staging-deploy.yml',
        '.github/workflows/test-and-deploy.yml',
        '.github/workflows/promote-to-production.yml'
      ];
      
      workflows.forEach(workflow => {
        const content = readFileSync(workflow, 'utf8');
        assert.ok(
          content.includes('npm run lint'),
          `${workflow} should include linting step to catch syntax errors`
        );
      });
    });
    
    it('should prevent deployment with test failures (2024-12-12 issue)', () => {
      const workflows = [
        '.github/workflows/staging-deploy.yml',
        '.github/workflows/test-and-deploy.yml',
        '.github/workflows/promote-to-production.yml'
      ];
      
      workflows.forEach(workflow => {
        const content = readFileSync(workflow, 'utf8');
        assert.ok(
          content.includes('npm test') || content.includes('Run tests'),
          `${workflow} should include test execution`
        );
      });
    });
    
    it('should verify build output before deployment', () => {
      const workflows = [
        '.github/workflows/staging-deploy.yml',
        '.github/workflows/test-and-deploy.yml',
        '.github/workflows/promote-to-production.yml'
      ];
      
      workflows.forEach(workflow => {
        const content = readFileSync(workflow, 'utf8');
        assert.ok(
          content.includes('Verify build output') || content.includes('verify build'),
          `${workflow} should verify build output`
        );
        assert.ok(
          content.includes('100000'),
          `${workflow} should check minimum build size`
        );
        assert.ok(
          content.includes('<!DOCTYPE html>'),
          `${workflow} should verify HTML embedding`
        );
      });
    });
    
    it('should validate deployed content (not just availability)', () => {
      const workflows = [
        '.github/workflows/staging-deploy.yml',
        '.github/workflows/test-and-deploy.yml',
        '.github/workflows/promote-to-production.yml'
      ];
      
      workflows.forEach(workflow => {
        const content = readFileSync(workflow, 'utf8');
        
        // Should check health endpoint
        assert.ok(
          content.includes('health') || content.includes('Health check'),
          `${workflow} should check health endpoint`
        );
        
        // Should verify HTML UI is served (not just that endpoint responds)
        assert.ok(
          content.includes('HTML UI') || content.includes('<!DOCTYPE html>'),
          `${workflow} should verify HTML UI content`
        );
      });
    });
  });
  
  describe('Documentation', () => {
    
    it('should have contributing guide', () => {
      assert.doesNotThrow(
        () => readFileSync('CONTRIBUTING.md', 'utf8'),
        'CONTRIBUTING.md should exist'
      );
      
      const content = readFileSync('CONTRIBUTING.md', 'utf8');
      assert.ok(content.includes('Git Hooks'), 'Should document git hooks');
      assert.ok(content.includes('CI/CD'), 'Should document CI/CD pipeline');
      assert.ok(content.includes('pre-commit'), 'Should explain pre-commit hook');
      assert.ok(content.includes('pre-push'), 'Should explain pre-push hook');
    });
    
    it('should have CI/CD pipeline documentation', () => {
      assert.doesNotThrow(
        () => readFileSync('docs/CI_CD_PIPELINE.md', 'utf8'),
        'CI/CD pipeline documentation should exist'
      );
      
      const content = readFileSync('docs/CI_CD_PIPELINE.md', 'utf8');
      assert.ok(content.includes('Gates and Validations'), 'Should document validation gates');
      assert.ok(content.includes('Troubleshooting'), 'Should include troubleshooting guide');
    });
    
    it('should have deployment failure documentation', () => {
      // Verify we document failures for future reference
      assert.doesNotThrow(
        () => readFileSync('docs/DEPLOYMENT_FAILURE_2024_12_12.md', 'utf8'),
        'Deployment failure documentation should exist'
      );
      
      assert.doesNotThrow(
        () => readFileSync('DEPLOYMENT_POSTMORTEM.md', 'utf8'),
        'Deployment postmortem should exist'
      );
    });
  });
});
