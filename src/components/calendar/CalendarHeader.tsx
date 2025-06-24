import React from 'react';

interface CalendarHeaderProps {
  view: 'month' | 'week' | 'day';
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ view }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-7 text-center">
        {days.map((day, index) => (
          <div 
            key={index} 
            className="py-2 px-1 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarHeader;