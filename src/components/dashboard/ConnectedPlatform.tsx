import React from 'react';
import { Platform } from '../../types';
import { Check, AlertCircle } from 'lucide-react';

interface ConnectedPlatformProps {
  platform: Platform;
  onManage?: () => void;
}

const ConnectedPlatform: React.FC<ConnectedPlatformProps> = ({ platform, onManage }) => {
  return (
    <div className="flex items-center space-x-4">
      <div 
        className="h-10 w-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: platform.color + '20', color: platform.color }}
      >
        <platform.icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{platform.name}</h3>
        <div className="flex items-center mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {platform.connected ? 'Connected' : 'Not connected'}
          </span>
          {platform.connected && (
            <div className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full flex items-center">
              <Check className="h-3 w-3 mr-1" />
              Synced
            </div>
          )}
          {platform.hasIssue && (
            <div className="ml-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 text-xs px-2 py-0.5 rounded-full flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              Issue
            </div>
          )}
        </div>
      </div>
      <div>
        <button 
          onClick={onManage}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
        >
          Manage
        </button>
      </div>
    </div>
  );
};

export default ConnectedPlatform;