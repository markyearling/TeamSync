import React, { useState } from 'react';
import { MapPin, Clock, User, AlertCircle, Repeat, Download } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Event } from '../../types';
import EventModal from './EventModal';
import { DateTime } from 'luxon';
import { useCapacitor } from '../../hooks/useCapacitor';

interface EventCardProps {
  event: Event;
  mapsLoaded?: boolean;
  mapsLoadError?: Error;
  userTimezone?: string;
  onClick?: () => void;
  showDateLabel?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, mapsLoaded = true, mapsLoadError, userTimezone = 'UTC', onClick, showDateLabel = true }) => {
  const { isNative } = useCapacitor();

  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateLabel = (date: Date) => {
    const dt = DateTime.fromJSDate(date).setZone(userTimezone);
    return `${dt.toFormat('ccc')} ${dt.toFormat('MMM')} ${dt.toFormat('d')}`;
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
        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex"
        onClick={onClick}
      >
        {showDateLabel && (
          <div className="w-12 sm:w-14 bg-blue-600 dark:bg-blue-700 flex items-center justify-center rounded-l-lg flex-shrink-0">
            <span className="vertical-day-text text-white text-xs sm:text-sm font-medium tracking-wide">
              {formatDateLabel(event.startTime)}
            </span>
          </div>
        )}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex items-start space-x-4">
            <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: event.child.color }}
              ></span>
              <span className={`text-sm text-gray-500 dark:text-gray-400 ${event.is_cancelled ? 'line-through' : ''}`}>{event.child.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full flex items-center font-medium ${event.is_cancelled ? 'line-through' : ''}`}
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
              {event.is_recurring && (
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-medium rounded flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  {!isNative && <span className="ml-1">Recurring</span>}
                </span>
              )}
              {event.is_cancelled && (
                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-xs font-bold rounded flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  CANCELLED
                </span>
              )}
            </div>
            <h3 className={`text-base font-medium text-gray-900 dark:text-white mt-1 ${event.is_cancelled ? 'line-through' : ''}`}>{event.title}</h3>
            <div className={`mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400 ${event.is_cancelled ? 'line-through' : ''}`}>
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
                className="h-16 w-16 rounded-full object-cover border-2"
                style={{ borderColor: event.child.color }}
              />
            ) : (
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-600 border-2"
                style={{ borderColor: event.child.color }}
              >
                <User className="h-10 w-10 text-gray-500 dark:text-gray-400" />
              </div>
            )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 flex-wrap">
            {!event.isOwnEvent && event.ownerName && (
              <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                {event.ownerName}'s schedule
              </div>
            )}
            {/* {event.calendar_name && (
              <div className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-200 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Download className="h-3 w-3" />
                Synced from {event.calendar_name}
              </div>
            )} */}
          </div>
        </div>
      </div>
  );
};

export default EventCard;