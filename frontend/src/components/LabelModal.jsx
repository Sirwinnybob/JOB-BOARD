import React, { useState, useEffect } from 'react';
import { labelAPI, pdfAPI } from '../utils/api';

function LabelModal({ pdf, onClose, onSuccess }) {
  const [labels, setLabels] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState({}); // { labelId: expiresAt }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      const response = await labelAPI.getAll();
      setLabels(response.data);

      // Pre-select current labels with their expiration
      if (pdf.labels) {
        const selected = {};
        pdf.labels.forEach(l => {
          selected[l.id] = l.label_expires_at || null;
        });
        setSelectedLabels(selected);
      }
    } catch (error) {
      console.error('Error loading labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLabel = (labelId) => {
    if (selectedLabels[labelId] !== undefined) {
      // Remove label
      const newSelected = { ...selectedLabels };
      delete newSelected[labelId];
      setSelectedLabels(newSelected);
    } else {
      // Add label with no expiration (Never)
      setSelectedLabels({
        ...selectedLabels,
        [labelId]: null
      });
    }
  };

  const setExpiration = (labelId, expiresAt) => {
    setSelectedLabels({
      ...selectedLabels,
      [labelId]: expiresAt
    });
  };

  const setExpireToday = (labelId) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    setExpiration(labelId, today.toISOString());
  };

  const setExpireTomorrow = (labelId) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999); // End of tomorrow
    setExpiration(labelId, tomorrow.toISOString());
  };

  const setExpireNever = (labelId) => {
    setExpiration(labelId, null);
  };

  const formatExpiration = (expiresAt) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const labelDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (labelDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (labelDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert selectedLabels object to array format expected by API
      const labelsArray = Object.entries(selectedLabels).map(([labelId, expiresAt]) => ({
        labelId: parseInt(labelId),
        expiresAt: expiresAt
      }));

      await pdfAPI.updateLabels(pdf.id, labelsArray);
      onSuccess();
    } catch (error) {
      console.error('Error updating labels:', error);
      alert('Failed to update labels');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">
          Manage Labels
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 truncate transition-colors">
          {pdf.original_name}
        </p>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-600 dark:text-gray-400 transition-colors">Loading labels...</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {labels.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 transition-colors">
                No labels available. Contact admin to create labels.
              </p>
            ) : (
              labels.map((label) => {
                const isSelected = selectedLabels[label.id] !== undefined;
                const expiresAt = selectedLabels[label.id];

                return (
                  <div key={label.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleLabel(label.id)}
                      className={`w-full px-4 py-3 transition-all text-left flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white transition-colors">
                          {label.name}
                        </span>
                      </div>
                      {isSelected && (
                        <svg
                          className="w-6 h-6 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>

                    {isSelected && (
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Expires: {formatExpiration(expiresAt)}
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setExpireNever(label.id)}
                            className={`px-3 py-1 text-xs rounded ${
                              expiresAt === null
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Never
                          </button>
                          <button
                            onClick={() => setExpireToday(label.id)}
                            className={`px-3 py-1 text-xs rounded ${
                              formatExpiration(expiresAt) === 'Today'
                                ? 'bg-orange-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Today
                          </button>
                          <button
                            onClick={() => setExpireTomorrow(label.id)}
                            className={`px-3 py-1 text-xs rounded ${
                              formatExpiration(expiresAt) === 'Tomorrow'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                            }`}
                          >
                            Tomorrow
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="mt-6 flex space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LabelModal;
