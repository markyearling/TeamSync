import React, { ReactNode, useState, useEffect } from 'react';
import { Bell, User, Search, Moon, Sun, LogOut, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationCenter from '../notifications/NotificationCenter';
import ChatModal from '../chat/ChatModal';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  children?: ReactNode;
}

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
}

const Header: React.FC<HeaderProps> = ({ children }) => {
  const { user } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const navigate = useNavigate();
  
  const toggleNotifications = () => setNotificationsOpen(!notificationsOpen);
  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);
  const toggleFriends = () => {
    setFriendsOpen(!friendsOpen);
    if (!friendsOpen && friends.length === 0) {
      fetchFriends();
    }
    // Reset search when opening/closing
    if (!friendsOpen) {
      setFriendSearchQuery('');
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    
    // Set up real-time subscription for notifications count
    const notificationsSubscription = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          fetchNotificationCount();
        }
      )
      .subscribe();

    return () => {
      notificationsSubscription.unsubscribe();
    };
  }, []);

  // Filter friends based on search query
  useEffect(() => {
    if (!friendSearchQuery.trim()) {
      setFilteredFriends(friends);
    } else {
      const query = friendSearchQuery.toLowerCase();
      const filtered = friends.filter(friend => 
        (friend.friend.full_name || '').toLowerCase().includes(query)
      );
      setFilteredFriends(filtered);
    }
  }, [friends, friendSearchQuery]);

  const fetchNotificationCount = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // Count unread notifications
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (!countError) {
        setNotificationCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      setLoadingFriends(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('friendships')
        .select('id, friend_id, role, created_at')
        .eq('user_id', user.id);

      if (friendsError) throw friendsError;

      // Get user details for friends from user_settings table
      const friendIds = friendsData?.map(f => f.friend_id) || [];
      let friendUsers: any[] = [];
      
      if (friendIds.length > 0) {
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', friendIds);

        if (settingsError) throw settingsError;

        friendUsers = friendIds.map(friendId => {
          const settings = userSettings?.find(s => s.user_id === friendId);
          
          return {
            id: friendId,
            full_name: settings?.full_name || 'No name set',
            profile_photo_url: settings?.profile_photo_url
          };
        });
      }

      // Transform friends data and sort alphabetically
      const transformedFriends = friendsData?.map(friendship => ({
        ...friendship,
        friend: friendUsers.find(u => u.id === friendship.friend_id) || {
          id: friendship.friend_id,
          full_name: 'No name set',
          profile_photo_url: undefined
        }
      })) || [];

      // Sort friends alphabetically by name
      transformedFriends.sort((a, b) => {
        const nameA = a.friend.full_name || 'No name set';
        const nameB = b.friend.full_name || 'No name set';
        return nameA.localeCompare(nameB);
      });

      setFriends(transformedFriends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth/signin');
  };

  const handleFriendClick = (friend: Friend) => {
    setSelectedFriend(friend);
    setFriendsOpen(false);
    setFriendSearchQuery(''); // Reset search when opening chat
  };

  const getRoleIcon = (role: string) => {
    return role === 'administrator' ? '👑' : role === 'viewer' ? '👁️' : '💬';
  };

  const getRoleLabel = (role: string) => {
    return role === 'administrator' ? 'Admin' : role === 'viewer' ? 'Viewer' : 'Friend';
  };

  return (
    <>
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

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-full bg-white dark:bg-gray-700 p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={toggleNotifications}
                >
                  <span className="sr-only">View notifications</span>
                  <Bell className="h-6 w-6" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>
                
                {notificationsOpen && (
                  <NotificationCenter onClose={() => setNotificationsOpen(false)} />
                )}
              </div>

              {/* Friends Dropdown - Removed number badge */}
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-full bg-white dark:bg-gray-700 p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={toggleFriends}
                >
                  <span className="sr-only">View friends</span>
                  <Users className="h-6 w-6" />
                </button>
                
                {friendsOpen && (
                  <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Friends ({friends.length})</h3>
                        <button
                          onClick={() => {
                            setFriendsOpen(false);
                            navigate('/settings');
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Manage
                        </button>
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
                    
                    <div className="max-h-64 overflow-y-auto">
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
                              onClick={() => handleFriendClick(friend)}
                              className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 text-left"
                            >
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3">
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
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {friend.friend.full_name || 'No name set'}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                    <span className="mr-1">{getRoleIcon(friend.role)}</span>
                                    {getRoleLabel(friend.role)}
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
                            onClick={() => {
                              setFriendsOpen(false);
                              navigate('/settings');
                            }}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Add friends
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
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

      {/* Chat Modal */}
      {selectedFriend && (
        <ChatModal 
          friend={selectedFriend} 
          onClose={() => setSelectedFriend(null)} 
        />
      )}
    </>
  );
};

export default Header;