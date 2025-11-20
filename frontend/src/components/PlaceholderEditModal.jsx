import React, { useState, useEffect } from 'react';

function PlaceholderEditModal({ placeholder, onClose, onSave }) {
  const [text, setText] = useState(placeholder?.placeholder_text || 'PLACEHOLDER');

  useEffect(() => {
    setText(placeholder?.placeholder_text || 'PLACEHOLDER');
  }, [placeholder]);

  const handleSave = () => {
    onSave(text);
  };

  const handleKeyDown = (e) => {
    // Allow Ctrl/Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
    // Escape to close
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 transition-colors">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors">
            Edit Placeholder Text
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
            Placeholder Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors resize-vertical min-h-[150px]"
            placeholder="Enter placeholder text...&#10;Multi-line supported!"
            autoFocus
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors">
            Multi-line text is supported. Press Enter for new lines. Ctrl+Enter (Cmd+Enter on Mac) to save.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg flex justify-end gap-3 transition-colors">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlaceholderEditModal;
