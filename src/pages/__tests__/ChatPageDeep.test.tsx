import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '../ChatPage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';
import * as aiModule from '../../utils/ai';

describe('ChatPage Deep Messaging Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    const snap = createDefaultProgressSnapshotV4();
    useStore.setState({
      snapshot: snap,
      hskLevel: 1,
      units: null,
      loading: false,
      isFullScreen: false,
      error: null,
      toast: null,
      adminMode: false,
      chatHistory: [
        { id: 'm1', role: 'model', content: 'Hello! I am your AI Chinese Tutor.' },
      ],
      storageStatus: 'healthy',
      storageError: null,
      stats: deriveUserStats(snap, 1),
    });
  });

  it('sends user message and displays model response', async () => {
    vi.spyOn(aiModule, 'callOpenRouter').mockResolvedValue('你好！ (Nǐ hǎo!) means Hello.');

    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Ask in Chinese or English/i);
    fireEvent.change(input, { target: { value: 'How do I say hello?' } });

    const sendBtn = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(sendBtn);

    expect(await screen.findByText('你好！ (Nǐ hǎo!) means Hello.')).toBeInTheDocument();
  });

  it('allows clearing chat history and restores default welcome message', async () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    act(() => {
      useStore.setState({
        chatHistory: [
          { id: 'm1', role: 'user', content: 'Question' },
          { id: 'm2', role: 'model', content: 'Answer' },
        ],
      });
    });

    const clearBtn = await screen.findByTitle('Clear Chat History');
    fireEvent.click(clearBtn);

    // Clears and restores initial welcome greeting
    const history = useStore.getState().chatHistory;
    expect(history.length).toBe(1);
    expect(history[0].role).toBe('model');
    expect(history[0].content).toContain('AI Language Tutor');
  });

  it('retries failed message without duplicating user bubble or request history', async () => {
    const callOpenRouterMock = vi.spyOn(aiModule, 'callOpenRouter')
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce('把 (bǎ) is a disposal marker preposition.');

    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Ask in Chinese or English/i);
    fireEvent.change(input, { target: { value: 'How does 把 work?' } });

    const sendBtn = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(sendBtn);

    // Wait for error state
    expect(await screen.findByText('Network timeout')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: 'Retry Message' });
    expect(retryBtn).toBeInTheDocument();

    // Verify user message is present once in chatHistory
    const userMessagesBeforeRetry = useStore.getState().chatHistory.filter((m) => m.content === 'How does 把 work?');
    expect(userMessagesBeforeRetry).toHaveLength(1);

    // Click retry
    fireEvent.click(retryBtn);

    // Verify response succeeds
    expect(await screen.findByText('把 (bǎ) is a disposal marker preposition.')).toBeInTheDocument();

    // Assert that user message is STILL only present once (NO duplicate bubble)
    const userMessagesAfterRetry = useStore.getState().chatHistory.filter((m) => m.content === 'How does 把 work?');
    expect(userMessagesAfterRetry).toHaveLength(1);

    // Assert that second call to callOpenRouter did not duplicate the user message in history
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
    const secondCallHistory = callOpenRouterMock.mock.calls[1][0];
    const userPromptsInPayload = secondCallHistory.filter((m) => m.content === 'How does 把 work?');
    expect(userPromptsInPayload).toHaveLength(1);
  });
});
