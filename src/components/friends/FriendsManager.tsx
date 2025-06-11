import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  email: string;
  full_name?: string;
  profile_photo_url?: string;
}

interface Friend {
  id: string;
  friend_id: string;
  role: 'viewer' | 'administrator';
  created_at: string;
  friend: User;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  requested_id: string;
  status: 'pending' | 'accepted' | 'declined';
  role: 'viewer' | 'administrator';
  message?: string;
  created_at: string;
  requester?: User;
  requested?: User;
}

const FriendsManager: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'administrator'>('viewer');
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchFriendsData();
  }, []);

  const fetchFriendsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch friends with user settings
      const { data: friendsData, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          id,
          friend_id,
          role,
          created_at,
          users!friend_id (
            id,
            email,
            user_settings (
              full_name,
              profile_photo_url
            )
          )
        `)
        .eq('user_id', user.id);

      if (friendsError) throw friendsError;

      // Transform the data to flatten user_settings
      const transformedFriends = friendsData?.map(friendship => ({
        ...friendship,
        friend: {
          id: friendship.users.id,
          email: friendship.users.email,
          full_name: friendship.users.user_settings?.[0]?.full_name,
          profile_photo_url: friendship.users.user_settings?.[0]?.profile_photo_url
        }
      })) || [];

      setFriends(transformedFriends);

      // Fetch incoming friend requests
      const { data: incomingData, error: incomingError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          requester_id,
          requested_id,
          status,
          role,
          message,
          created_at,
          users!requester_id (
            id,
            email,
            user_settings (
              full_name,
              profile_photo_url
            )
          )
        `)
        .eq('requested_id', user.id)
        .eq('status', 'pending');

      if (incomingError) throw incomingError;

      const transformedIncoming = incomingData?.map(request => ({
        ...request,
        requester: {
          id: request.users.id,
          email: request.users.email,
          full_name: request.users.user_settings?.[0]?.full_name,
          profile_photo_url: request.users.user_settings?.[0]?.profile_photo_url
        }
      })) || [];

      setIncomingRequests(transformedIncoming);

      // Fetch outgoing friend requests
      const { data: outgoingData, error: outgoingError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          requester_id,
          requested_id,
          status,
          role,
          message,
          created_at,
          users!requested_id (
            id,
            email,
            user_settings (
              full_name,
              profile_photo_url
            )
          )
        `)
        .eq('requester_id', user.id)
        .eq('status', 'pending');

      if (outgoingError) throw outgoingError;

      const transformedOutgoing = outgoingData?.map(request => ({
        ...request,
        requested: {
          id: request.users.id,
          email: request.users.email,
          full_name: request.users.user_settings?.[0]?.full_name,
          profile_photo_url: request.users.user_settings?.[0]?.profile_photo_url
        }
      })) || [];

      setOutgoingRequests(transformedOutgoing);

    } catch (err) {
      console.error('Error fetching friends data:', err);
      setError('Failed to load friends data');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Search for users by email (excluding current user and existing friends)
      const existingFriendIds = friends.map(f => f.friend_id);
      const pendingRequestIds = [
        ...incomingRequests.map(r => r.requester_id),
        ...outgoingRequests.map(r => r.requested_id)
      ];

      const excludeIds = [user.id, ...existingFriendIds, ...pendingRequestIds].filter(id => id);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          user_settings (
            full_name,
            profile_photo_url
          )
        `)
        .ilike('email', `%${searchEmail.trim()}%`)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(10);

      if (userError) throw userError;

      const transformedUsers = userData?.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.user_settings?.[0]?.full_name,
        profile_photo_url: u.user_settings?.[0]?.profile_photo_url
      })) || [];

      setSearchResults(transformedUsers);

      if (transformedUsers.length === 0) {
        setError('No users found with that email');
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          requester_id: user.id,
          requested_id: userId,
          role: selectedRole,
          message: requestMessage.trim() || null
        });

      if (error) throw error;

      setSuccess('Friend request sent successfully!');
      setSearchResults([]);
      setSearchEmail('');
      setRequestMessage('');
      fetchFriendsData();
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError('Failed to send friend request');
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
        // Create friendship records for both users
        const { error: friendshipError } = await supabase
          .from('friendships')
          .insert([
            {
              user_id: requestData.requested_id,
              friend_id: requestData.requester_id,
              role: requestData.role
            },
            {
              user_id: requestData.requester_id,
              friend_id: requestData.requested_id,
              role: 'viewer' // The requester gets viewer access by default
            }
          ]);

        if (friendshipError) throw friendshipError;
        setSuccess('Friend request accepted!');
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

  const getRoleIcon = (role: string) => {
    return role === 'administrator' ? (
      <Shield className="h-4 w-4 text-orange-500" />
    ) : (
      <Eye className="h-4 w-4 text-blue-500" />
    );
  };

  const getRoleLabel = (role: string) => {
    return role === 'administrator' ? 'Administrator' : 'Viewer';
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
          <div className="flex space-x-2">
            <div className="flex-1">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              />
            </div>
            <button
              onClick={searchUsers}
              disabled={searching || !searchEmail.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
            >
              {searching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex space-x-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'viewer' | 'administrator')}
                  className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="administrator">Administrator</option>
                </select>
                <input
                  type="text"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Optional message"
                  className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                />
              </div>

              {searchResults.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-600 rounded-md border border-gray-200 dark:border-gray-500">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-3">
                      {user.profile_photo_url ? (
                        <img src={user.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
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
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Send Request
                  </button>
                </div>
              ))}
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
                        {(request.requester?.full_name || request.requester?.email || '').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {request.requester?.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{request.requester?.email}</div>
                    <div className="flex items-center mt-1">
                      {getRoleIcon(request.role)}
                      <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                        Requesting {getRoleLabel(request.role)} access
                      </span>
                    </div>
                    {request.message && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
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
                        {(request.requested?.full_name || request.requested?.email || '').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {request.requested?.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{request.requested?.email}</div>
                    <div className="flex items-center mt-1">
                      {getRoleIcon(request.role)}
                      <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                        {getRoleLabel(request.role)} access requested
                      </span>
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

      {/* Friends List */}
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
                        {(friend.friend.full_name || friend.friend.email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {friend.friend.full_name || 'No name set'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{friend.friend.email}</div>
                    <div className="flex items-center mt-1">
                      {getRoleIcon(friend.role)}
                      <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                        {getRoleLabel(friend.role)}
                      </span>
                    </div>
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
            <p className="text-xs">Search for users by email to send friend requests</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsManager;