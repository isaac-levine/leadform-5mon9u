# Enterprise Form Widget

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![WCAG 2.1](https://img.shields.io/badge/WCAG-2.1%20AA-green.svg)

A secure, accessible, and performant form widget for enterprise lead capture applications. Built with TypeScript and React, featuring comprehensive validation, cross-origin support, and WCAG 2.1 Level AA compliance.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Security](#security)
- [Configuration](#configuration)
- [Validation](#validation)
- [Accessibility](#accessibility)
- [Performance](#performance)
- [Error Handling](#error-handling)
- [API Reference](#api-reference)
- [Browser Support](#browser-support)
- [Contributing](#contributing)
- [Support](#support)

## Installation

### NPM Package
```bash
npm install @company/form-widget@1.0.0
```

### CDN Integration
```html
<script 
  src="https://cdn.example.com/widget.js" 
  integrity="sha384-..." 
  crossorigin="anonymous"
></script>
```

## Quick Start

```javascript
import { initializeWidget } from '@company/form-widget';

initializeWidget({
  formId: 'your-form-uuid',
  containerId: 'form-container',
  security: {
    allowedOrigins: ['https://your-domain.com'],
    apiKey: 'your-api-key'
  }
});
```

## Security

### Cross-Origin Resource Sharing (CORS)
- Strict origin validation
- Configurable allowed origins
- CSP-compliant implementation

```javascript
security: {
  allowedOrigins: ['https://example.com'],
  contentSecurityPolicy: "default-src 'self'; script-src 'self'",
  enableSandbox: true
}
```

### Authentication
- API key-based authentication
- CSRF protection
- Rate limiting support

```javascript
security: {
  apiKey: 'your-api-key',
  csrfToken: 'generated-token',
  maxSubmissionsPerMinute: 5
}
```

## Configuration

### Basic Configuration
```typescript
interface WidgetConfig {
  formId: string;
  containerId: string;
  styling?: WidgetStyle;
  callbacks?: WidgetCallbacks;
  security?: WidgetSecurity;
}
```

### Styling Options
```typescript
styling: {
  theme: WidgetTheme.LIGHT,
  customStyles: {
    primaryColor: '#2563EB',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '4px'
  },
  responsiveBreakpoints: {
    mobile: 320,
    tablet: 768,
    desktop: 1024
  }
}
```

## Validation

### Built-in Validation Rules
- Required fields
- Email format
- Phone numbers
- Custom patterns
- Async validation
- Dependent field validation

```typescript
validation: {
  email: [
    {
      type: ValidationRuleType.EMAIL,
      message: 'Please enter a valid email address'
    }
  ],
  phone: [
    {
      type: ValidationRuleType.PHONE,
      message: 'Please enter a valid phone number'
    }
  ]
}
```

## Accessibility

- WCAG 2.1 Level AA compliant
- Screen reader support
- Keyboard navigation
- Focus management
- ARIA attributes
- High contrast support

```typescript
// Example of accessibility features
<form
  role="form"
  aria-label="Contact form"
  onSubmit={handleSubmit}
>
  <label htmlFor="email">Email Address</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby="email-error"
  />
</form>
```

## Performance

### Optimization Features
- Lazy loading
- Bundle size optimization
- Response caching
- Debounced validation
- Progressive enhancement

```typescript
// Performance configuration
{
  performance: {
    lazyLoad: true,
    cacheTTL: 300, // 5 minutes
    validationDebounce: 300, // milliseconds
    maxAsyncTimeout: 3000 // milliseconds
  }
}
```

## Error Handling

### Error Boundaries
- Graceful degradation
- Fallback UI
- Error reporting
- Retry mechanisms

```typescript
callbacks: {
  onError: (error: Error) => {
    console.error('Widget error:', error);
    // Custom error handling
  }
}
```

## API Reference

### Methods
```typescript
initializeWidget(config: WidgetConfig): void
configureValidation(rules: ValidationRule[]): void
setupSecurity(config: SecurityConfig): void
```

### Events
```typescript
callbacks: {
  onLoad: (formId: string) => void
  onSubmit: (data: FormData) => Promise<void>
  onValidation: (result: ValidationResult) => void
  onFieldChange: (name: string, value: any) => void
  onError: (error: Error) => void
}
```

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- iOS Safari (last 2 versions)
- Android Chrome (last 2 versions)

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## Support

- Technical Support: support@company.com
- Security Issues: security@company.com
- Documentation: [Full Documentation](https://docs.example.com/widget)

## License

MIT License - see [LICENSE.md](LICENSE.md) for details

---

## Version History

- 1.0.0 (2024-01) - Initial release
  - Core form functionality
  - Validation system
  - Security features
  - Accessibility compliance

## SLA

- Response Time: 24h
- Resolution Time: 48h
- Uptime: 99.9%

For enterprise support and custom SLAs, please contact sales@company.com