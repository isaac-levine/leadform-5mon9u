/**
 * @fileoverview Test suite for ConversationList component
 * Verifies conversation rendering, real-time updates, accessibility, and interactions
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Internal imports
import ConversationList from '../../../src/components/conversations/ConversationList';
import { Conversation, ConversationStatus, MessageDirection } from '../../../src/types/conversation';
import { useConversation } from '../../../src/hooks/useConversation';
import { 
  CONVERSATION_STATUS_LABELS, 
  AI_CONFIDENCE_THRESHOLDS 
} from '../../../src/lib/constants/messages';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock hooks
vi.mock('../../../src/hooks/useConversation');

// Mock data
const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    leadId: 'lead-1',
    formId: 'form-1',
    status: ConversationStatus.ACTIVE,
    phoneNumber: '+1234567890',
    assignedAgent: null,
    lastActivity: new Date('2023-01-01T12:00:00Z'),
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Hello there',
        direction: MessageDirection.INBOUND,
        timestamp: new Date('2023-01-01T12:00:00Z'),
        metadata: {}
      }
    ],
    metadata: {},
    aiEnabled: true,
    language: 'en-US',
    tags: [],
    aiConfidence: 0.95
  },
  {
    id: 'conv-2',
    leadId: 'lead-2',
    formId: 'form-1',
    status: ConversationStatus.HUMAN_TAKEOVER,
    phoneNumber: '+1987654321',
    assignedAgent: 'agent-1',
    lastActivity: new Date('2023-01-01T11:00:00Z'),
    messages: [],
    metadata: {},
    aiEnabled: true,
    language: 'en-US',
    tags: [],
    aiConfidence: 0.75
  }
];

describe('ConversationList', () => {
  const mockOnConversationSelect = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    (useConversation as jest.Mock).mockReturnValue({
      conversations: mockConversations,
      loading: false,
      error: null,
      connectionStatus: 'CONNECTED'
    });
  });

  it('renders conversation list correctly', () => {
    render(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    // Verify list container
    const list = screen.getByRole('listbox', { name: /conversations/i });
    expect(list).toBeInTheDocument();

    // Verify conversation items
    mockConversations.forEach(conversation => {
      const item = screen.getByRole('button', { 
        name: new RegExp(conversation.phoneNumber, 'i') 
      });
      expect(item).toBeInTheDocument();

      // Verify status badge
      const statusBadge = within(item).getByText(
        CONVERSATION_STATUS_LABELS[conversation.status]
      );
      expect(statusBadge).toBeInTheDocument();

      // Verify AI confidence indicator
      const confidenceIndicator = within(item).getByLabelText(/ai confidence/i);
      expect(confidenceIndicator).toBeInTheDocument();
    });
  });

  it('handles conversation selection', async () => {
    render(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    const firstConversation = screen.getByRole('button', { 
      name: new RegExp(mockConversations[0].phoneNumber, 'i') 
    });

    await user.click(firstConversation);
    expect(mockOnConversationSelect).toHaveBeenCalledWith(mockConversations[0].id);
    expect(firstConversation).toHaveAttribute('aria-selected', 'true');
  });

  it('displays loading state correctly', () => {
    (useConversation as jest.Mock).mockReturnValue({
      conversations: [],
      loading: true,
      error: null
    });

    render(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    const loadingElement = screen.getByRole('progressbar');
    expect(loadingElement).toBeInTheDocument();
    expect(screen.getByText(/loading conversations/i)).toBeInTheDocument();
  });

  it('handles error state correctly', () => {
    const mockError = new Error('Failed to load conversations');
    (useConversation as jest.Mock).mockReturnValue({
      conversations: [],
      loading: false,
      error: mockError
    });

    const { rerender } = render(
      <ConversationList onConversationSelect={mockOnConversationSelect} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load conversations/i)).toBeInTheDocument();

    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    // Simulate successful retry
    (useConversation as jest.Mock).mockReturnValue({
      conversations: mockConversations,
      loading: false,
      error: null
    });
    rerender(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    render(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    const conversations = screen.getAllByRole('button');
    const firstConversation = conversations[0];
    const secondConversation = conversations[1];

    // Focus first conversation
    firstConversation.focus();
    expect(document.activeElement).toBe(firstConversation);

    // Navigate with arrow keys
    await user.keyboard('[ArrowDown]');
    expect(document.activeElement).toBe(secondConversation);

    await user.keyboard('[ArrowUp]');
    expect(document.activeElement).toBe(firstConversation);

    // Select with Enter key
    await user.keyboard('[Enter]');
    expect(mockOnConversationSelect).toHaveBeenCalledWith(mockConversations[0].id);
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <ConversationList onConversationSelect={mockOnConversationSelect} />
    );

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA attributes
    const list = screen.getByRole('listbox');
    expect(list).toHaveAttribute('aria-label', 'Conversations');

    // Verify focus management
    const conversations = screen.getAllByRole('button');
    conversations.forEach(conversation => {
      expect(conversation).toHaveAttribute('tabIndex', '0');
      expect(conversation).toHaveAttribute('aria-selected');
    });
  });

  it('handles real-time updates', async () => {
    const { rerender } = render(
      <ConversationList onConversationSelect={mockOnConversationSelect} />
    );

    // Simulate new message
    const updatedConversations = [...mockConversations];
    updatedConversations[0].messages.push({
      id: 'msg-2',
      conversationId: 'conv-1',
      content: 'New message',
      direction: MessageDirection.INBOUND,
      timestamp: new Date(),
      metadata: {}
    });

    (useConversation as jest.Mock).mockReturnValue({
      conversations: updatedConversations,
      loading: false,
      error: null
    });

    rerender(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    await waitFor(() => {
      expect(screen.getByText('New message')).toBeInTheDocument();
    });
  });

  it('displays correct AI confidence indicators', () => {
    render(<ConversationList onConversationSelect={mockOnConversationSelect} />);

    mockConversations.forEach(conversation => {
      const confidenceIndicator = screen.getByLabelText(
        new RegExp(`AI confidence: ${Math.round(conversation.aiConfidence * 100)}%`, 'i')
      );
      expect(confidenceIndicator).toBeInTheDocument();

      // Verify confidence level styling
      const confidenceLevel = conversation.aiConfidence >= AI_CONFIDENCE_THRESHOLDS.HIGH
        ? 'high'
        : conversation.aiConfidence >= AI_CONFIDENCE_THRESHOLDS.MEDIUM
        ? 'medium'
        : 'low';
      expect(confidenceIndicator).toHaveClass(`ai-confidence ${confidenceLevel}`);
    });
  });
});