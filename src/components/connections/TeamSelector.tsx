import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

interface Team {
  id: string;
  name: string;
  sport: string;
}

interface TeamSelectorProps {
  teams: Team[];
  onTeamSelect: (teamId: string, childId: number) => void;
}

const TeamSelector: React.FC<TeamSelectorProps> = ({ teams, onTeamSelect }) => {
  const { children } = useApp();
  const [selectedTeams, setSelectedTeams] = useState<Record<string, number>>({});

  const handleTeamSelect = (teamId: string, childId: number) => {
    setSelectedTeams(prev => ({
      ...prev,
      [teamId]: childId
    }));
    onTeamSelect(teamId, childId);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Select Teams</h3>
      <div className="grid gap-4">
        {teams.map(team => (
          <div key={team.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium text-gray-900">{team.name}</h4>
                <p className="text-sm text-gray-500">{team.sport}</p>
              </div>
              <select
                value={selectedTeams[team.id] || ''}
                onChange={(e) => handleTeamSelect(team.id, Number(e.target.value))}
                className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Select child</option>
                {children.map(child => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamSelector;