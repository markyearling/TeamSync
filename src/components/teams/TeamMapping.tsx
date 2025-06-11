import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, RefreshCw } from 'lucide-react';
import { TeamSnapService } from '../../services/teamsnap';

interface Team {
  id: string;
  platform: string;
  team_id: string;
  team_name: string;
  sport: string;
}

interface TeamMappingProps {
  profileId: string;
  onClose: () => void;
}

const TeamMapping: React.FC<TeamMappingProps> = ({ profileId, onClose }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        // Get all platform teams
        const { data: platformTeams, error: platformError } = await supabase
          .from('platform_teams')
          .select('*');

        if (platformError) throw platformError;

        // Get currently mapped teams for this profile
        const { data: profileTeams, error: profileError } = await supabase
          .from('profile_teams')
          .select('platform_team_id')
          .eq('profile_id', profileId);

        if (profileError) throw profileError;

        setTeams(platformTeams);
        setSelectedTeams(profileTeams.map(pt => pt.platform_team_id));
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [profileId]);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Delete existing mappings
      await supabase
        .from('profile_teams')
        .delete()
        .eq('profile_id', profileId);

      // Insert new mappings
      if (selectedTeams.length > 0) {
        const { error } = await supabase
          .from('profile_teams')
          .insert(
            selectedTeams.map(teamId => ({
              profile_id: profileId,
              platform_team_id: teamId
            }))
          );

        if (error) throw error;
      }

      // Now sync events for TeamSnap teams
      for (const teamId of selectedTeams) {
        const team = teams.find(t => t.id === teamId);
        if (team && team.platform === 'TeamSnap') {
          try {
            setSyncing(teamId);
            
            // We need to create a TeamSnap service instance, but we don't have the access token
            // For now, we'll just show a message that events will be synced when the user refreshes
            console.log(`TeamSnap team ${team.team_name} mapped. Events will be synced on next refresh.`);
          } catch (syncError) {
            console.error(`Error syncing events for team ${team.team_name}:`, syncError);
          }
        }
      }

      setSyncing(null);
      onClose();
    } catch (error) {
      console.error('Error saving team mappings:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const groupedTeams = teams.reduce((acc, team) => {
    if (!acc[team.platform]) {
      acc[team.platform] = [];
    }
    acc[team.platform].push(team);
    return acc;
  }, {} as Record<string, Team[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Map Teams</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {Object.entries(groupedTeams).map(([platform, platformTeams]) => (
            <div key={platform}>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{platform}</h4>
              <div className="space-y-3">
                {platformTeams.map(team => (
                  <label
                    key={team.id}
                    className={`flex items-center p-4 rounded-lg border ${
                      selectedTeams.includes(team.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50'
                        : 'border-gray-200 dark:border-gray-700'
                    } cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 relative`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedTeams.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                            {team.team_name}
                          </h5>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {team.sport}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {syncing === team.id && (
                            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                          )}
                          {selectedTeams.includes(team.id) && (
                            <Check className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {teams.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No teams available. Connect to platforms to import teams.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || syncing !== null}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        {selectedTeams.some(teamId => teams.find(t => t.id === teamId)?.platform === 'TeamSnap') && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/50 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> TeamSnap events will be synced when you refresh the team connection or manually sync events.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMapping;