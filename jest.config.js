/**
 * Root Jest configuration — orchestrates tests across all workspace packages.
 *
 * Each package also has its own jest config in package.json for standalone runs.
 * This root config allows `npm test` to run all tests from the repo root.
 */

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    '<rootDir>/packages/domain-contract',
    '<rootDir>/packages/domain-finops',
    '<rootDir>/packages/opa-editor',
    '<rootDir>/packages/opa-editor-backend',
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    'packages/*/src/**/*.tsx',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.test.tsx',
    '!packages/*/src/**/__tests__/**',
    '!packages/*/src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
