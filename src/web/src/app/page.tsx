'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import { Analytics } from '@vercel/analytics';
import Button from '../components/shared/Button';
import { useAuth } from '../hooks/useAuth';

// Feature data for the platform highlights section
const features = [
  {
    title: 'AI-Powered Conversations',
    description: 'Intelligent SMS automation with natural language processing for seamless lead engagement',
    icon: '/icons/ai-chat.svg'
  },
  {
    title: 'Smart Lead Capture',
    description: 'Customizable forms that integrate seamlessly with your existing workflow',
    icon: '/icons/form-builder.svg'
  },
  {
    title: 'Human Oversight',
    description: 'Real-time monitoring and instant takeover capabilities for your team',
    icon: '/icons/monitoring.svg'
  },
  {
    title: 'Analytics Dashboard',
    description: 'Comprehensive insights into lead quality and engagement metrics',
    icon: '/icons/analytics.svg'
  }
];

// Statistics for the metrics section
const metrics = [
  { value: '80%', label: 'Response Rate' },
  { value: '25%', label: 'Conversion Improvement' },
  { value: '<500ms', label: 'AI Processing' },
  { value: '99.9%', label: 'Platform Uptime' }
];

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Head>
        <title>AI-Driven Lead Capture & SMS Platform</title>
        <meta 
          name="description" 
          content="Transform your lead nurturing with AI-powered SMS automation" 
        />
        <meta 
          name="keywords" 
          content="lead capture, SMS automation, AI, lead nurturing, sales automation" 
        />
        <meta property="og:title" content="AI-Driven Lead Capture & SMS Platform" />
        <meta 
          property="og:description" 
          content="Transform your lead nurturing with AI-powered SMS automation" 
        />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:type" content="website" />
      </Head>

      <Analytics />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              Intelligent Lead Capture & Nurturing
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
              Transform your lead engagement with AI-powered SMS automation while maintaining human oversight
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="secondary"
                size="lg"
                className="whitespace-nowrap"
                onClick={() => window.location.href = '/demo'}
              >
                Request Demo
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="ghost"
                  size="lg"
                  className="whitespace-nowrap border-2 border-white"
                  onClick={() => window.location.href = '/signup'}
                >
                  Start Free Trial
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <Image
                  src={feature.icon}
                  alt={feature.title}
                  width={48}
                  height={48}
                  className="mb-4"
                />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="bg-primary-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {metrics.map((metric, index) => (
              <div key={index} className="text-white">
                <div className="text-4xl font-bold mb-2">{metric.value}</div>
                <div className="text-white/80">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Lead Nurturing?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of businesses using AI to engage leads more effectively
          </p>
          <Button
            variant="secondary"
            size="lg"
            className="whitespace-nowrap"
            onClick={() => window.location.href = '/signup'}
          >
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="/features">Features</Link></li>
                <li><Link href="/pricing">Pricing</Link></li>
                <li><Link href="/demo">Request Demo</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/blog">Blog</Link></li>
                <li><Link href="/careers">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="/docs">Documentation</Link></li>
                <li><Link href="/support">Support</Link></li>
                <li><Link href="/api">API</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
                <li><Link href="/compliance">Compliance</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} AI-SMS Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default HomePage;