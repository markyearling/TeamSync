import React from 'react';
import { Users } from 'lucide-react';
import FriendsManager from '../components/friends/FriendsManager';

const Friends: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Friends</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your friends and share your children's schedules and events
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Friends & Sharing
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add friends to share your children's schedules and events. You can give them viewer or administrator access to control what they can see and do.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Access Levels Explained
            </h3>
            <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex items-start">
                <span className="font-medium mr-2">💬 Friend:</span>
                <span>Can chat and send messages only</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium mr-2">👁️ Viewer:</span>
                <span>Can view schedules and events in dashboard and calendar</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium mr-2">👑 Administrator:</span>
                <span>Can view and manage all schedules, events, and profiles</span>
              </div>
            </div>
          </div>

          <FriendsManager />
        </div>
      </div>
    </div>
  );
};

export default Friends;