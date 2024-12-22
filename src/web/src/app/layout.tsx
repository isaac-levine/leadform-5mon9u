'use client';

import { Inter } from 'next/font/google'; // v14.0.0
import { Provider } from 'react-redux'; // v9.0.0
import { ThemeProvider } from 'next-themes'; // v0.2.1
import { useState, useCallback } from 'react';

import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { store } from '../store';

// Initialize Inter font with optimized loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

// Metadata for SEO and document head
export const metadata = {
  title: 'AI-SMS Lead Platform',
  description: 'AI-Driven Lead Capture & SMS Lead Nurturing Platform',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  icons: {
    icon: '/favicon.ico'
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1F2937' }
  ]
};

// Props interface for RootLayout component
interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Root layout component that provides base structure, theme, and state management
 * Implements design system specifications and responsive behavior
 */
export default function RootLayout({ children }: RootLayoutProps) {
  // Navigation collapse state for responsive design
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);

  // Navigation toggle handler with accessibility
  const handleNavToggle = useCallback(() => {
    setIsNavCollapsed(prev => !prev);
  }, []);

  return (
    <html 
      lang="en" 
      suppressHydrationWarning 
      className={`${inter.variable} antialiased`}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <Provider store={store}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem={true}
            disableTransitionOnChange
          >
            <div className="main-layout">
              <Header 
                isNavCollapsed={isNavCollapsed}
                onNavToggle={handleNavToggle}
                aria-label="Main navigation"
              />
              
              <main 
                className="main-content"
                role="main"
                aria-label="Main content"
              >
                {children}
              </main>

              <Footer showSocialLinks={true} />
            </div>
          </ThemeProvider>
        </Provider>

        {/* Global styles */}
        <style jsx global>{`
          :root {
            --font-sans: ${inter.style.fontFamily}, system-ui, -apple-system,
              BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          html {
            font-family: var(--font-sans);
            scroll-behavior: smooth;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            min-height: 100vh;
            margin: 0;
            padding: 0;
            background-color: var(--background);
            color: var(--text-primary);
          }

          .main-layout {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: env(safe-area-inset-top) env(safe-area-inset-right) 
                    env(safe-area-inset-bottom) env(safe-area-inset-left);
          }

          .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 16px;
            padding-bottom: env(safe-area-inset-bottom);
          }

          /* Dark mode styles */
          [data-theme='dark'] {
            --background: #1F2937;
            --text-primary: #F9FAFB;
          }

          /* Light mode styles */
          [data-theme='light'] {
            --background: #FFFFFF;
            --text-primary: #1F2937;
          }

          /* Responsive breakpoints */
          @media (min-width: 768px) {
            .main-content {
              padding: 0 24px;
            }
          }

          @media (min-width: 1024px) {
            .main-content {
              padding: 0 32px;
            }
          }
        `}</style>
      </body>
    </html>
  );
}