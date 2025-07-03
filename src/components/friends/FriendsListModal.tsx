import React from 'react';
import { Users, Search, X, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCapacitor } from '../../hooks/useCapacitor';

interface Friend {
  id: string;
  friend_id: string;
  role: 'none' | 'viewer' | 'administrator';
  created_at: string;
  friend: {
    id: string;
    full_name?: string;
    profile_photo_url?: string;
  };
  unreadCount?: number;
  lastMessageAt?: string;
}

interface FriendsListModalProps {
  friends: Friend[];
  filteredFriends: Friend[];
  friendSearchQuery: string;
  setFriendSearchQuery: (query: string) => void;
  onFriendClick: (friend: Friend) => void;
  onManageFriends: () => void;
  onClose: () => void;
  loadingFriends: boolean;
}

const FriendsListModal: React.FC<FriendsListModalProps> = ({
  friends,
  filteredFriends,
  friendSearchQuery,
  setFriendSearchQuery,
  onFriendClick,
  onManageFriends,
  onClose,
  loadingFriends
}) => {
  const navigate = useNavigate();
  const { isNative } = useCapacitor();

  const getRoleIcon = (role: string) => {
    return role === 'administrator' ? '👑' : role === 'viewer' ? '👁️' : '💬';
  };

  const getRoleLabel = (role: string) => {
    return role === 'administrator' ? 'Admin' : role === 'viewer' ? 'Viewer' : 'Friend';
  };

  // Determine if we should use full-screen modal on mobile
  const containerClasses = isNative
    ? "fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-800 overflow-hidden"
    : "w-full max-w-xs sm:max-w-sm md:w-80 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none";

  return (
    <div 
      className={containerClasses}
      style={isNative ? {
        top: 'var(--safe-area-inset-top, 0px)',
        bottom: 'var(--safe-area-inset-bottom, 0px)',
        left: 'var(--safe-area-inset-left, 0px)',
        right: 'var(--safe-area-inset-right, 0px)'
      } : {}}
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Friends ({friends.length})</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onManageFriends}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Manage
            </button>
            {isNative && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        
        {/* Search Input */}
        {friends.length > 0 && (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={friendSearchQuery}
              onChange={(e) => setFriendSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loadingFriends ? (
          <div className="px-4 py-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredFriends.length > 0 ? (
          <>
            {friendSearchQuery && filteredFriends.length !== friends.length && (
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                {filteredFriends.length} of {friends.length} friends
              </div>
            )}
            {filteredFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => onFriendClick(friend)}
                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 text-left"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3 relative">
                    {friend.friend.profile_photo_url ? (
                      <img 
                        src={friend.friend.profile_photo_url} 
                        alt="" 
                        className="w-8 h-8 rounded-full object-cover" 
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {(friend.friend.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                    {/* Unread message indicator */}
                    {(friend.unreadCount || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white font-medium">
                        {friend.unreadCount! > 9 ? '9+' : friend.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      (friend.unreadCount || 0) > 0 
                        ? 'font-bold text-gray-900 dark:text-white' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {friend.friend.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <span className="mr-1">{getRoleIcon(friend.role)}</span>
                      {getRoleLabel(friend.role)}
                      {(friend.unreadCount || 0) > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                          {friend.unreadCount} new message{friend.unreadCount! > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </>
        ) : friends.length > 0 ? (
          <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No friends found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No friends added yet</p>
            <button
              onClick={onManageFriends}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Add friends
            </button>
          </div>
        )}
      </div>
      
      {isNative && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default FriendsListModal;