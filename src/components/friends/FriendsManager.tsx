import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  Search, 
  Mail, 
  Shield, 
  Eye,
  Trash2,
  Clock,
  AlertCircle,
  Edit2,
  Save,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProfiles } from '../../context/ProfilesContext';

interface User {
  id: string;
  email: string;
  full_name?: string;
  profile_photo_url?: string;
}

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  role: 'none' | 'viewer' | 'administrator';
  created_at: string;
  friend: User;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  requested_id: string;
  status: 'pending' | 'accepted' | 'declined';
  role: 'none' | 'viewer' | 'administrator';
  message?: string;
  created_at: string;
  requester?: User;
  requested?: User;
}

const FriendsManager: React.FC = () => {
  const { fetchAllProfiles } = useProfiles();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchDebugInfo, setSearchDebugInfo] = useState<string>('');
  const [editingFriend, setEditingFriend] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'none' | 'viewer' | 'administrator'>('none');

  const searchUsers = useCallback(async () => {
    if (!searchEmail.trim() || searchEmail.trim().length < 2) {
      setSearchResults([]);
      setSearchDebugInfo('');
      return;
    }

    setSearching(true);
    setError(null);
    setSearchDebugInfo('');

    try {
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }

      const searchTerm = searchEmail.trim();
      console.log('🔍 STARTING SEARCH');
      console.log('Search term:', searchTerm);
      console.log('Current user ID:', currentUserId);

      // Search for users by looking in user_settings table where we can match name patterns
      // Search by full_name only since we can't access auth.users table
      const { data: userSettings, error: settingsError } = await supabase
        .from('user_settings')
        .select('user_id, full_name, profile_photo_url')
        .ilike('full_name', `%${searchTerm}%`)
        .limit(10);

      console.log('📊 DATABASE RESPONSE');
      console.log('Error:', settingsError);
      console.log('Data:', userSettings);
      console.log('Data length:', userSettings?.length || 0);

      if (settingsError) {
        console.error('❌ Search error:', settingsError);
        setSearchDebugInfo(`Database error: ${settingsError.message}`);
        throw settingsError;
      }

      if (!userSettings) {
        console.log('❌ No data returned from database');
        setSearchDebugInfo('No data returned from database');
        setSearchResults([]);
        return;
      }

      if (userSettings.length === 0) {
        console.log('❌ Empty results from database');
        setSearchDebugInfo(`No users found in database with name containing "${searchTerm}"`);
        setSearchResults([]);
        return;
      }

      console.log('✅ Found users in database:', userSettings.length);
      setSearchDebugInfo(`Found ${userSettings.length} users in database`);

      // Get current user's existing connections to filter them out
      const existingFriendIds = friends.map(f => f.friend_id);
      const pendingIncomingIds = incomingRequests.map(r => r.requester_id);
      const pendingOutgoingIds = outgoingRequests.map(r => r.requested_id);
      
      console.log('🔍 FILTERING LOGIC');
      console.log('Existing friend IDs:', existingFriendIds);
      console.log('Pending incoming request IDs:', pendingIncomingIds);
      console.log('Pending outgoing request IDs:', pendingOutgoingIds);

      // Filter out existing friends and pending requests, but keep current user for now to see if they appear
      const filteredUsers = userSettings.filter(u => {
        const isCurrentUser = u.user_id === currentUserId;
        const isExistingFriend = existingFriendIds.includes(u.user_id);
        const hasPendingIncoming = pendingIncomingIds.includes(u.user_id);
        const hasPendingOutgoing = pendingOutgoingIds.includes(u.user_id);
        
        console.log(`--- Checking user: ${u.full_name} (${u.user_id}) ---`);
        console.log(`  Is current user: ${isCurrentUser}`);
        console.log(`  Is existing friend: ${isExistingFriend}`);
        console.log(`  Has pending incoming: ${hasPendingIncoming}`);
        console.log(`  Has pending outgoing: ${hasPendingOutgoing}`);
        
        // Only exclude current user, existing friends, and pending requests
        const shouldInclude = !isCurrentUser && !isExistingFriend && !hasPendingIncoming && !hasPendingOutgoing;
        console.log(`  ✅ Should include: ${shouldInclude}`);
        
        return shouldInclude;
      });

      console.log('🎯 FINAL FILTERING RESULTS');
      console.log('Filtered users count:', filteredUsers.length);
      console.log('Filtered users:', filteredUsers);

      // Transform users for display
      const transformedUsers = filteredUsers.map((settings) => ({
        id: settings.user_id,
        email: 'Search by name only', // Can't get email from auth.users
        full_name: settings.full_name,
        profile_photo_url: settings.profile_photo_url
      }));

      console.log('📋 FINAL RESULTS FOR UI');
      console.log('Transformed users:', transformedUsers);
      console.log('Setting search results...');

      setSearchResults(transformedUsers);

      // Update debug info
      if (transformedUsers.length > 0) {
        setSearchDebugInfo(`✅ Found ${transformedUsers.length} available user(s) for "${searchTerm}"`);
        console.log(`✅ SUCCESS: Found ${transformedUsers.length} user(s) matching "${searchTerm}"`);
      } else {
        setSearchDebugInfo(`❌ No available users found for "${searchTerm}" after filtering (found ${userSettings.length} in database but all were filtered out)`);
        console.log(`❌ NO RESULTS: Found ${userSettings.length} users in database but all were filtered out`);
      }

    } catch (err) {
      console.error('💥 Error searching users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to search users: ${errorMessage}`);
      setSearchDebugInfo(`Error: ${errorMessage}`);
    } finally {
      setSearching(false);
      console.log('🏁 SEARCH COMPLETE');
    }
  }, [searchEmail, currentUserId, friends, incomingRequests, outgoingRequests]);

  useEffect(() => {
    fetchFriendsData();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchEmail.trim().length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
        setSearchDebugInfo('');
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchEmail, searchUsers]);

  const fetchFriendsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

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
            email: 'Email not available', // We can't get email without admin access
            full_name: settings?.full_name,
            profile_photo_url: settings?.profile_photo_url
          };
        });
      }

      // Transform friends data
      const transformedFriends = friendsData?.map(friendship => ({
        ...friendship,
        friend: friendUsers.find(u => u.id === friendship.friend_id) || {
          id: friendship.friend_id,
          email: 'Email not available',
          full_name: undefined,
          profile_photo_url: undefined
        }
      })) || [];

      setFriends(transformedFriends);

      // Fetch incoming friend requests
      const { data: incomingData, error: incomingError } = await supabase
        .from('friend_requests')
        .select('id, requester_id, requested_id, status, role, message, created_at')
        .eq('requested_id', user.id)
        .eq('status', 'pending');

      if (incomingError) throw incomingError;

      // Get user details for incoming requests
      const requesterIds = incomingData?.map(r => r.requester_id) || [];
      let requesterUsers: any[] = [];

      if (requesterIds.length > 0) {
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', requesterIds);

        if (settingsError) throw settingsError;

        requesterUsers = requesterIds.map(requesterId => {
          const settings = userSettings?.find(s => s.user_id === requesterId);
          
          return {
            id: requesterId,
            email: 'Email not available',
            full_name: settings?.full_name,
            profile_photo_url: settings?.profile_photo_url
          };
        });
      }

      const transformedIncoming = incomingData?.map(request => ({
        ...request,
        requester: requesterUsers.find(u => u.id === request.requester_id)
      })) || [];

      setIncomingRequests(transformedIncoming);

      // Fetch outgoing friend requests
      const { data: outgoingData, error: outgoingError } = await supabase
        .from('friend_requests')
        .select('id, requester_id, requested_id, status, role, message, created_at')
        .eq('requester_id', user.id)
        .eq('status', 'pending');

      if (outgoingError) throw outgoingError;

      // Get user details for outgoing requests
      const requestedIds = outgoingData?.map(r => r.requested_id) || [];
      let requestedUsers: any[] = [];

      if (requestedIds.length > 0) {
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', requestedIds);

        if (settingsError) throw settingsError;

        requestedUsers = requestedIds.map(requestedId => {
          const settings = userSettings?.find(s => s.user_id === requestedId);
          
          return {
            id: requestedId,
            email: 'Email not available',
            full_name: settings?.full_name,
            profile_photo_url: settings?.profile_photo_url
          };
        });
      }

      const transformedOutgoing = outgoingData?.map(request => ({
        ...request,
        requested: requestedUsers.find(u => u.id === request.requested_id)
      })) || [];

      setOutgoingRequests(transformedOutgoing);

    } catch (err) {
      console.error('Error fetching friends data:', err);
      setError('Failed to load friends data');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if a request already exists before attempting to insert
      let existingRequest = null;
      try {
        const { data, error: checkError } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('requester_id', user.id)
          .eq('requested_id', userId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 means no rows found, which is expected when no duplicate exists
          throw checkError;
        }

        existingRequest = data;
      } catch (innerError: any) {
        // Only re-throw if it's not the expected "no rows found" error
        if (innerError.code !== 'PGRST116') {
          throw innerError;
        }
        // PGRST116 means no existing request found, which is what we want
      }

      if (existingRequest) {
        setError('Friend request already exists');
        return;
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          requester_id: user.id,
          requested_id: userId,
          role: 'none', // Default to none - basic friendship
          message: requestMessage.trim() || null
        });

      if (error) throw error;

      setSuccess('Friend request sent successfully!');
      setSearchResults([]);
      setSearchEmail('');
      setRequestMessage('');
      setSearchDebugInfo('');
      fetchFriendsData();
    } catch (err) {
      console.error('Error sending friend request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('duplicate key value violates unique constraint')) {
        setError('Friend request already exists');
      } else {
        setError('Failed to send friend request');
      }
    }
  };

  const respondToRequest = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update the friend request status
      const { data: requestData, error: updateError } = await supabase
        .from('friend_requests')
        .update({ status })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) throw updateError;

      if (status === 'accepted') {
        // Create friendship records for both users with 'none' role (basic friendship)
        const { error: friendshipError } = await supabase
          .from('friendships')
          .insert([
            {
              user_id: requestData.requested_id,
              friend_id: requestData.requester_id,
              role: 'none' // Default role for the friend
            },
            {
              user_id: requestData.requester_id,
              friend_id: requestData.requested_id,
              role: 'none' // Default role for the requester
            }
          ]);

        if (friendshipError) throw friendshipError;
        setSuccess('Friend request accepted!');
        
        // Refresh profiles to update the UI with any new friend profiles
        await fetchAllProfiles();
      } else {
        setSuccess('Friend request declined');
      }

      fetchFriendsData();
    } catch (err) {
      console.error('Error responding to friend request:', err);
      setError('Failed to respond to friend request');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the friendship to find the reciprocal one
      const { data: friendship, error: fetchError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('id', friendshipId)
        .single();

      if (fetchError) throw fetchError;

      // Remove both friendship records
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendship.friend_id}),and(user_id.eq.${friendship.friend_id},friend_id.eq.${user.id})`);

      if (deleteError) throw deleteError;

      setSuccess('Friend removed successfully');
      fetchFriendsData();
      
      // Refresh profiles to update the UI with any removed friend profiles
      await fetchAllProfiles();
    } catch (err) {
      console.error('Error removing friend:', err);
      setError('Failed to remove friend');
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      setError(null);
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      setSuccess('Friend request cancelled');
      fetchFriendsData();
    } catch (err) {
      console.error('Error cancelling request:', err);
      setError('Failed to cancel request');
    }
  };

  const updateFriendRole = async (friendshipId: string, newRole: 'none' | 'viewer' | 'administrator') => {
    try {
      setError(null);
      const { error } = await supabase
        .from('friendships')
        .update({ role: newRole })
        .eq('id', friendshipId);

      if (error) throw error;

      setSuccess(`Friend access level updated to ${getRoleLabel(newRole)}`);
      setEditingFriend(null);
      fetchFriendsData();
      
      // Refresh profiles to update the UI with any new friend profiles that now have administrator access
      await fetchAllProfiles();
    } catch (err) {
      console.error('Error updating friend role:', err);
      setError('Failed to update friend access level');
    }
  };

  const startEditingRole = (friendshipId: string, currentRole: 'none' | 'viewer' | 'administrator') => {
    setEditingFriend(friendshipId);
    setEditingRole(currentRole);
  };

  const cancelEditingRole = () => {
    setEditingFriend(null);
    setEditingRole('none');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'administrator':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'none':
      default:
        return <MessageCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'Administrator';
      case 'viewer':
        return 'Viewer';
      case 'none':
      default:
        return 'Friend';
    }
  };

  const getAccessLevelDescription = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'Can view and manage all schedules, events, and profiles';
      case 'viewer':
        return 'Can view schedules and events in dashboard and calendar';
      case 'none':
      default:
        return 'Can chat and send messages only';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700 flex items-center">
          <Check className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      {/* Add Friend Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Friend
        </h4>
        
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Start typing a user's name..."
              className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
            />
            {searching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Debug Information */}
          {searchDebugInfo && (
            <div className="text-xs p-2 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded">
              <strong>Debug:</strong> {searchDebugInfo}
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Search results will appear as you type (minimum 2 characters). Search is by user name only.
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div>
                <input
                  type="text"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Optional message with your friend request"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                />
              </div>

              <div className="bg-white dark:bg-gray-600 rounded-md border border-gray-200 dark:border-gray-500 max-h-60 overflow-y-auto">
                <div className="p-2 bg-green-50 dark:bg-green-900/50 border-b border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-700 dark:text-green-300">
                    ✅ Found {searchResults.length} user(s) matching "{searchEmail.trim()}"
                  </p>
                </div>
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-500 last:border-b-0">
                    <div className="flex items-center flex-1">
                      <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3">
                        {user.profile_photo_url ? (
                          <img src={user.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {(user.full_name || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.full_name || 'No name set'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => sendFriendRequest(user.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Send Request
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchEmail.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-600 rounded-md border border-gray-200 dark:border-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No available users found for "{searchEmail.trim()}"</p>
              <p className="text-xs">They may already be your friend, have a pending request, or don't exist</p>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Friend Requests */}
      {incomingRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <Mail className="h-4 w-4 mr-2" />
            Incoming Requests ({incomingRequests.length})
          </h4>
          <div className="space-y-2">
            {incomingRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-center flex-1">
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3">
                    {request.requester?.profile_photo_url ? (
                      <img src={request.requester.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {(request.requester?.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {request.requester?.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{request.requester?.email || `ID: ${request.requester_id.slice(0, 8)}...`}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Wants to be your friend
                    </div>
                    {request.message && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic bg-white dark:bg-gray-700 p-2 rounded">
                        "{request.message}"
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => respondToRequest(request.id, 'accepted')}
                    className="p-1 text-green-600 hover:text-green-700"
                    title="Accept"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => respondToRequest(request.id, 'declined')}
                    className="p-1 text-red-600 hover:text-red-700"
                    title="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Friend Requests */}
      {outgoingRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Pending Requests ({outgoingRequests.length})
          </h4>
          <div className="space-y-2">
            {outgoingRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/50 rounded-md border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center flex-1">
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3">
                    {request.requested?.profile_photo_url ? (
                      <img src={request.requested.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {(request.requested?.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {request.requested?.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{request.requested?.email || `ID: ${request.requested_id.slice(0, 8)}...`}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Friend request sent
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => cancelRequest(request.id)}
                  className="p-1 text-red-600 hover:text-red-700"
                  title="Cancel request"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List with Access Level Management */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
          <Users className="h-4 w-4 mr-2" />
          Friends ({friends.length})
        </h4>
        {friends.length > 0 ? (
          <div className="space-y-2">
            {friends.map(friend => (
              <div key={friend.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                <div className="flex items-center flex-1">
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3">
                    {friend.friend.profile_photo_url ? (
                      <img src={friend.friend.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {(friend.friend.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {friend.friend.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{friend.friend.email || `ID: ${friend.friend_id.slice(0, 8)}...`}</div>
                    
                    {/* Access Level Management */}
                    {editingFriend === friend.id ? (
                      <div className="mt-2 flex items-center space-x-2">
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value as 'none' | 'viewer' | 'administrator')}
                          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-600 dark:text-white"
                        >
                          <option value="none">Friend (Chat only)</option>
                          <option value="viewer">Viewer (View schedules)</option>
                          <option value="administrator">Administrator (Full access)</option>
                        </select>
                        <button
                          onClick={() => updateFriendRole(friend.id, editingRole)}
                          className="p-1 text-green-600 hover:text-green-700"
                          title="Save"
                        >
                          <Save className="h-3 w-3" />
                        </button>
                        <button
                          onClick={cancelEditingRole}
                          className="p-1 text-gray-400 hover:text-gray-500"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center">
                          {getRoleIcon(friend.role)}
                          <div className="ml-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {getRoleLabel(friend.role)}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {getAccessLevelDescription(friend.role)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => startEditingRole(friend.id, friend.role)}
                          className="p-1 text-gray-400 hover:text-blue-500"
                          title="Edit access level"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFriend(friend.id)}
                  className="p-1 text-red-600 hover:text-red-700"
                  title="Remove friend"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No friends added yet</p>
            <p className="text-xs">Search for users by name to send friend requests</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsManager;