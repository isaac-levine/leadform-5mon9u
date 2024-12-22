import type { Config } from 'tailwindcss'; // ^3.3.0

const config: Config = {
  // Scan all TypeScript/React files for class names
  content: [
    './src/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],

  // Theme customization implementing design system specifications
  theme: {
    // Color palette with semantic naming and contrast ratios for WCAG 2.1 AA compliance
    colors: {
      primary: {
        DEFAULT: '#2563EB', // Blue 600
        light: '#3B82F6', // Blue 500
        dark: '#1D4ED8', // Blue 700
        contrast: '#FFFFFF',
      },
      secondary: {
        DEFAULT: '#3B82F6', // Blue 500
        light: '#60A5FA', // Blue 400
        dark: '#2563EB', // Blue 600
        contrast: '#FFFFFF',
      },
      success: {
        DEFAULT: '#10B981', // Green 500
        light: '#34D399', // Green 400
        dark: '#059669', // Green 600
        contrast: '#FFFFFF',
      },
      error: {
        DEFAULT: '#EF4444', // Red 500
        light: '#F87171', // Red 400
        dark: '#DC2626', // Red 600
        contrast: '#FFFFFF',
      },
      neutral: {
        DEFAULT: '#1F2937', // Gray 800
        50: '#F9FAFB',
        100: '#F3F4F6',
        200: '#E5E7EB',
        300: '#D1D5DB',
        400: '#9CA3AF',
        500: '#6B7280',
        600: '#4B5563',
        700: '#374151',
        800: '#1F2937',
        900: '#111827',
      },
    },

    // Typography system with Inter as primary and SF Pro as secondary fonts
    fontFamily: {
      primary: ['Inter', 'system-ui', 'sans-serif'],
      secondary: ['SF Pro', 'Arial', 'sans-serif'],
    },

    // Type scale with defined line heights and letter spacing
    fontSize: {
      h1: ['48px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      h2: ['32px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
      h3: ['24px', { lineHeight: '1.4', letterSpacing: '0' }],
      h4: ['20px', { lineHeight: '1.5', letterSpacing: '0' }],
      h5: ['16px', { lineHeight: '1.5', letterSpacing: '0' }],
      body: ['16px', { lineHeight: '1.6', letterSpacing: '0' }],
      small: ['14px', { lineHeight: '1.5', letterSpacing: '0' }],
    },

    // Spacing system based on 4px grid
    spacing: {
      base: '4px',
      xs: '8px',
      sm: '12px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
      layout: {
        gutter: '16px',
        container: '1280px',
      },
    },

    // Responsive breakpoints
    screens: {
      mobile: '320px',
      tablet: '768px',
      desktop: '1024px',
      wide: '1280px',
    },

    // Container configuration
    container: {
      center: true,
      padding: {
        DEFAULT: '16px',
        tablet: '24px',
        desktop: '32px',
      },
      maxWidth: {
        DEFAULT: '1280px',
      },
    },

    // Extended theme configurations
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },

  // Plugins for enhanced functionality
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for accessibility enhancements
    function({ addBase, addComponents, addUtilities }) {
      addBase({
        // Ensure proper focus styles for accessibility
        '*:focus-visible': {
          outline: '2px solid #2563EB',
          outlineOffset: '2px',
        },
        // Respect user's motion preferences
        '@media (prefers-reduced-motion: reduce)': {
          '*': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      });
    },
  ],
};

export default config;