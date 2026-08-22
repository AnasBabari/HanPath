import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSupabaseClientAsync } from '../utils/supabase';
import { useStore } from '../store/useStore';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { initAuthSession } = useStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      // 1. Check for error parameters in URL query or hash
      const errorParam = searchParams.get('error') || searchParams.get('error_code');
      const errorDesc = searchParams.get('error_description');

      if (errorParam || errorDesc) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(errorDesc || errorParam || 'Authentication failed or was cancelled.');
        }
        return;
      }

      // 2. Check Supabase session
      const supabase = await getSupabaseClientAsync();
      if (!supabase) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Authentication service is currently unavailable.');
        }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(error.message);
          }
          return;
        }

        if (session) {
          await initAuthSession();
          if (isMounted) {
            setStatus('success');
            setTimeout(() => {
              navigate('/profile', { replace: true });
            }, 800);
          }
          return;
        }

        // If no session found yet, wait for onAuthStateChange
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
            await initAuthSession();
            if (isMounted) {
              setStatus('success');
              authListener.subscription.unsubscribe();
              setTimeout(() => {
                navigate('/profile', { replace: true });
              }, 800);
            }
          }
        });

        // Timeout fallback after 8 seconds
        setTimeout(() => {
          if (isMounted && status === 'loading') {
            authListener.subscription.unsubscribe();
            setStatus('error');
            setErrorMessage('Authentication timed out. Please return to profile and try again.');
          }
        }, 8000);
      } catch (err: unknown) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Authentication verification error');
        }
      }
    }

    void handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams, initAuthSession]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin mx-auto" />
          <h1 className="text-xl font-bold font-display text-primary">Verifying Authentication...</h1>
          <p className="text-xs text-on-surface-variant">
            Please wait while we complete your sign-in and synchronize your learning progress.
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-accessible flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-display text-green-accessible">Authentication Successful!</h1>
          <p className="text-xs text-on-surface-variant">Redirecting to your profile...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-surface-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-accessible flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-display text-red-accessible">Sign-In Failed</h1>
          <p className="text-xs text-on-surface-variant">{errorMessage || 'Unable to authenticate session.'}</p>
          <button
            type="button"
            onClick={() => navigate('/profile', { replace: true })}
            className="touch-target px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all w-full"
          >
            Return to Profile
          </button>
        </div>
      )}
    </div>
  );
}
