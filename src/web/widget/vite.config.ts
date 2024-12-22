import { defineConfig } from 'vite'; // v4.4.0
import react from '@vitejs/plugin-react'; // v4.0.0
import path from 'path';

export default defineConfig({
  // Build configuration for library mode
  build: {
    lib: {
      // Main entry point for the widget
      entry: path.resolve(__dirname, 'src/FormWidget.tsx'),
      name: 'FormWidget',
      // Generate both ES modules and UMD formats for maximum compatibility
      formats: ['es', 'umd'],
      fileName: (format) => `form-widget.${format}.js`
    },
    
    rollupOptions: {
      // Mark React and ReactDOM as external dependencies
      external: ['react', 'react-dom'],
      output: {
        // Provide global variable names for external dependencies
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        // Ensure CSS is extracted properly
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'form-widget.css';
          }
          return assetInfo.name;
        }
      }
    },

    // Enable source maps for debugging in development
    sourcemap: true,
    
    // Use Terser for optimal minification
    minify: 'terser',
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Output directory
    outDir: 'dist',
    
    // Clean the output directory before build
    emptyOutDir: true,
    
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    
    // Target modern browsers for better optimization
    target: 'es2018'
  },

  // Configure plugins
  plugins: [
    react({
      // Enable Fast Refresh for development
      fastRefresh: true,
      // Enable JSX runtime optimization
      jsxRuntime: 'automatic',
      // Enable babel plugins for optimal build
      babel: {
        plugins: [
          ['@babel/plugin-transform-runtime', { useESModules: true }]
        ]
      }
    })
  ],

  // Optimize dependencies
  optimizeDeps: {
    // Include React dependencies for optimization
    include: [
      'react',
      'react-dom'
    ],
    // No exclusions needed for the widget
    exclude: []
  },

  // Development server configuration
  server: {
    // Use port 3001 to avoid conflicts with main app
    port: 3001,
    // Enable CORS for cross-origin embedding
    cors: true,
    // Hot Module Replacement settings
    hmr: {
      // Enable HMR overlay for development
      overlay: true,
      // Use port 3001 for WebSocket connection
      port: 3001
    },
    // Headers for security and cross-origin support
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  },

  // Enable TypeScript path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  // Configure preview server
  preview: {
    port: 3001,
    cors: true
  },

  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    __WIDGET_VERSION__: JSON.stringify(process.env.npm_package_version)
  },

  // Enable detailed build logging
  logLevel: 'info',

  // Configure CSS handling
  css: {
    // Enable CSS modules
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    },
    // PostCSS configuration
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('cssnano')({
          preset: ['default', {
            discardComments: { removeAll: true }
          }]
        })
      ]
    }
  }
});