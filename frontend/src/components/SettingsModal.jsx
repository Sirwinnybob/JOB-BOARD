import React, { useState } from 'react';

function SettingsModal({ settings, onClose, onSave }) {
  const [rows, setRows] = useState(settings.grid_rows);
  const [cols, setCols] = useState(settings.grid_cols);
  const [aspectWidth, setAspectWidth] = useState(settings.aspect_ratio_width || 11);
  const [aspectHeight, setAspectHeight] = useState(settings.aspect_ratio_height || 10);

  const handleSave = () => {
    if (rows < 1 || rows > 20 || cols < 1 || cols > 20) {
      alert('Rows and columns must be between 1 and 20');
      return;
    }
    if (aspectWidth < 1 || aspectWidth > 50 || aspectHeight < 1 || aspectHeight > 50) {
      alert('Aspect ratio dimensions must be between 1 and 50');
      return;
    }
    onSave({
      grid_rows: rows,
      grid_cols: cols,
      aspect_ratio_width: aspectWidth,
      aspect_ratio_height: aspectHeight
    });
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

          <div className="border-t border-gray-300 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Slot Aspect Ratio</h3>
            <p className="text-sm text-gray-600 mb-3">
              Adjust the aspect ratio of job board slots (includes space for header)
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="aspectWidth"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Width (1-50)
                </label>
                <input
                  type="number"
                  id="aspectWidth"
                  min="1"
                  max="50"
                  step="0.1"
                  value={aspectWidth}
                  onChange={(e) => setAspectWidth(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="aspectHeight"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Height (1-50)
                </label>
                <input
                  type="number"
                  id="aspectHeight"
                  min="1"
                  max="50"
                  step="0.1"
                  value={aspectHeight}
                  onChange={(e) => setAspectHeight(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3">
              <p className="text-sm text-gray-700">
                Current ratio: <strong>{aspectWidth} : {aspectHeight}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Portrait (8.5 x 11) | Landscape (11 x 8.5) | Landscape with header (11 x 10)
              </p>
            </div>
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
