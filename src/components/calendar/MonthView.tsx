import React, { useState } from 'react';
import { Event } from '../../types';
import EventModal from '../events/EventModal';
import { DateTime } from 'luxon';

interface MonthViewProps {
  currentDate: Date;
  events: Event[];
  userTimezone?: string;
}

const MonthView: React.FC<MonthViewProps> = ({ currentDate, events, userTimezone = 'UTC' }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Calculate grid days for the month view using Luxon for consistent timezone handling
  const getDaysInMonth = (year: number, month: number) => {
    return DateTime.local(year, month + 1).setZone(userTimezone).daysInMonth || 31;
  };
  
  const getFirstDayOfMonth = (year: number, month: number) => {
    return DateTime.local(year, month + 1, 1).setZone(userTimezone).weekday % 7;
  };
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);
  
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);
  
  const calendarDays = [];
  
  // Previous month days
  for (let i = 0; i < firstDayOfMonth; i++) {
    const date = DateTime.local(prevMonthYear, prevMonth + 1, daysInPrevMonth - firstDayOfMonth + i + 1)
      .setZone(userTimezone)
      .toJSDate();
    calendarDays.push({
      date,
      isCurrentMonth: false,
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = DateTime.local(year, month + 1, i)
      .setZone(userTimezone)
      .toJSDate();
    calendarDays.push({
      date,
      isCurrentMonth: true,
    });
  }
  
  // Next month days to fill the calendar grid
  const remainingDays = 42 - calendarDays.length; // 6 rows of 7 days
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  
  for (let i = 1; i <= remainingDays; i++) {
    const date = DateTime.local(nextMonthYear, nextMonth + 1, i)
      .setZone(userTimezone)
      .toJSDate();
    calendarDays.push({
      date,
      isCurrentMonth: false,
    });
  }
  
  // Group events by date using Luxon for consistent timezone handling
  const eventsByDate: Record<string, Event[]> = {};
  events.forEach(event => {
    const dateKey = DateTime.fromJSDate(event.startTime).setZone(userTimezone).toISODate();
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  return (
    <div className="grid grid-cols-7 h-full border-b border-gray-200 dark:border-gray-700">
      {calendarDays.map((day, index) => {
        const dateKey = DateTime.fromJSDate(day.date).setZone(userTimezone).toISODate();
        const dayEvents = eventsByDate[dateKey] || [];
        const isToday = DateTime.fromJSDate(today).setZone(userTimezone).toISODate() === dateKey;
          
        return (
          <div 
            key={index} 
            className={`min-h-[100px] border-r border-t border-gray-200 dark:border-gray-700 p-1 ${
              !day.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/50' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <span 
                className={`text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full ${
                  isToday 
                    ? 'bg-blue-600 text-white' 
                    : day.isCurrentMonth 
                      ? 'text-gray-900 dark:text-gray-100' 
                      : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {DateTime.fromJSDate(day.date).setZone(userTimezone).toFormat('d')}
              </span>
            </div>
            
            <div className="mt-1 max-h-[80px] overflow-y-auto space-y-1">
              {dayEvents.slice(0, 3).map((event, eventIndex) => (
                <div 
                  key={`${event.isOwnEvent ? 'own' : 'friend'}-${event.id}-${eventIndex}`}
                  className="text-xs px-1 py-0.5 rounded truncate flex items-center cursor-pointer relative"
                  style={{ 
                    backgroundColor: event.color + '20',
                    color: event.color 
                  }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <span 
                    className="w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0"
                    style={{ backgroundColor: event.child.color }}
                  ></span>
                  <span className="truncate flex-1">{event.title}</span>
                  {!event.isOwnEvent && (
                    <span className="ml-1 text-xs opacity-75">👥</span>
                  )}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}

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

export default MonthView;