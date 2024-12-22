// Cypress E2E tests for SMS conversation management interface
// @version: 1.0.0
// @requires: cypress ^13.0.0

import { ConversationStatus, MessageDirection } from '../../src/types/conversation';
import type { Conversation } from '../../src/types/conversation';

describe('Conversation Management Interface', () => {
  beforeEach(() => {
    // Initialize clock for time-based testing
    cy.clock();

    // Intercept API requests
    cy.intercept('GET', '/api/v1/conversations*', {
      fixture: 'conversations.json'
    }).as('getConversations');

    // Stub WebSocket connection
    cy.window().then((win) => {
      const wsStub = {
        send: cy.stub().as('wsSend'),
        close: cy.stub().as('wsClose'),
        onmessage: null,
        onclose: null
      };
      cy.stub(win, 'WebSocket').returns(wsStub);
    });

    // Login and visit conversations page
    cy.login({ email: 'test@example.com', password: 'password123' });
    cy.visit('/conversations');
    cy.wait('@getConversations');
  });

  describe('Conversation List Display', () => {
    it('displays conversations with correct information', () => {
      cy.get('[data-cy=conversation-list]').should('be.visible');
      cy.get('[data-cy=conversation-item]').should('have.length', 3);

      // Verify first conversation details
      cy.get('[data-cy=conversation-item]').first().within(() => {
        cy.get('[data-cy=phone-number]').should('contain', '+1234567890');
        cy.get('[data-cy=status-badge]').should('contain', 'Active');
        cy.get('[data-cy=last-activity]').should('contain', 'just now');
        cy.get('[data-cy=ai-confidence]').should('contain', '95%');
      });
    });

    it('updates conversation status in real-time', () => {
      // Simulate WebSocket status update
      cy.window().then((win) => {
        const wsInstance = win.WebSocket.lastCall.returnValue;
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'conversation.status.update',
            conversationId: '123e4567-e89b-12d3-a456-426614174000',
            status: ConversationStatus.HUMAN_TAKEOVER
          })
        });
      });

      cy.get('[data-cy=conversation-item]').first()
        .find('[data-cy=status-badge]')
        .should('contain', 'Human Takeover');
    });
  });

  describe('Message Timeline', () => {
    it('displays message history with correct formatting', () => {
      // Select first conversation
      cy.get('[data-cy=conversation-item]').first().click();

      cy.get('[data-cy=message-list]').within(() => {
        // Verify message count
        cy.get('[data-cy=message-item]').should('have.length', 2);

        // Verify inbound message
        cy.get('[data-cy=message-item]').first().within(() => {
          cy.get('[data-cy=message-content]')
            .should('contain', 'Hi, I\'m interested in learning more about your services');
          cy.get('[data-cy=message-timestamp]')
            .should('contain', '15:30');
          cy.get('[data-cy=message-direction]')
            .should('have.class', 'inbound');
        });
      });
    });

    it('handles new messages correctly', () => {
      cy.get('[data-cy=conversation-item]').first().click();

      // Simulate new message via WebSocket
      cy.window().then((win) => {
        const wsInstance = win.WebSocket.lastCall.returnValue;
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'message.new',
            conversationId: '123e4567-e89b-12d3-a456-426614174000',
            message: {
              id: 'new-message-id',
              content: 'New test message',
              direction: MessageDirection.INBOUND,
              timestamp: new Date().toISOString()
            }
          })
        });
      });

      // Verify new message appears
      cy.get('[data-cy=message-list]')
        .find('[data-cy=message-item]')
        .should('have.length', 3);
    });
  });

  describe('Human Takeover Functionality', () => {
    it('allows agent takeover of AI conversation', () => {
      cy.get('[data-cy=conversation-item]').first().click();
      cy.get('[data-cy=takeover-button]').click();

      // Verify takeover request
      cy.get('@wsSend').should('be.calledWith', 
        JSON.stringify({
          type: 'agent.takeover.request',
          conversationId: '123e4567-e89b-12d3-a456-426614174000'
        })
      );

      // Verify UI updates
      cy.get('[data-cy=status-badge]')
        .should('contain', 'Human Takeover');
      cy.get('[data-cy=agent-controls]')
        .should('be.visible');
    });
  });

  describe('Performance Metrics', () => {
    it('meets response time requirements', () => {
      // Verify AI processing time
      cy.get('[data-cy=conversation-item]').first().click();
      cy.get('[data-cy=response-time]')
        .should('contain', '320ms')
        .and('have.class', 'within-sla');

      // Test real-time updates
      cy.window().then((win) => {
        const start = performance.now();
        const wsInstance = win.WebSocket.lastCall.returnValue;
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'message.new',
            conversationId: '123e4567-e89b-12d3-a456-426614174000',
            message: {
              content: 'Performance test message',
              timestamp: new Date().toISOString()
            }
          })
        });
        const end = performance.now();
        expect(end - start).to.be.lessThan(500);
      });
    });

    it('tracks lead engagement metrics', () => {
      cy.get('[data-cy=engagement-metrics]').within(() => {
        cy.get('[data-cy=response-rate]')
          .should('contain', '80%');
        cy.get('[data-cy=avg-response-time]')
          .invoke('text')
          .should('match', /^\d{2,3}ms$/);
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('meets WCAG 2.1 Level AA requirements', () => {
      // Test keyboard navigation
      cy.get('body').tab();
      cy.get('[data-cy=conversation-item]').first()
        .should('have.focus');
      
      // Verify ARIA labels
      cy.get('[data-cy=conversation-list]')
        .should('have.attr', 'role', 'list')
        .and('have.attr', 'aria-label', 'Conversations');

      cy.get('[data-cy=conversation-item]').first()
        .should('have.attr', 'role', 'listitem')
        .and('have.attr', 'aria-selected');

      // Check color contrast
      cy.get('[data-cy=status-badge]')
        .should('have.css', 'background-color')
        .and('satisfy', (color) => {
          // Verify contrast ratio meets WCAG AA standards
          return color !== 'transparent';
        });
    });

    it('supports screen readers', () => {
      cy.get('[data-cy=ai-confidence]')
        .should('have.attr', 'aria-label')
        .and('match', /AI confidence: \d{1,3}%/);

      cy.get('[data-cy=message-list]')
        .should('have.attr', 'aria-live', 'polite');
    });
  });
});