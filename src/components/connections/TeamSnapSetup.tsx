import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import TeamSnapService from '../../services/teamsnap';
import TeamSelector from './TeamSelector';

const TeamSnapSetup: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamSnap = new TeamSnapService({
          clientId: import.meta.env.VITE_TEAMSNAP_CLIENT_ID,
          redirectUri: `${window.location.origin}/connections/teamsnap/callback`
        });

        const teamsData = await teamSnap.getTeams();
        setTeams(teamsData.collection.items);
      } catch (err) {
        setError('Failed to fetch teams');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTeamSelect = async (teamId: string, childId: number) => {
    // Here you would typically save the team-child association to your database
    console.log(`Associating TeamSnap team ${teamId} with child ${childId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-lg w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-lg w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center text-red-600 mb-4">
              <AlertCircle className="h-12 w-12" />
            </div>
            <h2 className="text-xl font-semibold text-center mb-2">Error</h2>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <div className="flex justify-center">
              <button
                onClick={() => navigate('/connections')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Return to Connections
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
              <h2 className="text-lg font-medium text-gray-900">
                Connected to TeamSnap
              </h2>
            </div>
          </div>
          
          <div className="p-6">
            <TeamSelector teams={teams} onTeamSelect={handleTeamSelect} />
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => navigate('/connections')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Skip for now
              </button>
              <button
                onClick={() => navigate('/connections')}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Complete Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamSnapSetup;