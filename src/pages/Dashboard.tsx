import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon, Users, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EventCard from '../components/events/EventCard';
import ChildActivitySummary from '../components/dashboard/ChildActivitySummary';
import ConnectedPlatform from '../components/dashboard/ConnectedPlatform';
import { useProfiles } from '../context/ProfilesContext';
import { supabase } from '../lib/supabase';
import { Event, Platform } from '../types';
import { useLoadScript, Libraries } from '@react-google-maps/api';
import { DateTime } from 'luxon';

// Define libraries outside component to prevent recreation on each render
const libraries: Libraries = ['places', 'marker'];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profiles } = useProfiles();
  const [events, setEvents] = useState<Event[]>([]);
  const [friendsEvents, setFriendsEvents] = useState<Event[]>([]);
  const [friendsProfiles, setFriendsProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Platform[]>([]);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');

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
          .single();

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

  // Fetch connected platforms
  useEffect(() => {
    const fetchConnectedPlatforms = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_teams')
          .select('platform')
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
        return {
          ...event,
          id: event.id,
          startTime: new Date(event.start_time),
          endTime: new Date(event.end_time),
          child: profile!,
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
  const fetchFriendsEvents = useCallback(async (userId: string) => {
    try {
      console.log('🔍 DASHBOARD: Fetching friends events for user:', userId);
      
      // Get friendships where current user has granted access to friends
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id, role')
        .eq('user_id', userId)
        .in('role', ['viewer', 'administrator']);

      if (friendshipsError) {
        console.error('❌ DASHBOARD: Error fetching friendships:', friendshipsError);
        return;
      }

      if (!friendships || friendships.length === 0) {
        console.log('❌ DASHBOARD: No friendships with viewer/admin access found');
        setFriendsEvents([]);
        setFriendsProfiles([]);
        return;
      }

      const friendUserIds = friendships.map(f => f.friend_id);
      console.log('👥 DASHBOARD: Friend user IDs:', friendUserIds);

      // Get user settings and profiles in parallel
      const [userSettingsResult, friendProfilesResult] = await Promise.all([
        supabase
          .from('user_settings')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', friendUserIds),
        supabase
          .from('profiles')
          .select('id, name, user_id')
          .in('user_id', friendUserIds)
      ]);

      if (userSettingsResult.error) {
        console.error('❌ DASHBOARD: Error fetching user settings:', userSettingsResult.error);
        return;
      }

      if (friendProfilesResult.error) {
        console.error('❌ DASHBOARD: Error fetching friend profiles:', friendProfilesResult.error);
        return;
      }

      const { data: userSettings } = userSettingsResult;
      const { data: friendProfiles } = friendProfilesResult;

      if (!friendProfiles || friendProfiles.length === 0) {
        console.log('❌ DASHBOARD: No friend profiles found');
        setFriendsEvents([]);
        setFriendsProfiles([]);
        return;
      }

      // Transform friend profiles
      const transformedFriendProfiles = friendProfiles.map(profile => {
        const friendship = friendships.find(f => f.friend_id === profile.user_id);
        const userSetting = userSettings?.find(us => us.user_id === profile.user_id);
        
        return {
          ...profile,
          age: 0,
          color: '#64748B',
          photo_url: null,
          sports: [],
          eventCount: 0,
          ownerName: userSetting?.full_name || 'Friend',
          ownerPhoto: userSetting?.profile_photo_url,
          accessRole: friendship?.role
        };
      });

      setFriendsProfiles(transformedFriendProfiles);

      // Get events for friend profiles
      const friendProfileIds = friendProfiles.map(p => p.id);
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

        const formattedFriendEvents = friendEventData.map(event => {
          const profile = transformedFriendProfiles.find(p => p.id === event.profile_id);
          return {
            ...event,
            id: event.id,
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            child: profile!,
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
  }, []);

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
        await fetchFriendsEvents(user.id);

      } catch (error) {
        console.error('❌ DASHBOARD: Error in main fetch:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [fetchOwnEvents, fetchFriendsEvents]); // Only re-run when these callbacks change

  // Combine all events for display
  const allEvents = [...events, ...friendsEvents];
  
  // Get upcoming events (today and future)
  const upcomingEvents = allEvents
    .filter(event => event.startTime >= new Date())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate event counts for each child (own and friends)
  const allProfiles = [
    ...profiles.map(p => ({ ...p, isOwnProfile: true })),
    ...friendsProfiles.map(p => ({ ...p, isOwnProfile: false }))
  ];

  const profilesWithEventCounts = allProfiles.map(profile => ({
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-white mr-2" />
            <h2 className="text-lg font-medium text-white">Today's Schedule</h2>
          </div>
          <span className="text-white text-sm font-medium">
            {upcomingEvents.filter(e => e.isToday).length} Events
          </span>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingEvents.filter(e => e.isToday).length > 0 ? (
            upcomingEvents
              .filter(e => e.isToday)
              .map(event => (
                <div key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}`} className="relative">
                  {!event.isOwnEvent && (
                    <div className="absolute top-2 right-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full z-10">
                      {event.ownerName}'s schedule
                    </div>
                  )}
                  <EventCard 
                    event={event} 
                    mapsLoaded={mapsLoaded}
                    mapsLoadError={mapsLoadError}
                    userTimezone={userTimezone}
                  />
                </div>
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

      {/* Children Activity Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Children's Activities</h2>
            </div>
            <a href="/profiles" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center">
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
                    <div className="flex items-center space-x-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div 
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
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
                          <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full mr-2">
                            {child.ownerName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {child.accessRole === 'administrator' ? '👑 Admin' : '👁️ Viewer'} access
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Connected Platforms</h2>
            </div>
            <a href="/connections" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center">
              Manage <ArrowRight className="ml-1 h-4 w-4" />
            </a>
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

      {/* Upcoming Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Upcoming Events</h2>
          </div>
          <a href="/calendar" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center">
            View calendar <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingEvents
            .filter(e => !e.isToday)
            .slice(0, 8)
            .map(event => (
              <div key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}`} className="relative">
                {!event.isOwnEvent && (
                  <div className="absolute top-2 right-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full z-10">
                    {event.ownerName}'s schedule
                  </div>
                )}
                <EventCard 
                  event={event} 
                  mapsLoaded={mapsLoaded}
                  mapsLoadError={mapsLoadError}
                  userTimezone={userTimezone}
                />
              </div>
            ))}
          {upcomingEvents.filter(e => !e.isToday).length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No upcoming events scheduled.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;