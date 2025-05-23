import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../../lib/supabase';
import { testSupabaseConnection } from '../../lib/testConnection';
import { AlertCircle } from 'lucide-react';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || '/';
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const status = await testSupabaseConnection();
      setConnectionStatus(status);
    };

    checkConnection();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate(returnTo);
      }
      setError(null);
    });

    return () => subscription.unsubscribe();
  }, [navigate, returnTo]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to TeamSync</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {connectionStatus && !connectionStatus.success && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{connectionStatus.error}</p>
                    {connectionStatus.details && (
                      <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                        {JSON.stringify(connectionStatus.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              style: {
                message: {
                  color: 'red'
                }
              }
            }}
            providers={['google', 'apple', 'facebook']}
            redirectTo={`${window.location.origin}/auth/callback`}
            view="sign_in"
            onError={(error) => {
              setError(error.message);
            }}
          />
          <div className="mt-4 text-center">
            <Link 
              to="/auth/reset-password" 
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;