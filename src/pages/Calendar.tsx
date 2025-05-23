import React, { useState, useEffect } from 'react';
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

type ViewType = 'month' | 'week' | 'day' | 'agenda';

const Calendar: React.FC = () => {
  const { profiles } = useProfiles();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['game', 'practice', 'tournament', 'other']);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        if (profiles.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const profileIds = selectedProfiles.length > 0 
          ? selectedProfiles 
          : profiles.map(profile => profile.id);

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
  }, [profiles, selectedProfiles]);

  useEffect(() => {
    // Initialize selected profiles with all profiles
    setSelectedProfiles(profiles.map(profile => profile.id));
  }, [profiles]);
  
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
    // Filter events based on selected filters
    const filteredEvents = events.filter(event => {
      if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(event.platform)) {
        return false;
      }
      return true;
    });

    switch (view) {
      case 'month':
        return <MonthView currentDate={currentDate} events={filteredEvents} />;
      case 'week':
        return <WeekView currentDate={currentDate} events={filteredEvents} />;
      case 'day':
        return <DayView currentDate={currentDate} events={filteredEvents} />;
      case 'agenda':
        return <AgendaView currentDate={currentDate} events={filteredEvents} />;
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900 mr-4">Calendar</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={navigatePrevious}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <button
              onClick={navigateToday}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
            <h2 className="text-xl font-semibold text-gray-700 ml-2">{renderTitle()}</h2>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="bg-white border border-gray-300 rounded-md p-1 flex">
            <button
              onClick={() => setView('month')}
              className={`p-1 rounded ${
                view === 'month' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Month view"
            >
              <CalendarIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('week')}
              className={`p-1 rounded ${
                view === 'week' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Week view"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('day')}
              className={`p-1 rounded ${
                view === 'day' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
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
                view === 'agenda' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="List view"
            >
              <LayoutList className="h-5 w-5" />
            </button>
          </div>
          
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </button>
        </div>
      </div>
      
      {filterOpen && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Children</h3>
            <div className="space-y-2">
              {profiles.map(profile => (
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
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label 
                    htmlFor={`child-${profile.id}`} 
                    className="ml-2 text-sm text-gray-700 flex items-center"
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
            <h3 className="text-sm font-medium text-gray-700 mb-2">Platforms</h3>
            <div className="space-y-2">
              {['SportsEngine', 'TeamSnap', 'Manual'].map(platform => (
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
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label 
                    htmlFor={`platform-${platform}`} 
                    className="ml-2 text-sm text-gray-700"
                  >
                    {platform}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Activity Types</h3>
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
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`type-${type.id}`} className="ml-2 text-sm text-gray-700">
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow flex-1 overflow-hidden">
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