import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, Clock, ArrowRight } from 'lucide-react';
import EventCard from '../components/events/EventCard';
import ChildActivitySummary from '../components/dashboard/ChildActivitySummary';
import ConnectedPlatform from '../components/dashboard/ConnectedPlatform';
import { useProfiles } from '../context/ProfilesContext';
import { supabase } from '../lib/supabase';
import { Event, Platform } from '../types';

const Dashboard: React.FC = () => {
  const { profiles } = useProfiles();
  const [events, setEvents] = useState<Event[]>([]);
  const [friendsEvents, setFriendsEvents] = useState<Event[]>([]);
  const [friendsProfiles, setFriendsProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [platforms] = useState<Platform[]>([
    {
      id: 1,
      name: 'SportsEngine',
      icon: CalendarIcon,
      color: '#2563EB',
      connected: true,
      hasIssue: false,
    },
    {
      id: 2,
      name: 'TeamSnap',
      icon: Users,
      color: '#7C3AED',
      connected: true,
      hasIssue: false,
    }
  ]);

  useEffect(() => {
    const fetchAllEvents = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        // Fetch user's own events
        if (profiles.length > 0) {
          const profileIds = profiles.map(profile => profile.id);
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
        }

        // Fetch events from friends who have given viewer access
        await fetchFriendsEvents(user.id);

      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllEvents();
  }, [profiles]);

  const fetchFriendsEvents = async (userId: string) => {
    try {
      // Get all friendships where current user is the friend and has viewer or admin role
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          role,
          user:users!friendships_user_id_fkey(id),
          user_settings!friendships_user_id_fkey(full_name, profile_photo_url)
        `)
        .eq('friend_id', userId)
        .in('role', ['viewer', 'administrator']);

      if (friendshipsError) {
        console.error('Error fetching friendships:', friendshipsError);
        return;
      }

      if (!friendships || friendships.length === 0) {
        return;
      }

      // Get all profiles for friends who have given access
      const friendUserIds = friendships.map(f => f.user_id);
      const { data: friendProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          age,
          color,
          photo_url,
          user_id,
          profile_sports(sport, color)
        `)
        .in('user_id', friendUserIds);

      if (profilesError) {
        console.error('Error fetching friend profiles:', profilesError);
        return;
      }

      if (!friendProfiles || friendProfiles.length === 0) {
        return;
      }

      // Transform friend profiles to match our Child interface
      const transformedFriendProfiles = friendProfiles.map(profile => {
        const friendship = friendships.find(f => f.user_id === profile.user_id);
        const userSettings = friendship?.user_settings;
        
        return {
          ...profile,
          sports: profile.profile_sports?.map(sport => ({
            name: sport.sport,
            color: sport.color
          })) || [],
          eventCount: 0,
          ownerName: userSettings?.full_name || 'Friend',
          ownerPhoto: userSettings?.profile_photo_url,
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
          console.error('Error fetching friend events:', eventsError);
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
      }

    } catch (error) {
      console.error('Error fetching friends events:', error);
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gradient-to-r from-blue-500 to-blue-600">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-white mr-2" />
            <h2 className="text-lg font-medium text-white">Today's Schedule</h2>
          </div>
          <span className="text-white text-sm font-medium">
            {upcomingEvents.filter(e => e.isToday).length} Events
          </span>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingEvents.filter(e => e.isToday).length > 0 ? (
            upcomingEvents
              .filter(e => e.isToday)
              .map(event => (
                <div key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}`} className="relative">
                  {!event.isOwnEvent && (
                    <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {event.ownerName}'s schedule
                    </div>
                  )}
                  <EventCard event={event} />
                </div>
              ))
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Clock className="h-12 w-12 text-gray-300 mb-2" />
              <h3 className="text-lg font-medium text-gray-900">No events scheduled for today</h3>
              <p className="text-gray-500 mt-1">Enjoy your free time!</p>
            </div>
          )}
        </div>
      </div>

      {/* Children Activity Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Children's Activities</h2>
            </div>
            <a href="/profiles" className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center">
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
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    Friends' Children ({profilesWithEventCounts.filter(p => !p.isOwnProfile).length})
                  </h4>
                </div>
                {profilesWithEventCounts.filter(p => !p.isOwnProfile).map(child => (
                  <div key={child.id} className="relative">
                    <div className="flex items-center space-x-4 p-3 bg-blue-50 rounded-lg">
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
                        <h3 className="text-sm font-medium text-gray-900">{child.name}</h3>
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mr-2">
                            {child.ownerName}
                          </span>
                          <span className="text-xs text-gray-500">
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
                              <span className="text-gray-500">{sport.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{child.eventCount}</div>
                        <div className="text-xs text-gray-500">This week</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {profilesWithEventCounts.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No children profiles found. Add a profile to get started.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Connected Platforms</h2>
            </div>
            <a href="/connections" className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center">
              Manage <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </div>
          <div className="px-4 py-5 sm:px-6 space-y-4">
            {platforms.map(platform => (
              <ConnectedPlatform key={platform.id} platform={platform} />
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">Upcoming Events</h2>
          </div>
          <a href="/calendar" className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center">
            View calendar <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingEvents
            .filter(e => !e.isToday)
            .slice(0, 8)
            .map(event => (
              <div key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}`} className="relative">
                {!event.isOwnEvent && (
                  <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {event.ownerName}'s schedule
                  </div>
                )}
                <EventCard event={event} />
              </div>
            ))}
          {upcomingEvents.filter(e => !e.isToday).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No upcoming events scheduled.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;