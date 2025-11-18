import React from 'react';

function ConflictWarningModal({ onRefresh, onForceSave, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors">
              Conflict Detected
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 transition-colors">
            Another admin has made changes while you were editing. You have the following options:
          </p>

          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 transition-colors">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Refresh and Discard</h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">Load the latest changes from the other admin and discard your local changes.</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 transition-colors">
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">Force Save</h3>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">Save your changes and override the other admin's changes. Use with caution!</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-3 transition-colors">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1">Cancel</h3>
              <p className="text-xs text-gray-700 dark:text-gray-300">Return to edit mode and continue working.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg flex justify-end gap-3 transition-colors">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh & Discard
          </button>
          <button
            onClick={onForceSave}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Force Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConflictWarningModal;
