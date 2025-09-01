import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Edit2,
  Save,
  X,
  Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProfiles } from '../../context/ProfilesContext';

interface PlaymetricsTeam {
  id: string;
  team_name: string;
  ics_url: string;
  last_synced: string | null;
  sync_status: 'pending' | 'success' | 'error';
  mapped_profiles?: { id: string; name: string; color: string }[];
  event_count?: number;
}

interface EditTeamNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  currentTeamName: string;
  onSave: (teamId: string, newName: string) => Promise<void>;
  platformColor: string;
}

const EditTeamNameModal: React.FC<EditTeamNameModalProps> = ({
  isOpen,
  onClose,
  teamId,
  currentTeamName,
  onSave,
  platformColor
}) => {
  const [editingName, setEditingName] = useState(currentTeamName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(teamId, editingName);
      onClose();
    } catch (error) {
      console.error('Error saving team name:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Edit Team Name</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div>
            <label htmlFor="team-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Team Name
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="team-name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter team name"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editingName.trim()}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const Playmetrics: React.FC = () => {
  const navigate = useNavigate();
  const { profiles } = useProfiles();
  const [teams, setTeams] = useState<PlaymetricsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [icsUrl, setIcsUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<{ id: string; name: string; color: string } | null>(null);

  const [showMappingModal, setShowMappingModal] = useState<string | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [refreshingTeam, setRefreshingTeam] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      const { data: teamsData, error: teamsError } = await supabase
        .from('platform_teams')
        .select('*')
        .eq('platform', 'Playmetrics')
        .eq('user_id', user.id)
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
    } finally {
      setLoading(false);
    }
  };

  const validateIcsUrl = (url: string): boolean => {
    try {
      // Handle webcal:// protocol by converting to https:// for URL parsing
      let urlToValidate = url;
      const isWebcal = url.startsWith('webcal://');
      
      if (isWebcal) {
        urlToValidate = url.replace('webcal://', 'https://');
      }
      
      const parsedUrl = new URL(urlToValidate);
      
      // Check hostname is from Playmetrics
      const validHostname = parsedUrl.hostname.includes('playmetrics.com');
      
      // Check for calendar path - be more flexible
      const hasCalendarPath = parsedUrl.pathname.includes('/calendar') || parsedUrl.pathname.includes('/calendars');
      
      // Check if ends with .ics
      const endsWithIcs = url.endsWith('.ics');
      
      // If it's a webcal URL, we don't require the .ics extension
      if (isWebcal) {
        const result = validHostname && hasCalendarPath;
        return result;
      }
      
      // For regular https URLs, we still check for .ics extension
      const result = validHostname && hasCalendarPath && endsWithIcs;
      return result;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateIcsUrl(icsUrl)) {
      setError('Please enter a valid Playmetrics calendar URL');
      return;
    }

    setSubmitting(true);

    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user');

      // Extract team ID from URL - handle multiple Playmetrics URL formats
      let teamId = null;
      
      // Try different patterns for Playmetrics URLs
      const patterns = [
        /\/t([a-zA-Z0-9]+)\//,  // /t410884/ or /tDD630420/
        /\/team\/([a-zA-Z0-9-]+)/,  // /team/220548-46283CA0
        /\/calendar\/\d+\/team\/([a-zA-Z0-9-]+)/,  // /calendar/1079/team/220548-46283CA0
        /\/([a-zA-Z0-9-]+)\.ics$/  // filename before .ics
      ];
      
      for (const pattern of patterns) {
        const match = icsUrl.match(pattern);
        if (match) {
          teamId = match[1];
          break;
        }
      }
      
      if (!teamId) {
        throw new Error('Could not extract team ID from URL. Please ensure the URL is a valid Playmetrics calendar URL.');
      }
      
      const teamName = `Playmetrics Team ${teamId}`;

      // Check if this user already has this team
      const { data: existingTeam, error: checkError } = await supabase
        .from('platform_teams')
        .select('*')
        .eq('platform', 'Playmetrics')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw checkError;
      }

      let team;
      if (existingTeam) {
        // Update existing team
        const { data: updatedTeam, error: updateError } = await supabase
          .from('platform_teams')
          .update({
            team_name: teamName,
            sport: 'Soccer',
            ics_url: icsUrl,
            sync_status: 'pending'
          })
          .eq('id', existingTeam.id)
          .select()
          .single();

        if (updateError) throw updateError;
        team = updatedTeam;
      } else {
        // Use upsert to handle potential conflicts with other users' teams
        const { data: newTeam, error: upsertError } = await supabase
          .from('platform_teams')
          .upsert({
            platform: 'Playmetrics',
            team_id: teamId,
            team_name: teamName,
            sport: 'Soccer',
            ics_url: icsUrl,
            sync_status: 'pending',
            user_id: user.id
          }, {
            onConflict: 'platform,team_id',
            ignoreDuplicates: false
          })
          .select()
          .maybeSingle();

        if (upsertError) throw upsertError;
        team = newTeam;
      }

      if (!team) throw new Error('Failed to create or update team');

      // Immediately sync the calendar to get events and team name
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-playmetrics-calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`, // Use user.id for authorization if needed, or session.access_token
          },
          body: JSON.stringify({
            icsUrl: icsUrl,
            teamId: team.id,
            profileId: null, // No profile mapping yet
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to sync calendar');
        }

        const syncResult = await response.json();
        
        setSuccess(`Team calendar added successfully! Found ${syncResult.eventCount || 0} events. You can now map it to your children's profiles.`);
      } catch (syncError) {
        console.error('Error syncing calendar:', syncError);
        setSuccess('Team calendar added successfully! You can now map it to your children\'s profiles and sync events.');
      }

      setIcsUrl('');
      fetchTeams();
    } catch (err) {
      console.error('Error adding team:', err);
      setError(err instanceof Error ? err.message : 'Failed to add team calendar. Please try again.');
    } finally {
      setSubmitting(false);
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
      setError('Failed to remove team. Please try again.');
    }
  };

  const handleRefresh = async (teamId: string) => {
    try {
      setError(null);
      setSuccess(null);
      setRefreshingTeam(teamId);
      
      // Fetch the latest team data with profile mappings directly from the database
      const { data: freshTeamData, error: freshTeamError } = await supabase
        .from('platform_teams')
        .select('id, team_name, ics_url')
        .eq('id', teamId)
        .single();
      
      if (freshTeamError) throw freshTeamError;
      if (!freshTeamData) throw new Error('Team not found');
      
      // Get the latest profile mappings for this team
      const { data: freshProfileMappings, error: mappingsError } = await supabase
        .from('profile_teams')
        .select(`
          profile_id,
          profiles!inner(id, name, color)
        `)
        .eq('platform_team_id', teamId);
      
      if (mappingsError) throw mappingsError;
      
      // Check if there are any profile mappings
      if (!freshProfileMappings || freshProfileMappings.length === 0) {
        setError('Please map this team to at least one child profile before syncing events.');
        return;
      }
      
      const mappedProfiles = freshProfileMappings.map(mapping => mapping.profiles);
      console.log(`Found ${mappedProfiles.length} mapped profiles for team ${teamId}`);

      // Get the current session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user');

      // Update team status to pending
      await supabase
        .from('platform_teams')
        .update({ sync_status: 'pending' })
        .eq('id', teamId);

      // Sync events for each mapped profile
      let totalEvents = 0;
      for (const profile of mappedProfiles) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-playmetrics-calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`, // Use user.id for authorization if needed, or session.access_token
          },
          body: JSON.stringify({
            icsUrl: freshTeamData.ics_url,
            teamId: teamId,
            profileId: profile.id
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to sync calendar');
        }

        const syncResult = await response.json();
        totalEvents += syncResult.eventCount || 0;
      }

      setSuccess(`Calendar refreshed successfully! Synced ${totalEvents} events for ${mappedProfiles.length} profile(s).`);
      fetchTeams();
    } catch (err) {
      console.error('Error refreshing calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh calendar. Please try again.');
      
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
    } finally {
      setRefreshingTeam(null);
    }
  };

  const handleEditTeamName = (teamId: string, currentName: string, platformColor: string) => {
    setTeamToEdit({ id: teamId, name: currentName, color: platformColor });
    setIsEditModalOpen(true);
  };

  const handleSaveTeamName = async (teamId: string, newName: string) => {
    try {
      setError(null);
      setSuccess(null);

      if (!newName.trim()) {
        setError('Team name cannot be empty');
        return;
      }

      const { error: updateError } = await supabase
        .from('platform_teams')
        .update({ team_name: newName.trim() })
        .eq('id', teamId);

      if (updateError) throw updateError;

      setTeams(teams.map(team => 
        team.id === teamId 
          ? { ...team, team_name: newName.trim() }
          : team
      ));

      setSuccess('Team name updated successfully');
    } catch (err) {
      console.error('Error updating team name:', err);
      setError('Failed to update team name. Please try again.');
    }
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
        
        // Immediately sync events for the newly mapped profiles
        await handleRefresh(showMappingModal);
      }

      setShowMappingModal(null);
      setSelectedProfiles([]);
      fetchTeams();
    } catch (err) {
      console.error('Error saving team mapping:', err);
      setError('Failed to update team mapping. Please try again.');
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/connections')}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Connections
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-12 w-12 rounded-lg overflow-hidden">
                <img 
                  src="https://play-lh.googleusercontent.com/3qlMAhClWu_R_XMqFx_8afl4ZiMQpDmw0Xfyb6OyTHAv3--KRr6yxmvmPr0gzQlKJWQ" 
                  alt="Playmetrics Logo" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connect to Playmetrics</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  Import your team schedules from Playmetrics calendars
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Team Calendar</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="ics-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Calendar URL
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      id="ics-url"
                      value={icsUrl}
                      onChange={(e) => setIcsUrl(e.target.value)}
                      placeholder="https://api.playmetrics.com/calendar/1079/team/220548-46283CA0.ics or webcal://api.playmetrics.com/calendar/1079/team/220548"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Enter the Playmetrics calendar URL for your team (e.g., from calendar.playmetrics.com). Both https:// and webcal:// URLs are supported.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 text-green-700 dark:text-green-300">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Adding & Syncing Team...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Team Calendar
                    </>
                  )}
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Connected Teams</h2>
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="animate-spin h-6 w-6 text-gray-400 dark:text-gray-500 mx-auto" />
                  </div>
                ) : teams.length > 0 ? (
                  teams.map((team) => (
                    <div
                      key={team.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start">
                        <div className="flex items-center flex-1">
                          <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {team.team_name}
                                </h3>
                                <button
                                  onClick={() => handleEditTeamName(team.id, team.team_name, '#10B981')} // Playmetrics green
                                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
                                  title="Edit team name"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </div>
                            
                            {/* Event count and profile mappings */}
                            <div className="mt-2 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {team.event_count || 0} events imported
                                </span>
                                {team.mapped_profiles && team.mapped_profiles.length > 0 && (
                                  <>
                                    <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      Mapped to {team.mapped_profiles.length} profile(s)
                                    </span>
                                  </>
                                )}
                              </div>
                              
                              {team.mapped_profiles && team.mapped_profiles.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
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
                                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                                  Not mapped to any profiles - events won't appear in calendars
                                </span>
                              )}
                            </div>

                            <div className="flex items-center mt-1">
                              {team.sync_status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-1" />
                              ) : team.sync_status === 'error' ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 mr-1" />
                              ) : (
                                <RefreshCw className="h-4 w-4 text-yellow-500 dark:text-yellow-400 mr-1" />
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {team.last_synced
                                  ? `Last synced ${new Date(team.last_synced).toLocaleString()}`
                                  : 'Never synced'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 mt-2 sm:mt-0">
                          <button
                            onClick={() => handleOpenMapping(team.id)}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400"
                            title="Map to profiles"
                          >
                            <Users className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRefresh(team.id)}
                            className={`p-2 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 ${
                              refreshingTeam === team.id ? 'animate-spin' : ''
                            }`}
                            title="Refresh calendar"
                            disabled={refreshingTeam === team.id}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(team.id)}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                            title="Remove team"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Calendar className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No teams connected yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && teamToEdit && (
        <EditTeamNameModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          teamId={teamToEdit.id}
          currentTeamName={teamToEdit.name}
          onSave={handleSaveTeamName}
          platformColor={teamToEdit.color}
        />
      )}

      {/* Profile Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Map Team to Profiles</h3>
              <button
                onClick={handleCancelMapping}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Select which children's profiles this team calendar should be associated with. Events will be automatically synced for mapped profiles.
              </p>

              {profiles && profiles.length > 0 ? (
                <div className="space-y-3">
                  {profiles.map(profile => (
                    <label
                      key={profile.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProfiles.includes(profile.id)
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{profile.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {profile.date_of_birth 
                              ? `Born: ${new Date(profile.date_of_birth).toLocaleDateString()}`
                              : 'Date of birth not set'
                            }
                          </div>
                        </div>
                      </div>
                      {selectedProfiles.includes(profile.id) && (
                        <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <UserPlus className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No profiles available</p>
                  <button
                    onClick={() => navigate('/profiles')}
                    className="mt-2 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    Create a profile first
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={handleCancelMapping}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800"
              >
                Save & Sync Events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Playmetrics;