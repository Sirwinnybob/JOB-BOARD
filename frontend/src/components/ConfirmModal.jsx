import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * ConfirmModal - Reusable confirmation dialog
 * Replaces browser's native confirm() with a styled modal
 */
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', confirmStyle = 'danger', showCancel = true }) {
  const { darkMode } = useDarkMode();

  if (!isOpen) return null;

  const confirmButtonClass = confirmStyle === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-md w-full transition-colors`}>
        {/* Header */}
        {title && (
          <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} px-6 py-4 border-b transition-colors`}>
            <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'} transition-colors`}>
              {title}
            </h3>
          </div>
        )}

        {/* Message */}
        <div className="px-6 py-4">
          <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} px-6 py-4 border-t flex gap-3 ${showCancel ? 'justify-end' : 'justify-center'} transition-colors`}>
          {showCancel && (
            <button
              onClick={onCancel}
              className={`px-4 py-2 rounded font-medium ${
                darkMode
                  ? 'bg-gray-600 text-white hover:bg-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } transition-colors`}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded font-medium text-white ${confirmButtonClass} transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
