// ESLint configuration for backend services
// Dependencies:
// @typescript-eslint/eslint-plugin: ^6.0.0
// @typescript-eslint/parser: ^6.0.0
// eslint-config-prettier: ^9.0.0
// eslint-plugin-import: ^2.28.0

module.exports = {
  // Environment configuration
  env: {
    node: true,
    jest: true,
    es2022: true,
  },

  // TypeScript parser configuration
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module',
  },

  // ESLint plugins
  plugins: [
    '@typescript-eslint',
    'import',
  ],

  // Extended configurations
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'prettier',
  ],

  // Custom rule configurations
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {
      'argsIgnorePattern': '^_'
    }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // Import rules
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always',
      'alphabetize': {
        'order': 'asc'
      }
    }],
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',

    // General rules
    'no-console': ['error', {
      'allow': ['warn', 'error']
    }],
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-vars': 'off', // Turned off in favor of @typescript-eslint/no-unused-vars
  },

  // Settings for import resolution
  settings: {
    'import/resolver': {
      'typescript': {
        'alwaysTryTypes': true,
        'project': './tsconfig.json'
      }
    }
  },

  // Files to ignore
  ignorePatterns: [
    'dist',
    'coverage',
    'node_modules',
    '**/*.js',
    '**/*.d.ts'
  ]
};