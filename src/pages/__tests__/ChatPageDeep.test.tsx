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
      authSession: { user: null, token: null },
      syncStatus: 'idle',
      cloudVersion: 0,
      lastSyncTime: null,
      lastSuccessfulSyncTime: null,
      lastSyncAttemptTime: null,
      isDirty: false,
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

  it('allows clearing chat history', async () => {
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

    expect(useStore.getState().chatHistory.length).toBe(0);
  });
});
