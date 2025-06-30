import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Bell, User, Search, Moon, Sun, LogOut, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationCenter from '../notifications/NotificationCenter';
import ChatModal from '../chat/ChatModal';
import { supabase } from '../../lib/supabase';
import EventModal from '../events/EventModal';
import { Event } from '../../types';

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
  unreadCount?: number;
  lastMessageAt?: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
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
    
    // Set up real-time subscription for notifications count (excluding messages)
    const setupNotificationSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const notificationsSubscription = supabase
          .channel(`header-notifications:user_id=eq.${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`
            },
            () => {
              fetchNotificationCount();
            }
          )
          .subscribe();

        return () => {
          notificationsSubscription.unsubscribe();
        };
      }
    };

    setupNotificationSubscription();
  }, []);

  useEffect(() => {
    // Set up real-time subscription for messages to update unread counts
    const setupMessageSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const messagesSubscription = supabase
          .channel(`header-messages:user_id=eq.${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages'
            },
            () => {
              // Refresh friends list to update unread counts
              if (friends.length > 0) {
                fetchFriends();
              }
            }
          )
          .subscribe();

        return () => {
          messagesSubscription.unsubscribe();
        };
      }
    };

    setupMessageSubscription();
  }, [friends.length]);

  // Filter friends based on search query and sort by unread messages
  useEffect(() => {
    if (!friendSearchQuery.trim()) {
      // Sort friends: unread messages first, then by most recent message, then alphabetically
      const sorted = [...friends].sort((a, b) => {
        // First, sort by unread count (descending)
        if ((a.unreadCount || 0) !== (b.unreadCount || 0)) {
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        }
        
        // Then by last message time (most recent first)
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        
        // Finally alphabetically
        const nameA = a.friend.full_name || 'No name set';
        const nameB = b.friend.full_name || 'No name set';
        return nameA.localeCompare(nameB);
      });
      
      setFilteredFriends(sorted);
    } else {
      const query = friendSearchQuery.toLowerCase();
      const filtered = friends.filter(friend => 
        (friend.friend.full_name || '').toLowerCase().includes(query)
      );
      
      // Apply same sorting to filtered results
      const sorted = filtered.sort((a, b) => {
        if ((a.unreadCount || 0) !== (b.unreadCount || 0)) {
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        }
        
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }
        
        const nameA = a.friend.full_name || 'No name set';
        const nameB = b.friend.full_name || 'No name set';
        return nameA.localeCompare(nameB);
      });
      
      setFilteredFriends(sorted);
    }
  }, [friends, friendSearchQuery]);

  // Handle clicks outside of search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search events when query changes
  useEffect(() => {
    const searchEvents = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get all profiles the user has access to (own profiles and friends' profiles with viewer/admin access)
        const { data: ownProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id);

        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, user_id')
          .neq('user_id', user.id);

        // Filter friend profiles to only those the user has access to
        const accessibleFriendProfiles = await Promise.all(
          (friendProfiles || []).map(async (profile) => {
            const { data: friendship } = await supabase
              .from('friendships')
              .select('role')
              .eq('friend_id', user.id)
              .eq('user_id', profile.user_id)
              .in('role', ['viewer', 'administrator'])
              .maybeSingle();

            return friendship ? profile : null;
          })
        );

        const allAccessibleProfiles = [
          ...(ownProfiles || []),
          ...accessibleFriendProfiles.filter(Boolean)
        ];

        const profileIds = allAccessibleProfiles.map(p => p?.id).filter(Boolean);

        // Search events by title, description, or location
        const { data: eventData, error } = await supabase
          .from('events')
          .select(`
            *,
            profiles:profile_id (
              id,
              name,
              color,
              user_id
            )
          `)
          .in('profile_id', profileIds)
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)
          .order('start_time', { ascending: true })
          .limit(10);

        if (error) throw error;

        // Format events for display
        const formattedEvents = eventData.map(event => {
          const isOwnEvent = ownProfiles?.some(p => p.id === event.profile_id) || false;
          
          return {
            ...event,
            id: event.id,
            title: event.title,
            description: event.description || '',
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            location: event.location || '',
            sport: event.sport,
            color: event.color,
            platform: event.platform,
            platformColor: event.platform_color,
            platformIcon: () => null, // This will be replaced with the actual icon component
            child: {
              id: event.profiles.id,
              name: event.profiles.name,
              color: event.profiles.color,
              user_id: event.profiles.user_id,
              sports: [],
              eventCount: 0
            },
            isOwnEvent,
            isToday: new Date(event.start_time).toDateString() === new Date().toDateString()
          };
        });

        setSearchResults(formattedEvents);
      } catch (error) {
        console.error('Error searching events:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchEvents();
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchNotificationCount = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // Count unread notifications excluding message notifications
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .neq('type', 'message'); // Exclude message notifications

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

      // Get unread message counts for each friend
      const friendsWithUnreadCounts = await Promise.all(
        (friendsData || []).map(async (friendship) => {
          const friend = friendUsers.find(u => u.id === friendship.friend_id) || {
            id: friendship.friend_id,
            full_name: 'No name set',
            profile_photo_url: undefined
          };

          // Get conversation with this friend
          const { data: conversation } = await supabase
            .from('conversations')
            .select('id, last_message_at')
            .or(`and(participant_1_id.eq.${user.id},participant_2_id.eq.${friendship.friend_id}),and(participant_1_id.eq.${friendship.friend_id},participant_2_id.eq.${user.id})`)
            .maybeSingle();

          let unreadCount = 0;
          let lastMessageAt = null;

          if (conversation) {
            // Count unread messages from this friend
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conversation.id)
              .eq('sender_id', friendship.friend_id)
              .eq('read', false);

            unreadCount = count || 0;
            lastMessageAt = conversation.last_message_at;
          }

          return {
            ...friendship,
            friend,
            unreadCount,
            lastMessageAt
          };
        })
      );

      setFriends(friendsWithUnreadCounts);
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
    // Clear unread count for this friend
    setFriends(prevFriends => 
      prevFriends.map(f => 
        f.id === friend.id ? { ...f, unreadCount: 0 } : f
      )
    );
    
    setSelectedFriend(friend);
    setFriendsOpen(false);
    setFriendSearchQuery(''); // Reset search when opening chat
  };

  const handleManageFriends = () => {
    setFriendsOpen(false);
    navigate('/friends');
  };

  const handleOpenChatFromNotification = (friendId: string, friendInfo: any) => {
    setSelectedFriend(friendInfo);
    setNotificationsOpen(false);
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const getRoleIcon = (role: string) => {
    return role === 'administrator' ? '👑' : role === 'viewer' ? '👁️' : '💬';
  };

  const getRoleLabel = (role: string) => {
    return role === 'administrator' ? 'Admin' : role === 'viewer' ? 'Viewer' : 'Friend';
  };

  const formatEventDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              {children}
              <div className="ml-4 md:ml-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">FamSink</h1>
              </div>
            </div>
            
            <div className="hidden md:block relative" ref={searchRef}>
              <div className="relative mx-4 w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-10 pr-3 text-sm placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {isSearching && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent"></div>
                  </div>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                  <div className="py-2 px-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Search Results ({searchResults.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchResults.map(event => (
                      <div 
                        key={event.id}
                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => handleEventSelect(event)}
                      >
                        <div className="flex items-center mb-1">
                          <span 
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: event.color }}
                          ></span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {event.title}
                          </span>
                          {!event.isOwnEvent && (
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                              👥 Friend's
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <span 
                              className="w-2 h-2 rounded-full mr-1"
                              style={{ backgroundColor: event.child.color }}
                            ></span>
                            <span>{event.child.name}</span>
                          </div>
                          <div>
                            {formatEventDate(event.startTime)} • {event.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                        {event.location && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {event.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* No Results Message */}
              {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-700">
                  <div className="p-4 text-center">
                    <Search className="h-6 w-6 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No events found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
                  </div>
                </div>
              )}
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
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white font-medium">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>
                
                {notificationsOpen && (
                  <NotificationCenter 
                    onClose={() => setNotificationsOpen(false)} 
                    onOpenChat={handleOpenChatFromNotification}
                  />
                )}
              </div>

              {/* Friends Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-full bg-white dark:bg-gray-700 p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={toggleFriends}
                >
                  <span className="sr-only">View friends</span>
                  <Users className="h-6 w-6" />
                  {/* Show total unread messages count */}
                  {friends.some(f => (f.unreadCount || 0) > 0) && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white font-medium">
                      {friends.reduce((total, f) => total + (f.unreadCount || 0), 0)}
                    </span>
                  )}
                </button>
                
                {friendsOpen && (
                  <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Friends ({friends.length})</h3>
                        <button
                          onClick={handleManageFriends}
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
                            onClick={handleManageFriends}
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

      {/* Event Modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          mapsLoaded={true}
          mapsLoadError={undefined}
        />
      )}
    </>
  );
};

export default Header;