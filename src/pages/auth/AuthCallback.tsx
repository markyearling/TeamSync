import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // First, check for password reset tokens in the URL query parameters
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');

        // If this is a password recovery flow with tokens in the query parameters
        if (type === 'recovery' && accessToken && refreshToken) {
          console.log('Password reset flow detected in query params');
          // Set the session with the tokens
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          // Navigate to reset password page with tokens
          navigate(`/auth/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}`);
          return;
        }

        // Check if there's a hash in the URL (Supabase sometimes appends tokens to the hash)
        if (window.location.hash) {
          // Parse the hash parameters (remove the leading '#')
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashType = hashParams.get('type');
          const hashAccessToken = hashParams.get('access_token');
          const hashRefreshToken = hashParams.get('refresh_token');

          // If this is a password recovery flow with tokens in the hash
          if (hashType === 'recovery' && hashAccessToken && hashRefreshToken) {
            console.log('Password reset flow detected in hash');
            // Set the session with the tokens
            await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            });
            // Navigate to reset password page with tokens
            navigate(`/auth/reset-password?access_token=${hashAccessToken}&refresh_token=${hashRefreshToken}`);
            return;
          }
        }

        // For normal sign-in flows or if no recovery parameters found
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate('/');
        } else {
          navigate('/auth/signin');
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        navigate('/auth/signin');
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;