import React, { useState } from 'react';
import { Event } from '../../types';
import { Calendar, MapPin, Clock } from 'lucide-react';
import EventModal from '../events/EventModal';

interface AgendaViewProps {
  currentDate: Date;
  events: Event[];
}

const AgendaView: React.FC<AgendaViewProps> = ({ currentDate, events }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Get the start of the month
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  // Get the end of the month
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Filter events for the current month
  const monthEvents = events.filter(event => {
    const eventDate = event.startTime;
    return eventDate >= startOfMonth && eventDate <= endOfMonth;
  });
  
  // Sort events by date
  monthEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Group events by date
  const eventsByDate: Record<string, Event[]> = {};
  monthEvents.forEach(event => {
    const dateKey = event.startTime.toISOString().split('T')[0];
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });
  
  const dateKeys = Object.keys(eventsByDate).sort();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="divide-y divide-gray-200">
      {dateKeys.length > 0 ? (
        dateKeys.map(dateKey => {
          const date = new Date(dateKey);
          const isToday = dateKey === today;
          
          return (
            <div key={dateKey} className="p-4">
              <div className="flex items-center mb-3">
                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                <h3 
                  className={`text-base font-medium ${
                    isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                  {isToday && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Today
                    </span>
                  )}
                </h3>
              </div>
              
              <div className="space-y-3">
                {eventsByDate[dateKey].map((event, index) => (
                  <div 
                    key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}-${index}`}
                    className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex border-l-4 h-full" style={{ borderColor: event.color }}>
                      <div className="p-3 flex-1">
                        <div className="flex items-center mb-1">
                          <span 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: event.child.color }}
                          ></span>
                          <span className="text-sm text-gray-500">
                            {event.child.name}
                            {!event.isOwnEvent && event.ownerName && (
                              <span className="text-blue-600"> ({event.ownerName})</span>
                            )}
                          </span>
                          <span 
                            className="ml-2 text-xs px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: event.platformColor + '20',
                              color: event.platformColor 
                            }}
                          >
                            {event.platform}
                          </span>
                          {!event.isOwnEvent && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              👥 Friend's Event
                            </span>
                          )}
                        </div>
                        
                        <h4 className="text-base font-medium text-gray-900">{event.title}</h4>
                        
                        <div className="mt-2 flex flex-col sm:flex-row sm:space-x-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="h-4 w-4 mr-1" />
                            {event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
                            {event.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                          
                          {event.location && (
                            <div className="flex items-center text-sm text-gray-500 mt-1 sm:mt-0">
                              <MapPin className="h-4 w-4 mr-1" />
                              {event.location}
                            </div>
                          )}
                        </div>
                        
                        {event.description && (
                          <p className="mt-2 text-sm text-gray-600">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No events this month</h3>
          <p className="text-gray-500 mt-1">Try changing your filters or adding new connections</p>
        </div>
      )}

      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
};

export default AgendaView;