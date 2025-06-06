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
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PlaymetricsTeam {
  id: string;
  team_name: string;
  ics_url: string;
  last_synced: string | null;
  sync_status: 'pending' | 'success' | 'error';
}

const PlaymetricsConnection: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<PlaymetricsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [icsUrl, setIcsUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_teams')
        .select('*')
        .eq('platform', 'Playmetrics')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateIcsUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.protocol === 'https:' &&
        parsedUrl.hostname === 'api.playmetrics.com' &&
        parsedUrl.pathname.includes('/calendar/') &&
        url.endsWith('.ics')
      );
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

      // Extract team name from URL
      const teamId = icsUrl.split('/team/')[1]?.split('-')[0];
      const teamName = `Team ${teamId}`;

      // Add or update team in platform_teams using upsert
      const { data: team, error: teamError } = await supabase
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
          returning: 'minimal'
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Sync events from ICS using Supabase Edge Function
      const { data: syncData, error: invokeError } = await supabase.functions.invoke(
        'sync-playmetrics-calendar',
        {
          body: { teamId: team.id, icsUrl }
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to sync calendar events');
      }

      setSuccess('Team calendar added successfully!');
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
      const { error } = await supabase
        .from('platform_teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      setTeams(teams.filter(team => team.id !== teamId));
      setSuccess('Team removed successfully');
    } catch (err) {
      console.error('Error deleting team:', err);
      setError('Failed to remove team. Please try again.');
    }
  };

  const handleRefresh = async (teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      // Sync events from ICS using Supabase Edge Function
      const { data: syncData, error: invokeError } = await supabase.functions.invoke(
        'sync-playmetrics-calendar',
        {
          body: { teamId: team.id, icsUrl: team.ics_url }
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to sync calendar events');
      }

      setSuccess('Calendar refreshed successfully!');
      fetchTeams();
    } catch (err) {
      console.error('Error refreshing calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh calendar. Please try again.');
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
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#10B981' + '20', color: '#10B981' }}
              >
                <BarChart className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Connect to Playmetrics</h1>
                <p className="mt-1 text-gray-500">
                  Import your team schedules from Playmetrics calendars
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Add Team Calendar</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="ics-url" className="block text-sm font-medium text-gray-700">
                    Calendar URL
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      id="ics-url"
                      value={icsUrl}
                      onChange={(e) => setIcsUrl(e.target.value)}
                      placeholder="https://api.playmetrics.com/calendar/1079/team/220548-46283CA0.ics"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      required
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Enter the Playmetrics calendar URL for your team
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Adding Team...
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
              <h2 className="text-lg font-medium text-gray-900 mb-4">Connected Teams</h2>
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="animate-spin h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                ) : teams.length > 0 ? (
                  teams.map((team) => (
                    <div
                      key={team.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">
                              {team.team_name}
                            </h3>
                            <div className="flex items-center mt-1">
                              {team.sync_status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              ) : team.sync_status === 'error' ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
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
                            onClick={() => handleRefresh(team.id)}
                            className="p-2 text-gray-400 hover:text-gray-500"
                            title="Refresh calendar"
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
                    <p className="text-gray-500">No teams connected yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaymetricsConnection;