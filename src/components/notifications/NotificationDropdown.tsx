import React from 'react';
import { Calendar, MapPin, Clock, X, Trash2 } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  type: 'new_event' | 'schedule_change' | 'location_change';
  time: Date;
  read: boolean;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  onClose: () => void;
  onClearAll: () => void;
  onClearOne: (id: string) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ 
  notifications, 
  onClose, 
  onClearAll,
  onClearOne 
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'schedule_change':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'new_event':
        return <Calendar className="h-5 w-5 text-green-500" />;
      case 'location_change':
        return <MapPin className="h-5 w-5 text-blue-500" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'schedule_change':
        return 'Schedule Updated';
      case 'new_event':
        return 'New Event Added';
      case 'location_change':
        return 'Location Changed';
      default:
        return 'Notification';
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3>
        <div className="flex items-center space-x-2">
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
              !notification.read ? 'bg-blue-50 dark:bg-blue-900/50' : ''
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                {getIcon(notification.type)}
              </div>
              <div className="ml-3 flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {getNotificationTitle(notification.type)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{notification.title}</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {getTimeAgo(notification.time)}
                    </p>
                  </div>
                  <button
                    onClick={() => onClearOne(notification.id)}
                    className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
            No new notifications
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;