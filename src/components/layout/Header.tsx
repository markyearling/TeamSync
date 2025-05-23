import React, { ReactNode, useState, useEffect } from 'react';
import { Bell, User, Search, Moon, Sun, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  children?: ReactNode;
}

const Header: React.FC<HeaderProps> = ({ children }) => {
  const { user } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();
  
  const toggleNotifications = () => setNotificationsOpen(!notificationsOpen);
  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Get user's profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        if (!profiles?.length) return;

        const profileIds = profiles.map(p => p.id);

        // Get events that were created or updated in the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: recentEvents } = await supabase
          .from('events')
          .select('*')
          .in('profile_id', profileIds)
          .or(`created_at.gt.${yesterday.toISOString()},updated_at.gt.${yesterday.toISOString()}`);

        if (recentEvents) {
          const newNotifications = recentEvents.map(event => ({
            id: event.id,
            title: event.title,
            type: event.created_at > event.updated_at ? 'new_event' : 'schedule_change',
            time: new Date(event.created_at > event.updated_at ? event.created_at : event.updated_at),
            read: false
          }));

          setNotifications(newNotifications);
          setNotificationCount(newNotifications.length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();

    // Subscribe to realtime changes
    const eventsSubscription = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          fetchNotifications(); // Refresh notifications when events change
        }
      )
      .subscribe();

    return () => {
      eventsSubscription.unsubscribe();
    };
  }, []);

  const handleClearAllNotifications = () => {
    setNotifications([]);
    setNotificationCount(0);
    setNotificationsOpen(false);
  };

  const handleClearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setNotificationCount(prev => prev - 1);
    if (notificationCount === 1) {
      setNotificationsOpen(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth/signin');
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            {children}
            <div className="ml-4 md:ml-6">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">TeamSync</h1>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="relative mx-4 w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search events..."
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-10 pr-3 text-sm placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="relative rounded-full p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {theme === 'dark' ? (
                <Sun className="h-6 w-6" />
              ) : (
                <Moon className="h-6 w-6" />
              )}
            </button>

            {notificationCount > 0 && (
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-full bg-white dark:bg-gray-700 p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={toggleNotifications}
                >
                  <span className="sr-only">View notifications</span>
                  <Bell className="h-6 w-6" />
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {notificationCount}
                  </span>
                </button>
                {notificationsOpen && (
                  <NotificationDropdown 
                    notifications={notifications} 
                    onClose={() => setNotificationsOpen(false)}
                    onClearAll={handleClearAllNotifications}
                    onClearOne={handleClearNotification}
                  />
                )}
              </div>
            )}
            
            <div className="relative">
              <button
                type="button"
                className="flex rounded-full bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={toggleUserMenu}
              >
                <span className="sr-only">Open user menu</span>
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <User className="h-5 w-5" />
                </div>
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <a href="/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">Settings</a>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;