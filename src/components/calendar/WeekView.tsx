import React, { useState } from 'react';
import { Event } from '../../types';
import EventModal from '../events/EventModal';
import { DateTime } from 'luxon';

interface WeekViewProps {
  currentDate: Date;
  events: Event[];
  userTimezone?: string;
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, events, userTimezone = 'UTC' }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Get the start of the week (Sunday) using Luxon with proper timezone handling
  const getStartOfWeek = (date: Date) => {
    const dt = DateTime.fromJSDate(date).setZone(userTimezone);
    const startOfWeek = dt.startOf('week');
    return startOfWeek.toJSDate();
  };
  
  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = DateTime.fromJSDate(startOfWeek).setZone(userTimezone).plus({ days: i }).toJSDate();
    return day;
  });
  
  const today = new Date();
  const isToday = (date: Date) => {
    const dateInTz = DateTime.fromJSDate(date).setZone(userTimezone);
    const todayInTz = DateTime.fromJSDate(today).setZone(userTimezone);
    return dateInTz.hasSame(todayInTz, 'day');
  };
  
  // Group events by date using Luxon for consistent timezone handling
  const eventsByDate: Record<string, Event[]> = {};
  events.forEach(event => {
    const dateKey = DateTime.fromJSDate(event.startTime).setZone(userTimezone).toISODate();
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });
  
  // Generate time slots
  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  // Format time with user's timezone
  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex">
        <div className="w-20 flex-shrink-0"></div>
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day, index) => (
            <div 
              key={index} 
              className="px-2 py-3 text-center border-r border-gray-200 dark:border-gray-700"
            >
              <div 
                className={`text-sm font-medium ${
                  isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {DateTime.fromJSDate(day).setZone(userTimezone).toFormat('ccc')}
              </div>
              <div 
                className={`text-lg font-semibold ${
                  isToday(day) 
                    ? 'text-white bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {DateTime.fromJSDate(day).setZone(userTimezone).toFormat('d')}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="flex h-full">
          <div className="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
            {timeSlots.map(hour => (
              <div 
                key={hour} 
                className="h-12 text-xs text-gray-500 dark:text-gray-400 text-right pr-2"
                style={{ marginTop: hour === 0 ? '0' : '-8px' }}
              >
                {hour === 0 ? '' : `${hour % 12 === 0 ? '12' : hour % 12}${hour < 12 ? 'am' : 'pm'}`}
              </div>
            ))}
          </div>
          
          <div className="flex-1 grid grid-cols-7 relative">
            {/* Time grid lines */}
            {timeSlots.map(hour => (
              <React.Fragment key={hour}>
                <div 
                  className="absolute w-full border-t border-gray-200 dark:border-gray-700" 
                  style={{ top: `${hour * 48}px` }}
                ></div>
                <div 
                  className="absolute w-full border-t border-gray-200 dark:border-gray-700 border-dashed opacity-50" 
                  style={{ top: `${hour * 48 + 24}px` }}
                ></div>
              </React.Fragment>
            ))}
            
            {/* Day columns */}
            {weekDays.map((day, dayIndex) => {
              const dateKey = DateTime.fromJSDate(day).setZone(userTimezone).toISODate();
              const dayEvents = eventsByDate[dateKey] || [];
              
              return (
                <div 
                  key={dayIndex} 
                  className="h-full border-r border-gray-200 dark:border-gray-700 relative"
                >
                  {dayEvents.map((event, eventIndex) => {
                    const startHour = DateTime.fromJSDate(event.startTime).setZone(userTimezone).hour + 
                                     (DateTime.fromJSDate(event.startTime).setZone(userTimezone).minute / 60);
                    const endHour = DateTime.fromJSDate(event.endTime).setZone(userTimezone).hour + 
                                   (DateTime.fromJSDate(event.endTime).setZone(userTimezone).minute / 60);
                    const duration = endHour - startHour;
                    
                    return (
                      <div
                        key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}-${eventIndex}`}
                        className="absolute left-1 right-1 rounded overflow-hidden text-xs shadow-sm cursor-pointer"
                        style={{
                          top: `${startHour * 48}px`,
                          height: `${duration * 48}px`,
                          backgroundColor: event.color + '20',
                          borderLeft: `3px solid ${event.color}`
                        }}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="p-1 h-full overflow-hidden">
                          <div className="font-medium flex items-center" style={{ color: event.color }}>
                            <span className="truncate flex-1">{event.title}</span>
                            {!event.isOwnEvent && (
                              <span className="ml-1 text-xs opacity-75">👥</span>
                            )}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300 text-xs mt-0.5">
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </div>
                          {duration > 0.75 && (
                            <div className="text-gray-600 dark:text-gray-300 text-xs mt-0.5 flex items-center">
                              <span 
                                className="w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: event.child.color }}
                              ></span>
                              <span className="truncate">
                                {event.child.name}
                                {!event.isOwnEvent && event.ownerName && (
                                  <span className="text-blue-600 dark:text-blue-400"> ({event.ownerName})</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            
            {/* Current time indicator */}
            <div 
              className="absolute w-full border-t-2 border-red-500 z-10"
              style={{ 
                top: `${(DateTime.now().setZone(userTimezone).hour + DateTime.now().setZone(userTimezone).minute / 60) * 48}px`,
                left: 0,
                right: 0
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 relative -top-1 -left-1"></div>
            </div>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)}
          mapsLoaded={true}
          mapsLoadError={undefined}
          userTimezone={userTimezone}
        />
      )}
    </div>
  );
};

export default WeekView;