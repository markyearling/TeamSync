import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';

const TeamSnapConnect: React.FC = () => {
  const navigate = useNavigate();

  const handleConnect = () => {
    navigate('/connections/teamsnap');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <div className="h-8 w-8 flex items-center justify-center mr-3 bg-purple-100 rounded-lg">
          <Users className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">TeamSnap</h3>
          <p className="text-sm text-gray-500">Connect to import your teams, schedules, and events</p>
        </div>
      </div>

      <button
        onClick={handleConnect}
        className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
      >
        Connect TeamSnap
      </button>
    </div>
  );
};

export default TeamSnapConnect;