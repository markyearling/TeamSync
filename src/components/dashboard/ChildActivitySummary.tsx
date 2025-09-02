import React from 'react';
import { Child } from '../../types';

interface ChildActivitySummaryProps {
  child: Child;
}

const ChildActivitySummary: React.FC<ChildActivitySummaryProps> = ({ child }) => {
  return (
    <div className="flex items-center space-x-4">
      <div 
        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
        style={{ backgroundColor: child.color }}
      >
        {child.name.charAt(0)}
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{child.name}</h3>
        <div className="flex items-center mt-1">
          {child.sports.map((sport, index) => (
            <div 
              key={index}
              className="flex items-center text-xs mr-2"
            >
              <span 
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: sport.color }}
              ></span>
              <span className="text-gray-500 dark:text-gray-400">{sport.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{child.eventCount}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">This week</div>
      </div>
    </div>
  );
};

export default ChildActivitySummary;