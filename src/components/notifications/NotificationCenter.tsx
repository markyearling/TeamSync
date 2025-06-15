import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  UserPlus, 
  Calendar, 
  MessageSquare,
  Clock,
  Trash2,
  MarkAsRead
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  type: 'friend_request' | 'schedule_change' | 'new_event' | 'message';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any; // Additional data for the notification
}

interface NotificationCenterProps {
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription for friend requests
    const friendRequestsSubscription = supabase
      .channel('friend-requests-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests'
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    // Set up real-time subscription for events
    const eventsSubscription = supabase
      .channel('events-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events'
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      friendRequestsSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      const notifications: Notification[] = [];

      // Fetch friend requests (incoming)
      const { data: friendRequests, error: friendRequestsError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          requester_id,
          message,
          created_at,
          user_settings!friend_requests_requester_id_fkey(full_name, profile_photo_url)
        `)
        .eq('requested_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (friendRequestsError) {
        console.error('Error fetching friend requests:', friendRequestsError);
      } else if (friendRequests) {
        friendRequests.forEach(request => {
          const requesterName = request.user_settings?.full_name || 'Someone';
          notifications.push({
            id: `friend_request_${request.id}`,
            type: 'friend_request',
            title: 'New Friend Request',
            message: `${requesterName} wants to be your friend${request.message ? `: "${request.message}"` : ''}`,
            read: false,
            created_at: request.created_at,
            data: {
              friend_request_id: request.id,
              requester_id: request.requester_id,
              requester_name: requesterName,
              requester_photo: request.user_settings?.profile_photo_url
            }
          });
        });
      }

      // Fetch recent events (created in last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id);

      if (!profilesError && profiles) {
        const profileIds = profiles.map(p => p.id);

        const { data: recentEvents, error: eventsError } = await supabase
          .from('events')
          .select(`
            id,
            title,
            start_time,
            created_at,
            updated_at,
            platform,
            profiles!inner(name)
          `)
          .in('profile_id', profileIds)
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false });

        if (!eventsError && recentEvents) {
          recentEvents.forEach(event => {
            const isNew = new Date(event.created_at) > new Date(event.updated_at);
            notifications.push({
              id: `event_${event.id}`,
              type: isNew ? 'new_event' : 'schedule_change',
              title: isNew ? 'New Event Added' : 'Schedule Updated',
              message: `${event.title} for ${event.profiles.name}`,
              read: false,
              created_at: event.created_at,
              data: {
                event_id: event.id,
                child_name: event.profiles.name,
                event_title: event.title,
                start_time: event.start_time
              }
            });
          });
        }
      }

      // Sort notifications by creation date
      notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(notifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleFriendRequestAction = async (notificationId: string, action: 'accept' | 'decline') => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification || notification.type !== 'friend_request') return;

      const friendRequestId = notification.data.friend_request_id;

      // Update the friend request status
      const { data: requestData, error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', friendRequestId)
        .select()
        .single();

      if (updateError) throw updateError;

      if (action === 'accept') {
        // Create friendship records for both users
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const { error: friendshipError } = await supabase
          .from('friendships')
          .insert([
            {
              user_id: user.id,
              friend_id: requestData.requester_id,
              role: requestData.role
            },
            {
              user_id: requestData.requester_id,
              friend_id: user.id,
              role: 'viewer' // The requester gets viewer access by default
            }
          ]);

        if (friendshipError) throw friendshipError;
      }

      // Remove the notification from the list
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error handling friend request:', err);
      setError('Failed to process friend request');
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 'new_event':
        return <Calendar className="h-5 w-5 text-green-500" />;
      case 'schedule_change':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="absolute right-0 mt-2 w-96 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {notifications.length > 0 && (
            <>
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                title="Mark all as read"
              >
                <MarkAsRead className="h-4 w-4" />
              </button>
              <button
                onClick={clearAllNotifications}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
                !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {getTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Friend request actions */}
                  {notification.type === 'friend_request' && (
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => handleFriendRequestAction(notification.id, 'accept')}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleFriendRequestAction(notification.id, 'decline')}
                        className="flex-1 px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
            <p className="text-xs mt-1">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;