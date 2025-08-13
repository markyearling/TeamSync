import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        console.log('[AuthCallback] Starting auth redirect handler');
        console.log('[AuthCallback] Full URL:', window.location.href);

        // Check for type parameter in both query params and hash
        const url = new URL(window.location.href);
        const typeFromQuery = url.searchParams.get('type');
        const typeFromHash = url.hash ? new URLSearchParams(url.hash.substring(1)).get('type') : null;
        const isRecoveryFlow = typeFromQuery === 'recovery' || typeFromHash === 'recovery';

        console.log('[AuthCallback] Type from query:', typeFromQuery);
        console.log('[AuthCallback] Type from hash:', typeFromHash);
        console.log('[AuthCallback] Is recovery flow:', isRecoveryFlow);

        // Let Supabase handle the session establishment automatically
        // This will parse tokens from URL hash/query and establish session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        console.log('[AuthCallback] Session result:', {
          hasSession: !!session,
          error: sessionError?.message
        });

        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          
          if (isRecoveryFlow) {
            navigate('/auth/forgot-password', { 
              state: { 
                error: 'Password reset link was invalid or expired. Please request a new one.' 
              },
              replace: true
            });
          } else {
            setError('Authentication error. Please sign in again.');
          }
          return;
        }

        if (session) {
          console.log('[AuthCallback] Valid session established');
          
          if (isRecoveryFlow) {
            console.log('[AuthCallback] Recovery flow with valid session, navigating to reset password');
            navigate('/auth/reset-password', { replace: true });
          } else {
            console.log('[AuthCallback] Standard auth flow with valid session, navigating to dashboard');
            navigate('/', { replace: true });
          }
        } else {
          console.log('[AuthCallback] No session established');
          
          if (isRecoveryFlow) {
            console.log('[AuthCallback] Recovery flow failed, redirecting to forgot password');
            navigate('/auth/forgot-password', { 
              state: { 
                error: 'Password reset link was invalid or expired. Please request a new one.' 
              },
              replace: true
            });
          } else {
            console.log('[AuthCallback] No session, navigating to sign in');
            navigate('/auth/signin', { replace: true });
          }
        }
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred during authentication.');
      } finally {
        setProcessing(false);
      }
    };

    handleAuthRedirect();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="flex items-center justify-center text-red-600 mb-4">
              <AlertCircle className="h-12 w-12" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/auth/signin')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;