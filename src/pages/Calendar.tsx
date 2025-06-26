import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
  LayoutGrid,
  LayoutList
} from 'lucide-react';
import { useProfiles } from '../context/ProfilesContext';
import { supabase } from '../lib/supabase';
import CalendarHeader from '../components/calendar/CalendarHeader';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import AgendaView from '../components/calendar/AgendaView';
import { Event } from '../types';
import { useLoadScript, Libraries } from '@react-google-maps/api';
import { DateTime } from 'luxon';

// Define libraries outside component to prevent recreation on each render
const libraries: Libraries = ['places', 'marker'];

type ViewType = 'month' | 'week' | 'day' | 'agenda';

const Calendar: React.FC = () => {
  const { profiles } = useProfiles();
  const [events, setEvents] = useState<Event[]>([]);
  const [friendsEvents, setFriendsEvents] = useState<Event[]>([]);
  const [friendsProfiles, setFriendsProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['game', 'practice', 'tournament', 'other']);
  const [showFriendsEvents, setShowFriendsEvents] = useState(true);
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
      console.error('❌ CALENDAR: Error fetching own events:', error);
    }
  }, [profileIds, profiles]);

  // Fetch friends events - only when user changes or showFriendsEvents changes
  const fetchFriendsEvents = useCallback(async (userId: string) => {
    if (!showFriendsEvents) {
      setFriendsEvents([]);
      setFriendsProfiles([]);
      return;
    }

    try {
      console.log('🔍 CALENDAR: Fetching friends events for user:', userId);
      
      // Get friendships where current user has granted access to friends
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id, role')
        .eq('user_id', userId)
        .in('role', ['viewer', 'administrator']);

      if (friendshipsError) {
        console.error('❌ CALENDAR: Error fetching friendships:', friendshipsError);
        return;
      }

      if (!friendships || friendships.length === 0) {
        console.log('❌ CALENDAR: No friendships with viewer/admin access found');
        setFriendsEvents([]);
        setFriendsProfiles([]);
        return;
      }

      const friendUserIds = friendships.map(f => f.friend_id);
      console.log('👥 CALENDAR: Friend user IDs:', friendUserIds);

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
        console.error('❌ CALENDAR: Error fetching user settings:', userSettingsResult.error);
        return;
      }

      if (friendProfilesResult.error) {
        console.error('❌ CALENDAR: Error fetching friend profiles:', friendProfilesResult.error);
        return;
      }

      const { data: userSettings } = userSettingsResult;
      const { data: friendProfiles } = friendProfilesResult;

      if (!friendProfiles || friendProfiles.length === 0) {
        console.log('❌ CALENDAR: No friend profiles found');
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
          console.error('❌ CALENDAR: Error fetching friend events:', eventsError);
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
        console.log('✅ CALENDAR: Successfully loaded friends events:', formattedFriendEvents.length);
      }

    } catch (error) {
      console.error('💥 CALENDAR: Error fetching friends events:', error);
    }
  }, [showFriendsEvents]);

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
        console.error('❌ CALENDAR: Error in main fetch:', error);
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

  // Initialize selected profiles when profiles change
  useEffect(() => {
    const allAvailableProfiles = [...profiles.map(p => p.id), ...friendsProfiles.map(p => p.id)];
    setSelectedProfiles(allAvailableProfiles);
  }, [profiles, friendsProfiles]);
  
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    setCurrentDate(newDate);
  };
  
  const navigateNext = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    setCurrentDate(newDate);
  };
  
  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const renderTitle = () => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
    };
    
    switch (view) {
      case 'month':
        options.month = 'long';
        break;
      case 'week':
        options.month = 'short';
        options.day = 'numeric';
        // Add end of week date
        const endOfWeek = new Date(currentDate);
        endOfWeek.setDate(currentDate.getDate() + 6);
        return `${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        options.weekday = 'long';
        options.month = 'long';
        options.day = 'numeric';
        break;
    }
    
    return currentDate.toLocaleDateString('en-US', options);
  };

  const renderView = () => {
    // Combine and filter events based on selected filters
    const allEvents = [...events, ...friendsEvents];
    
    const filteredEvents = allEvents.filter(event => {
      if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(event.platform)) {
        return false;
      }
      return true;
    });

    switch (view) {
      case 'month':
        return <MonthView currentDate={currentDate} events={filteredEvents} userTimezone={userTimezone} />;
      case 'week':
        return <WeekView currentDate={currentDate} events={filteredEvents} userTimezone={userTimezone} />;
      case 'day':
        return <DayView currentDate={currentDate} events={filteredEvents} userTimezone={userTimezone} />;
      case 'agenda':
        return <AgendaView currentDate={currentDate} events={filteredEvents} userTimezone={userTimezone} />;
    }
  };

  // Combine all profiles for filter display
  const allProfiles = [
    ...profiles.map(p => ({ ...p, isOwnProfile: true })),
    ...friendsProfiles.map(p => ({ ...p, isOwnProfile: false }))
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mr-4">Calendar</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={navigatePrevious}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={navigateToday}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 ml-2">{renderTitle()}</h2>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-1 flex">
            <button
              onClick={() => setView('month')}
              className={`p-1 rounded ${
                view === 'month' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="Month view"
            >
              <CalendarIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('week')}
              className={`p-1 rounded ${
                view === 'week' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="Week view"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('day')}
              className={`p-1 rounded ${
                view === 'day' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="Day view"
            >
              <div className="w-5 h-5 flex flex-col justify-center items-center">
                <div className="w-4 h-0.5 bg-current mb-0.5"></div>
                <div className="w-4 h-0.5 bg-current mb-0.5"></div>
                <div className="w-4 h-0.5 bg-current"></div>
              </div>
            </button>
            <button
              onClick={() => setView('agenda')}
              className={`p-1 rounded ${
                view === 'agenda' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="List view"
            >
              <LayoutList className="h-5 w-5" />
            </button>
          </div>
          
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-300"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </button>
        </div>
      </div>
      
      {filterOpen && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Children</h3>
            <div className="space-y-2">
              {allProfiles.filter(p => p.isOwnProfile).map(profile => (
                <div key={profile.id} className="flex items-center">
                  <input 
                    id={`child-${profile.id}`} 
                    type="checkbox" 
                    checked={selectedProfiles.includes(profile.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProfiles([...selectedProfiles, profile.id]);
                      } else {
                        setSelectedProfiles(selectedProfiles.filter(id => id !== profile.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                  />
                  <label 
                    htmlFor={`child-${profile.id}`} 
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center"
                  >
                    <span 
                      className="w-3 h-3 rounded-full mr-1.5"
                      style={{ backgroundColor: profile.color }}
                    ></span>
                    {profile.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Friends' Children</h3>
            <div className="space-y-2">
              <div className="flex items-center mb-2">
                <input 
                  id="show-friends-events" 
                  type="checkbox" 
                  checked={showFriendsEvents}
                  onChange={(e) => setShowFriendsEvents(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                />
                <label 
                  htmlFor="show-friends-events" 
                  className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Show friends' events
                </label>
              </div>
              {showFriendsEvents && allProfiles.filter(p => !p.isOwnProfile).map(profile => (
                <div key={profile.id} className="flex items-center">
                  <input 
                    id={`friend-child-${profile.id}`} 
                    type="checkbox" 
                    checked={selectedProfiles.includes(profile.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProfiles([...selectedProfiles, profile.id]);
                      } else {
                        setSelectedProfiles(selectedProfiles.filter(id => id !== profile.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                  />
                  <label 
                    htmlFor={`friend-child-${profile.id}`} 
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex items-center"
                  >
                    <span 
                      className="w-3 h-3 rounded-full mr-1.5"
                      style={{ backgroundColor: profile.color }}
                    ></span>
                    {profile.name}
                    <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">({profile.ownerName})</span>
                  </label>
                </div>
              ))}
              {!showFriendsEvents && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Enable to see friends' children</p>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platforms</h3>
            <div className="space-y-2">
              {['SportsEngine', 'TeamSnap', 'Playmetrics', 'Manual'].map(platform => (
                <div key={platform} className="flex items-center">
                  <input 
                    id={`platform-${platform}`} 
                    type="checkbox" 
                    checked={selectedPlatforms.length === 0 || selectedPlatforms.includes(platform)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlatforms([...selectedPlatforms, platform]);
                      } else {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                  />
                  <label 
                    htmlFor={`platform-${platform}`} 
                    className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {platform}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity Types</h3>
            <div className="space-y-2">
              {[
                { id: 'game', label: 'Games' },
                { id: 'practice', label: 'Practices' },
                { id: 'tournament', label: 'Tournaments' },
                { id: 'other', label: 'Other events' }
              ].map(type => (
                <div key={type.id} className="flex items-center">
                  <input 
                    id={`type-${type.id}`} 
                    type="checkbox" 
                    checked={selectedTypes.includes(type.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTypes([...selectedTypes, type.id]);
                      } else {
                        setSelectedTypes(selectedTypes.filter(t => t !== type.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                  />
                  <label htmlFor={`type-${type.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex-1 overflow-hidden">
        {view !== 'agenda' && (
          <CalendarHeader view={view} />
        )}
        <div className="flex-1 overflow-auto">
          {renderView()}
        </div>
      </div>
    </div>
  );
};

export default Calendar;