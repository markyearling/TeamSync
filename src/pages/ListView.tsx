import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Check, X as XIcon, Trash2, CheckSquare, Square, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DeleteConfirmationModal from '../components/lists/DeleteConfirmationModal';

interface ListItem {
  id: string;
  item_text: string;
  is_checked: boolean;
  sort_order: number;
}

interface List {
  id: string;
  name: string;
  color: string;
}

const ListView: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const newItemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listId) {
      fetchListAndItems();
    }
  }, [listId]);

  const fetchListAndItems = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: listData, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single();

      if (listError) throw listError;
      if (!listData) {
        navigate('/lists');
        return;
      }

      setList(listData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId)
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim() || !listId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const maxSortOrder = items.length > 0 ? Math.max(...items.map(item => item.sort_order)) : -1;

      const { data, error } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          user_id: user.id,
          item_text: newItemText.trim(),
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setItems([...items, data]);
      setNewItemText('');
      newItemInputRef.current?.focus();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleToggleCheck = async (item: ListItem) => {
    try {
      const { error } = await supabase
        .from('list_items')
        .update({ is_checked: !item.is_checked })
        .eq('id', item.id);

      if (error) throw error;

      setItems(items.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(items.filter(i => i.id !== itemId));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleStartEdit = (item: ListItem) => {
    setEditingItemId(item.id);
    setEditingText(item.item_text);
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editingText.trim()) {
      setEditingItemId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('list_items')
        .update({ item_text: editingText.trim() })
        .eq('id', itemId);

      if (error) throw error;

      setItems(items.map(i => i.id === itemId ? { ...i, item_text: editingText.trim() } : i));
      setEditingItemId(null);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingText('');
  };

  const handleCheckAll = async () => {
    try {
      const updates = items.map(item =>
        supabase
          .from('list_items')
          .update({ is_checked: true })
          .eq('id', item.id)
      );

      await Promise.all(updates);
      setItems(items.map(i => ({ ...i, is_checked: true })));
    } catch (error) {
      console.error('Error checking all items:', error);
    }
  };

  const handleUncheckAll = async () => {
    try {
      const updates = items.map(item =>
        supabase
          .from('list_items')
          .update({ is_checked: false })
          .eq('id', item.id)
      );

      await Promise.all(updates);
      setItems(items.map(i => ({ ...i, is_checked: false })));
    } catch (error) {
      console.error('Error unchecking all items:', error);
    }
  };

  const handleDeleteCheckedClick = () => {
    const checkedItems = items.filter(i => i.is_checked);
    if (checkedItems.length === 0) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    const checkedItems = items.filter(i => i.is_checked);
    if (checkedItems.length === 0) return;

    try {
      setIsDeleting(true);
      const deletes = checkedItems.map(item =>
        supabase
          .from('list_items')
          .delete()
          .eq('id', item.id)
      );

      await Promise.all(deletes);
      setItems(items.filter(i => !i.is_checked));
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting checked items:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetItemId) return;

    const draggedIndex = items.findIndex(i => i.id === draggedItemId);
    const targetIndex = items.findIndex(i => i.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setItems(newItems);
  };

  const handleDragEnd = async () => {
    if (!draggedItemId) return;

    try {
      const updates = items.map((item, index) =>
        supabase
          .from('list_items')
          .update({ sort_order: index })
          .eq('id', item.id)
      );

      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating sort order:', error);
      fetchListAndItems();
    }

    setDraggedItemId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  const checkedCount = items.filter(i => i.is_checked).length;

  return (
    <div className="w-full md:max-w-4xl md:mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/lists')}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back to Lists
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
                style={{ backgroundColor: list.color }}
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {list.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCheckAll}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center whitespace-nowrap"
                title="Check all"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Check All</span>
              </button>
              <button
                onClick={handleUncheckAll}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center whitespace-nowrap"
                title="Uncheck all"
              >
                <Square className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Uncheck All</span>
              </button>
              <button
                onClick={handleDeleteCheckedClick}
                disabled={checkedCount === 0}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Delete checked items"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Delete ({checkedCount})</span>
                <span className="sm:hidden">Del ({checkedCount})</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <input
                ref={newItemInputRef}
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                }}
                placeholder="Add new item..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleAddItem}
                disabled={!newItemText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No items yet. Add your first item above!
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  draggable={!editingItemId}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                    draggedItemId === item.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="cursor-move text-gray-400 dark:text-gray-500">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <button
                    onClick={() => handleToggleCheck(item)}
                    className="flex-shrink-0"
                  >
                    {item.is_checked ? (
                      <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>

                  {editingItemId === item.id ? (
                    <>
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(item.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <XIcon className="h-5 w-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        onClick={() => handleStartEdit(item)}
                        className={`flex-1 cursor-pointer ${
                          item.is_checked
                            ? 'line-through text-gray-500 dark:text-gray-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {item.item_text}
                      </span>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        itemCount={checkedCount}
        isProcessing={isDeleting}
      />
    </div>
  );
};

export default ListView;
