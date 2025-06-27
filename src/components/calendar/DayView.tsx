import React, { useState } from 'react';
import { Event } from '../../types';
import { MapPin, Clock } from 'lucide-react';
import EventModal from '../events/EventModal';
import { DateTime } from 'luxon';

interface DayViewProps {
  currentDate: Date;
  events: Event[];
  userTimezone?: string;
}

const DayView: React.FC<DayViewProps> = ({ currentDate, events, userTimezone = 'UTC' }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Check if the current date is today using Luxon with proper timezone handling
  const todayLuxon = DateTime.now().setZone(userTimezone);
  const currentDateLuxon = DateTime.fromJSDate(currentDate).setZone(userTimezone);
  const isToday = currentDateLuxon.hasSame(todayLuxon, 'day');
  
  // Get events for the current day using Luxon for consistent timezone handling
  const dayEvents = events.filter(event => {
    const eventDateLuxon = DateTime.fromJSDate(event.startTime).setZone(userTimezone);
    return eventDateLuxon.hasSame(currentDateLuxon, 'day');
  });
  
  // Sort events by start time
  dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
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
        <div className="flex-1 px-4 py-3">
          <div className="text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {currentDateLuxon.toFormat('EEEE')}
            </div>
            <div className={`inline-flex items-center justify-center ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
              <span 
                className={`text-2xl font-bold ${
                  isToday ? 'bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center' : ''
                }`}
              >
                {currentDateLuxon.toFormat('d')}
              </span>
            </div>
          </div>
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
          
          <div className="flex-1 relative">
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
            
            {/* Events */}
            {dayEvents.map((event, eventIndex) => {
              const startHour = DateTime.fromJSDate(event.startTime).setZone(userTimezone).hour + 
                               (DateTime.fromJSDate(event.startTime).setZone(userTimezone).minute / 60);
              const endHour = DateTime.fromJSDate(event.endTime).setZone(userTimezone).hour + 
                             (DateTime.fromJSDate(event.endTime).setZone(userTimezone).minute / 60);
              const duration = endHour - startHour;
              
              return (
                <div
                  key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}-${eventIndex}`}
                  className="absolute left-2 right-2 rounded overflow-hidden shadow-sm cursor-pointer"
                  style={{
                    top: `${startHour * 48}px`,
                    height: `${duration * 48}px`,
                    backgroundColor: event.color + '20',
                    borderLeft: `3px solid ${event.color}`
                  }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="p-2 h-full overflow-hidden">
                    <div className="flex items-center">
                      <span 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: event.child.color }}
                      ></span>
                      <span className="text-sm font-medium flex-1 truncate" style={{ color: event.color }}>
                        {event.title}
                      </span>
                      {!event.isOwnEvent && (
                        <span className="ml-1 text-xs opacity-75">👥</span>
                      )}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                      {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </div>
                    {duration > 0.75 && event.location && (
                      <div className="text-gray-600 dark:text-gray-300 text-xs mt-1 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {duration > 1.5 && (
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center">
                          <span className="truncate">
                            {event.child.name}
                            {!event.isOwnEvent && event.ownerName && (
                              <span className="text-blue-600 dark:text-blue-400"> ({event.ownerName})</span>
                            )}
                          </span>
                        </div>
                        {event.description && (
                          <div className="mt-1 truncate">{event.description}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Current time indicator */}
            {isToday && (
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
            )}
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

export default DayView;