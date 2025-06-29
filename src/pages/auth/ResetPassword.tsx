import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const { isAuthPage } = useTheme();

  useEffect(() => {
    // Log the full URL and search parameters for debugging
    console.log('ResetPassword: Full URL:', window.location.href);
    console.log('ResetPassword: URL hash:', window.location.hash);
    console.log('ResetPassword: URL search params:', window.location.search);
    
    // Check if we have the required tokens from the URL
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const code = searchParams.get('code');
    
    console.log('ResetPassword: access_token from searchParams:', accessToken ? 'present' : 'missing');
    console.log('ResetPassword: refresh_token from searchParams:', refreshToken ? 'present' : 'missing');
    console.log('ResetPassword: code from searchParams:', code ? 'present' : 'missing');
    
    // Check if tokens might be in the hash fragment
    let hashAccessToken, hashRefreshToken, hashCode;
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      hashAccessToken = hashParams.get('access_token');
      hashRefreshToken = hashParams.get('refresh_token');
      hashCode = hashParams.get('code');
      
      console.log('ResetPassword: access_token from hash:', hashAccessToken ? 'present' : 'missing');
      console.log('ResetPassword: refresh_token from hash:', hashRefreshToken ? 'present' : 'missing');
      console.log('ResetPassword: code from hash:', hashCode ? 'present' : 'missing');
      
      // If tokens are in the hash but not in search params, use them
      if (hashAccessToken && hashRefreshToken && (!accessToken || !refreshToken)) {
        console.log('ResetPassword: Using tokens from hash instead of search params');
        
        // Redirect to the same page but with tokens in search params
        navigate(`/auth/reset-password?access_token=${hashAccessToken}&refresh_token=${hashRefreshToken}`, { replace: true });
        return;
      }
      
      // If code is in the hash but not in search params, use it
      if (hashCode && !code) {
        console.log('ResetPassword: Using code from hash instead of search params');
        
        // Redirect to the same page but with code in search params
        navigate(`/auth/reset-password?code=${hashCode}`, { replace: true });
        return;
      }
    }

    const setupResetSession = async () => {
      try {
        console.log('ResetPassword: Checking for valid session');
        
        // First check if we have tokens in the URL
        if (accessToken && refreshToken) {
          console.log('ResetPassword: Found tokens in URL, setting up session');
          
          // Explicitly clear any stored tokens from localStorage
          localStorage.removeItem('supabase.auth.token');
          localStorage.removeItem('sb-refresh-token');
          localStorage.removeItem('sb-access-token');
          
          // Ensure any existing session is cleared first
          await supabase.auth.signOut();
          
          // Set the session with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          console.log('ResetPassword: setSession result:', { 
            success: !error, 
            hasData: !!data,
            error: error ? error.message : null
          });

          if (error) {
            console.error('ResetPassword: Error setting session:', error);
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else {
            console.log('ResetPassword: Session set successfully with tokens from URL');
          }
        } 
        // Check if we have a code parameter
        else if (code || hashCode) {
          console.log('ResetPassword: Found code in URL, exchanging for session');
          
          const finalCode = code || hashCode;
          
          // Explicitly clear any stored tokens from localStorage
          localStorage.removeItem('supabase.auth.token');
          localStorage.removeItem('sb-refresh-token');
          localStorage.removeItem('sb-access-token');
          
          // Ensure any existing session is cleared first
          await supabase.auth.signOut();
          
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(finalCode);
          
          console.log('ResetPassword: exchangeCodeForSession result:', { 
            success: !error, 
            hasData: !!data,
            hasSession: !!data?.session,
            error: error ? error.message : null
          });
          
          if (error) {
            console.error('ResetPassword: Error exchanging code for session:', error);
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else if (!data.session) {
            console.error('ResetPassword: No session returned from code exchange');
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else {
            console.log('ResetPassword: Successfully exchanged code for session');
          }
        } else {
          // No tokens or code in URL, check if we have an active session already
          console.log('ResetPassword: No tokens or code in URL, checking for existing session');
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('ResetPassword: Error getting session:', sessionError);
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else if (!sessionData.session) {
            console.error('ResetPassword: No session found');
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else {
            console.log('ResetPassword: Found existing session, can proceed with password reset');
          }
        }
      } catch (err) {
        console.error('ResetPassword: Exception setting up session:', err);
        setError('Invalid or expired reset link. Please request a new password reset.');
      } finally {
        setInitializing(false);
      }
    };

    setupResetSession();
  }, [searchParams, navigate]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      console.log('ResetPassword: Updating password');
      
      // Update the user's password
      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      console.log('ResetPassword: updateUser result:', { 
        success: !error, 
        hasData: !!data,
        error: error ? error.message : null
      });

      if (error) throw error;

      // Password updated successfully, now sign out to force re-authentication
      console.log('ResetPassword: Password updated successfully, signing out');
      await supabase.auth.signOut();
      
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/auth/signin', { 
          state: { 
            message: 'Password updated successfully. Please sign in with your new password.' 
          } 
        });
      }, 3000);

    } catch (err) {
      console.error('ResetPassword: Error updating password:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Verifying your reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-gray-600 mb-4">
                Your password has been successfully updated.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting you to the sign in page...
              </p>
              <div className="mt-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Reset your password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter your new password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Password must be at least 8 characters with uppercase, lowercase, and number
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirm your new password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Updating password...
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;