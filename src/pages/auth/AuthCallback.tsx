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

        const url = new URL(window.location.href);
        
        // Check for parameters in both query string and hash fragment
        const codeFromQuery = url.searchParams.get('code');
        const typeFromQuery = url.searchParams.get('type');
        const accessTokenFromQuery = url.searchParams.get('access_token');
        const refreshTokenFromQuery = url.searchParams.get('refresh_token');
        
        let codeFromHash, typeFromHash, accessTokenFromHash, refreshTokenFromHash;
        if (url.hash) {
          const hashParams = new URLSearchParams(url.hash.substring(1));
          codeFromHash = hashParams.get('code');
          typeFromHash = hashParams.get('type');
          accessTokenFromHash = hashParams.get('access_token');
          refreshTokenFromHash = hashParams.get('refresh_token');
        }

        // Determine which parameters to use (prefer query string over hash)
        const code = codeFromQuery || codeFromHash;
        const type = typeFromQuery || typeFromHash;
        const accessToken = accessTokenFromQuery || accessTokenFromHash;
        const refreshToken = refreshTokenFromQuery || refreshTokenFromHash;
        
        // Check for custom flow parameter to identify password recovery
        const flowFromQuery = url.searchParams.get('flow');
        const flowFromHash = url.hash ? new URLSearchParams(url.hash.substring(1)).get('flow') : null;
        const flow = flowFromQuery || flowFromHash;
        
        const isRecoveryFlow = flow === 'recovery' || type === 'recovery';

        console.log('[AuthCallback] Parameters found:', {
          code: code ? 'present' : 'missing',
          type,
          flow,
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing',
          isRecoveryFlow
        });

        let sessionEstablished = false;

        // Try to establish session based on available parameters
        if (code) {
          console.log('[AuthCallback] Found code, exchanging for session');
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('[AuthCallback] Error exchanging code:', error);
              throw error;
            }
            
            if (data?.session) {
              console.log('[AuthCallback] Successfully exchanged code for session');
              sessionEstablished = true;
            } else {
              console.log('[AuthCallback] No session returned from code exchange');
            }
          } catch (codeError) {
            console.error('[AuthCallback] Code exchange failed:', codeError);
            throw codeError;
          }
        } else if (accessToken && refreshToken) {
          console.log('[AuthCallback] Found access/refresh tokens, setting session');
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('[AuthCallback] Error setting session:', error);
              throw error;
            }
            
            if (data?.session) {
              console.log('[AuthCallback] Successfully set session with tokens');
              sessionEstablished = true;
            } else {
              console.log('[AuthCallback] No session returned from setSession');
            }
          } catch (tokenError) {
            console.error('[AuthCallback] Token session setup failed:', tokenError);
            throw tokenError;
          }
        } else {
          console.log('[AuthCallback] No authentication parameters found in URL');
          // Check if there's already an existing session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('[AuthCallback] Error getting existing session:', sessionError);
            throw sessionError;
          }
          
          if (session) {
            console.log('[AuthCallback] Found existing session');
            sessionEstablished = true;
          }
        }

        // Navigate based on session status and flow type
        if (sessionEstablished) {
          console.log('[AuthCallback] Session established successfully');
          
          if (isRecoveryFlow) {
            console.log('[AuthCallback] Recovery flow - navigating to reset password');
            navigate('/auth/reset-password', { replace: true });
          } else {
            console.log('[AuthCallback] Standard auth flow - navigating to dashboard');
            navigate('/', { replace: true });
          }
        } else {
          console.log('[AuthCallback] Failed to establish session');
          
          if (isRecoveryFlow) {
            console.log('[AuthCallback] Recovery flow failed - redirecting to forgot password');
            navigate('/auth/forgot-password', { 
              state: { 
                error: 'Password reset link was invalid or expired. Please request a new one.' 
              },
              replace: true
            });
          } else {
            console.log('[AuthCallback] Standard auth failed - redirecting to sign in');
            navigate('/auth/signin', { 
              state: { 
                error: 'Authentication failed. Please sign in again.' 
              },
              replace: true
            });
          }
        }

      } catch (err) {
        console.error('[AuthCallback] Error in auth redirect handler:', err);
        
        // Check if this was a recovery flow to provide appropriate error handling
        const url = new URL(window.location.href);
        const typeFromQuery = url.searchParams.get('type');
        const typeFromHash = url.hash ? new URLSearchParams(url.hash.substring(1)).get('type') : null;
        const isRecoveryFlow = typeFromQuery === 'recovery' || typeFromHash === 'recovery';
        
        if (isRecoveryFlow) {
          navigate('/auth/forgot-password', { 
            state: { 
              error: 'Password reset link was invalid or expired. Please request a new one.' 
            },
            replace: true
          });
        } else {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred during authentication.');
        }
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