## Description
<!-- Provide a detailed description of your changes (minimum 100 characters). Include the purpose, business value, and overall impact. -->




## Type of Change
<!-- Select ONE option that best describes this PR -->
- [ ] feature: New functionality or capability
- [ ] bugfix: Non-breaking bug resolution
- [ ] hotfix: Critical production fix
- [ ] refactor: Code improvement without functional changes
- [ ] documentation: Documentation updates only
- [ ] test: Test coverage improvements
- [ ] ci: CI/CD pipeline changes
- [ ] security: Security-related changes

## Technical Details

### Implementation Approach
<!-- Describe the technical implementation approach and design decisions -->




### Architecture Changes
<!-- Detail any changes to system architecture, patterns, or core components -->




### Database Changes
<!-- List any database schema changes, migrations, or data updates -->




### API Changes
<!-- Document any API changes, including new endpoints, modifications, or deprecations -->




### Security Considerations
<!-- Describe security implications and mitigation strategies -->




## Testing Checklist
<!-- Check all that apply and provide evidence/details for each checked item -->
- [ ] Unit tests added/updated
  <!-- Link to test files -->
- [ ] Integration tests added/updated
  <!-- Link to test files -->
- [ ] E2E tests added/updated
  <!-- Link to test files -->
- [ ] Manual testing performed
  <!-- Describe test scenarios -->
- [ ] Performance testing completed
  <!-- Include performance metrics -->
- [ ] Security testing verified
  <!-- Include security test results -->

## Security Checklist
<!-- ALL items must be checked for security-related changes -->
- [ ] OWASP Top 10 reviewed
- [ ] Security scanning passed
- [ ] PII data handling verified
- [ ] Authentication/Authorization checked
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] Error handling secured

## Deployment Impact

### Database Migrations
<!-- List any database migrations and their impact -->




### Configuration Changes
<!-- Detail any configuration file or environment variable changes -->




### Infrastructure Updates
<!-- Describe infrastructure changes or requirements -->




### Rollback Plan
<!-- REQUIRED: Detailed steps to rollback these changes if needed -->




### Performance Impact
<!-- Analyze and document performance implications -->




### Monitoring Updates
<!-- Describe any changes to monitoring, alerts, or metrics -->




## Documentation Checklist
<!-- Check all updated documentation -->
- [ ] README updated
- [ ] API documentation updated
- [ ] Architecture diagrams updated
- [ ] Deployment guides updated
- [ ] Security documentation updated
- [ ] Configuration documentation updated

## Required Checks
The following checks must pass before merging:
- [ ] Backend tests (backend-ci.yml)
- [ ] Frontend tests (frontend-ci.yml)
- [ ] E2E tests (frontend-ci.yml)
- [ ] Security scan (security.yml)

## Review Requirements
This PR requires:
- 2 technical reviewers
- 1 domain expert
- Security review (for security-related changes)

<!-- 
PR Best Practices:
1. Keep changes focused and atomic
2. Provide clear context and documentation
3. Include relevant test coverage
4. Address security implications
5. Consider deployment impact
6. Update all relevant documentation
-->