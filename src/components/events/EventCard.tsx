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

    const firstPartOfLocation = event.location.split(',')[0].trim();

    // If location_name matches the first part of the full location, display only the full location
    if (event.location_name && event.location_name === firstPartOfLocation) {
      return (
        <div className="flex items-center">
          <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{event.location}</span>
        </div>
      );
    } else {
      // Otherwise, display location_name (if available) and then the full location
      return (
        <>
          {event.location_name && (
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span>{event.location_name}</span>
            </div>
          )}
          {event.location_name && (
            <div className="flex items-center ml-5">
              <span className="text-xs text-gray-400 dark:text-gray-500">{event.location}</span>
            </div>
          )}
          {!event.location_name && (
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
        </>
      );
    }
  };

  return (
      <div
        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer relative" // Add 'relative' here
        onClick={onClick}
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
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full flex items-center">
                {event.sportIcon && React.createElement(event.sportIcon, {
                  className: "h-3 w-3 mr-1"
                })}
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
          <div className="flex-shrink-0 self-center">
            <div
              className="h-8 w-8 rounded flex items-center justify-center"
              style={{ backgroundColor: event.platformColor + '20', color: event.platformColor }}
            >
              <event.platformIcon className="h-4 w-4" />
            </div>
          </div>
        </div>
        {/* Add the new conditional div here */}
        {!event.isOwnEvent && event.ownerName && (
          <div className="absolute bottom-2 right-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full z-10">
            {event.ownerName}'s schedule
          </div>
        )}
      </div>
  );
};

export default EventCard;