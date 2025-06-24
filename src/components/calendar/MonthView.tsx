import React, { useState } from 'react';
import { Event } from '../../types';
import EventModal from '../events/EventModal';

interface MonthViewProps {
  currentDate: Date;
  events: Event[];
}

const MonthView: React.FC<MonthViewProps> = ({ currentDate, events }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Calculate grid days for the month view
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
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
    calendarDays.push({
      date: new Date(prevMonthYear, prevMonth, daysInPrevMonth - firstDayOfMonth + i + 1),
      isCurrentMonth: false,
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Next month days to fill the calendar grid
  const remainingDays = 42 - calendarDays.length; // 6 rows of 7 days
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({
      date: new Date(nextMonthYear, nextMonth, i),
      isCurrentMonth: false,
    });
  }
  
  // Group events by date
  const eventsByDate: Record<string, Event[]> = {};
  events.forEach(event => {
    const dateKey = event.startTime.toISOString().split('T')[0];
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  return (
    <div className="grid grid-cols-7 h-full border-b border-gray-200">
      {calendarDays.map((day, index) => {
        const dateKey = day.date.toISOString().split('T')[0];
        const dayEvents = eventsByDate[dateKey] || [];
        const isToday = 
          today.getDate() === day.date.getDate() &&
          today.getMonth() === day.date.getMonth() &&
          today.getFullYear() === day.date.getFullYear();
          
        return (
          <div 
            key={index} 
            className={`min-h-[100px] border-r border-t border-gray-200 p-1 ${
              !day.isCurrentMonth ? 'bg-gray-50' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <span 
                className={`text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full ${
                  isToday 
                    ? 'bg-blue-600 text-white' 
                    : day.isCurrentMonth 
                      ? 'text-gray-900' 
                      : 'text-gray-400'
                }`}
              >
                {day.date.getDate()}
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
                <div className="text-xs text-gray-500 px-1">
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
        />
      )}
    </div>
  );
};

export default MonthView;