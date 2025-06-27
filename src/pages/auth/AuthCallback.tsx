import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if this is a password reset flow by examining the URL parameters
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const isPasswordReset = type === 'recovery';
    
    if (isPasswordReset && token) {
      // For password reset flow, redirect to the reset password page with the token
      navigate(`/auth/reset-password?token=${token}`);
      return;
    }

    // Check if this is a hash-based auth flow (for backward compatibility)
    if (window.location.hash.includes('type=recovery')) {
      // Extract the access token from the URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        // Redirect to the reset password page with the tokens
        const queryParams = new URLSearchParams();
        queryParams.append('access_token', accessToken);
        if (refreshToken) {
          queryParams.append('refresh_token', refreshToken);
        }
        navigate(`/auth/reset-password?${queryParams.toString()}`);
        return;
      }
    }

    // For normal sign-in flows, continue with the standard behavior
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/');
      }
    });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;