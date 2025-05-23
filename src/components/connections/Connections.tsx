import React from 'react';
import SportsEngineConnect from './SportsEngineConnect';
import TeamSnapConnect from './TeamSnapConnect';

const Connections: React.FC = () => {
  const handleSportsEngineSuccess = (data: any) => {
    console.log('SportsEngine connected:', data);
  };

  const handleTeamSnapSuccess = (data: any) => {
    console.log('TeamSnap connected:', data);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SportsEngineConnect onSuccess={handleSportsEngineSuccess} />
      <TeamSnapConnect onSuccess={handleTeamSnapSuccess} />
    </div>
  );
};

export default Connections;