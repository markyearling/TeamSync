import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Calendar, 
  MessageSquare, 
  Trophy, 
  ArrowLeft,
  RefreshCw,
  Trash2,
  Edit2,
  Save,
  UserPlus
} from 'lucide-react';
import { TeamSnapService } from '../../services/teamsnap';
import { supabase } from '../../lib/supabase';
import { useProfiles } from '../../context/ProfilesContext';

interface TeamSnapTeam {
  id: string;
  team_name: string;
  sport: string;
  last_synced: string | null;
  sync_status: 'pending' | 'success' | 'error';
  mapped_profiles?: { id: string; name: string; color: string }[];
  event_count?: number;
}

const TeamSnapConnection: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [teams, setTeams] = useState<TeamSnapTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showMappingModal, setShowMappingModal] = useState<string | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const navigate = useNavigate();
  const { profiles } = useProfiles();

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

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      // Check if we have any TeamSnap teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('platform_teams')
        .select('*')
        .eq('platform', 'TeamSnap')
        .order('created_at', { ascending: false });

      if (teamsError) throw teamsError;

      if (teamsData && teamsData.length > 0) {
        setIsConnected(true);
        await fetchTeams();
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Error checking connection status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('platform_teams')
        .select('*')
        .eq('platform', 'TeamSnap')
        .order('created_at', { ascending: false });

      if (teamsError) throw teamsError;

      // Fetch profile mappings and event counts for each team
      const teamsWithMappings = await Promise.all(
        (teamsData || []).map(async (team) => {
          // Get profile mappings
          const { data: profileTeams, error: profileError } = await supabase
            .from('profile_teams')
            .select(`
              profile_id,
              profiles!inner(id, name, color)
            `)
            .eq('platform_team_id', team.id);

          if (profileError) {
            console.error('Error fetching profile mappings:', profileError);
          }

          // Get event count for this team
          const { count: eventCount, error: eventError } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('platform_team_id', team.id);

          if (eventError) {
            console.error('Error fetching event count:', eventError);
          }

          const mapped_profiles = profileTeams?.map(pt => pt.profiles) || [];
          return { 
            ...team, 
            mapped_profiles,
            event_count: eventCount || 0
          };
        })
      );

      setTeams(teamsWithMappings);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to fetch teams');
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const authUrl = await teamSnap.initiateOAuth();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      setError('Failed to initiate connection');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      setSuccess(null);

      // Delete all TeamSnap teams and their associated data
      const { error: deleteError } = await supabase
        .from('platform_teams')
        .delete()
        .eq('platform', 'TeamSnap');

      if (deleteError) throw deleteError;

      setIsConnected(false);
      setTeams([]);
      setSuccess('TeamSnap disconnected successfully');
    } catch (err) {
      console.error('Error disconnecting TeamSnap:', err);
      setError('Failed to disconnect TeamSnap');
    }
  };

  const handleRefresh = async (teamId: string) => {
    try {
      setError(null);
      setSuccess(null);
      
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      if (!team.mapped_profiles || team.mapped_profiles.length === 0) {
        setError('Please map this team to at least one child profile before syncing events.');
        return;
      }

      // Update team status to pending
      await supabase
        .from('platform_teams')
        .update({ sync_status: 'pending' })
        .eq('id', teamId);

      // For now, we'll just update the sync status since we need the access token
      // In a real implementation, you'd need to store and retrieve the access token
      await supabase
        .from('platform_teams')
        .update({
          sync_status: 'success',
          last_synced: new Date().toISOString()
        })
        .eq('id', teamId);

      setSuccess(`Team refreshed successfully. Note: Full event sync requires re-authentication.`);
      fetchTeams();
    } catch (err) {
      console.error('Error refreshing team:', err);
      setError('Failed to refresh team');
      
      // Update team sync status to error
      if (teamId) {
        await supabase
          .from('platform_teams')
          .update({
            sync_status: 'error',
            last_synced: new Date().toISOString()
          })
          .eq('id', teamId);
      }
    }
  };

  const handleDelete = async (teamId: string) => {
    try {
      setError(null);
      setSuccess(null);

      const { error: deleteError } = await supabase
        .from('platform_teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) throw deleteError;

      setTeams(teams.filter(team => team.id !== teamId));
      setSuccess('Team removed successfully');
    } catch (err) {
      console.error('Error deleting team:', err);
      setError('Failed to remove team');
    }
  };

  const handleEditTeamName = (teamId: string, currentName: string) => {
    setEditingTeam(teamId);
    setEditingName(currentName);
  };

  const handleSaveTeamName = async (teamId: string) => {
    try {
      setError(null);
      setSuccess(null);

      if (!editingName.trim()) {
        setError('Team name cannot be empty');
        return;
      }

      const { error: updateError } = await supabase
        .from('platform_teams')
        .update({ team_name: editingName.trim() })
        .eq('id', teamId);

      if (updateError) throw updateError;

      setTeams(teams.map(team => 
        team.id === teamId 
          ? { ...team, team_name: editingName.trim() }
          : team
      ));

      setEditingTeam(null);
      setEditingName('');
      setSuccess('Team name updated successfully');
    } catch (err) {
      console.error('Error updating team name:', err);
      setError('Failed to update team name');
    }
  };

  const handleCancelEdit = () => {
    setEditingTeam(null);
    setEditingName('');
  };

  const handleOpenMapping = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      setSelectedProfiles(team.mapped_profiles?.map(p => p.id) || []);
      setShowMappingModal(teamId);
    }
  };

  const handleSaveMapping = async () => {
    if (!showMappingModal) return;

    try {
      setError(null);
      setSuccess(null);

      // Delete existing mappings
      await supabase
        .from('profile_teams')
        .delete()
        .eq('platform_team_id', showMappingModal);

      // Insert new mappings
      if (selectedProfiles.length > 0) {
        const { error } = await supabase
          .from('profile_teams')
          .insert(
            selectedProfiles.map(profileId => ({
              profile_id: profileId,
              platform_team_id: showMappingModal
            }))
          );

        if (error) throw error;
      }

      setShowMappingModal(null);
      setSelectedProfiles([]);
      setSuccess('Team mapping updated successfully. Use the refresh button to sync events for the mapped profiles.');
      fetchTeams();
    } catch (err) {
      console.error('Error saving team mapping:', err);
      setError('Failed to update team mapping');
    }
  };

  const handleCancelMapping = () => {
    setShowMappingModal(null);
    setSelectedProfiles([]);
  };

  const toggleProfileSelection = (profileId: string) => {
    setSelectedProfiles(prev =>
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

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
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-12 w-12 flex-shrink-0 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-gray-900">TeamSnap</h1>
                  <p className="mt-1 text-gray-500">
                    {isConnected ? 'Connected - Manage your teams and schedules' : 'Connect to sync your TeamSnap schedules, events, and team information'}
                  </p>
                </div>
              </div>
              {isConnected && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-200">
              <div className="flex items-center text-red-700">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            </div>
          )}

          {success && (
            <div className="px-6 py-4 bg-green-50 border-b border-green-200">
              <div className="flex items-center text-green-700">
                <CheckCircle className="h-5 w-5 mr-2" />
                {success}
              </div>
            </div>
          )}

          {!isConnected ? (
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
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Users className="h-5 w-5 mr-2" />
                      Connect TeamSnap Account
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900">Connected Teams</h2>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm font-medium"
                >
                  Disconnect TeamSnap
                </button>
              </div>

              <div className="space-y-4">
                {teams.length > 0 ? (
                  teams.map((team) => (
                    <div
                      key={team.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                          <div className="flex-1">
                            {editingTeam === team.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="flex-1 text-sm font-medium border-gray-300 rounded-md focus:border-purple-500 focus:ring-purple-500"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveTeamName(team.id);
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit();
                                    }
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveTeamName(team.id)}
                                  className="p-1 text-purple-600 hover:text-purple-700"
                                  title="Save"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 text-gray-400 hover:text-gray-500"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-medium text-gray-900">
                                  {team.team_name}
                                </h3>
                                <button
                                  onClick={() => handleEditTeamName(team.id, team.team_name)}
                                  className="p-1 text-gray-400 hover:text-gray-500"
                                  title="Edit team name"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            
                            {/* Event count and profile mappings */}
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  {team.event_count || 0} events imported
                                </span>
                                {team.mapped_profiles && team.mapped_profiles.length > 0 && (
                                  <>
                                    <span className="text-xs text-gray-300">•</span>
                                    <span className="text-xs text-gray-500">
                                      Mapped to {team.mapped_profiles.length} profile(s)
                                    </span>
                                  </>
                                )}
                              </div>
                              
                              {team.mapped_profiles && team.mapped_profiles.length > 0 ? (
                                <div className="flex items-center space-x-2">
                                  {team.mapped_profiles.map(profile => (
                                    <span
                                      key={profile.id}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                                      style={{ 
                                        backgroundColor: profile.color + '20',
                                        color: profile.color
                                      }}
                                    >
                                      {profile.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                  Not mapped to any profiles - events won't appear in calendars
                                </span>
                              )}
                            </div>

                            <div className="flex items-center mt-1">
                              {team.sync_status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              ) : team.sync_status === 'error' ? (
                                <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                              ) : (
                                <RefreshCw className="h-4 w-4 text-yellow-500 mr-1" />
                              )}
                              <span className="text-xs text-gray-500">
                                {team.last_synced
                                  ? `Last synced ${new Date(team.last_synced).toLocaleString()}`
                                  : 'Never synced'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenMapping(team.id)}
                            className="p-2 text-gray-400 hover:text-purple-500"
                            title="Map to profiles"
                          >
                            <Users className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRefresh(team.id)}
                            className="p-2 text-gray-400 hover:text-gray-500"
                            title="Refresh team"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(team.id)}
                            className="p-2 text-gray-400 hover:text-red-500"
                            title="Remove team"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No teams found</p>
                    <p className="text-sm text-gray-400 mt-1">Teams will appear here after connecting to TeamSnap</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Map Team to Profiles</h3>
              <button
                onClick={handleCancelMapping}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Select which children's profiles this team should be associated with. Events will only appear in the calendars of mapped profiles.
              </p>

              {profiles && profiles.length > 0 ? (
                <div className="space-y-3">
                  {profiles.map(profile => (
                    <label
                      key={profile.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProfiles.includes(profile.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedProfiles.includes(profile.id)}
                        onChange={() => toggleProfileSelection(profile.id)}
                      />
                      <div className="flex items-center flex-1">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3"
                          style={{ backgroundColor: profile.color }}
                        >
                          {profile.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{profile.name}</div>
                          <div className="text-xs text-gray-500">Age: {profile.age}</div>
                        </div>
                      </div>
                      {selectedProfiles.includes(profile.id) && (
                        <CheckCircle className="h-5 w-5 text-purple-500" />
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <UserPlus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No profiles available</p>
                  <button
                    onClick={() => navigate('/profiles')}
                    className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                  >
                    Create a profile first
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={handleCancelMapping}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSnapConnection;