import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer'; // ^14.0.0
import { createSecureHeaders } from '@next/security'; // ^14.0.0

// Import Tailwind config for reference
import tailwindConfig from './tailwind.config.ts';

// Initialize bundle analyzer
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Define secure headers configuration
const securityHeaders = createSecureHeaders({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      mediaSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    interestCohort: [],
  },
  forceHTTPSRedirect: true,
  nosniff: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  xssProtection: true,
  forceHTTPSRedirect: true,
});

const nextConfig: NextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,

  // Disable X-Powered-By header for security
  poweredByHeader: false,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
    NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
  },

  // Image optimization configuration
  images: {
    domains: ['localhost', 'storage.googleapis.com', 'cdn.yourdomain.com'],
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          ...securityHeaders,
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Add bundle analyzer plugin
    if (process.env.ANALYZE === 'true') {
      withBundleAnalyzer(config);
    }

    // Optimization settings
    config.optimization = {
      ...config.optimization,
      minimize: !dev,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    };

    return config;
  },

  // Experimental features
  experimental: {
    serverActions: true,
    serverComponents: true,
    optimizeCss: true,
    scrollRestoration: true,
    workerThreads: true,
    optimisticClientCache: true,
  },

  // Compiler options
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn', 'info'],
    },
  },

  // Output configuration
  output: 'standalone',
  distDir: '.next',

  // General optimization settings
  generateEtags: true,
  compress: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,
  swcMinify: true,

  // Internationalization
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },

  // On-demand page generation settings
  onDemandEntries: {
    maxInactiveAge: 60000,
    pagesBufferLength: 5,
  },

  // TypeScript configuration
  pageExtensions: ['tsx', 'ts'],
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json',
  },
};

// Export the configuration with bundle analyzer wrapper
export default withBundleAnalyzer(nextConfig);