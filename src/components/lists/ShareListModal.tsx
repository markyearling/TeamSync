import React, { useState, useEffect } from 'react';
import { X, Users, Check, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ModalPortal from '../ModalPortal';
import { useCapacitor } from '../../hooks/useCapacitor';

interface ShareListModalProps {
  listId: string;
  listName: string;
  listColor: string;
  onClose: () => void;
  onShared?: () => void;
}

interface AdministratorFriend {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

interface SharedUser {
  id: string;
  shared_with_user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

const ShareListModal: React.FC<ShareListModalProps> = ({
  listId,
  listName,
  listColor,
  onClose,
  onShared
}) => {
  const { isNative } = useCapacitor();
  const [administrators, setAdministrators] = useState<AdministratorFriend[]>([]);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdministratorsAndShares();
  }, [listId]);

  const fetchAdministratorsAndShares = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: admins, error: adminsError } = await supabase
        .rpc('get_administrator_friends');

      if (adminsError) throw adminsError;

      const { data: shares, error: sharesError } = await supabase
        .from('list_shares')
        .select(`
          id,
          shared_with_user_id,
          user_profiles!list_shares_shared_with_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('list_id', listId);

      if (sharesError) throw sharesError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const enrichedShares = await Promise.all(
        (shares || []).map(async (share: any) => {
          const { data: userData } = await supabase.auth.admin.getUserById(share.shared_with_user_id);
          return {
            id: share.id,
            shared_with_user_id: share.shared_with_user_id,
            email: userData?.user?.email || '',
            full_name: share.user_profiles?.full_name || 'Unknown User',
            avatar_url: share.user_profiles?.avatar_url || null
          };
        })
      );

      setAdministrators(admins || []);
      setSharedUsers(enrichedShares);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleShare = async () => {
    if (selectedUsers.size === 0) {
      setError('Please select at least one user to share with');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const sharesToInsert = Array.from(selectedUsers).map(userId => ({
        list_id: listId,
        owner_id: user.id,
        shared_with_user_id: userId
      }));

      const { error: insertError } = await supabase
        .from('list_shares')
        .insert(sharesToInsert);

      if (insertError) throw insertError;

      setSelectedUsers(new Set());
      await fetchAdministratorsAndShares();

      if (onShared) {
        onShared();
      }
    } catch (err) {
      console.error('Error sharing list:', err);
      setError(err instanceof Error ? err.message : 'Failed to share list');
    } finally {
      setSaving(false);
    }
  };

  const handleUnshare = async (shareId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('list_shares')
        .delete()
        .eq('id', shareId);

      if (deleteError) throw deleteError;

      await fetchAdministratorsAndShares();

      if (onShared) {
        onShared();
      }
    } catch (err) {
      console.error('Error unsharing list:', err);
      setError(err instanceof Error ? err.message : 'Failed to unshare list');
    }
  };

  const containerClasses = isNative
    ? "fixed inset-0 bg-white dark:bg-gray-800 z-50"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  const contentClasses = isNative
    ? "flex flex-col h-full w-full bg-white dark:bg-gray-800 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4";

  const availableAdmins = administrators.filter(
    admin => !sharedUsers.some(shared => shared.shared_with_user_id === admin.user_id)
  );

  return (
    <ModalPortal>
      <div className={containerClasses}>
        <div className={contentClasses}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Share List
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className={`${isNative ? 'flex-1 overflow-y-auto' : 'max-h-[600px] overflow-y-auto'}`}>
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: listColor + '20' }}
                  >
                    <Users className="h-5 w-5" style={{ color: listColor }} />
                  </div>
                  <div className="ml-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">{listName}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Share with administrator friends
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {sharedUsers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Currently Shared With
                      </h4>
                      <div className="space-y-2">
                        {sharedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                          >
                            <div className="flex items-center min-w-0">
                              <div className="flex-shrink-0">
                                {user.avatar_url ? (
                                  <img
                                    src={user.avatar_url}
                                    alt={user.full_name}
                                    className="h-8 w-8 rounded-full"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                      {user.full_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-3 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {user.full_name}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnshare(user.id)}
                              className="ml-2 flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {availableAdmins.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Administrator Friends
                      </h4>
                      <div className="space-y-2">
                        {availableAdmins.map((admin) => (
                          <button
                            key={admin.user_id}
                            onClick={() => handleToggleUser(admin.user_id)}
                            className={`w-full flex items-center p-3 rounded-lg border-2 transition-colors ${
                              selectedUsers.has(admin.user_id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                          >
                            <div className="flex items-center flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {admin.avatar_url ? (
                                  <img
                                    src={admin.avatar_url}
                                    alt={admin.full_name}
                                    className="h-10 w-10 rounded-full"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                      {admin.full_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-3 text-left min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {admin.full_name}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {admin.email}
                                </p>
                              </div>
                            </div>
                            {selectedUsers.has(admin.user_id) && (
                              <div className="flex-shrink-0 ml-2">
                                <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : sharedUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        No administrator friends available to share with.
                      </p>
                      <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
                        Add friends with administrator role to share lists.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        All administrator friends already have access to this list.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {availableAdmins.length > 0 && (
            <div className={`px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3 ${isNative ? 'pb-[env(safe-area-inset-bottom)]' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={saving || selectedUsers.size === 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Share with {selectedUsers.size} {selectedUsers.size === 1 ? 'User' : 'Users'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default ShareListModal;
