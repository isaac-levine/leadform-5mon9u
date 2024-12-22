// @ts-check
import { forms } from '../fixtures/forms.json'; // v1.0.0
import type { FormSchema } from '../../src/types/form';

// Constants for test configuration
const VIEWPORT_SIZES = {
  mobile: { width: 320, height: 568 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  wide: { width: 1280, height: 800 }
};

const TEST_FORM = forms[0] as FormSchema;
const SELECTORS = {
  formBuilder: {
    createButton: '[data-cy=create-form-button]',
    fieldPalette: '[data-cy=field-palette]',
    canvas: '[data-cy=form-canvas]',
    preview: '[data-cy=form-preview]',
    styleEditor: '[data-cy=style-editor]',
    saveButton: '[data-cy=save-form-button]',
    dragHandle: '[data-cy=field-drag-handle]',
    dropZone: '[data-cy=field-drop-zone]'
  },
  fields: {
    text: '[data-cy=field-text]',
    email: '[data-cy=field-email]',
    phone: '[data-cy=field-phone]'
  },
  accessibility: {
    skipLink: '[data-cy=skip-to-main]',
    ariaLive: '[aria-live=polite]',
    focusTrap: '[data-cy=modal-container]'
  }
};

describe('Form Builder E2E Tests', () => {
  beforeEach(() => {
    // Reset state and setup test environment
    cy.clearCookies();
    cy.clearLocalStorage();

    // Mock API responses
    cy.intercept('GET', '/api/forms', { body: forms }).as('getForms');
    cy.intercept('POST', '/api/forms', { statusCode: 201 }).as('createForm');
    cy.intercept('PUT', '/api/forms/*', { statusCode: 200 }).as('updateForm');
    cy.intercept('POST', '/api/analytics', { statusCode: 200 }).as('trackAnalytics');

    // Visit form builder page
    cy.visit('/forms');
    cy.wait('@getForms');

    // Enable accessibility testing
    cy.injectAxe();
  });

  describe('Form Builder UI', () => {
    it('should render form builder interface correctly', () => {
      cy.get(SELECTORS.formBuilder.createButton).should('be.visible');
      cy.get(SELECTORS.formBuilder.fieldPalette).should('be.visible');
      cy.get(SELECTORS.formBuilder.canvas).should('be.visible');
      cy.checkA11y(); // Verify accessibility compliance
    });

    it('should handle drag-and-drop field placement', () => {
      // Test drag and drop functionality
      cy.get(SELECTORS.fields.text)
        .drag(SELECTORS.formBuilder.dropZone)
        .then(() => {
          cy.get(SELECTORS.formBuilder.canvas)
            .find('[data-cy=field-text]')
            .should('exist');
        });

      // Verify field ordering
      cy.get(SELECTORS.fields.email)
        .drag(SELECTORS.formBuilder.dropZone)
        .then(() => {
          cy.get(SELECTORS.formBuilder.canvas)
            .find('[data-cy=field-email]')
            .should('exist');
        });
    });

    it('should update live preview in real-time', () => {
      // Add field and verify preview updates
      cy.get(SELECTORS.fields.text).drag(SELECTORS.formBuilder.dropZone);
      cy.get(SELECTORS.formBuilder.preview)
        .find('[data-cy=field-text]')
        .should('be.visible');

      // Update field properties and verify preview
      cy.get('[data-cy=field-properties]')
        .find('[data-cy=label-input]')
        .type('Updated Label');
      cy.get(SELECTORS.formBuilder.preview)
        .find('[data-cy=field-text] label')
        .should('have.text', 'Updated Label');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', () => {
      // Add required field
      cy.get(SELECTORS.fields.email).drag(SELECTORS.formBuilder.dropZone);
      cy.get('[data-cy=required-toggle]').click();

      // Test validation
      cy.get(SELECTORS.formBuilder.preview)
        .find('[type=submit]')
        .click();
      cy.get('[data-cy=validation-error]')
        .should('be.visible')
        .and('contain', 'This field is required');
    });

    it('should handle async validation correctly', () => {
      // Setup async validation mock
      cy.intercept('POST', '/api/validate/email', (req) => {
        req.reply({
          delay: 1000,
          statusCode: 200,
          body: { valid: false, message: 'Email already exists' }
        });
      }).as('validateEmail');

      // Add email field with async validation
      cy.get(SELECTORS.fields.email).drag(SELECTORS.formBuilder.dropZone);
      cy.get('[data-cy=async-validation-toggle]').click();

      // Test async validation
      cy.get(SELECTORS.formBuilder.preview)
        .find('[type=email]')
        .type('test@example.com');
      cy.wait('@validateEmail');
      cy.get('[data-cy=validation-error]')
        .should('contain', 'Email already exists');
    });
  });

  describe('Responsive Design', () => {
    Object.entries(VIEWPORT_SIZES).forEach(([device, size]) => {
      it(`should render correctly on ${device}`, () => {
        cy.viewport(size.width, size.height);
        cy.get(SELECTORS.formBuilder.canvas).should('be.visible');
        cy.get(SELECTORS.formBuilder.fieldPalette).should('exist');
        cy.checkA11y(); // Verify accessibility at each breakpoint
      });
    });
  });

  describe('Form Analytics', () => {
    it('should track form interactions', () => {
      // Add field and track interaction
      cy.get(SELECTORS.fields.text).drag(SELECTORS.formBuilder.dropZone);
      cy.wait('@trackAnalytics')
        .its('request.body')
        .should('deep.include', {
          eventType: 'FIELD_ADDED',
          fieldType: 'TEXT'
        });

      // Track preview interaction
      cy.get(SELECTORS.formBuilder.preview)
        .find('[data-cy=field-text]')
        .click();
      cy.wait('@trackAnalytics')
        .its('request.body')
        .should('deep.include', {
          eventType: 'FIELD_FOCUSED',
          fieldType: 'TEXT'
        });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 Level AA standards', () => {
      // Test keyboard navigation
      cy.get(SELECTORS.accessibility.skipLink)
        .focus()
        .should('be.visible')
        .type('{enter}');
      cy.focused().should('have.attr', 'data-cy', 'form-canvas');

      // Test screen reader announcements
      cy.get(SELECTORS.fields.text).drag(SELECTORS.formBuilder.dropZone);
      cy.get(SELECTORS.accessibility.ariaLive)
        .should('contain', 'Text field added to form');

      // Verify focus management in modals
      cy.get('[data-cy=field-settings-button]').click();
      cy.get(SELECTORS.accessibility.focusTrap)
        .should('have.attr', 'aria-modal', 'true');

      // Run comprehensive accessibility audit
      cy.checkA11y(null, {
        includedImpacts: ['critical', 'serious', 'moderate']
      });
    });
  });

  describe('Form Submission', () => {
    it('should handle successful form submission', () => {
      // Setup test form
      cy.get(SELECTORS.fields.text).drag(SELECTORS.formBuilder.dropZone);
      cy.get(SELECTORS.fields.email).drag(SELECTORS.formBuilder.dropZone);

      // Fill and submit form
      cy.get(SELECTORS.formBuilder.preview)
        .find('[data-cy=field-text] input')
        .type('Test User');
      cy.get(SELECTORS.formBuilder.preview)
        .find('[data-cy=field-email] input')
        .type('test@example.com');

      cy.get(SELECTORS.formBuilder.preview)
        .find('[type=submit]')
        .click();

      // Verify submission
      cy.wait('@createForm')
        .its('response.statusCode')
        .should('eq', 201);
      cy.get('[data-cy=success-message]')
        .should('be.visible')
        .and('contain', 'Form submitted successfully');
    });
  });
});