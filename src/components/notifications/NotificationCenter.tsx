import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, UserPlus, Calendar, MessageSquare, Clock, Trash2, BookMarked as MarkAsRead } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'schedule_change' | 'new_event' | 'message';
  title: string;
  message: string;
  read: boolean;
  data: any;
  created_at: string;
  updated_at: string;
}

interface NotificationCenterProps {
  onClose: () => void;
  onOpenChat?: (friendId: string, friendInfo: any) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose, onOpenChat }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Clean up previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Set up real-time subscription for notifications (excluding messages)
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        console.log('Setting up notifications subscription for user:', user.id);
        
        subscriptionRef.current = supabase
          .channel(`notifications:user_id=eq.${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Notification change received:', payload);
              
              // Only handle non-message notifications
              if (payload.new && payload.new.type !== 'message') {
                if (payload.eventType === 'INSERT') {
                  // Add new notification to the top of the list
                  const newNotification = payload.new as Notification;
                  setNotifications(prev => [newNotification, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                  // Update existing notification
                  const updatedNotification = payload.new as Notification;
                  setNotifications(prev => 
                    prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                  );
                }
              } else if (payload.eventType === 'DELETE') {
                // Remove deleted notification
                const deletedId = payload.old.id;
                setNotifications(prev => prev.filter(n => n.id !== deletedId));
              }
            }
          )
          .subscribe((status) => {
            console.log('Notifications subscription status:', status);
          });
      }
    };

    setupSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      // Fetch notifications excluding message notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'message') // Exclude message notifications
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      setNotifications(notificationsData || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle different notification types (excluding messages since they're not shown here)
    // Message handling is removed since messages are not displayed in this component
  };

  const handleFriendRequestAction = async (notification: Notification, action: 'accept' | 'decline') => {
    try {
      if (notification.type !== 'friend_request') return;

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
              role: 'none' // Default role for the friend
            },
            {
              user_id: requestData.requester_id,
              friend_id: user.id,
              role: 'none' // Default role for the requester
            }
          ]);

        if (friendshipError) throw friendshipError;
      }

      // Delete the notification after processing
      await deleteNotification(notification.id);
    } catch (err) {
      console.error('Error handling friend request:', err);
      setError('Failed to process friend request');
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .neq('type', 'message'); // Only mark non-message notifications as read

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .neq('type', 'message'); // Only clear non-message notifications

      if (error) throw error;

      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 'new_event':
        return <Calendar className="h-5 w-5 text-green-500" />;
      case 'schedule_change':
        return <Clock className="h-5 w-5 text-orange-500" />;
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
              className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 cursor-pointer ${
                !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
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
                        <div className="w-2 h-2 bg-blue-500 rounded-full" title="Unread"></div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFriendRequestAction(notification, 'accept');
                        }}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFriendRequestAction(notification, 'decline');
                        }}
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