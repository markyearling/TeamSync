import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a password reset flow by examining the URL hash
    const isPasswordReset = window.location.hash.includes('type=recovery');
    
    if (isPasswordReset) {
      // Extract the access token and refresh token from the URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // Redirect to the reset password page with the tokens
        navigate(`/auth/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}`);
        return;
      }
    }

    // For normal sign-in flows, continue with the standard behavior
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/');
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;