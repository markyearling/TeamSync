import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon, Users, Clock, ArrowRight, RefreshCw, UserPlus, Link as LinkIcon, MapPin } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import EventCard from '../components/events/EventCard';
import ChildActivitySummary from '../components/dashboard/ChildActivitySummary';
import ConnectedPlatform from '../components/dashboard/ConnectedPlatform';
import { useProfiles } from '../context/ProfilesContext';
import { supabase } from '../lib/supabase';
import { Event, Platform, Child } from '../types';
import { useLoadScript, Libraries } from '@react-google-maps/api';
import { DateTime } from 'luxon';
import { getSportDetails } from '../utils/sports';
import { useCapacitor } from '../hooks/useCapacitor';
import EventModal from '../components/events/EventModal';

// Define libraries outside component to prevent recreation on each render
const libraries: Libraries = ['places', 'marker'];

// Minimum time between refreshes in milliseconds (5 seconds)
const MIN_REFRESH_INTERVAL = 5000;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profiles, friendsProfiles, fetchAllProfiles } = useProfiles();
  const [events, setEvents] = useState<Event[]>([]);
  const [friendsEvents, setFriendsEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Platform[]>([]);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [lastRefreshedDate, setLastRefreshedDate] = useState<Date | null>(null);
  const [lastRefreshInProgress, setLastRefreshInProgress] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const { isNative } = useCapacitor();

  // Centralized Google Maps loading
  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
    mapIds: [import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '']
  });

  // Memoize profile IDs to prevent unnecessary re-renders
  const profileIds = useMemo(() => profiles.map(p => p.id), [profiles]);

  // Fetch user's timezone
  useEffect(() => {
    const fetchUserTimezone = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userSettings, error } = await supabase
          .from('user_settings')
          .select('timezone')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user timezone:', error);
          return;
        }

        if (userSettings?.timezone) {
          setUserTimezone(userSettings.timezone);
        }
      } catch (error) {
        console.error('Error fetching user timezone:', error);
      }
    };

    fetchUserTimezone();
  }, []);

  // Format the last refreshed time
  const formatLastRefreshed = () => {
    if (!lastRefreshedDate) return null;
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastRefreshedDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  // Fetch last dashboard refresh time
  const fetchLastRefreshTime = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userSettings, error } = await supabase
        .from('user_settings')
        .select('last_dashboard_refresh')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching last refresh time:', error);
        return;
      }

      if (userSettings?.last_dashboard_refresh) {
        setLastRefreshedDate(new Date(userSettings.last_dashboard_refresh));
        console.log('Last dashboard refresh:', new Date(userSettings.last_dashboard_refresh));
      }
    } catch (error) {
      console.error('Error fetching last refresh time:', error);
    }
  }, []);

  // Update last dashboard refresh time in database
  const updateLastRefreshTime = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      
      const { error } = await supabase
        .from('user_settings')
        .update({ last_dashboard_refresh: now.toISOString() })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating last refresh time:', error);
        return;
      }

      setLastRefreshedDate(now);
    } catch (error) {
      console.error('Error updating last refresh time:', error);
    }
  };

  // Fetch connected platforms
  useEffect(() => {
    const fetchConnectedPlatforms = async () => {
      try {
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        // Get platforms connected by the current user
        const { data, error } = await supabase
          .from('platform_teams')
          .select('platform')
          .eq('user_id', user.id)
          .limit(1000);

        if (error) throw error;

        // Get unique platforms
        const uniquePlatforms = [...new Set(data.map(p => p.platform))];
        
        // Create platform objects for each connected platform
        const platforms: Platform[] = [];
        
        if (uniquePlatforms.includes('TeamSnap')) {
          platforms.push({
            id: 1,
            name: 'TeamSnap',
            icon: Users,
            color: '#7C3AED', // Purple
            connected: true,
            hasIssue: false,
          });
        }
        
        if (uniquePlatforms.includes('SportsEngine')) {
          platforms.push({
            id: 2,
            name: 'SportsEngine',
            icon: CalendarIcon,
            color: '#2563EB', // Blue
            connected: true,
            hasIssue: false,
          });
        }
        
        if (uniquePlatforms.includes('Playmetrics')) {
          platforms.push({
            id: 3,
            name: 'Playmetrics',
            icon: CalendarIcon,
            color: '#10B981', // Green
            connected: true,
            hasIssue: false,
          });
        }

        setConnectedPlatforms(platforms);
      } catch (error) {
        console.error('Error fetching connected platforms:', error);
      }
    };

    fetchConnectedPlatforms();
  }, []);

  // Fetch user's own events - only when profiles change
  const fetchOwnEvents = useCallback(async () => {
    if (profileIds.length === 0) return;

    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .in('profile_id', profileIds)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const formattedEvents = eventData.map(event => {
        const profile = profiles.find(p => p.id === event.profile_id);
        const sportDetails = getSportDetails(event.sport);
        return {
          ...event,
          id: event.id,
          startTime: new Date(event.start_time),
          endTime: new Date(event.end_time),
          child: profile!,
          sportIcon: sportDetails.icon,
          platformIcon: CalendarIcon,
          isToday: new Date(event.start_time).toDateString() === new Date().toDateString(),
          isOwnEvent: true
        };
      });

      setEvents(formattedEvents);
    } catch (error) {
      console.error('❌ DASHBOARD: Error fetching own events:', error);
    }
  }, [profileIds, profiles]);

  // Fetch friends events - only when user changes
  const fetchFriendsEvents = useCallback(async () => {
    if (friendsProfiles.length === 0) {
      setFriendsEvents([]);
      return;
    }

    try {
      console.log('🔍 DASHBOARD: Fetching friends events for profiles:', friendsProfiles.length);

      // Get events for friend profiles
      const friendProfileIds = friendsProfiles.map(p => p.id);
      if (friendProfileIds.length > 0) {
        const { data: friendEventData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .in('profile_id', friendProfileIds)
          .order('start_time', { ascending: true });

        if (eventsError) {
          console.error('❌ DASHBOARD: Error fetching friend events:', eventsError);
          return;
        }

        const formattedFriendEvents = friendEventData.map((event) => {
          const profile = friendsProfiles.find(p => p.id === event.profile_id);
          const sportDetails = getSportDetails(event.sport);
          return {
            ...event,
            id: event.id,
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            child: profile!,
            sportIcon: sportDetails.icon,
            platformIcon: CalendarIcon,
            isToday: new Date(event.start_time).toDateString() === new Date().toDateString(),
            isOwnEvent: false,
            ownerName: profile?.ownerName
          };
        });

        setFriendsEvents(formattedFriendEvents);
        console.log('✅ DASHBOARD: Successfully loaded friends events:', formattedFriendEvents.length);
      }

    } catch (error) {
      console.error('💥 DASHBOARD: Error fetching friends events:', error);
    }
  }, [friendsProfiles]);

  const refreshDashboardEvents = useCallback(async () => {
    try {
      await fetchOwnEvents();
      await fetchFriendsEvents();
    } catch (error) {
      console.error('Error refreshing dashboard events:', error);
    }
  }, [fetchOwnEvents, fetchFriendsEvents]);

  // Mount-only fetch of last refresh time
  useEffect(() => {
    fetchLastRefreshTime();
    // fetchLastRefreshTime is stable (useCallback with [])
  }, [fetchLastRefreshTime]);

  // Main effect - only runs when dependencies actually change
  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user || !isMounted) return;

        // Fetch own events
        await fetchOwnEvents();

        // Fetch friends events
        await fetchFriendsEvents();

      } catch (error) {
        console.error('❌ DASHBOARD: Error in main fetch:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'Present' : 'Missing',
          supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing'
        });
      } finally {
        if (isMounted) {
          const hasProfiles = profiles.length > 0 || friendsProfiles.length > 0;
          const hasEvents = events.length > 0 || friendsEvents.length > 0;
          const isOnboardingComplete = hasProfiles && hasEvents;

          setOnboardingComplete(isOnboardingComplete);
          setLoading(false);
        }
        
        // Delay the appearance of the onboarding section
        setTimeout(() => {
          setShowOnboarding(true);
        }, 2000); // Adjust the delay as needed (in milliseconds)
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [fetchOwnEvents, fetchFriendsEvents, friendsProfiles, profiles, events, friendsEvents]); // Re-run when friendsProfiles changes

  // Function to sync all platform events
  const syncAllPlatformEvents = async () => {
    try {
      // Prevent rapid refreshes
      if (isRefreshing || lastRefreshInProgress) {
        console.log('Refresh already in progress, skipping');
        return;
      }
      
      // Check if we've refreshed recently
      if (lastRefreshedDate) {
        const timeSinceLastRefresh = Date.now() - lastRefreshedDate.getTime();
        if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
          console.log(`Refreshed too recently (${timeSinceLastRefresh}ms ago), skipping`);
          setIsPulling(false);
          setPullDistance(0);
          return;
        }
      }
      
      setIsRefreshing(true);
      setLastRefreshInProgress(true);
      
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      // Get user IDs where we have administrator access (friends we can manage)
      const { data: adminFriendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('user_id')
        .eq('friend_id', user.id)
        .eq('role', 'administrator');

      if (friendshipsError) {
        console.error('Error fetching administrator friendships:', friendshipsError);
      }

      // Build list of user IDs to sync (current user + friends with admin access)
      const userIdsToSync = [user.id];
      if (adminFriendships && adminFriendships.length > 0) {
        const friendUserIds = adminFriendships.map(f => f.user_id);
        userIdsToSync.push(...friendUserIds);
        console.log(`Found ${friendUserIds.length} friends where user has administrator access`);
      }

      // Get all platform teams for the current user and friends with admin access
      const { data: teamsData, error: teamsError } = await supabase
        .from('platform_teams')
        .select('*')
        .in('user_id', userIdsToSync);

      if (teamsError) throw teamsError;

      if (!teamsData || teamsData.length === 0) {
        console.log('No platform teams found to sync');
        return;
      }
      
      console.log(`Found ${teamsData.length} platform teams to sync`);
      
      // Process each team
      for (const team of teamsData) {
        try {
          // Update team status to pending
          await supabase
            .from('platform_teams')
            .update({ sync_status: 'pending' })
            .eq('id', team.id);
            
          // Get profile mappings for this team
          const { data: profileMappings } = await supabase
            .from('profile_teams')
            .select('profile_id')
            .eq('platform_team_id', team.id);
            
          if (!profileMappings || profileMappings.length === 0) {
            console.log(`Team ${team.team_name} has no profile mappings, skipping`);
            continue;
          }
          
          // Process based on platform type
          if (team.platform === 'TeamSnap') {
            // For TeamSnap, we need to use the TeamSnap service
            // This would typically be handled by a server-side function
            console.log(`Syncing TeamSnap team: ${team.team_name}`);
            
            // Simulate a successful sync
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update team status to success
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'success',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          } 
          else if (team.platform === 'SportsEngine' && team.ics_url) {
            // For SportsEngine, we use the edge function
            console.log(`Syncing SportsEngine team: ${team.team_name}`);
            
            // Get the current session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) throw new Error('No authenticated session');
            
            // Sync events for each mapped profile
            for (const mapping of profileMappings) {
              try {
                console.log(`[Dashboard] SportsEngine Making fetch request for profile ${mapping.profile_id} to sync-sportsengine-calendar`);
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-sportsengine-calendar`, {
                  // Add more logging for the fetch request
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    icsUrl: team.ics_url,
                    teamId: team.id,
                    profileId: mapping.profile_id
                  })
                });
                console.log(`[Dashboard] SportsEngine Fetch response status for profile ${mapping.profile_id}: ${response.status}`);
                
                if (!response.ok) {
                  const errorData = await response.json();
                  console.error(`[Dashboard] SportsEngine Error response from function for profile ${mapping.profile_id}:`, errorData);
                }
              } catch (error) {
                console.error(`Error syncing SportsEngine team ${team.team_name} for profile ${mapping.profile_id}:`, error);
              }
            }
            
            // Update team status to success
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'success',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
          else if (team.platform === 'Playmetrics' && team.ics_url) {
            // For Playmetrics, we use the edge function
            console.log(`Syncing Playmetrics team: ${team.team_name}`);
            
            // Get the current session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) throw new Error('No authenticated session');
            
            // Sync events for each mapped profile
            for (const mapping of profileMappings) {
              try {
                console.log(`[Dashboard] Playmetrics Making fetch request for profile ${mapping.profile_id} to sync-playmetrics-calendar`);
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-playmetrics-calendar`, {
                  // Add more logging for the fetch request
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    icsUrl: team.ics_url,
                    teamId: team.id,
                    profileId: mapping.profile_id
                  })
                });
                console.log(`[Dashboard] Playmetrics Fetch response status for profile ${mapping.profile_id}: ${response.status}`);
                
                if (!response.ok) {
                  const errorData = await response.json();
                  console.error(`[Dashboard] Playmetrics Error response from function for profile ${mapping.profile_id}:`, errorData);
                }
              } catch (error) {
                console.error(`Error syncing Playmetrics team ${team.team_name} for profile ${mapping.profile_id}:`, error);
              }
            }
            
            // Update team status to success
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'success',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
          else if (team.platform === 'GameChanger' && team.ics_url) {
            // For GameChanger, we use the edge function
            console.log(`Syncing GameChanger team: ${team.team_name}`);
            
            // Get the current session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) throw new Error('No authenticated session');
            console.log('GameChanger sync - session access token available:', !!session.access_token);
            
            // Sync events for each mapped profile
            for (const mapping of profileMappings) {
              try {
                console.log(`[Dashboard] GameChanger Making fetch request for profile ${mapping.profile_id} to sync-gamechanger-calendar`);
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-gamechanger-calendar`, {
                  // Add more logging for the fetch request
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    icsUrl: team.ics_url,
                    teamId: team.id,
                    profileId: mapping.profile_id
                  })
                });
                console.log(`[Dashboard] GameChanger Fetch response status for profile ${mapping.profile_id}: ${response.status}`);
                
                if (!response.ok) {
                  const errorData = await response.json();
                  console.error(`[Dashboard] GameChanger Error response from function for profile ${mapping.profile_id}:`, errorData);
                }
              } catch (error) {
                console.error(`Error syncing GameChanger team ${team.team_name} for profile ${mapping.profile_id}:`, error);
              }
            }
            
            // Update team status to success
            await supabase
              .from('platform_teams')
              .update({ 
                sync_status: 'success',
                last_synced: new Date().toISOString()
              })
              .eq('id', team.id);
          }
        } catch (error) {
          console.error(`Error processing team ${team.team_name}:`, error);
          
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
      
      // Refresh data after sync
      await fetchOwnEvents();
      await fetchFriendsEvents();
      await fetchAllProfiles(); // Refresh profiles to pick up any changes in access

      // Update last refreshed time in state and database
      await updateLastRefreshTime();
      
    } catch (error) {
      console.error('Error syncing platform events:', error);
      
      // Provide specific troubleshooting for fetch errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error(
          'Troubleshooting Tip: The application failed to connect to the Supabase Edge Function. ' +
          'This often indicates a network issue, an incorrect VITE_SUPABASE_URL, or a problem with the Edge Function deployment. ' +
          'Please verify your internet connection, check the VITE_SUPABASE_URL in your .env file and Netlify environment settings, ' +
          'and ensure the "sync-gamechanger-calendar" function is deployed and healthy in your Supabase project.'
        );
      }
    } finally {
      setIsRefreshing(false);
      setLastRefreshInProgress(false);
      setIsPulling(false);
      setPullDistance(0);
    }
  };

  // Touch event handlers for pull-to-refresh (Facebook-style)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isNative || selectedEvent || isRefreshing) return;

    // Only start pull if we're at the very top of the page
    const scrollContainer = document.querySelector('.space-y-6.overflow-y-auto');
    const isAtTop = scrollContainer ? scrollContainer.scrollTop === 0 : window.scrollY === 0;

    if (isAtTop) {
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isNative || selectedEvent || isRefreshing || touchStartY === 0) return;

    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY;

    // Check if still at top
    const scrollContainer = document.querySelector('.space-y-6.overflow-y-auto');
    const isAtTop = scrollContainer ? scrollContainer.scrollTop === 0 : window.scrollY === 0;

    // Only allow pulling down when at top
    if (distance > 0 && isAtTop) {
      if (!isPulling && distance > 10) {
        setIsPulling(true);
      }

      // Apply more resistance (Facebook-style) - harder to pull
      const pullWithResistance = Math.min(distance * 0.3, 80);
      setPullDistance(pullWithResistance);

      // Prevent default scrolling behavior when pulling
      if (distance > 20) {
        e.preventDefault();
      }
    } else if (distance <= 0) {
      // User is scrolling up, cancel the pull
      setIsPulling(false);
      setPullDistance(0);
      setTouchStartY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isNative || selectedEvent || !isPulling) return;

    // Require a significant pull (80px worth of resistance = ~270px actual pull)
    // This matches Facebook's behavior of requiring a substantial pull
    if (pullDistance >= 70) {
      syncAllPlatformEvents();
    } else {
      // Reset pull state with animation
      setIsPulling(false);
      setPullDistance(0);
    }

    setTouchStartY(0);
  };

  // Combine all events for display
  const allEvents = [...events, ...friendsEvents];
  
  // Get upcoming events (today and future)
  const upcomingEvents = allEvents
    .filter(event => event.startTime >= new Date())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate event counts for each child (own and friends)
  const profilesWithEventCounts = [...profiles, ...friendsProfiles].map(profile => ({
    ...profile,
    eventCount: allEvents.filter(event => 
      event.child.id === profile.id && 
      event.startTime >= new Date() &&
      event.startTime <= new Date(new Date().setDate(new Date().getDate() + 7))
    ).length
  }));

  // Handle platform management
  const handleManagePlatform = (platformName: string) => {
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
      default:
        navigate('/connections');
    }
  };

  if (loading || onboardingComplete === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const hasProfiles = profiles.length > 0 || friendsProfiles.length > 0;
  const hasEvents = events.length > 0 || friendsEvents.length > 0;
  const showQuickStart = !onboardingComplete;

  return (
    <div>
      <div className="space-y-6 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      >
      {/* Professional pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
          style={{
            height: isRefreshing ? '48px' : isPulling ? `${Math.min(pullDistance, 48)}px` : '0px',
            opacity: isRefreshing ? 1 : isPulling ? (pullDistance / 80) : 0
          }}
        >
          <div className="flex items-center justify-center h-full">
            {isRefreshing ? (
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Refreshing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-500">
                <RefreshCw
                  className="h-4 w-4 transition-transform duration-100"
                  style={{
                    transform: `rotate(${Math.min(pullDistance * 4, 360)}deg)`
                  }}
                />
                <span className="text-sm">
                  {pullDistance >= 70 ? 'Release to refresh' : 'Pull to refresh'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Quick Start Guide */}
      {showQuickStart && showOnboarding && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="px-6 py-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                {!hasProfiles ? 'Welcome to FamSink!' : 'Quick Start'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {!hasProfiles
                  ? "Let's get you started with these simple steps"
                  : "Complete these steps to get the most out of FamSink"}
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1: Create Profiles (only show if no profiles exist) */}
              {!hasProfiles && (
                <div className="flex items-start space-x-4 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-800/10 rounded-lg p-5 border border-violet-200 dark:border-violet-800">
                  <div className="flex-shrink-0 w-10 h-10 bg-violet-600 dark:bg-violet-500 rounded-full flex items-center justify-center font-bold text-white shadow-md">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2 flex items-center text-gray-900 dark:text-white">
                      <UserPlus className="h-5 w-5 mr-2 text-violet-600 dark:text-violet-400" />
                      Create Child Profiles
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      Add profiles for your children, yourself, or your family group. These profiles will organize all your activities.
                    </p>
                    <button
                      onClick={() => navigate('/profiles')}
                      className="inline-flex items-center px-4 py-2 bg-violet-600 dark:bg-violet-500 text-white rounded-md hover:bg-violet-700 dark:hover:bg-violet-600 font-medium text-sm transition-colors shadow-sm"
                    >
                      Create Your First Profile
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Connect Apps (only show if no events exist) */}
              {!hasEvents && (
                <div className="flex items-start space-x-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-lg p-5 border border-amber-200 dark:border-amber-800">
                  <div className="flex-shrink-0 w-10 h-10 bg-amber-600 dark:bg-amber-500 rounded-full flex items-center justify-center font-bold text-white shadow-md">
                    {!hasProfiles ? '2' : '1'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2 flex items-center text-gray-900 dark:text-white">
                      <LinkIcon className="h-5 w-5 mr-2 text-amber-600 dark:text-amber-400" />
                      Connect Sports Apps or Add Events
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      Link your TeamSnap, SportsEngine, GameChanger, or Playmetrics accounts to automatically sync schedules, or manually add events to your calendar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate('/connections')}
                        className="inline-flex items-center px-4 py-2 bg-amber-600 dark:bg-amber-500 text-white rounded-md hover:bg-amber-700 dark:hover:bg-amber-600 font-medium text-sm transition-colors shadow-sm"
                      >
                        Connect Sports Apps
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </button>
                      {hasProfiles && (
                        <button
                          onClick={() => navigate(`/profiles/${profiles[0]?.id}`)}
                          className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 border border-amber-600 dark:border-amber-500 rounded-md hover:bg-amber-50 dark:hover:bg-gray-600 font-medium text-sm transition-colors"
                        >
                          Add Manual Event
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Map Teams (only show if no events exist and has profiles) */}
              {!hasEvents && hasProfiles && connectedPlatforms.length > 0 && (
                <div className="flex items-start space-x-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10 rounded-lg p-5 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 dark:bg-emerald-500 rounded-full flex items-center justify-center font-bold text-white shadow-md">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2 flex items-center text-gray-900 dark:text-white">
                      <MapPin className="h-5 w-5 mr-2 text-emerald-600 dark:text-emerald-400" />
                      Map Teams to Profiles
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      You've connected your sports apps! Now visit each child profile to link their teams. This ensures events appear in the right place.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-start space-x-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="text-2xl">💡</div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  <strong className="text-gray-900 dark:text-white">Pro Tip:</strong> You can also add friends to share schedules and coordinate activities together!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-row items-center justify-between flex-wrap sm:flex-nowrap space-y-2 sm:space-y-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex flex-col items-end">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
            day: 'numeric',
            year: 'numeric'
            })}
          </div>
          {(connectedPlatforms.length > 0 || friendsEvents.length > 0) && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center">
              <span>Last refreshed: {lastRefreshedDate ? formatLastRefreshed() : 'Never' }</span>
              {!isNative && (
                <button
                  onClick={syncAllPlatformEvents}
                  disabled={isRefreshing || lastRefreshInProgress}
                  className="ml-2 p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Refresh all platform events"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-4 sm:px-6 flex justify-between items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg mr-3">
              <CalendarIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Schedule</h2>
          </div>
          <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium px-3 py-1 rounded-full">
            {upcomingEvents.filter(e => e.isToday).length} Events
          </span>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingEvents.filter(e => e.isToday).length > 0 ? (
            upcomingEvents
              .filter(e => e.isToday)
              .map(event => (
                // Remove the wrapping div here
                <EventCard
                  key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}`}
                  event={event}
                  mapsLoaded={mapsLoaded}
                  mapsLoadError={mapsLoadError}
                  userTimezone={userTimezone}
                  onClick={() => setSelectedEvent(event)}
                />
              ))
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Clock className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No events scheduled for today</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Enjoy your free time!</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-4 sm:px-6 flex justify-between items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg mr-3">
              <CalendarIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Upcoming Events
            </h2>
          </div>
          <a href="/calendar" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center transition-colors">
            View calendar <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingEvents
            .filter(e => !e.isToday)
            .slice(0, 8)
            .map(event => (
              <EventCard
                key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}`}
                event={event}
                mapsLoaded={mapsLoaded}
                mapsLoadError={mapsLoadError}
                userTimezone={userTimezone}
                onClick={() => setSelectedEvent(event)}
              />
            ))}
          {upcomingEvents.filter(e => !e.isToday).length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No upcoming events scheduled.
            </div>
          )}
        </div>
      </div>

      {/* Children Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-4 sm:px-6 flex justify-between items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg mr-3">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Children's Activities</h2>
            </div>
            <a href="/profiles" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center transition-colors">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </div>
          <div className="px-4 py-5 sm:px-6 space-y-4">
            {/* Own children */}
            {profilesWithEventCounts.filter(p => p.isOwnProfile).map(child => (
              <ChildActivitySummary key={child.id} child={child} />
            ))}
            
            {/* Friends' children with viewer access */}
            {profilesWithEventCounts.filter(p => !p.isOwnProfile).length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    Friends' Children ({profilesWithEventCounts.filter(p => !p.isOwnProfile).length})
                  </h4>
                </div>
                {profilesWithEventCounts.filter(p => !p.isOwnProfile).map(child => (
                  <div key={child.id} className="relative">
                    <div className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                        style={{ backgroundColor: child.color }}
                      >
                        {child.photo_url ? (
                          <img
                            src={child.photo_url}
                            alt={child.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          child.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{child.name}</h3>
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full mr-2 font-medium">
                            {child.ownerName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {child.accessRole === 'administrator' ? '👑 Admin' : child.accessRole === 'viewer' ? '👁️ Viewer' : '💬 Friend'} access
                          </span>
                        </div>
                        <div className="flex items-center mt-1">
                          {child.sports.map((sport, index) => (
                            <div 
                              key={index}
                              className="flex items-center text-xs mr-2"
                            >
                              <span 
                                className="w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: sport.color }}
                              ></span>
                              <span className="text-gray-500 dark:text-gray-400">{sport.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{child.eventCount}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">This week</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {profilesWithEventCounts.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No children profiles found. Add a profile to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connected Platforms Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4 sm:px-6 flex justify-between items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg mr-3">
              <LinkIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connected Platforms</h2>
          </div>
          <div className="flex items-center space-x-2">
            {isRefreshing && (
              <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                Syncing...
              </div>
            )}
            <a href="/connections" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center transition-colors">
              Manage <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="px-4 py-5 sm:px-6 space-y-4">
          {connectedPlatforms.length > 0 ? (
            connectedPlatforms.map(platform => (
              <ConnectedPlatform 
                key={platform.id} 
                platform={platform} 
                onManage={() => handleManagePlatform(platform.name)}
              />
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No platforms connected yet. Visit the Connections page to connect your sports platforms.
            </div>
          )}
        </div>
      </div>

      
      </div>
      {selectedEvent && (
        <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        mapsLoaded={mapsLoaded}
        mapsLoadError={mapsLoadError}
        userTimezone={userTimezone}
        onEventUpdated={refreshDashboardEvents}
        />
      )}
    </div>
  );
};

export default Dashboard;