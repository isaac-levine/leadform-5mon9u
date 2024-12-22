import { FC } from 'react';
import Link from 'next/link'; // v14.0.0

// Constants for footer navigation and social links
const FOOTER_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Contact Us', href: '/contact' }
] as const;

const SOCIAL_LINKS = [
  {
    platform: 'LinkedIn',
    href: 'https://linkedin.com/company/ai-sms-platform',
    ariaLabel: 'Visit our LinkedIn page'
  },
  {
    platform: 'Twitter',
    href: 'https://twitter.com/ai_sms_platform',
    ariaLabel: 'Follow us on Twitter'
  }
] as const;

// Props interface with optional social links display
interface FooterProps {
  showSocialLinks?: boolean;
}

// Styles following design system specifications
const styles = {
  footer: {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    borderTop: '1px solid #E5E7EB',
    marginTop: 'auto',
    fontFamily: 'Inter, sans-serif'
  },
  footerContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '32px',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 16px'
  },
  footerSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    color: '#1F2937'
  },
  footerLinks: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  link: {
    color: '#1F2937',
    fontSize: '14px',
    textDecoration: 'none',
    padding: '4px',
    borderRadius: '4px',
    transition: 'color 0.2s ease',
    ':hover': {
      color: '#2563EB'
    },
    ':focus': {
      outline: '2px solid #2563EB',
      outlineOffset: '2px'
    }
  },
  socialLinks: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center'
  }
} as const;

/**
 * Footer component implementing design system specifications and accessibility requirements
 * @param {FooterProps} props - Component props
 * @returns {JSX.Element} Rendered footer component
 */
const Footer: FC<FooterProps> = ({ showSocialLinks = false }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      style={styles.footer}
      role="contentinfo"
      aria-label="Site footer"
    >
      <div style={styles.footerContent}>
        {/* Copyright Section */}
        <div style={styles.footerSection}>
          <p style={{ fontSize: '14px', margin: 0 }}>
            © {currentYear} AI-SMS Platform. All rights reserved.
          </p>
        </div>

        {/* Navigation Links */}
        <nav 
          style={styles.footerSection}
          aria-label="Footer navigation"
        >
          <div style={styles.footerLinks}>
            {FOOTER_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                style={styles.link}
                className="footer-link"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Social Links - Conditionally Rendered */}
        {showSocialLinks && (
          <div style={styles.footerSection}>
            <div style={styles.socialLinks}>
              {SOCIAL_LINKS.map(({ platform, href, ariaLabel }) => (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={ariaLabel}
                  style={styles.link}
                  className="social-link"
                >
                  {platform}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;