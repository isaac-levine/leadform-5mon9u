// PostCSS Configuration v10.0.0
// Integrates with Tailwind CSS ^3.3.0 and implements design system specifications

/** @type {import('postcss').Config} */
module.exports = {
  plugins: [
    // Primary styling framework - Tailwind CSS ^3.3.0
    // Processes utility classes and custom components
    require('tailwindcss'),

    // Cross-browser compatibility - Autoprefixer ^10.4.0
    // Adds vendor prefixes based on browserslist config
    require('autoprefixer')({
      // Optimize flexbox prefixing
      flexbox: 'no-2009',
      // Enable modern grid features
      grid: 'autoplace'
    }),

    // Modern CSS features - PostCSS Preset Env ^8.0.0
    // Enables future CSS syntax with fallbacks
    require('postcss-preset-env')({
      // Use stage 3 features (relatively stable)
      stage: 3,
      features: {
        // Disable custom properties processing (handled by Tailwind)
        'custom-properties': false,
        // Enable CSS nesting for better organization
        'nesting-rules': true,
        // Enable modern color functions
        'color-function': true,
        // Enable custom media queries for responsive design
        'custom-media-queries': true
      },
      // Preserve custom selectors for design system
      preserve: true,
      // Minimize output
      minimize: process.env.NODE_ENV === 'production'
    })
  ]
};