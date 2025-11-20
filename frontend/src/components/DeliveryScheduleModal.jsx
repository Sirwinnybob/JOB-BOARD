import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import ConfirmModal from './ConfirmModal';

function DeliveryScheduleModal({ onClose, isAdmin, schedule: propSchedule, onScheduleUpdate }) {
  const { darkMode } = useDarkMode();
  const [schedule, setSchedule] = useState(propSchedule || {});
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editForm, setEditForm] = useState({ jobs: [] });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [draggedItem, setDraggedItem] = useState(null); // { slotKey, jobIndex }
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [selectedForMove, setSelectedForMove] = useState(null); // { slotKey, jobIndex } for touch/tap mode

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = ['am', 'pm'];
  const periodLabels = ['AM', 'PM'];

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Sync with prop schedule updates from HomePage WebSocket
  useEffect(() => {
    if (propSchedule && Object.keys(propSchedule).length > 0) {
      setSchedule(propSchedule);
    }
  }, [propSchedule]);

  const fetchSchedule = async () => {
    try {
      const response = await fetch('/api/delivery-schedule');
      if (response.ok) {
        const data = await response.json();
        const scheduleData = data.schedule || {};
        setSchedule(scheduleData);
        if (onScheduleUpdate) {
          onScheduleUpdate(scheduleData);
        }
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
        if (onScheduleUpdate) {
          onScheduleUpdate(updated.schedule);
        }
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
            const scheduleData = updated.schedule || {};
            setSchedule(scheduleData);
            if (onScheduleUpdate) {
              onScheduleUpdate(scheduleData);
            }
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
            if (onScheduleUpdate) {
              onScheduleUpdate(updated.schedule);
            }
          } else {
            console.error('Failed to delete job:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Failed to delete job:', error);
        }
      }
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e, slotKey, jobIndex) => {
    if (!isAdmin) return;
    setDraggedItem({ slotKey, jobIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (slotKey) => {
    setDragOverSlot(slotKey);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're leaving the slot container, not just moving between children
    if (e.currentTarget === e.target) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = async (e, targetSlotKey) => {
    e.preventDefault();
    if (!draggedItem || !isAdmin) return;

    const { slotKey: sourceSlotKey, jobIndex: sourceIndex } = draggedItem;

    // Don't do anything if dropped in the same position
    if (sourceSlotKey === targetSlotKey && sourceIndex === 0 && (schedule[targetSlotKey]?.jobs?.length || 0) <= 1) {
      setDraggedItem(null);
      setDragOverSlot(null);
      return;
    }

    try {
      const sourceSlotData = schedule[sourceSlotKey] || { jobs: [] };
      const targetSlotData = schedule[targetSlotKey] || { jobs: [] };

      // Get the job being moved
      const movedJob = sourceSlotData.jobs[sourceIndex];

      // Check if target slot would exceed max capacity (only if different slots)
      if (sourceSlotKey !== targetSlotKey && targetSlotData.jobs.length >= 3) {
        alert('Cannot add more than 3 jobs to a time slot');
        setDraggedItem(null);
        setDragOverSlot(null);
        return;
      }

      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (sourceSlotKey === targetSlotKey) {
        // Reordering within the same slot - just move to the end for simplicity
        const updatedJobs = sourceSlotData.jobs.filter((_, i) => i !== sourceIndex);
        updatedJobs.push(movedJob);

        const response = await fetch('/api/delivery-schedule', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            slot: sourceSlotKey,
            data: { jobs: updatedJobs }
          })
        });

        if (response.ok) {
          const updated = await response.json();
          setSchedule(updated.schedule);
          if (onScheduleUpdate) {
            onScheduleUpdate(updated.schedule);
          }
        }
      } else {
        // Moving between different slots - need to update both
        const updatedSourceJobs = sourceSlotData.jobs.filter((_, i) => i !== sourceIndex);
        const updatedTargetJobs = [...targetSlotData.jobs, movedJob];

        // Update source slot first
        const sourceResponse = await fetch('/api/delivery-schedule', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            slot: sourceSlotKey,
            data: { jobs: updatedSourceJobs }
          })
        });

        if (sourceResponse.ok) {
          // Then update target slot
          const targetResponse = await fetch('/api/delivery-schedule', {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              slot: targetSlotKey,
              data: { jobs: updatedTargetJobs }
            })
          });

          if (targetResponse.ok) {
            const updated = await targetResponse.json();
            setSchedule(updated.schedule);
            if (onScheduleUpdate) {
              onScheduleUpdate(updated.schedule);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to move job:', error);
    }

    setDraggedItem(null);
    setDragOverSlot(null);
  };

  // Touch/tap mode handlers for mobile
  const handleSelectForMove = (slotKey, jobIndex) => {
    if (!isAdmin) return;

    // If clicking the same job, deselect it (cancel move)
    if (selectedForMove?.slotKey === slotKey && selectedForMove?.jobIndex === jobIndex) {
      setSelectedForMove(null);
      return;
    }

    setSelectedForMove({ slotKey, jobIndex });
  };

  const handleMoveToSlot = async (targetSlotKey) => {
    if (!selectedForMove || !isAdmin) return;

    const { slotKey: sourceSlotKey, jobIndex: sourceIndex } = selectedForMove;

    try {
      const sourceSlotData = schedule[sourceSlotKey] || { jobs: [] };
      const targetSlotData = schedule[targetSlotKey] || { jobs: [] };

      // Get the job being moved
      const movedJob = sourceSlotData.jobs[sourceIndex];

      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (sourceSlotKey === targetSlotKey) {
        // Reordering within the same slot - move to the end
        const updatedJobs = sourceSlotData.jobs.filter((_, i) => i !== sourceIndex);
        updatedJobs.push(movedJob);

        const response = await fetch('/api/delivery-schedule', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            slot: sourceSlotKey,
            data: { jobs: updatedJobs }
          })
        });

        if (response.ok) {
          const updated = await response.json();
          setSchedule(updated.schedule);
          if (onScheduleUpdate) {
            onScheduleUpdate(updated.schedule);
          }
        }
      } else {
        // Check if target slot would exceed max capacity (only for different slots)
        if (targetSlotData.jobs.length >= 3) {
          alert('Cannot add more than 3 jobs to a time slot');
          setSelectedForMove(null);
          return;
        }

        // Moving between different slots - need to update both
        const updatedSourceJobs = sourceSlotData.jobs.filter((_, i) => i !== sourceIndex);
        const updatedTargetJobs = [...targetSlotData.jobs, movedJob];

        // Update source slot first
        const sourceResponse = await fetch('/api/delivery-schedule', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            slot: sourceSlotKey,
            data: { jobs: updatedSourceJobs }
          })
        });

        if (sourceResponse.ok) {
          // Then update target slot
          const targetResponse = await fetch('/api/delivery-schedule', {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              slot: targetSlotKey,
              data: { jobs: updatedTargetJobs }
            })
          });

          if (targetResponse.ok) {
            const updated = await targetResponse.json();
            setSchedule(updated.schedule);
            if (onScheduleUpdate) {
              onScheduleUpdate(updated.schedule);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to move job:', error);
    }

    setSelectedForMove(null);
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

        {/* Move Mode Banner */}
        {selectedForMove && (
          <div className={`${darkMode ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-100 border-yellow-300'} border-b px-6 py-3 flex justify-between items-center transition-colors`}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`font-medium ${darkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
                Job selected for move - Tap a time slot to place it there
              </span>
            </div>
            <button
              onClick={() => setSelectedForMove(null)}
              className={`px-3 py-1 rounded text-sm font-medium ${darkMode ? 'bg-yellow-800 hover:bg-yellow-700 text-yellow-100' : 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900'} transition-colors`}
            >
              Cancel
            </button>
          </div>
        )}

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

                    const isSelectedSource = selectedForMove?.slotKey === slotKey;
                    const canMoveHere = selectedForMove && (
                      (isSelectedSource && slotData.jobs.length > 1) ||
                      (!isSelectedSource && slotData.jobs.length < 3)
                    );

                    return (
                      <div
                        key={period}
                        className={`${darkMode ? 'border-gray-600' : 'border-gray-200'} border-t p-3 transition-colors ${
                          dragOverSlot === slotKey ? (darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-50') : ''
                        } ${canMoveHere ? (darkMode ? 'bg-green-900 bg-opacity-20 border-green-500 cursor-pointer' : 'bg-green-50 border-green-400 cursor-pointer') : ''}`}
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(slotKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, slotKey)}
                        onClick={() => canMoveHere && handleMoveToSlot(slotKey)}
                      >
                        {/* Period Label */}
                        <div className="flex justify-between items-center mb-2">
                          <span className={`font-semibold text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors flex items-center gap-1`}>
                            {periodLabels[periods.indexOf(period)]}
                            {canMoveHere && (
                              <span className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                                {isSelectedSource ? '(Tap to reorder)' : '(Tap to place here)'}
                              </span>
                            )}
                          </span>
                          {isAdmin && !isEditing && !selectedForMove && (
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
                              slotData.jobs.map((job, index) => {
                                const isSelectedForMove = selectedForMove?.slotKey === slotKey && selectedForMove?.jobIndex === index;

                                return (
                                  <div
                                    key={index}
                                    draggable={isAdmin && !selectedForMove}
                                    onDragStart={(e) => handleDragStart(e, slotKey, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'} border rounded p-2 transition-colors ${
                                      isAdmin && !selectedForMove ? 'cursor-move hover:shadow-lg' : ''
                                    } ${draggedItem?.slotKey === slotKey && draggedItem?.jobIndex === index ? 'opacity-50' : ''} ${
                                      isSelectedForMove ? (darkMode ? 'ring-2 ring-yellow-500 bg-yellow-900 bg-opacity-20' : 'ring-2 ring-yellow-400 bg-yellow-50') : ''
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex-1 min-w-0">
                                        <div className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'} truncate transition-colors`}>
                                          {job.jobNumber}
                                        </div>
                                        <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} line-clamp-2 transition-colors`}>
                                          {job.description}
                                        </div>
                                      </div>
                                      <div className="flex gap-1 flex-col">
                                        <div className="flex gap-1">
                                          {isAdmin && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectForMove(slotKey, index);
                                              }}
                                              className={`${
                                                isSelectedForMove
                                                  ? (darkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-yellow-600 hover:text-yellow-700')
                                                  : (darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700')
                                              } transition-colors`}
                                              title={isSelectedForMove ? "Cancel move" : "Select to move"}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                              </svg>
                                            </button>
                                          )}
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
                                        </div>
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
                                );
                              })
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
