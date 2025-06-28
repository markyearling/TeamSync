import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthPage } = useTheme();

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

        // If this is a password recovery flow with tokens in the query parameters
        if (type === 'recovery' && accessToken && refreshToken) {
          console.log('[AuthCallback] Password reset flow detected in query params');
          
          // Navigate to reset password with tokens
          navigate(`/auth/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}`, { replace: true });
          return;
        }

        // Check if there's a hash in the URL (Supabase sometimes appends tokens to the hash)
        if (window.location.hash) {
          // Parse the hash parameters (remove the leading '#')
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashType = hashParams.get('type');
          const hashAccessToken = hashParams.get('access_token');
          const hashRefreshToken = hashParams.get('refresh_token');

          console.log('[AuthCallback] Hash params check:');
          console.log('  - type:', hashType);
          console.log('  - access_token:', hashAccessToken ? 'present' : 'null');
          console.log('  - refresh_token:', hashRefreshToken ? 'present' : 'null');

          // If this is a password recovery flow with tokens in the hash
          if (hashType === 'recovery' && hashAccessToken && hashRefreshToken) {
            console.log('[AuthCallback] Password reset flow detected in hash');
            
            // Navigate to reset password with tokens
            navigate(`/auth/reset-password?access_token=${hashAccessToken}&refresh_token=${hashRefreshToken}`, { replace: true });
            return;
          }
        }

        // Special handling for code parameter (OAuth or magic link)
        if (code) {
          console.log('[AuthCallback] Code parameter detected, likely OAuth or magic link flow');
          try {
            // Exchange the code for a session
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
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
              
              // Check if this is a recovery flow
              if (type === 'recovery' || window.location.href.includes('type=recovery')) {
                console.log('[AuthCallback] This is a recovery flow with code, redirecting to reset password');
                navigate('/auth/reset-password', { replace: true });
                return;
              }
              
              navigate('/');
              return;
            } else {
              console.log('[AuthCallback] Code exchange successful but no session returned');
            }
          } catch (exchangeError) {
            console.error('[AuthCallback] Error exchanging code for session:', exchangeError);
          }
        }

        // Check if the URL contains "recovery" anywhere (fallback check)
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

        // For normal sign-in flows or if no recovery parameters found
        console.log('[AuthCallback] No recovery flow detected, checking for normal session');
        const { data, error } = await supabase.auth.getSession();
        
        console.log('[AuthCallback] getSession result:', {
          success: !error,
          hasSession: !!data?.session,
          error: error ? error.message : null,
          sessionDetails: data?.session ? {
            userId: data.session.user.id,
            expiresAt: data.session.expires_at
          } : null
        });
        
        if (error) {
          console.error('[AuthCallback] Error getting session:', error);
          navigate('/auth/signin', { 
            state: { 
              error: 'Authentication error. Please sign in again.' 
            } 
          });
          return;
        }
        
        if (data.session) {
          console.log('[AuthCallback] Valid session found, navigating to dashboard');
          navigate('/');
        } else {
          console.log('[AuthCallback] No session found, navigating to sign in');
          navigate('/auth/signin');
        }
      } catch (error) {
        console.error('[AuthCallback] Error in auth callback:', error);
        navigate('/auth/signin', { 
          state: { 
            error: error instanceof Error ? error.message : 'An unexpected error occurred during authentication.' 
          } 
        });
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

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