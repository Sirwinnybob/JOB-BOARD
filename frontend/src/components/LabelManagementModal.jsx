import React, { useState, useEffect } from 'react';
import { labelAPI } from '../utils/api';

function LabelManagementModal({ onClose, onUpdate }) {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', color: '#10b981' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', color: '#10b981' });

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      const response = await labelAPI.getAll();
      setLabels(response.data);
    } catch (error) {
      console.error('Error loading labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!addForm.name.trim()) {
      alert('Label name is required');
      return;
    }

    try {
      const response = await labelAPI.create(addForm.name, addForm.color);
      setLabels([...labels, response.data]);
      setAddForm({ name: '', color: '#10b981' });
      setShowAddForm(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error creating label:', error);
      alert(error.response?.data?.error || 'Failed to create label');
    }
  };

  const handleEdit = (label) => {
    setEditingId(label.id);
    setEditForm({
      name: label.name,
      color: label.color
    });
  };

  const handleUpdate = async (id) => {
    if (!editForm.name.trim()) {
      alert('Label name is required');
      return;
    }

    try {
      const response = await labelAPI.update(id, editForm.name, editForm.color);
      setLabels(labels.map(l => l.id === id ? response.data : l));
      setEditingId(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating label:', error);
      alert(error.response?.data?.error || 'Failed to update label');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this label? It will be removed from all PDFs.')) {
      return;
    }

    try {
      await labelAPI.delete(id);
      setLabels(labels.filter(l => l.id !== id));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting label:', error);
      alert('Failed to delete label');
    }
  };

  const predefinedColors = [
    '#10b981', // green
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#f97316', // orange
    '#14b8a6', // teal
    '#6366f1', // indigo
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Manage Labels
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-600 dark:text-gray-400">Loading labels...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="space-y-2">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    {editingId === label.id ? (
                      <div className="flex-1 flex flex-col gap-3">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder="Label name"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Color:</label>
                          <input
                            type="color"
                            value={editForm.color}
                            onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                            className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                          />
                          <div className="flex gap-1 flex-wrap">
                            {predefinedColors.map(color => (
                              <button
                                key={color}
                                onClick={() => setEditForm({ ...editForm, color })}
                                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(label.id)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="flex-1 font-medium text-gray-900 dark:text-white">
                          {label.name}
                        </span>
                        <button
                          onClick={() => handleEdit(label)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(label.id)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Label Form */}
            {showAddForm ? (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Add New Label</h3>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Label name"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Color:</label>
                    <input
                      type="color"
                      value={addForm.color}
                      onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}
                      className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                    />
                    <div className="flex gap-1 flex-wrap flex-1">
                      {predefinedColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setAddForm({ ...addForm, color })}
                          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Create Label
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setAddForm({ name: '', color: '#10b981' });
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors font-medium"
              >
                + Add New Label
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LabelManagementModal;
