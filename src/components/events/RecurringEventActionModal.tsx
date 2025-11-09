import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import ModalPortal from '../ModalPortal';

interface RecurringEventActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (applyToAll: boolean) => void;
  actionType: 'edit' | 'delete';
  eventCount?: number;
}

const RecurringEventActionModal: React.FC<RecurringEventActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  eventCount = 0
}) => {
  if (!isOpen) return null;

  const actionVerb = actionType === 'edit' ? 'edit' : 'delete';
  const actionVerbCapitalized = actionType === 'edit' ? 'Edit' : 'Delete';

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[220]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {actionVerbCapitalized} Recurring Event
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              This event is part of a recurring series. Would you like to {actionVerb}:
            </p>

            <div className="space-y-3">
              <button
                onClick={() => onConfirm(false)}
                className="w-full text-left px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  Only this event
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Changes will only apply to this single occurrence
                </div>
              </button>

              <button
                onClick={() => onConfirm(true)}
                className="w-full text-left px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  All remaining events
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {actionType === 'delete'
                    ? `This will ${actionVerb} ${eventCount} event${eventCount !== 1 ? 's' : ''} in this series`
                    : 'Changes will apply to this and all future occurrences'
                  }
                </div>
              </button>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RecurringEventActionModal;
