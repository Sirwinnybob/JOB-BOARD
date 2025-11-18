import React, { useState, useEffect } from 'react';
import { labelAPI, pdfAPI } from '../utils/api';

function LabelModal({ pdf, onClose, onSuccess }) {
  const [labels, setLabels] = useState([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      const response = await labelAPI.getAll();
      // Filter out expired labels from the assignment list
      const activeLabels = response.data.filter(label => {
        if (!label.expires_at) return true; // No expiration, always active
        return new Date(label.expires_at) > new Date(); // Not yet expired
      });
      setLabels(activeLabels);

      // Pre-select current labels
      if (pdf.labels) {
        setSelectedLabelIds(pdf.labels.map(l => l.id));
      }
    } catch (error) {
      console.error('Error loading labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLabel = (labelId) => {
    if (selectedLabelIds.includes(labelId)) {
      setSelectedLabelIds(selectedLabelIds.filter(id => id !== labelId));
    } else {
      setSelectedLabelIds([...selectedLabelIds, labelId]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await pdfAPI.updateLabels(pdf.id, selectedLabelIds);
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
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {labels.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 transition-colors">
                No labels available. Contact admin to create labels.
              </p>
            ) : (
              labels.map((label) => {
                const isSelected = selectedLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
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
