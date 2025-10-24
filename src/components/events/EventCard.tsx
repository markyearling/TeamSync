import React, { useState } from 'react';
import { MapPin, Clock, User } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Event } from '../../types';
import EventModal from './EventModal';
import { DateTime } from 'luxon';

interface EventCardProps {
  event: Event;
  mapsLoaded?: boolean;
  mapsLoadError?: Error;
  userTimezone?: string;
  onClick?: () => void; // Optional click handler for the card
}

const EventCard: React.FC<EventCardProps> = ({ event, mapsLoaded = true, mapsLoadError, userTimezone = 'UTC', onClick }) => {
  // Format time with user's timezone using Luxon
  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Determine how to display the location
  const displayLocation = () => {
    if (!event.location) {
      return null; // No location to display
    }

    // If location_name exists, show venue name with full address below
    // Otherwise, just show the full location
    if (event.location_name) {
      return (
        <>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span>{event.location_name}</span>
          </div>
          <div className="flex items-center ml-5">
            <span className="text-xs text-gray-400 dark:text-gray-500">{event.location}</span>
          </div>
        </>
      );
    } else {
      // No venue name, just show full location
      return (
        <div className="flex items-center">
          <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{event.location}</span>
        </div>
      );
    }
  };

  return (
      <div
        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex flex-col"
        onClick={onClick}
      >
        <div className="flex items-start space-x-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: event.child.color }}
              ></span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{event.child.name}</span>
              <span 
                className="text-xs px-2 py-0.5 rounded-full flex items-center font-medium"
                style={{ 
                  backgroundColor: event.color + '20',
                  color: event.color
                }}
              >
                {event.sportIcon && (
                  <FontAwesomeIcon 
                    icon={event.sportIcon} 
                    className="h-3 w-3 mr-1"
                    style={{ color: event.color }}
                  />
                )}
                {event.sport}
              </span>
            </div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white mt-1">{event.title}</h3>
            <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
              </div>
              {displayLocation()}
            </div>
          </div>
          <div className="flex-shrink-0 self-start">
            {event.child.photo_url ? (
              <img
                src={event.child.photo_url}
                alt={event.child.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              />
            ) : (
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                <User className="h-10 w-10 text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>
        </div>
        {!event.isOwnEvent && event.ownerName && (
          <div className="mt-2 self-end bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
            {event.ownerName}'s schedule
          </div>
        )}
      </div>
  );
};

export default EventCard;