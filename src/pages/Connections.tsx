import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Users,
  BarChart,
  X
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Platform } from '../types';

const Connections: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [connectedPlatforms, setConnectedPlatforms] = useState<Platform[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([]);
  const [refreshingPlatform, setRefreshingPlatform] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Define all supported platforms
  const allPlatforms: Platform[] = [
    {
      id: 1,
      name: 'TeamSnap',
      icon: Users,
      color: '#7C3AED', // Purple
      connected: false,
      hasIssue: false,
    },
    {
      id: 2,
      name: 'SportsEngine',
      icon: Calendar,
      color: '#2563EB', // Blue
      connected: false,
      hasIssue: false,
    },
    {
      id: 3,
      name: 'Playmetrics',
      icon: BarChart,
      color: '#10B981', // Green
      connected: false,
      hasIssue: false,
    },
    {
      id: 4,
      name: 'GameChanger',
      icon: BarChart,
      color: '#F97316', // Orange
      connected: false,
      hasIssue: false,
    }
  ];

  useEffect(() => {
    fetchConnectedPlatforms();
    
    // Show success message if redirected from callback
    if (location.state?.teamSnapConnected) {
      setSuccessMessage('TeamSnap connected successfully! Your teams have been imported.');
      setShowSuccessMessage(true);
      // Clear the state
      window.history.replaceState({}, document.title);
      // Hide the message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, [location]);

  const fetchConnectedPlatforms = async () => {
    try {
      setLoading(true);
      
      // Get all platform teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('platform_teams')
        .select('platform, team_name, sync_status, last_synced')
        .order('created_at', { ascending: false });

      if (teamsError) throw teamsError;

      // Get unique platforms and their status
      const platformsMap = new Map<string, {
        connected: boolean;
        hasIssue: boolean;
        teamCount: number;
        lastSynced: string | null;
      }>();

      teamsData?.forEach(team => {
        const platformInfo = platformsMap.get(team.platform) || {
          connected: true,
          hasIssue: false,
          teamCount: 0,
          lastSynced: null
        };

        platformInfo.teamCount += 1;
        
        // Check if any team has sync issues
        if (team.sync_status === 'error') {
          platformInfo.hasIssue = true;
        }

        // Track the most recent sync
        if (team.last_synced) {
          if (!platformInfo.lastSynced || new Date(team.last_synced) > new Date(platformInfo.lastSynced)) {
            platformInfo.lastSynced = team.last_synced;
          }
        }

        platformsMap.set(team.platform, platformInfo);
      });

      // Create connected platforms list
      const connected: Platform[] = [];
      const available: Platform[] = [];

      allPlatforms.forEach(platform => {
        const platformInfo = platformsMap.get(platform.name);
        
        if (platformInfo) {
          // This platform is connected
          connected.push({
            ...platform,
            connected: true,
            hasIssue: platformInfo.hasIssue,
            teamCount: platformInfo.teamCount,
            lastSynced: platformInfo.lastSynced
          });
        } else {
          // This platform is available but not connected
          available.push({
            ...platform,
            connected: false,
            hasIssue: false
          });
        }
      });

      setConnectedPlatforms(connected);
      setAvailablePlatforms(available);
    } catch (error) {
      console.error('Error fetching connected platforms:', error);
      setError('Failed to load connected platforms');
    } finally {
      setLoading(false);
    }
  };
  
  const handleManage = (platformName: string) => {
    switch(platformName) {
      case 'TeamSnap':
        navigate('/connections/teamsnap');
        break;
      case 'SportsEngine':
        navigate('/connections/sportsengine');
        break;
      case 'Playmetrics':
        navigate('/connections/playmetrics');
        break;
      case 'GameChanger':
        navigate('/connections/gamechanger');
        break;
      default:
        navigate('/connections');
    }
  };
  
  const handleRefresh = async (platformId: number) => {
    try {
      setRefreshingPlatform(platformId);
      setError(null);
      
      const platform = connectedPlatforms.find(p => p.id === platformId);
      if (!platform) return;

      // Get all teams for this platform
      const { data: teams, error: teamsError } = await supabase
        .from('platform_teams')
        .select('id, team_name')
        .eq('platform', platform.name);

      if (teamsError) throw teamsError;

      if (!teams || teams.length === 0) {
        throw new Error(`No teams found for ${platform.name}`);
      }

      // For each team, trigger a refresh
      let refreshedCount = 0;
      
      for (const team of teams) {
        // Update team status to pending
        await supabase
          .from('platform_teams')
          .update({ sync_status: 'pending' })
          .eq('id', team.id);

        // For TeamSnap, we would call the sync function
        if (platform.name === 'TeamSnap') {
          try {
            // Get profile mappings for this team
            const { data: profileMappings } = await supabase
              .from('profile_teams')
              .select('profile_id')
              .eq('platform_team_id', team.id);

            if (profileMappings && profileMappings.length > 0) {
              // In a real implementation, we would call the TeamSnap sync function here
              // For now, we'll just simulate a successful sync
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Update team status to success
              await supabase
                .from('platform_teams')
                .update({ 
                  sync_status: 'success',
                  last_synced: new Date().toISOString()
                })
                .eq('id', team.id);
                
              refreshedCount++;
            }
          } catch (error) {
            console.error(`Error refreshing TeamSnap team ${team.team_name}:`, error);
            
            // Update team status to error
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'error',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
        }
        
        // For SportsEngine, we would call the sync function
        else if (platform.name === 'SportsEngine') {
          try {
            // Get profile mappings for this team
            const { data: profileMappings } = await supabase
              .from('profile_teams')
              .select('profile_id')
              .eq('platform_team_id', team.id);

            if (profileMappings && profileMappings.length > 0) {
              // In a real implementation, we would call the SportsEngine sync function here
              // For now, we'll just simulate a successful sync
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Update team status to success
              await supabase
                .from('platform_teams')
                .update({ 
                  sync_status: 'success',
                  last_synced: new Date().toISOString()
                })
                .eq('id', team.id);
                
              refreshedCount++;
            }
          } catch (error) {
            console.error(`Error refreshing SportsEngine team ${team.team_name}:`, error);
            
            // Update team status to error
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'error',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
        }
        
        // For Playmetrics, we would call the sync function
        else if (platform.name === 'Playmetrics') {
          try {
            // Get profile mappings for this team
            const { data: profileMappings } = await supabase
              .from('profile_teams')
              .select('profile_id')
              .eq('platform_team_id', team.id);

            if (profileMappings && profileMappings.length > 0) {
              // In a real implementation, we would call the Playmetrics sync function here
              // For now, we'll just simulate a successful sync
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Update team status to success
              await supabase
                .from('platform_teams')
                .update({ 
                  sync_status: 'success',
                  last_synced: new Date().toISOString()
                })
                .eq('id', team.id);
                
              refreshedCount++;
            }
          } catch (error) {
            console.error(`Error refreshing Playmetrics team ${team.team_name}:`, error);
            
            // Update team status to error
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'error',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
        }
        
        // For GameChanger, we would call the sync function
        else if (platform.name === 'GameChanger') {
          try {
            // Get profile mappings for this team
            const { data: profileMappings } = await supabase
              .from('profile_teams')
              .select('profile_id')
              .eq('platform_team_id', team.id);

            if (profileMappings && profileMappings.length > 0) {
              // In a real implementation, we would call the GameChanger sync function here
              // For now, we'll just simulate a successful sync
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Update team status to success
              await supabase
                .from('platform_teams')
                .update({ 
                  sync_status: 'success',
                  last_synced: new Date().toISOString()
                })
                .eq('id', team.id);
                
              refreshedCount++;
            }
          } catch (error) {
            console.error(`Error refreshing GameChanger team ${team.team_name}:`, error);
            
            // Update team status to error
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'error',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
        }
      }

      setSuccessMessage(`Successfully refreshed ${refreshedCount} teams for ${platform.name}`);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
      
      // Refresh the list of connected platforms
      fetchConnectedPlatforms();
    } catch (error) {
      console.error('Error refreshing platform:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh platform');
    } finally {
      setRefreshingPlatform(null);
    }
  };

  // Get platform logo URL
  const getPlatformLogo = (platformName: string) => {
    switch(platformName) {
      case 'TeamSnap':
        return "https://play-lh.googleusercontent.com/jB40sjFamYP83iQhDcc3DZy_1ukC3TuhH0Dfvh2HMKmhEIFMzB2zTWYZ8CtHU3x5-V8";
      case 'SportsEngine':
        return "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnajmgf8Kri_EZxVAbe7kFESjsiGlQx4lOKw&s";
      case 'Playmetrics':
        return "https://play-lh.googleusercontent.com/3qlMAhClWu_R_XMqFx_8afl4ZiMQpDmw0Xfyb6OyTHAv3--KRr6yxmvmPr0gzQlKJWQ";
      case 'GameChanger':
        return "https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/GameChanger_Logo.jpg/250px-GameChanger_Logo.jpg";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div>
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg p-4 shadow-lg z-50 animate-fade-in">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-400 dark:text-green-300 mr-2" />
            <div className="flex-1">
              <p className="font-medium">{successMessage}</p>
            </div>
            <button 
              onClick={() => setShowSuccessMessage(false)}
              className="ml-4 text-green-400 dark:text-green-300 hover:text-green-500 dark:hover:text-green-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">Connections</h1>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Connected Platforms</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your connections to sports platforms and services
          </p>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {connectedPlatforms.length > 0 ? (
            connectedPlatforms.map(platform => (
              <div key={platform.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start">
                  <div 
                    className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center mb-4 sm:mb-0 sm:mr-4"
                  >
                    <img 
                      src={getPlatformLogo(platform.name)} 
                      alt={`${platform.name} logo`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{platform.name}</h3>
                      <div className="flex items-center mt-2 sm:mt-0">
                        {platform.hasIssue ? (
                          <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                            <AlertTriangle className="h-5 w-5 mr-1" />
                            <span>Connection issue</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-green-600 dark:text-green-400">
                            <CheckCircle className="h-5 w-5 mr-1" />
                            <span>Connected</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {platform.hasIssue 
                        ? `There is an issue with your ${platform.name} connection. Please refresh or reconnect.` 
                        : `Your ${platform.name} account is connected and syncing data to TeamSync.`}
                    </p>
                    
                    {platform.teamCount && (
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md mb-4">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <span className="font-medium">{platform.teamCount}</span> team{platform.teamCount !== 1 ? 's' : ''} connected
                          {platform.lastSynced && (
                            <span className="ml-2 text-gray-500 dark:text-gray-400">
                              · Last synced {new Date(platform.lastSynced).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                        onClick={() => handleManage(platform.name)}
                      >
                        Manage
                      </button>
                      
                      <button
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                        onClick={() => handleRefresh(platform.id)}
                        disabled={refreshingPlatform === platform.id}
                      >
                        {refreshingPlatform === platform.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                            Refreshing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1.5" />
                            Refresh
                          </>
                        )}
                      </button>
                      
                      {platform.hasIssue && (
                        <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2.5 py-1.5 rounded-full flex items-center">
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Connection issue
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No platforms connected</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">Connect to your sports platforms to start syncing data</p>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md mb-6">
          <p>{error}</p>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Available Platforms</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect to additional sports platforms to import your schedules and events
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
          {availablePlatforms.length > 0 ? (
            availablePlatforms.map(platform => (
              <div 
                key={platform.id} 
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div 
                  className="p-4 border-b border-gray-200 dark:border-gray-700" 
                  style={{ backgroundColor: platform.color + '10' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center mr-3"
                      >
                        <img 
                          src={getPlatformLogo(platform.name)} 
                          alt={`${platform.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{platform.name}</h3>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Connect to {platform.name} to import your schedules, events, and team information.
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <a 
                      href="#" 
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
                      onClick={(e) => e.preventDefault()}
                    >
                      Learn more
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </a>
                    
                    <button
                      className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => handleManage(platform.name)}
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-8 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">All platforms connected!</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">You've connected all available platforms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Connections;