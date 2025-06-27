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
    
    if (type === 'recovery' && token) {
      // For password reset flow, redirect to the reset password page with the token
      navigate(`/auth/reset-password?token=${token}`);
      return;
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