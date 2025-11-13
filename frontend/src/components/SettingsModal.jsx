import React, { useState } from 'react';

function SettingsModal({ settings, onClose, onSave }) {
  const [rows, setRows] = useState(settings.grid_rows);
  const [cols, setCols] = useState(settings.grid_cols);

  const handleSave = () => {
    if (rows < 1 || rows > 20 || cols < 1 || cols > 20) {
      alert('Rows and columns must be between 1 and 20');
      return;
    }
    onSave({ grid_rows: rows, grid_cols: cols });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Grid Settings</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="rows"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Rows (1-20)
            </label>
            <input
              type="number"
              id="rows"
              min="1"
              max="20"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="cols"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Columns (1-20)
            </label>
            <input
              type="number"
              id="cols"
              min="1"
              max="20"
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Total slots: <strong>{rows * cols}</strong>
            </p>
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
