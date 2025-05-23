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
    const fetchEvents = async () => {
      try {
        if (profiles.length === 0) return;

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
            isToday: new Date(event.start_time).toDateString() === new Date().toDateString()
          };
        });

        setEvents(formattedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [profiles]);

  // Get upcoming events (today and future)
  const upcomingEvents = events
    .filter(event => event.startTime >= new Date())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate event counts for each child
  const profilesWithEventCounts = profiles.map(profile => ({
    ...profile,
    eventCount: events.filter(event => 
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
                <EventCard key={event.id} event={event} />
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
            {profilesWithEventCounts.map(child => (
              <ChildActivitySummary key={child.id} child={child} />
            ))}
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
            .slice(0, 5)
            .map(event => (
              <EventCard key={event.id} event={event} />
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