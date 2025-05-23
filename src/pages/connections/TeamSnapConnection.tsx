import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AlertCircle, CheckCircle, X, Calendar, MessageSquare, Trophy, ArrowLeft } from 'lucide-react';
import { TeamSnapService } from '../../services/teamsnap';

const TeamSnapConnection: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  const teamSnap = new TeamSnapService({
    clientId: import.meta.env.VITE_TEAMSNAP_CLIENT_ID,
    redirectUri: `${window.location.origin}/connections/teamsnap/callback`
  });

  const features = [
    {
      icon: Calendar,
      title: 'Automatic Schedule Sync',
      description: 'Keep your calendar up to date with automatic syncing of games, practices, and events'
    },
    {
      icon: MessageSquare,
      title: 'Team Communication',
      description: 'Stay connected with coaches and team members through integrated messaging'
    },
    {
      icon: Trophy,
      title: 'Game Statistics',
      description: 'Track performance metrics and game statistics in real-time'
    }
  ];

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const authUrl = await teamSnap.initiateOAuth();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/connections')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Connections
        </button>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex items-center">
              <div className="h-12 w-12 flex-shrink-0">
                <img 
                  src="https://images.teamsnap.com/teamsnap-logo.svg" 
                  alt="TeamSnap" 
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Connect to TeamSnap</h1>
                <p className="mt-1 text-gray-500">
                  Sync your TeamSnap schedules, events, and team information
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-6">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-purple-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-purple-900 mb-4">
                Before you connect
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-purple-200 text-purple-600 flex items-center justify-center text-sm mr-3 mt-0.5">
                    1
                  </div>
                  <p className="text-purple-800">
                    Make sure you have an active TeamSnap account
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-purple-200 text-purple-600 flex items-center justify-center text-sm mr-3 mt-0.5">
                    2
                  </div>
                  <p className="text-purple-800">
                    Have your TeamSnap login credentials ready
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-purple-200 text-purple-600 flex items-center justify-center text-sm mr-3 mt-0.5">
                    3
                  </div>
                  <p className="text-purple-800">
                    Ensure you have permission to access team data
                  </p>
                </li>
              </ul>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect TeamSnap Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamSnapConnection;