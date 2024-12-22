// Jest configuration for backend services
// jest: ^29.5.0
// ts-jest: ^29.1.0

import type { Config } from '@jest/types';

const jestConfig: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Configure source root directories
  roots: ['<rootDir>/src'],

  // TypeScript and source file handling
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: {
          warnOnly: true,
          ignoreCodes: ['TS151001']
        },
        sourceMap: true,
        isolatedModules: true
      }
    ]
  },

  // Module path aliases matching tsconfig.json
  moduleNameMapper: {
    '@shared/(.*)': '<rootDir>/src/shared/$1',
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@models/(.*)': '<rootDir>/src/models/$1',
    '@services/(.*)': '<rootDir>/src/services/$1',
    '@controllers/(.*)': '<rootDir>/src/controllers/$1',
    '@routes/(.*)': '<rootDir>/src/routes/$1',
    '@middleware/(.*)': '<rootDir>/src/middleware/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1',
    '@types/(.*)': '<rootDir>/src/types/$1'
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/types/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // Test environment setup
  setupFilesAfterEnv: [
    '<rootDir>/src/test/setup.ts'
  ],

  // Test timeout (in milliseconds)
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Global configuration
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Verbose output for detailed test results
  verbose: true,

  // Clear mock calls and instances between tests
  clearMocks: true,

  // Automatically restore mock state between tests
  restoreMocks: true,

  // Maximum number of concurrent workers
  maxWorkers: '50%',

  // Error handling
  bail: 0,
  errorOnDeprecated: true,

  // Watch plugins for development
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default jestConfig;