import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

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
          
          // Clear any existing session first
          await supabase.auth.signOut();
          console.log('Existing session cleared for password reset');
          
          // Navigate to reset password with tokens
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
            
            // Clear any existing session first
            await supabase.auth.signOut();
            console.log('Existing session cleared for password reset');
            
            // Navigate to reset password with tokens
            navigate(`/auth/reset-password?access_token=${hashAccessToken}&refresh_token=${hashRefreshToken}`);
            return;
          }
        }

        // For normal sign-in flows or if no recovery parameters found
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          navigate('/auth/signin', { 
            state: { 
              error: 'Authentication error. Please sign in again.' 
            } 
          });
          return;
        }
        
        if (data.session) {
          navigate('/');
        } else {
          navigate('/auth/signin');
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Processing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;