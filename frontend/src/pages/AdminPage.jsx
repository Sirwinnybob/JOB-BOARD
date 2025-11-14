import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { pdfAPI, settingsAPI } from '../utils/api';
import AdminGrid from '../components/AdminGrid';
import UploadModal from '../components/UploadModal';
import SettingsModal from '../components/SettingsModal';
import LabelModal from '../components/LabelModal';
import LabelManagementModal from '../components/LabelManagementModal';
import PendingSection from '../components/PendingSection';
import useWebSocket from '../hooks/useWebSocket';
import { useDarkMode } from '../contexts/DarkModeContext';

function AdminPage({ onLogout }) {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [pdfs, setPdfs] = useState([]);
  const [pendingPdfs, setPendingPdfs] = useState([]);
  const [workingPdfs, setWorkingPdfs] = useState([]);
  const [workingPendingPdfs, setWorkingPendingPdfs] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [settings, setSettings] = useState({ grid_rows: 4, grid_cols: 6 });
  const [editMode, setEditMode] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTargetPosition, setUploadTargetPosition] = useState(null);
  const [uploadToPending, setUploadToPending] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showLabelManagement, setShowLabelManagement] = useState(false);
  const [selectedPdfForLabels, setSelectedPdfForLabels] = useState(null);
  const [showSlotMenu, setShowSlotMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState(null);
  const navigate = useNavigate();

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  const loadData = useCallback(async () => {
    try {
      const [allPdfsRes, settingsRes] = await Promise.all([
        pdfAPI.getAll(true), // Include pending PDFs
        settingsAPI.get(),
      ]);

      // Separate pending and visible PDFs
      const allPdfs = allPdfsRes.data;
      const visible = allPdfs.filter(pdf => !pdf.is_pending);
      const pending = allPdfs.filter(pdf => pdf.is_pending);

      setPdfs(visible);
      setPendingPdfs(pending);
      setSettings({
        grid_rows: parseInt(settingsRes.data.grid_rows),
        grid_cols: parseInt(settingsRes.data.grid_cols),
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket connection for live updates
  const handleWebSocketMessage = useCallback((message) => {
    console.log('Admin received update:', message.type);
    // Don't reload data during edit mode to preserve working copies
    if (editMode) {
      console.log('Skipping reload during edit mode');
      return;
    }

    // Reload data when any relevant update is received
    const relevantTypes = [
      'pdf_uploaded',
      'pdf_deleted',
      'pdfs_reordered',
      'pdf_labels_updated',
      'pdf_status_updated',
      'label_created',
      'label_updated',
      'label_deleted',
      'settings_updated'
    ];

    if (relevantTypes.includes(message.type)) {
      loadData();
    }
  }, [loadData, editMode]);

  useWebSocket(handleWebSocketMessage, true);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleReorder = (newPdfs) => {
    // During edit mode, only update local working copy
    setWorkingPdfs(newPdfs);
    setHasUnsavedChanges(true);
  };

  const saveReorder = async (pdfsToSave) => {
    const reorderedPdfs = pdfsToSave.map((pdf, index) => ({
      id: pdf.id,
      position: index + 1,
    }));

    try {
      await pdfAPI.reorder(reorderedPdfs);
      setPdfs(pdfsToSave);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error reordering PDFs:', error);
      // Reload on error
      loadData();
      throw error;
    }
  };

  const handleToggleEditMode = async () => {
    if (editMode) {
      // Exiting edit mode - save if there are changes
      if (hasUnsavedChanges) {
        try {
          // Prepare all PDFs with their positions and status
          const allPdfs = [];

          // Board PDFs - ensure they're marked as not pending
          // Filter out undefined (empty slots)
          workingPdfs.forEach((pdf, index) => {
            if (pdf) {
              allPdfs.push({
                id: pdf.id,
                position: index + 1,
                is_pending: 0
              });
            }
          });

          // Pending PDFs - ensure they're marked as pending
          workingPendingPdfs.forEach((pdf, index) => {
            if (pdf) {
              allPdfs.push({
                id: pdf.id,
                position: allPdfs.length + index + 1, // Continue numbering
                is_pending: 1
              });
            }
          });

          // Save positions
          await pdfAPI.reorder(allPdfs.map(p => ({ id: p.id, position: p.position })));

          // Update status for all PDFs that changed
          const statusUpdates = [];

          allPdfs.forEach(pdfUpdate => {
            // Find the PDF in original arrays
            const originalPdf = [...pdfs, ...pendingPdfs].find(p => p && p.id === pdfUpdate.id);

            // If status changed, update it
            if (originalPdf && originalPdf.is_pending !== pdfUpdate.is_pending) {
              statusUpdates.push(pdfAPI.updateStatus(pdfUpdate.id, pdfUpdate.is_pending));
            }
          });

          if (statusUpdates.length > 0) {
            await Promise.all(statusUpdates);
          }

          // Reload data to ensure consistency
          await loadData();
        } catch (error) {
          console.error('Error saving changes:', error);
          alert('Failed to save changes. Please try again.');
          return;
        }
      }
      setEditMode(false);
      setHasUnsavedChanges(false);
    } else {
      // Entering edit mode - create working copies
      setWorkingPdfs([...pdfs]);
      setWorkingPendingPdfs([...pendingPdfs]);
      setHasUnsavedChanges(false);
      setEditMode(true);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this PDF?')) {
      return;
    }

    try {
      await pdfAPI.delete(id);

      // If in edit mode, update working copies
      if (editMode) {
        setWorkingPdfs(workingPdfs.filter((pdf) => pdf && pdf.id !== id));
        setWorkingPendingPdfs(workingPendingPdfs.filter((pdf) => pdf && pdf.id !== id));
        setHasUnsavedChanges(true);
      } else {
        // Not in edit mode, update main state
        setPdfs(pdfs.filter((pdf) => pdf && pdf.id !== id));
        setPendingPdfs(pendingPdfs.filter((pdf) => pdf && pdf.id !== id));
      }
    } catch (error) {
      console.error('Error deleting PDF:', error);
      alert('Failed to delete PDF');
    }
  };

  const handleUploadSuccess = async (uploadedPdf) => {
    setShowUpload(false);
    setUploadTargetPosition(null);
    setUploadToPending(true);

    // If in edit mode, update working copies immediately
    if (editMode && uploadedPdf) {
      if (uploadedPdf.is_pending) {
        // Add to pending working copy
        setWorkingPendingPdfs([...workingPendingPdfs, uploadedPdf]);
      } else {
        // Add to board working copy at the specified position
        if (uploadTargetPosition !== null) {
          const newWorkingPdfs = [...workingPdfs];
          // Insert at target position (0-based index)
          newWorkingPdfs.splice(uploadTargetPosition - 1, 0, uploadedPdf);
          setWorkingPdfs(newWorkingPdfs);
        } else {
          setWorkingPdfs([...workingPdfs, uploadedPdf]);
        }
      }
      setHasUnsavedChanges(true);
    } else {
      // Not in edit mode, reload data
      await loadData();
    }
  };

  const handleUploadToPending = () => {
    setUploadTargetPosition(null);
    setUploadToPending(true);
    setShowUpload(true);
  };

  const handleSettingsSave = async (newSettings) => {
    try {
      await settingsAPI.update(newSettings);
      setSettings(newSettings);
      setShowSettings(false);
      loadData();
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    }
  };

  const handleLabelClick = (pdf) => {
    setSelectedPdfForLabels(pdf);
    setShowLabelModal(true);
  };

  const handleLabelSuccess = async () => {
    setShowLabelModal(false);
    const pdfId = selectedPdfForLabels?.id;
    setSelectedPdfForLabels(null);

    if (editMode && pdfId) {
      // In edit mode, fetch the updated PDF and update working copies
      try {
        const allPdfsRes = await pdfAPI.getAll(true);
        const allPdfs = allPdfsRes.data;
        const updatedPdf = allPdfs.find(p => p && p.id === pdfId);

        if (updatedPdf) {
          // Update the PDF in the appropriate working array
          if (updatedPdf.is_pending) {
            setWorkingPendingPdfs(prevWorking =>
              prevWorking.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, labels: updatedPdf.labels } : pdf)
            );
          } else {
            setWorkingPdfs(prevWorking =>
              prevWorking.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, labels: updatedPdf.labels } : pdf)
            );
          }
        }
      } catch (error) {
        console.error('Error updating labels in working copy:', error);
      }
    } else {
      // Not in edit mode, just reload all data
      await loadData();
    }
  };

  const handleMetadataUpdate = (pdfId, metadata) => {
    // Update metadata in working copies immediately
    setWorkingPdfs(prevWorking =>
      prevWorking.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
    );
    setWorkingPendingPdfs(prevWorking =>
      prevWorking.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
    );

    // Also update the base state if not in edit mode
    if (!editMode) {
      setPdfs(prevPdfs =>
        prevPdfs.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
      );
      setPendingPdfs(prevPending =>
        prevPending.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
      );
    }
  };

  const handleSlotMenuOpen = (position) => {
    setShowSlotMenu(position);
  };

  const handleSlotMenuClose = () => {
    setShowSlotMenu(null);
  };

  const handleAddPlaceholder = async (position) => {
    try {
      const response = await pdfAPI.createPlaceholder(position + 1);
      const placeholder = response.data;
      setShowSlotMenu(null);

      // If in edit mode, update working copy immediately
      if (editMode && placeholder) {
        const newWorkingPdfs = [...workingPdfs];
        // Place placeholder directly at the position, don't insert (which would shift)
        newWorkingPdfs[position] = placeholder;
        setWorkingPdfs(newWorkingPdfs);
        setHasUnsavedChanges(true);
      } else {
        // Not in edit mode, reload data
        await loadData();
      }
    } catch (error) {
      console.error('Error creating placeholder:', error);
      alert('Failed to create placeholder');
    }
  };

  const handleUploadToSlot = (position) => {
    // Upload directly to this slot position
    setUploadTargetPosition(position + 1); // Convert to 1-based position
    setUploadToPending(false);
    setShowSlotMenu(null);
    setShowUpload(true);
  };

  const handleMovePdfToBoard = (pdfId) => {
    // Move from pending to board (working copies only, not saved yet)
    const pdfToMove = workingPendingPdfs.find(pdf => pdf && pdf.id === pdfId);
    if (!pdfToMove) return;

    // Create a copy and update is_pending flag
    const updatedPdf = { ...pdfToMove, is_pending: 0 };

    // Remove from pending and add to board
    setWorkingPendingPdfs(workingPendingPdfs.filter(pdf => pdf && pdf.id !== pdfId));
    setWorkingPdfs([...workingPdfs, updatedPdf]);
    setHasUnsavedChanges(true);
  };

  const handleMoveAllPdfsToBoard = () => {
    if (workingPendingPdfs.length === 0) return;

    if (!confirm(`Add all ${workingPendingPdfs.length} pending PDFs to the board?`)) {
      return;
    }

    // Update all pending PDFs to not be pending (filter out any undefined)
    const movedPdfs = workingPendingPdfs.filter(pdf => pdf).map(pdf => ({ ...pdf, is_pending: 0 }));

    // Add all to board and clear pending
    setWorkingPdfs([...workingPdfs, ...movedPdfs]);
    setWorkingPendingPdfs([]);
    setHasUnsavedChanges(true);
  };

  const handleMovePdfToPending = (pdfId) => {
    // Move from board to pending (working copies only, not saved yet)
    const pdfToMove = workingPdfs.find(pdf => pdf && pdf.id === pdfId);
    if (!pdfToMove) return;

    // Create a copy and update is_pending flag
    const updatedPdf = { ...pdfToMove, is_pending: 1 };

    // Remove from board and add to pending
    // Use map to set to undefined instead of filter to preserve indices
    const newWorkingPdfs = workingPdfs.map(pdf => (pdf && pdf.id === pdfId) ? undefined : pdf);
    setWorkingPdfs(newWorkingPdfs);
    setWorkingPendingPdfs([...workingPendingPdfs, updatedPdf]);
    setHasUnsavedChanges(true);
  };

  // Drag handlers for @dnd-kit
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event) => {
    setActiveDragId(null);

    const { active, over } = event;

    // Dropped outside a valid droppable
    if (!over) {
      return;
    }

    const activeData = active.data.current;
    const overId = over.id;

    if (!activeData) {
      return;
    }

    const sourceContainer = activeData.container;
    const sourcePdf = activeData.pdf;
    const sourceIndex = activeData.index;

    // Determine destination
    let destContainer = null;
    let destIndex = null;

    if (typeof overId === 'string') {
      if (overId.startsWith('board-')) {
        destContainer = 'board';
        destIndex = parseInt(overId.split('-')[1]);
      } else if (overId === 'pending-container') {
        destContainer = 'pending';
        destIndex = workingPendingPdfs.length; // Add to end
      }
    }

    if (!destContainer) {
      return;
    }

    // Handle dragging within board
    if (sourceContainer === 'board' && destContainer === 'board') {
      if (sourceIndex === destIndex) {
        return; // Same position
      }

      const newPdfs = [...workingPdfs];

      // Simple swap: take what's at source, take what's at dest, swap them
      const sourcePdfItem = newPdfs[sourceIndex];
      const destPdfItem = newPdfs[destIndex];

      newPdfs[destIndex] = sourcePdfItem;
      newPdfs[sourceIndex] = destPdfItem;

      setWorkingPdfs(newPdfs);
      setHasUnsavedChanges(true);
    }
    // Handle dragging from pending to board
    else if (sourceContainer === 'pending' && destContainer === 'board') {
      const newPendingPdfs = [...workingPendingPdfs];
      newPendingPdfs.splice(sourceIndex, 1);

      const newBoardPdfs = [...workingPdfs];
      const updatedPdf = { ...sourcePdf, is_pending: 0 };

      // Get what's currently at the destination
      const destPdfItem = newBoardPdfs[destIndex];

      // Place the pending PDF at the destination
      newBoardPdfs[destIndex] = updatedPdf;

      // If there was something at the destination, add it to the end
      if (destPdfItem) {
        newBoardPdfs.push(destPdfItem);
      }

      setWorkingPendingPdfs(newPendingPdfs);
      setWorkingPdfs(newBoardPdfs);
      setHasUnsavedChanges(true);
    }
    // Handle dragging from board to pending
    else if (sourceContainer === 'board' && destContainer === 'pending') {
      // Prevent placeholders from being moved to pending
      if (sourcePdf.is_placeholder) {
        console.log('Cannot move placeholder to pending');
        return;
      }

      const newBoardPdfs = [...workingPdfs];
      // Remove from board by setting to undefined (leave the slot empty)
      newBoardPdfs[sourceIndex] = undefined;

      const newPendingPdfs = [...workingPendingPdfs];
      const updatedPdf = { ...sourcePdf, is_pending: 1 };
      newPendingPdfs.push(updatedPdf);

      setWorkingPdfs(newBoardPdfs);
      setWorkingPendingPdfs(newPendingPdfs);
      setHasUnsavedChanges(true);
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
                Job Board Admin
              </h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title={darkMode ? 'Light Mode' : 'Dark Mode'}
                >
                  {darkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  View Board
                </button>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleToggleEditMode}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  editMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {editMode ? (hasUnsavedChanges ? 'Save Changes' : 'Done Editing') : 'Edit Mode'}
              </button>
              {editMode && (
                <button
                  onClick={handleUploadToPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  + Upload to Pending
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => setShowLabelManagement(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Manage Labels
              </button>
              <button
                onClick={() => navigate('/admin/ocr-settings')}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
              >
                OCR Settings
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {editMode && (
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors">
                <p className="text-blue-800 dark:text-blue-200 text-sm transition-colors">
                  Drag and drop PDFs to reorder them. Click the tag icon to manage labels. Click the X to delete. Click the + button on empty slots to add placeholders.
                  {hasUnsavedChanges && <strong className="ml-2">Changes will be saved when you click "Save Changes".</strong>}
                </p>
              </div>
            )}

            {/* Pending Section - Always visible */}
            <PendingSection
              pdfs={editMode ? workingPendingPdfs : pendingPdfs}
              onMovePdfToBoard={editMode ? handleMovePdfToBoard : null}
              onMoveAllPdfsToBoard={editMode ? handleMoveAllPdfsToBoard : null}
              onDelete={editMode ? handleDelete : null}
              onUploadToPending={handleUploadToPending}
              editMode={editMode}
            />

            <AdminGrid
              pdfs={editMode ? workingPdfs : pdfs}
              rows={settings.grid_rows}
              cols={settings.grid_cols}
              editMode={editMode}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onLabelClick={handleLabelClick}
              onMetadataUpdate={handleMetadataUpdate}
              onSlotMenuOpen={handleSlotMenuOpen}
              showSlotMenu={showSlotMenu}
              onSlotMenuClose={handleSlotMenuClose}
              onAddPlaceholder={handleAddPlaceholder}
              onUploadToSlot={handleUploadToSlot}
              onMoveToPending={handleMovePdfToPending}
            />
          </DndContext>
        </main>

        {/* Modals */}
        {showUpload && (
          <UploadModal
            onClose={() => {
              setShowUpload(false);
              setUploadTargetPosition(null);
              setUploadToPending(true);
            }}
            onSuccess={handleUploadSuccess}
            targetPosition={uploadTargetPosition}
            uploadToPending={uploadToPending}
          />
        )}

        {showSettings && (
          <SettingsModal
            settings={settings}
            onClose={() => setShowSettings(false)}
            onSave={handleSettingsSave}
          />
        )}

        {showLabelModal && selectedPdfForLabels && (
          <LabelModal
            pdf={selectedPdfForLabels}
            onClose={() => {
              setShowLabelModal(false);
              setSelectedPdfForLabels(null);
            }}
            onSuccess={handleLabelSuccess}
          />
        )}

        {showLabelManagement && (
          <LabelManagementModal
            onClose={() => setShowLabelManagement(false)}
            onUpdate={loadData}
          />
        )}
    </div>
  );
}

export default AdminPage;
