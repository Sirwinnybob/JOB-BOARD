import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import { pdfAPI, settingsAPI } from '../utils/api';
import AdminGrid from '../components/AdminGrid';
import UploadModal from '../components/UploadModal';
import SettingsModal from '../components/SettingsModal';
import LabelModal from '../components/LabelModal';
import PendingSection from '../components/PendingSection';
import useWebSocket from '../hooks/useWebSocket';

function AdminPage({ onLogout }) {
  const [pdfs, setPdfs] = useState([]);
  const [pendingPdfs, setPendingPdfs] = useState([]);
  const [workingPdfs, setWorkingPdfs] = useState([]);
  const [workingPendingPdfs, setWorkingPendingPdfs] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [settings, setSettings] = useState({ grid_rows: 4, grid_cols: 6 });
  const [editMode, setEditMode] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedPdfForLabels, setSelectedPdfForLabels] = useState(null);
  const [showSlotMenu, setShowSlotMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
    // Reload data when any relevant update is received
    const relevantTypes = [
      'pdf_uploaded',
      'pdf_deleted',
      'pdfs_reordered',
      'pdf_labels_updated',
      'pdf_status_updated',
      'label_created',
      'label_deleted',
      'settings_updated'
    ];

    if (relevantTypes.includes(message.type)) {
      loadData();
    }
  }, [loadData]);

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
          // Save reordering
          await saveReorder(workingPdfs);

          // Save pending status changes
          const statusChanges = [];

          // Check for PDFs moved to/from pending
          workingPdfs.forEach(pdf => {
            const original = pdfs.find(p => p.id === pdf.id);
            if (original && original.is_pending !== pdf.is_pending) {
              statusChanges.push(pdfAPI.updateStatus(pdf.id, pdf.is_pending));
            }
          });

          workingPendingPdfs.forEach(pdf => {
            const original = pendingPdfs.find(p => p.id === pdf.id);
            if (original && original.is_pending !== pdf.is_pending) {
              statusChanges.push(pdfAPI.updateStatus(pdf.id, pdf.is_pending));
            }
          });

          if (statusChanges.length > 0) {
            await Promise.all(statusChanges);
          }

          await loadData();
        } catch (error) {
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
      setPdfs(pdfs.filter((pdf) => pdf.id !== id));
    } catch (error) {
      console.error('Error deleting PDF:', error);
      alert('Failed to delete PDF');
    }
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    loadData();
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

  const handleLabelSuccess = () => {
    setShowLabelModal(false);
    setSelectedPdfForLabels(null);
    loadData();
  };

  const handleSlotMenuOpen = (position) => {
    setShowSlotMenu(position);
  };

  const handleSlotMenuClose = () => {
    setShowSlotMenu(null);
  };

  const handleAddPlaceholder = async (position) => {
    try {
      await pdfAPI.createPlaceholder(position + 1);
      setShowSlotMenu(null);
      loadData();
    } catch (error) {
      console.error('Error creating placeholder:', error);
      alert('Failed to create placeholder');
    }
  };

  const handleUploadToPdf = (position) => {
    // Position will be used after upload
    setShowSlotMenu(null);
    setShowUpload(true);
  };

  const handleMovePdfToBoard = (pdfId) => {
    // Move from pending to board (working copies only, not saved yet)
    const pdfToMove = workingPendingPdfs.find(pdf => pdf.id === pdfId);
    if (!pdfToMove) return;

    // Update is_pending flag
    pdfToMove.is_pending = 0;

    // Remove from pending and add to board
    setWorkingPendingPdfs(workingPendingPdfs.filter(pdf => pdf.id !== pdfId));
    setWorkingPdfs([...workingPdfs, pdfToMove]);
    setHasUnsavedChanges(true);
  };

  const handleMovePdfToPending = (pdfId) => {
    // Move from board to pending (working copies only, not saved yet)
    const pdfToMove = workingPdfs.find(pdf => pdf.id === pdfId);
    if (!pdfToMove) return;

    // Update is_pending flag
    pdfToMove.is_pending = 1;

    // Remove from board and add to pending
    setWorkingPdfs(workingPdfs.filter(pdf => pdf.id !== pdfId));
    setWorkingPendingPdfs([...workingPendingPdfs, pdfToMove]);
    setHasUnsavedChanges(true);
  };

  // Unified drag handler for @hello-pangea/dnd
  const handleDragEnd = (result) => {
    const { source, destination } = result;

    // Dropped outside a valid droppable
    if (!destination) {
      return;
    }

    // Dropped in the same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceId = source.droppableId;
    const destId = destination.droppableId;

    if (sourceId === 'board' && destId === 'board') {
      // Reordering within board
      const newPdfs = [...workingPdfs];
      const [movedPdf] = newPdfs.splice(source.index, 1);
      newPdfs.splice(destination.index, 0, movedPdf);
      setWorkingPdfs(newPdfs);
      setHasUnsavedChanges(true);
    } else if (sourceId === 'pending' && destId === 'pending') {
      // Reordering within pending
      const newPdfs = [...workingPendingPdfs];
      const [movedPdf] = newPdfs.splice(source.index, 1);
      newPdfs.splice(destination.index, 0, movedPdf);
      setWorkingPendingPdfs(newPdfs);
      setHasUnsavedChanges(true);
    } else if (sourceId === 'pending' && destId === 'board') {
      // Moving from pending to board
      const newPendingPdfs = [...workingPendingPdfs];
      const [movedPdf] = newPendingPdfs.splice(source.index, 1);
      movedPdf.is_pending = 0;

      const newBoardPdfs = [...workingPdfs];
      newBoardPdfs.splice(destination.index, 0, movedPdf);

      setWorkingPendingPdfs(newPendingPdfs);
      setWorkingPdfs(newBoardPdfs);
      setHasUnsavedChanges(true);
    } else if (sourceId === 'board' && destId === 'pending') {
      // Moving from board to pending
      const newBoardPdfs = [...workingPdfs];
      const [movedPdf] = newBoardPdfs.splice(source.index, 1);
      movedPdf.is_pending = 1;

      const newPendingPdfs = [...workingPendingPdfs];
      newPendingPdfs.splice(destination.index, 0, movedPdf);

      setWorkingPdfs(newBoardPdfs);
      setWorkingPendingPdfs(newPendingPdfs);
      setHasUnsavedChanges(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Job Board Admin
              </h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/')}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  View Board
                </button>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200">
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
                  onClick={() => setShowUpload(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  + Upload PDF
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DragDropContext onDragEnd={handleDragEnd}>
            {editMode && (
              <>
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    Drag and drop PDFs to reorder them. Click the tag icon to manage labels. Click the X to delete. Click the + button on empty slots to add placeholders.
                    {hasUnsavedChanges && <strong className="ml-2">Changes will be saved when you click "Save Changes".</strong>}
                  </p>
                </div>

                {/* Pending Section - Only visible in edit mode */}
                <PendingSection
                  pdfs={workingPendingPdfs}
                  onMovePdfToBoard={handleMovePdfToBoard}
                  onDelete={handleDelete}
                />
              </>
            )}

            <AdminGrid
              pdfs={editMode ? workingPdfs : pdfs}
              rows={settings.grid_rows}
              cols={settings.grid_cols}
              editMode={editMode}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onLabelClick={handleLabelClick}
              onSlotMenuOpen={handleSlotMenuOpen}
              showSlotMenu={showSlotMenu}
              onSlotMenuClose={handleSlotMenuClose}
              onAddPlaceholder={handleAddPlaceholder}
              onUploadToSlot={handleUploadToPdf}
              onMoveToPending={handleMovePdfToPending}
            />
          </DragDropContext>
        </main>

        {/* Modals */}
        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onSuccess={handleUploadSuccess}
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
    </div>
  );
}

export default AdminPage;
