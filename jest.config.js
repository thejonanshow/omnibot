module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'provider_rotation.js',
    'cloudflare-worker/src/**/*.js',
    'scripts/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/*.test.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true
};
