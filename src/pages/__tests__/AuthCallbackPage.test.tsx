import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthCallbackPage from '../AuthCallbackPage';
import { useStore } from '../../store/useStore';
import * as supabaseLib from '../../utils/supabase';

describe('AuthCallbackPage PKCE & Token Exchange', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useStore.setState({
      initAuthSession: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('detects existing session and sets success status', async () => {
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'test-user-id', email: 'learner@example.com' },
              access_token: 'valid-jwt',
            },
          },
          error: null,
        }),
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Authentication Successful!')).toBeInTheDocument();
  });

  it('handles error URL parameters with error alert', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/auth/callback?error=access_denied&error_description=User+cancelled']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('User cancelled')).toBeInTheDocument();
    expect(screen.getByText('Return to Profile')).toBeInTheDocument();
    await user.click(screen.getByText('Return to Profile'));
  });

  it('shows an opaque service error when the Supabase client is unavailable', async () => {
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Authentication service is currently unavailable.')).toBeInTheDocument();
  });

  it('reports provider session errors and thrown verification failures', async () => {
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'Session rejected' } }),
      },
    } as any);

    const first = render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Session rejected')).toBeInTheDocument();
    first.unmount();

    vi.mocked(supabaseLib.getSupabaseClientAsync).mockResolvedValue({
      auth: { getSession: vi.fn().mockRejectedValue(new Error('Verification failed safely')) },
    } as any);
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Verification failed safely')).toBeInTheDocument();
  });

  it('resolves a delayed SIGNED_IN callback and unsubscribes the listener', async () => {
    let callback: ((event: string, session: unknown) => Promise<void>) | undefined;
    const unsubscribe = vi.fn();
    const initAuthSession = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ initAuthSession });

    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn((handler) => {
          callback = handler;
          return { data: { subscription: { unsubscribe } } };
        }),
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    await vi.waitFor(() => expect(callback).toBeDefined());
    await act(async () => {
      await callback?.('SIGNED_IN', { user: { id: 'user-2' }, access_token: 'token' });
    });
    expect(await screen.findByText('Authentication Successful!')).toBeInTheDocument();
    expect(initAuthSession).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('times out when no session event arrives', async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe } } });
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange,
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    await vi.waitFor(() => expect(onAuthStateChange).toHaveBeenCalled());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByText('Authentication timed out. Please return to profile and try again.')).toBeInTheDocument();
    expect(unsubscribe).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
