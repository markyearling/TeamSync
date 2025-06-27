import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if there's a hash in the URL (Supabase appends tokens to the hash)
        if (window.location.hash) {
          // Parse the hash parameters (remove the leading '#')
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get('type');
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          // If this is a password recovery flow
          if (type === 'recovery' && accessToken && refreshToken) {
            // Navigate to reset password page with the tokens
            navigate(`/auth/reset-password?access_token=${accessToken}&refresh_token=${refreshToken}`);
            return;
          }
        }

        // For normal sign-in flows or if no hash parameters found
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
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default AuthCallback;