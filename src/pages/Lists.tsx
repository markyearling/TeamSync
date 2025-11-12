import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ListChecks, Trash2, Edit2, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CreateListModal from '../components/lists/CreateListModal';
import EditListModal from '../components/lists/EditListModal';
import { useCapacitor } from '../hooks/useCapacitor';

interface List {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
  checked_count?: number;
}

const Lists: React.FC = () => {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [listToDelete, setListToDelete] = useState<List | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isNative } = useCapacitor();

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;

      if (listsData) {
        const listsWithCounts = await Promise.all(
          listsData.map(async (list) => {
            const { count: totalCount } = await supabase
              .from('list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id);

            const { count: checkedCount } = await supabase
              .from('list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id)
              .eq('is_checked', true);

            return {
              ...list,
              item_count: totalCount || 0,
              checked_count: checkedCount || 0,
            };
          })
        );

        setLists(listsWithCounts);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = () => {
    setShowCreateModal(true);
  };

  const handleListCreated = () => {
    setShowCreateModal(false);
    fetchLists();
  };

  const handleListUpdated = () => {
    setShowEditModal(false);
    setSelectedList(null);
    fetchLists();
  };

  const handleEditList = (list: List) => {
    setSelectedList(list);
    setShowEditModal(true);
    setActiveMenuId(null);
  };

  const handleDeleteList = (list: List) => {
    setListToDelete(list);
    setShowDeleteConfirm(true);
    setActiveMenuId(null);
  };

  const confirmDeleteList = async () => {
    if (!listToDelete) return;

    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listToDelete.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setListToDelete(null);
      fetchLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      alert('Failed to delete list. Please try again.');
    }
  };

  const handleListClick = (listId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.menu-button')) {
      return;
    }
    navigate(`/lists/${listId}`);
  };

  const toggleMenu = (listId: string) => {
    setActiveMenuId(activeMenuId === listId ? null : listId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lists</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create and manage your lists
          </p>
        </div>
        <button
          onClick={handleCreateList}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create List
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-16">
          <ListChecks className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No lists yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Get started by creating your first list
          </p>
          <button
            onClick={handleCreateList}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Your First List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {lists.map((list) => (
            <div
              key={list.id}
              onClick={(e) => handleListClick(list.id, e)}
              className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 cursor-pointer group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: list.color + '20' }}
                  >
                    <ListChecks
                      className="h-6 w-6"
                      style={{ color: list.color }}
                    />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {list.name}
                </h3>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                  </span>
                  {list.item_count! > 0 && (
                    <>
                      <span className="mx-2">•</span>
                      <span>
                        {list.checked_count} checked
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="absolute top-4 right-4 menu-button" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu(list.id);
                  }}
                  className={`p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity ${
                    isNative ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {activeMenuId === list.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditList(list);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit List
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteList(list);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-md"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete List
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateListModal
          onClose={() => setShowCreateModal(false)}
          onListCreated={handleListCreated}
        />
      )}

      {showEditModal && selectedList && (
        <EditListModal
          list={selectedList}
          onClose={() => {
            setShowEditModal(false);
            setSelectedList(null);
          }}
          onListUpdated={handleListUpdated}
        />
      )}

      {showDeleteConfirm && listToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Delete List</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300">
                Are you sure you want to delete "{listToDelete.name}"? This will also delete all items in the list. This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setListToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteList}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lists;
