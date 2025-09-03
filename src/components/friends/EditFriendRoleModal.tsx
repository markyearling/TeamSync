import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Shield, Eye, MessageCircle } from 'lucide-react';
import { useCapacitor } from '../../hooks/useCapacitor';

interface EditFriendRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  friendshipId: string;
  currentRole: 'none' | 'viewer' | 'administrator';
  friendName: string;
  onSave: (friendshipId: string, newRole: 'none' | 'viewer' | 'administrator') => Promise<void>;
}

const EditFriendRoleModal: React.FC<EditFriendRoleModalProps> = ({
  isOpen,
  onClose,
  friendshipId,
  currentRole,
  friendName,
  onSave
}) => {
  const [selectedRole, setSelectedRole] = useState<'none' | 'viewer' | 'administrator'>(currentRole);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { isNative } = useCapacitor();

  useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole, isOpen]);

  // Handle clicks outside the modal
  useEffect(() => {
    if (!isNative) {
      const handleClickOutside = (event: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose, isNative]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(friendshipId, selectedRole);
      onClose();
    } catch (error) {
      console.error('Error saving friend role:', error);
    } finally {
      setSaving(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'administrator':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'viewer':
        return <Eye className="h-5 w-5 text-blue-500" />;
      case 'none':
      default:
        return <MessageCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getRoleDescription = (role: string) => {
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

  if (!isOpen) return null;

  // Determine modal styling based on whether we're on mobile or desktop
  const modalContainerClasses = isNative
    ? "fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-800 overflow-hidden"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";

  const modalContentClasses = isNative
    ? "flex flex-col h-full w-full overflow-hidden"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full";

  return (
    <div 
      className={modalContainerClasses}
      style={isNative ? {
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      } : undefined}
    >
      <div 
        ref={modalRef}
        className={modalContentClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Edit Access Level
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              {friendName}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose what level of access this friend should have to your family's schedules and profiles.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { value: 'none', label: 'Friend', icon: MessageCircle, color: 'text-green-500' },
              { value: 'viewer', label: 'Viewer', icon: Eye, color: 'text-blue-500' },
              { value: 'administrator', label: 'Administrator', icon: Shield, color: 'text-red-500' }
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-start p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedRole === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={selectedRole === option.value}
                  onChange={(e) => setSelectedRole(e.target.value as 'none' | 'viewer' | 'administrator')}
                  className="sr-only"
                />
                <div className="flex items-center flex-1">
                  <div className="flex-shrink-0 mr-3">
                    <option.icon className={`h-6 w-6 ${option.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {getRoleDescription(option.value)}
                    </div>
                  </div>
                  {selectedRole === option.value && (
                    <div className="flex-shrink-0 ml-3">
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Access Level Details
            </h4>
            <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex items-start">
                <MessageCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Friend:</span> Basic friendship with messaging capabilities only
                </div>
              </div>
              <div className="flex items-start">
                <Eye className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Viewer:</span> Can see your children's schedules and events in their dashboard and calendar
                </div>
              </div>
              <div className="flex items-start">
                <Shield className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Administrator:</span> Full access to view and manage your children's profiles, schedules, and events
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedRole === currentRole}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
      </div>
    </div>
  );
};

export default EditFriendRoleModal;