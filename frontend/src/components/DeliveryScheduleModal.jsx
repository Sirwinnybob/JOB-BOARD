import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import ConfirmModal from './ConfirmModal';

function DeliveryScheduleModal({ onClose, isAdmin }) {
  const { darkMode } = useDarkMode();
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editForm, setEditForm] = useState({ jobs: [] });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = ['am', 'pm'];
  const periodLabels = ['AM', 'PM'];

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch('/api/delivery-schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedule(data.schedule || {});
      }
    } catch (error) {
      console.error('Failed to fetch delivery schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (day, period) => {
    const slotKey = `${day}_${period}`;
    const slotData = schedule[slotKey] || { jobs: [] };
    setEditingSlot(slotKey);
    setEditForm({ jobs: [...slotData.jobs] });
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/delivery-schedule', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          slot: editingSlot,
          data: editForm
        })
      });

      if (response.ok) {
        const updated = await response.json();
        setSchedule(updated.schedule);
        setEditingSlot(null);
        setEditForm({ jobs: [] });
      } else {
        console.error('Failed to save delivery schedule:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to save delivery schedule:', error);
    }
  };

  const handleCancel = () => {
    setEditingSlot(null);
    setEditForm({ jobs: [] });
  };

  const addJob = () => {
    if (editForm.jobs.length < 3) {
      setEditForm({
        jobs: [...editForm.jobs, { jobNumber: '', description: '', address: '' }]
      });
    }
  };

  const updateJob = (index, field, value) => {
    const updatedJobs = [...editForm.jobs];
    updatedJobs[index][field] = value;
    setEditForm({ jobs: updatedJobs });
  };

  const removeJob = (index) => {
    const updatedJobs = editForm.jobs.filter((_, i) => i !== index);
    setEditForm({ jobs: updatedJobs });
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
  };

  const handleResetAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Delivery Schedule',
      message: 'Are you sure you want to clear the entire delivery schedule? This cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const token = localStorage.getItem('token');
          const headers = {
            'Content-Type': 'application/json'
          };

          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          const response = await fetch('/api/delivery-schedule/reset', {
            method: 'POST',
            headers
          });

          if (response.ok) {
            const updated = await response.json();
            setSchedule(updated.schedule || {});
          } else {
            console.error('Failed to reset delivery schedule:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Failed to reset delivery schedule:', error);
        }
      }
    });
  };

  const handleDeleteJob = (day, period, jobIndex) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Delivery Entry',
      message: 'Are you sure you want to delete this delivery entry?',
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const slotKey = `${day}_${period}`;
          const slotData = schedule[slotKey] || { jobs: [] };
          const updatedJobs = slotData.jobs.filter((_, i) => i !== jobIndex);

          const token = localStorage.getItem('token');
          const headers = {
            'Content-Type': 'application/json'
          };

          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          const response = await fetch('/api/delivery-schedule', {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              slot: slotKey,
              data: { jobs: updatedJobs }
            })
          });

          if (response.ok) {
            const updated = await response.json();
            setSchedule(updated.schedule);
          } else {
            console.error('Failed to delete job:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Failed to delete job:', error);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden transition-colors`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} px-6 py-4 border-b flex justify-between items-center transition-colors`}>
          <div className="flex items-center gap-4">
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} transition-colors`}>
              This Week's Delivery Schedule
            </h2>
            {isAdmin && (
              <button
                onClick={handleResetAll}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                title="Clear all schedule entries"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Reset All</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Schedule Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading schedule...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {days.map((day, dayIndex) => (
                <div key={day} className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg overflow-hidden transition-colors`}>
                  {/* Day Header */}
                  <div className={`${darkMode ? 'bg-gray-600' : 'bg-gray-200'} px-3 py-2 text-center font-bold ${darkMode ? 'text-white' : 'text-gray-900'} transition-colors`}>
                    {dayLabels[dayIndex]}
                  </div>

                  {/* AM/PM Slots */}
                  {periods.map((period) => {
                    const slotKey = `${day}_${period}`;
                    const slotData = schedule[slotKey] || { jobs: [] };
                    const isEditing = editingSlot === slotKey;

                    return (
                      <div key={period} className={`${darkMode ? 'border-gray-600' : 'border-gray-200'} border-t p-3 transition-colors`}>
                        {/* Period Label */}
                        <div className="flex justify-between items-center mb-2">
                          <span className={`font-semibold text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors`}>
                            {periodLabels[periods.indexOf(period)]}
                          </span>
                          {isAdmin && !isEditing && (
                            <button
                              onClick={() => handleEdit(day, period)}
                              className={`text-xs ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {/* Jobs List or Edit Form */}
                        {isEditing ? (
                          <div className="space-y-2">
                            {editForm.jobs.map((job, index) => (
                              <div key={index} className={`${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'} border rounded p-2 space-y-1 transition-colors`}>
                                <input
                                  type="text"
                                  placeholder="Job Number"
                                  value={job.jobNumber}
                                  onChange={(e) => updateJob(index, 'jobNumber', e.target.value)}
                                  className={`w-full px-2 py-1 text-sm rounded ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} border transition-colors`}
                                />
                                <input
                                  type="text"
                                  placeholder="Description"
                                  value={job.description}
                                  onChange={(e) => updateJob(index, 'description', e.target.value)}
                                  className={`w-full px-2 py-1 text-sm rounded ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} border transition-colors`}
                                />
                                <input
                                  type="text"
                                  placeholder="Address (optional)"
                                  value={job.address}
                                  onChange={(e) => updateJob(index, 'address', e.target.value)}
                                  className={`w-full px-2 py-1 text-sm rounded ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} border transition-colors`}
                                />
                                <button
                                  onClick={() => removeJob(index)}
                                  className="text-xs text-red-500 hover:text-red-600"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {editForm.jobs.length < 3 && (
                              <button
                                onClick={addJob}
                                className={`w-full py-1 text-xs ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
                              >
                                + Add Job
                              </button>
                            )}
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancel}
                                className={`flex-1 ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'} px-3 py-1 rounded text-sm transition-colors`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {slotData.jobs && slotData.jobs.length > 0 ? (
                              slotData.jobs.map((job, index) => (
                                <div key={index} className={`${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'} border rounded p-2 transition-colors`}>
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                      <div className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'} truncate transition-colors`}>
                                        {job.jobNumber}
                                      </div>
                                      <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} line-clamp-2 transition-colors`}>
                                        {job.description}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      {job.address && (
                                        <>
                                          <a
                                            href={job.address.startsWith('http') ? job.address : `https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
                                            title="Open in maps"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                          </a>
                                          <button
                                            onClick={() => copyAddress(job.address)}
                                            className={`${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'} transition-colors`}
                                            title="Copy address"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                          </button>
                                        </>
                                      )}
                                      {isAdmin && (
                                        <button
                                          onClick={() => handleDeleteJob(day, period, index)}
                                          className="text-red-500 hover:text-red-600 transition-colors"
                                          title="Delete this entry"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} italic text-center py-2 transition-colors`}>
                                No deliveries
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </div>
  );
}

export default DeliveryScheduleModal;
