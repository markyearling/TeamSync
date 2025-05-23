import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SportsEngineService from '../../services/sportsengine';
import { Calendar, CheckCircle, AlertCircle } from 'lucide-react';

interface SportsEngineConnectProps {
  onSuccess: (data: any) => void;
}

const SportsEngineConnect: React.FC<SportsEngineConnectProps> = ({ onSuccess }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sportsEngine = new SportsEngineService({
    clientId: import.meta.env.VITE_SPORTSENGINE_CLIENT_ID,
    redirectUri: `${window.location.origin}/connections/callback`
  });

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleCallback(code);
    }
  }, [searchParams]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const authUrl = await sportsEngine.initiateOAuth();
      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to initiate connection');
      setIsConnecting(false);
    }
  };

  const handleCallback = async (code: string) => {
    try {
      await sportsEngine.handleCallback(code);
      const leagues = await sportsEngine.getLeagues();
      onSuccess(leagues);
      navigate('/connections');
    } catch (err) {
      setError('Failed to complete connection');
      setIsConnecting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <Calendar className="h-8 w-8 text-blue-600 mr-3" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">SportsEngine</h3>
          <p className="text-sm text-gray-500">Connect to import your leagues, teams, and games</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 rounded-md flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className={`w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          isConnecting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isConnecting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
            Connecting...
          </>
        ) : (
          'Connect SportsEngine'
        )}
      </button>
    </div>
  );
};

export default SportsEngineConnect;