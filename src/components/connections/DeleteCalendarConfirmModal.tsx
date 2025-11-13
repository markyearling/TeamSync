import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import ModalPortal from '../ModalPortal';

interface DeleteCalendarConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  calendarName: string;
  isDeleting?: boolean;
}

const DeleteCalendarConfirmModal: React.FC<DeleteCalendarConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  calendarName,
  isDeleting = false
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[220]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Delete Calendar Import
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">"{calendarName}"</span>?
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Warning:</strong> All imported events from this calendar will be permanently removed. This action cannot be undone.
              </p>
            </div>

            {isDeleting && (
              <div className="flex items-center justify-center space-x-2 mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Deleting calendar...
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete Calendar'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default DeleteCalendarConfirmModal;
