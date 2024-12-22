# AI-SMS Lead Platform Backend

Enterprise-grade backend monorepo for the AI-Driven Lead Capture & SMS Lead Nurturing Platform. This system provides a secure, scalable microservices architecture for form management, SMS handling, analytics, and AI-powered conversation processing.

## Architecture Overview

The backend is built using a microservices architecture with the following key components:

- **API Gateway**: Central entry point handling authentication, rate limiting, and request routing
- **Form Service**: Manages form creation, validation, and submissions
- **SMS Service**: Handles message delivery, queuing, and provider integration
- **Analytics Service**: Processes metrics and generates insights
- **AI Service**: Provides NLP processing and conversation management

### System Requirements

- Node.js >= 20.0.0
- npm >= 9.0.0
- Docker and Docker Compose
- Python 3.11+ (for AI Service)
- PostgreSQL 15
- MongoDB 7
- Redis 7

## Quick Start

1. Clone the repository:
```bash
git clone git@github.com:ai-sms/backend.git
cd backend
```

2. Install dependencies:
```bash
npm install
npm run bootstrap
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development environment:
```bash
docker-compose up -d
npm run dev
```

## Service Architecture

### API Gateway (Port: 3000)
- Request routing and load balancing
- Authentication and authorization
- Rate limiting and security
- Metrics collection

### Form Service (Port: 3001)
- Form CRUD operations
- Validation logic
- Widget embedding
- PostgreSQL integration

### SMS Service (Port: 3002)
- Message queuing (Bull)
- Provider integration (Twilio, MessageBird)
- Delivery tracking
- MongoDB for message storage

### Analytics Service (Port: 3003)
- Real-time metrics processing
- Dashboard data aggregation
- Report generation
- MongoDB for analytics storage

### AI Service (Port: 3004)
- NLP processing using GPT-4
- Conversation management
- Context handling
- Redis for caching

## Development

### Project Structure
```
backend/
├── services/
│   ├── gateway/      # API Gateway service
│   ├── form/         # Form management service
│   ├── sms/          # SMS handling service
│   ├── analytics/    # Analytics processing service
│   └── ai/           # AI conversation service
├── shared/           # Shared libraries and utilities
├── monitoring/       # Monitoring configuration
├── logging/          # Logging configuration
└── docker-compose.yml
```

### Available Scripts

```bash
# Development
npm run dev          # Start all services in development mode
npm run build        # Build all services
npm run test         # Run tests
npm run lint         # Run linting

# Deployment
npm run start        # Start production services
npm run db:migrate   # Run database migrations
npm run docs:generate # Generate documentation

# Maintenance
npm run clean        # Clean build artifacts
npm run deps:update  # Update dependencies
npm run security:audit # Run security audit
```

## Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- API key management for services
- Rate limiting per client

### Data Protection
- End-to-end encryption for sensitive data
- Data validation and sanitization
- SQL injection prevention
- XSS protection

### Infrastructure Security
- Container security with minimal privileges
- Network isolation using Docker networks
- Regular security audits
- Automated vulnerability scanning

## Monitoring & Observability

### Metrics Collection
- Prometheus metrics endpoints
- Custom business metrics
- Performance monitoring
- Resource utilization tracking

### Logging
- Centralized logging with ELK Stack
- Request correlation IDs
- Error tracking
- Audit logging

### Health Checks
- Service health endpoints
- Database connectivity checks
- External service monitoring
- Resource monitoring

## Deployment

### Container Orchestration
- Docker Compose for development
- Kubernetes for production
- Auto-scaling configuration
- Resource limits and requests

### CI/CD Pipeline
- GitHub Actions workflows
- Automated testing
- Security scanning
- Deployment automation

## Contributing

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following our coding standards

3. Run tests and linting:
```bash
npm run test
npm run lint
```

4. Submit a pull request with detailed description

## License

Private - AI-SMS Platform - All Rights Reserved

## Support

For technical support, please contact:
- Email: support@platform.com
- Slack: #backend-support

## Documentation

Additional documentation:
- [API Documentation](./docs/api.md)
- [Architecture Guide](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [Security Guidelines](./docs/security.md)