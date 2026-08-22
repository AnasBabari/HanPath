import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    render(
      <MemoryRouter initialEntries={['/auth/callback?error=access_denied&error_description=User+cancelled']}>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('User cancelled')).toBeInTheDocument();
    expect(screen.getByText('Return to Profile')).toBeInTheDocument();
  });
});
