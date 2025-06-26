import React, { useState } from 'react';
import { MapPin, Clock, User } from 'lucide-react';
import { Event } from '../../types';
import EventModal from './EventModal';
import { DateTime } from 'luxon';

interface EventCardProps {
  event: Event;
  mapsLoaded?: boolean;
  mapsLoadError?: Error;
  userTimezone?: string;
}

const EventCard: React.FC<EventCardProps> = ({ event, mapsLoaded = true, mapsLoadError, userTimezone = 'UTC' }) => {
  const [showModal, setShowModal] = useState(false);

  // Format time with user's timezone using Luxon
  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <>
      <div 
        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div 
              className="w-12 h-12 rounded-lg flex flex-col items-center justify-center"
              style={{ backgroundColor: event.color + '20', color: event.color }}
            >
              <div className="text-xs font-medium">{event.startTime.toLocaleString('default', { month: 'short' })}</div>
              <div className="text-lg font-bold">{event.startTime.getDate()}</div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span 
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: event.child.color }}
              ></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{event.child.name}</span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full">{event.sport}</span>
            </div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white mt-1">{event.title}</h3>
            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {formatTime(event.startTime)} - 
                {formatTime(event.endTime)}
              </div>
              {event.location && (
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {event.location}
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 self-center">
            <div 
              className="h-8 w-8 rounded flex items-center justify-center"
              style={{ backgroundColor: event.platformColor + '20', color: event.platformColor }}
            >
              <event.platformIcon className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <EventModal 
          event={event} 
          onClose={() => setShowModal(false)} 
          mapsLoaded={mapsLoaded}
          mapsLoadError={mapsLoadError}
          userTimezone={userTimezone}
        />
      )}
    </>
  );
};

export default EventCard;