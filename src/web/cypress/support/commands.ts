// @ts-check
import { MetricType } from '../../src/types/analytics';
import { ConversationStatus } from '../../src/types/conversation';
import { FormFieldStyle } from '../../src/types/form';
import 'cypress'; // ^13.0.0

/**
 * Type definitions for custom command options
 */
interface LoginOptions {
  rememberMe?: boolean;
  redirectUrl?: string;
  maxRetries?: number;
}

interface FormOptions {
  validateStyles?: boolean;
  checkResponsiveness?: boolean;
  waitForSave?: boolean;
}

interface ConversationOptions {
  checkAiConfidence?: boolean;
  validateTimestamps?: boolean;
  waitForResponses?: boolean;
}

interface AnalyticsOptions {
  timeRange?: string;
  validateThresholds?: boolean;
  exportResults?: boolean;
}

/**
 * Custom command to handle user login with enhanced error handling
 * @param email - User email
 * @param password - User password
 * @param options - Additional login options
 */
Cypress.Commands.add('login', (
  email: string, 
  password: string, 
  options: LoginOptions = {}
) => {
  const { rememberMe = false, redirectUrl = '/', maxRetries = 3 } = options;

  cy.session([email, password], () => {
    cy.visit('/login', { retryOnNetworkFailure: true });
    cy.get('[data-cy=login-form]').should('be.visible');
    
    cy.get('[data-cy=email-input]')
      .clear()
      .type(email)
      .should('have.value', email);
    
    cy.get('[data-cy=password-input]')
      .clear()
      .type(password, { log: false });
    
    if (rememberMe) {
      cy.get('[data-cy=remember-me]').check();
    }
    
    cy.get('[data-cy=login-submit]')
      .click()
      .should(() => {
        expect(localStorage.getItem('authToken')).to.exist;
      });
    
    cy.url().should('include', redirectUrl);
  }, {
    validate() {
      cy.window().its('localStorage.authToken').should('exist');
    },
    cacheAcrossSpecs: true
  });
});

/**
 * Custom command to create and validate form with comprehensive styling checks
 * @param formData - Form configuration data
 * @param options - Form creation options
 */
Cypress.Commands.add('createForm', (
  formData: FormSchema,
  options: FormOptions = {}
) => {
  const { validateStyles = true, checkResponsiveness = true, waitForSave = true } = options;

  cy.visit('/forms/create');
  cy.get('[data-cy=form-builder]').should('be.visible');

  // Add form fields
  formData.fields.forEach((field, index) => {
    cy.get(`[data-cy=add-field-${field.type}]`).click();
    cy.get(`[data-cy=field-${index}]`)
      .should('exist')
      .within(() => {
        cy.get('[data-cy=field-label]').type(field.label);
        if (field.validation?.length) {
          cy.get('[data-cy=field-validation]').click();
          field.validation.forEach(rule => {
            cy.get(`[data-cy=validation-${rule.type}]`).click();
          });
        }
      });
  });

  // Validate styling if enabled
  if (validateStyles) {
    const style = formData.styling as FormFieldStyle;
    cy.get('[data-cy=style-editor]').within(() => {
      cy.get('[data-cy=background-color]').type(style.backgroundColor);
      cy.get('[data-cy=text-color]').type(style.textColor);
      cy.get('[data-cy=border-radius]').type(style.borderRadius);
    });
  }

  // Check responsiveness if enabled
  if (checkResponsiveness) {
    cy.viewport('iphone-x');
    cy.get('[data-cy=form-preview]').should('be.visible');
    cy.viewport('macbook-15');
  }

  // Save form and wait for confirmation
  cy.get('[data-cy=save-form]').click();
  if (waitForSave) {
    cy.get('[data-cy=save-success]').should('be.visible');
  }

  // Return form ID
  return cy.get('[data-cy=form-id]').invoke('text');
});

/**
 * Custom command to verify conversation details and state
 * @param conversationId - ID of conversation to check
 * @param options - Conversation verification options
 */
Cypress.Commands.add('checkConversation', (
  conversationId: string,
  options: ConversationOptions = {}
) => {
  const { checkAiConfidence = true, validateTimestamps = true, waitForResponses = true } = options;

  cy.visit(`/conversations/${conversationId}`);
  cy.get('[data-cy=conversation-thread]').should('be.visible');

  // Verify message list
  cy.get('[data-cy=message-list]').within(() => {
    if (validateTimestamps) {
      cy.get('[data-cy=message-timestamp]').each($timestamp => {
        expect(Date.parse($timestamp.text())).to.be.a('number');
      });
    }

    if (checkAiConfidence) {
      cy.get('[data-cy=ai-confidence]').each($confidence => {
        const value = parseFloat($confidence.text());
        expect(value).to.be.within(0, 1);
      });
    }
  });

  // Check conversation status
  return cy.get('[data-cy=conversation-status]')
    .invoke('text')
    .then(status => {
      expect(Object.values(ConversationStatus)).to.include(status);
      return status as ConversationStatus;
    });
});

/**
 * Custom command to validate analytics metrics and thresholds
 * @param metricType - Type of metric to verify
 * @param options - Analytics verification options
 */
Cypress.Commands.add('verifyAnalytics', (
  metricType: MetricType,
  options: AnalyticsOptions = {}
) => {
  const { timeRange = 'DAY', validateThresholds = true, exportResults = false } = options;

  cy.visit('/analytics');
  cy.get('[data-cy=analytics-dashboard]').should('be.visible');

  // Select time range
  cy.get('[data-cy=time-range-selector]').select(timeRange);

  // Verify metric data
  cy.get(`[data-cy=metric-${metricType}]`).within(() => {
    cy.get('[data-cy=metric-value]').should('exist').then($value => {
      const value = parseFloat($value.text());
      
      if (validateThresholds) {
        switch (metricType) {
          case MetricType.RESPONSE_TIME:
            expect(value).to.be.lessThan(500); // 500ms threshold
            break;
          case MetricType.LEAD_ENGAGEMENT:
            expect(value).to.be.greaterThan(0.8); // 80% threshold
            break;
          case MetricType.CONVERSION_RATE:
            expect(value).to.be.greaterThan(0.25); // 25% threshold
            break;
        }
      }
    });
  });

  // Export results if enabled
  if (exportResults) {
    cy.get('[data-cy=export-analytics]').click();
    cy.get('[data-cy=export-success]').should('be.visible');
  }

  // Return analytics result
  return cy.get(`[data-cy=metric-${metricType}]`)
    .invoke('text')
    .then(value => ({
      type: metricType,
      value: parseFloat(value),
      timestamp: new Date()
    }));
});

// Declare custom commands on Cypress namespace
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string, options?: LoginOptions): Chainable<void>;
      createForm(formData: FormSchema, options?: FormOptions): Chainable<string>;
      checkConversation(conversationId: string, options?: ConversationOptions): Chainable<ConversationStatus>;
      verifyAnalytics(metricType: MetricType, options?: AnalyticsOptions): Chainable<AnalyticsResult>;
    }
  }
}