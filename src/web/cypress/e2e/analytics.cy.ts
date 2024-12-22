import { MetricType, TimeRange, AnalyticsOverview } from '../../src/types/analytics';
import '@testing-library/cypress';

describe('Analytics Dashboard', () => {
  beforeEach(() => {
    // Intercept API calls and provide mock responses
    cy.intercept('GET', '/api/v1/analytics/overview', {
      fixture: 'analytics.json'
    }).as('getAnalytics');

    cy.intercept('GET', '/api/v1/analytics/metrics*', {
      fixture: 'analytics.json'
    }).as('getMetrics');

    // Mock WebSocket connection for real-time updates
    cy.window().then((win) => {
      win.WebSocket = class MockWebSocket {
        onopen: () => void = () => {};
        send = cy.stub().as('wsSend');
        close = cy.stub().as('wsClose');
      } as any;
    });

    // Visit analytics dashboard with authentication
    cy.visit('/dashboard/analytics', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('auth_token', 'test-token');
      }
    });

    // Wait for initial data load
    cy.wait('@getAnalytics');
  });

  it('validates metrics display and meets performance criteria', () => {
    // Verify response time metrics
    cy.findByTestId('metric-response-time')
      .should('be.visible')
      .within(() => {
        cy.findByText(/Response Time/i).should('be.visible');
        cy.get('[data-value]').should('have.attr', 'data-value').and('be.lessThan', 500);
      });

    // Verify lead engagement metrics
    cy.findByTestId('metric-lead-engagement')
      .should('be.visible')
      .within(() => {
        cy.findByText(/Lead Engagement/i).should('be.visible');
        cy.get('[data-value]').should('have.attr', 'data-value').and('be.greaterThan', 80);
      });

    // Verify conversion rate improvement
    cy.findByTestId('metric-conversion-rate')
      .should('be.visible')
      .within(() => {
        cy.findByText(/Conversion Rate/i).should('be.visible');
        cy.get('[data-improvement]').should('have.attr', 'data-improvement').and('be.greaterThan', 25);
      });

    // Test loading states
    cy.intercept('GET', '/api/v1/analytics/overview', {
      delay: 1000,
      fixture: 'analytics.json'
    }).as('delayedAnalytics');

    cy.findByRole('button', { name: /refresh/i }).click();
    cy.findByTestId('metrics-loading').should('be.visible');
    cy.wait('@delayedAnalytics');
    cy.findByTestId('metrics-loading').should('not.exist');

    // Verify accessibility
    cy.injectAxe();
    cy.checkA11y();
  });

  it('tests time range filtering with data updates', () => {
    // Test daily range selection
    cy.findByRole('combobox', { name: /time range/i }).click();
    cy.findByRole('option', { name: /daily/i }).click();
    cy.wait('@getMetrics')
      .its('request.url')
      .should('include', `timeRange=${TimeRange.DAY}`);

    // Test weekly range selection
    cy.findByRole('combobox', { name: /time range/i }).click();
    cy.findByRole('option', { name: /weekly/i }).click();
    cy.wait('@getMetrics')
      .its('request.url')
      .should('include', `timeRange=${TimeRange.WEEK}`);

    // Verify chart updates
    cy.findByTestId('analytics-chart')
      .should('be.visible')
      .and('have.attr', 'data-time-range', TimeRange.WEEK);

    // Test custom date range
    cy.findByRole('button', { name: /custom range/i }).click();
    cy.findByLabelText(/start date/i).type('2023-01-01');
    cy.findByLabelText(/end date/i).type('2023-01-31');
    cy.findByRole('button', { name: /apply/i }).click();
    cy.wait('@getMetrics');
  });

  it('verifies chart interactions and visualizations', () => {
    // Test chart tooltip interactions
    cy.findByTestId('analytics-chart')
      .should('be.visible')
      .within(() => {
        // Hover over data points
        cy.get('[data-point]').first().trigger('mouseover');
        cy.get('[role="tooltip"]')
          .should('be.visible')
          .and('contain', 'Response Time')
          .and('contain', 'ms');

        // Test zoom functionality
        cy.get('.zoom-controls [data-zoom="in"]').click();
        cy.get('[data-zoom-level]').should('have.attr', 'data-zoom-level', '2');

        // Test pan functionality
        cy.get('.chart-area')
          .trigger('mousedown', { clientX: 100, clientY: 100 })
          .trigger('mousemove', { clientX: 200, clientY: 100 })
          .trigger('mouseup');
      });

    // Verify legend interactions
    cy.findByTestId('chart-legend')
      .should('be.visible')
      .within(() => {
        cy.findByText(/response time/i).click();
        cy.get('[data-series="response-time"]').should('have.attr', 'data-visible', 'false');
      });
  });

  it('validates export features and data integrity', () => {
    // Test CSV export
    cy.findByRole('button', { name: /export csv/i }).click();
    cy.findByRole('menuitem', { name: /current view/i }).click();
    cy.wait('@getMetrics');
    cy.readFile('cypress/downloads/analytics-export.csv').should('exist');

    // Test PDF export
    cy.findByRole('button', { name: /export pdf/i }).click();
    cy.findByTestId('export-progress').should('be.visible');
    cy.wait('@getMetrics');
    cy.readFile('cypress/downloads/analytics-report.pdf').should('exist');

    // Verify export data integrity
    cy.fixture('analytics.json').then((analyticsData: AnalyticsOverview) => {
      cy.readFile('cypress/downloads/analytics-export.csv').then((csvContent) => {
        // Verify CSV contains all metric types
        Object.values(MetricType).forEach((metricType) => {
          expect(csvContent).to.include(metricType);
        });
        
        // Verify metric values match fixture data
        expect(csvContent).to.include(analyticsData.metrics.responseTime.value.toString());
      });
    });
  });

  it('tests responsive behavior and mobile interactions', () => {
    // Test mobile viewport
    cy.viewport('iphone-x');
    
    // Verify mobile menu
    cy.findByRole('button', { name: /menu/i }).click();
    cy.findByRole('menu').should('be.visible');
    
    // Test touch interactions on charts
    cy.findByTestId('analytics-chart')
      .trigger('touchstart', { touches: [{ clientX: 100, clientY: 100 }] })
      .trigger('touchmove', { touches: [{ clientX: 200, clientY: 100 }] })
      .trigger('touchend');
    
    // Verify responsive layout
    cy.findByTestId('metrics-grid')
      .should('have.css', 'grid-template-columns')
      .and('match', /1fr/);
  });
});