import { defineConfig } from 'cypress'; // ^13.0.0

export default defineConfig({
  // E2E Testing Configuration
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/commands.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeout settings to ensure reliable testing of API and WebSocket operations
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    
    // Video and screenshot settings for debugging and documentation
    video: true,
    screenshotOnRunFailure: true,
    
    // Retry mechanism for handling potential flaky tests
    retries: {
      runMode: 2, // Retry failed tests twice in CI
      openMode: 0  // No retries in interactive mode
    },
    
    // Enable WebKit support for broader browser testing
    experimentalWebKitSupport: true,
    
    // Setup function for each test
    setupNodeEvents(on, config) {
      // Register tasks for fixture handling
      on('task', {
        // Load test data fixtures
        loadAnalytics: () => {
          return require('./cypress/fixtures/analytics.json');
        },
        loadConversations: () => {
          return require('./cypress/fixtures/conversations.json');
        },
        loadForms: () => {
          return require('./cypress/fixtures/forms.json');
        }
      });

      // Configure code coverage if enabled
      if (config.env.coverage) {
        require('@cypress/code-coverage/task')(on, config);
      }

      return config;
    }
  },

  // Component Testing Configuration
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
      options: {
        // Webpack configuration for component testing
        webpackConfig: {
          resolve: {
            alias: {
              '@components': 'src/components',
              '@utils': 'src/utils'
            }
          }
        }
      }
    },
    specPattern: '**/*.cy.tsx',
    supportFile: 'cypress/support/component.ts',
    viewportWidth: 1280,
    viewportHeight: 720
  },

  // Environment variables and global settings
  env: {
    // API and WebSocket endpoints
    apiUrl: 'http://localhost:4000',
    wsUrl: 'ws://localhost:4000',
    
    // Code coverage settings
    coverage: false,
    codeCoverage: {
      url: 'http://localhost:4000/__coverage__'
    },
    
    // Network retry settings
    retryOnNetworkFailure: true,
    requestTimeout: 10000,
    responseTimeout: 30000
  },

  // Global configuration
  watchForFileChanges: true,
  chromeWebSecurity: false,
  modifyObstructiveCode: false,
  numTestsKeptInMemory: 50,
  
  // Reporter configuration
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true
  }
});