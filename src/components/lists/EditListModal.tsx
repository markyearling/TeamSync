import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ModalPortal from '../ModalPortal';

interface List {
  id: string;
  name: string;
  color: string;
}

interface EditListModalProps {
  list: List;
  onClose: () => void;
  onListUpdated: () => void;
}

const PRESET_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

const EditListModal: React.FC<EditListModalProps> = ({ list, onClose, onListUpdated }) => {
  const [name, setName] = useState(list.name);
  const [color, setColor] = useState(list.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a list name');
      return;
    }

    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('lists')
        .update({
          name: name.trim(),
          color: color,
        })
        .eq('id', list.id);

      if (updateError) throw updateError;

      onListUpdated();
    } catch (err) {
      console.error('Error updating list:', err);
      setError(err instanceof Error ? err.message : 'Failed to update list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit List
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="listName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  List Name
                </label>
                <input
                  type="text"
                  id="listName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Grocery List, To-Do, Shopping"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => setColor(presetColor)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        color === presetColor
                          ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default EditListModal;
