import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthPage } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] Starting callback handler');
        console.log('[AuthCallback] Full URL:', window.location.href);
        console.log('[AuthCallback] URL hash:', window.location.hash);
        console.log('[AuthCallback] URL search params:', window.location.search);
        
        // First, check for password reset tokens in the URL query parameters
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');
        const code = searchParams.get('code');
        
        console.log('[AuthCallback] Query params check:');
        console.log('  - access_token:', accessToken ? 'present' : 'null');
        console.log('  - refresh_token:', refreshToken ? 'present' : 'null');
        console.log('  - type:', type);
        console.log('  - code:', code ? 'present' : 'null');

        // Check if there's a hash in the URL (Supabase sometimes appends tokens to the hash)
        let hashType, hashAccessToken, hashRefreshToken, hashCode;
        if (window.location.hash) {
          // Parse the hash parameters (remove the leading '#')
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          hashType = hashParams.get('type');
          hashAccessToken = hashParams.get('access_token');
          hashRefreshToken = hashParams.get('refresh_token');
          hashCode = hashParams.get('code');

          console.log('[AuthCallback] Hash params check:');
          console.log('  - type:', hashType);
          console.log('  - access_token:', hashAccessToken ? 'present' : 'null');
          console.log('  - refresh_token:', hashRefreshToken ? 'present' : 'null');
          console.log('  - code:', hashCode ? 'present' : 'null');
        }

        // CASE 1: Password Recovery Flow with tokens
        // Check both query params and hash for recovery tokens
        if ((type === 'recovery' && accessToken && refreshToken) || 
            (hashType === 'recovery' && hashAccessToken && hashRefreshToken)) {
          
          console.log('[AuthCallback] Password reset flow detected with tokens');
          
          // Use tokens from either query params or hash
          const finalAccessToken = accessToken || hashAccessToken;
          const finalRefreshToken = refreshToken || hashRefreshToken;
          
          // Navigate to reset password with tokens
          navigate(`/auth/reset-password?access_token=${finalAccessToken}&refresh_token=${finalRefreshToken}`, { replace: true });
          return;
        }

        // CASE 2: Password Recovery Flow with code
        if ((type === 'recovery' && code) || (hashType === 'recovery' && hashCode)) {
          console.log('[AuthCallback] Password reset flow detected with code');
          
          const finalCode = code || hashCode;
          
          try {
            // Explicitly clear any stored tokens from localStorage
            localStorage.removeItem('supabase.auth.token');
            localStorage.removeItem('sb-refresh-token');
            localStorage.removeItem('sb-access-token');
            
            // Ensure any existing session is cleared first
            await supabase.auth.signOut();
            
            // Exchange the code for a session
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(finalCode);
            
            console.log('[AuthCallback] Code exchange result:', {
              success: !exchangeError,
              hasSession: !!data?.session,
              error: exchangeError ? exchangeError.message : null
            });
            
            if (exchangeError) {
              console.error('[AuthCallback] Error exchanging code for session:', exchangeError);
              navigate('/auth/forgot-password', { 
                state: { 
                  error: 'Password reset link was invalid or expired. Please request a new one.' 
                },
                replace: true
              });
              return;
            }
            
            if (data?.session) {
              console.log('[AuthCallback] Successfully exchanged code for session, redirecting to reset password');
              navigate('/auth/reset-password', { replace: true });
              return;
            } else {
              console.log('[AuthCallback] Code exchange successful but no session returned');
              navigate('/auth/forgot-password', { 
                state: { 
                  error: 'Password reset link was invalid or expired. Please request a new one.' 
                },
                replace: true
              });
              return;
            }
          } catch (exchangeError) {
            console.error('[AuthCallback] Error exchanging code for session:', exchangeError);
            navigate('/auth/forgot-password', { 
              state: { 
                error: 'Password reset link was invalid or expired. Please request a new one.' 
              },
              replace: true
            });
            return;
          }
        }

        // CASE 3: Standard OAuth or Magic Link Flow with code
        if (code || hashCode) {
          console.log('[AuthCallback] Standard auth flow detected with code');
          
          const finalCode = code || hashCode;
          
          try {
            // Exchange the code for a session
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(finalCode);
            
            console.log('[AuthCallback] Code exchange result:', {
              success: !exchangeError,
              hasSession: !!exchangeData?.session,
              error: exchangeError ? exchangeError.message : null
            });
            
            if (exchangeError) {
              throw exchangeError;
            }
            
            if (exchangeData?.session) {
              console.log('[AuthCallback] Successfully exchanged code for session');
              navigate('/', { replace: true });
              return;
            } else {
              console.log('[AuthCallback] Code exchange successful but no session returned');
              setError('Authentication failed. Please try signing in again.');
              setProcessing(false);
              return;
            }
          } catch (exchangeError) {
            console.error('[AuthCallback] Error exchanging code for session:', exchangeError);
            setError('Authentication failed. Please try signing in again.');
            setProcessing(false);
            return;
          }
        }

        // CASE 4: Check for recovery keyword in URL as fallback
        if (window.location.href.includes('recovery') || window.location.href.includes('reset-password')) {
          console.log('[AuthCallback] Recovery keyword found in URL, but tokens not properly extracted');
          
          // Try to get the current session
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('[AuthCallback] Found existing session for recovery flow, redirecting to reset password');
            navigate('/auth/reset-password', { replace: true });
            return;
          }
          
          // Redirect to forgot password page as fallback
          navigate('/auth/forgot-password', { 
            state: { 
              error: 'Password reset link was invalid or expired. Please request a new one.' 
            },
            replace: true
          });
          return;
        }

        // CASE 5: No specific parameters found, check for session
        console.log('[AuthCallback] No specific auth parameters found, checking for session');
        const { data, error } = await supabase.auth.getSession();
        
        console.log('[AuthCallback] getSession result:', {
          success: !error,
          hasSession: !!data?.session,
          error: error ? error.message : null
        });
        
        if (error) {
          console.error('[AuthCallback] Error getting session:', error);
          setError('Authentication error. Please sign in again.');
          setProcessing(false);
          return;
        }
        
        if (data.session) {
          console.log('[AuthCallback] Valid session found, navigating to dashboard');
          navigate('/', { replace: true });
        } else {
          console.log('[AuthCallback] No session found, navigating to sign in');
          navigate('/auth/signin', { replace: true });
        }
      } catch (error) {
        console.error('[AuthCallback] Error in auth callback:', error);
        setError(error instanceof Error ? error.message : 'An unexpected error occurred during authentication.');
        setProcessing(false);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

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