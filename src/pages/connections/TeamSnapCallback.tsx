import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { TeamSnapService } from '../../services/teamsnap';

const TeamSnapCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'syncing' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      if (!code) {
        setError('No authorization code received');
        setStatus('error');
        return;
      }

      try {
        const teamSnap = new TeamSnapService({
          clientId: import.meta.env.VITE_TEAMSNAP_CLIENT_ID,
          redirectUri: `${window.location.origin}/connections/teamsnap/callback`
        });

        // Handle OAuth callback and get access token
        await teamSnap.handleCallback(code);
        setStatus('syncing');
        
        // Wait a moment to show success message before redirecting
        setTimeout(() => {
          setStatus('success');
          // Redirect to TeamSnap connections page instead of general connections
          setTimeout(() => {
            navigate('/connections/teamsnap', { 
              state: { 
                teamSnapConnected: true,
                showSuccessMessage: true 
              }
            });
          }, 1500);
        }, 2000);
      } catch (err) {
        setError('Failed to complete authentication');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/connections/teamsnap')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              Return to TeamSnap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          {status === 'loading' ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting to TeamSnap</h2>
              <p className="text-gray-600">Please wait while we complete the connection...</p>
            </>
          ) : status === 'syncing' ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Successfully Connected!</h2>
              <p className="text-gray-600 mb-2">Your TeamSnap account has been connected.</p>
              <div className="flex items-center justify-center">
                <div className="animate-pulse flex items-center text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Syncing your teams...
                </div>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Teams Synced Successfully!</h2>
              <p className="text-gray-600">Redirecting to manage your teams...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamSnapCallback;