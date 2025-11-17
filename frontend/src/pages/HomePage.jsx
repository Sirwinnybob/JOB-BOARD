import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { pdfAPI, settingsAPI, authAPI } from '../utils/api';
import PDFGrid from '../components/PDFGrid';
import AdminGrid from '../components/AdminGrid';
import SlideShowView from '../components/SlideShowView';
import UploadModal from '../components/UploadModal';
import SettingsModal from '../components/SettingsModal';
import LabelModal from '../components/LabelModal';
import LabelManagementModal from '../components/LabelManagementModal';
import PendingSection from '../components/PendingSection';
import useWebSocket from '../hooks/useWebSocket';
import { useDarkMode } from '../contexts/DarkModeContext';

function HomePage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pdfs, setPdfs] = useState([]);
  const [pendingPdfs, setPendingPdfs] = useState([]);
  const [workingPdfs, setWorkingPdfs] = useState([]);
  const [workingPendingPdfs, setWorkingPendingPdfs] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [settings, setSettings] = useState({ grid_rows: 6, grid_cols: 4, aspect_ratio_width: 11, aspect_ratio_height: 10 });
  const [editMode, setEditMode] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTargetPosition, setUploadTargetPosition] = useState(null);
  const [uploadToPending, setUploadToPending] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showLabelManagement, setShowLabelManagement] = useState(false);
  const [selectedPdfForLabels, setSelectedPdfForLabels] = useState(null);
  const [showSlotMenu, setShowSlotMenu] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('viewMode');
    // Default to slideshow on mobile devices
    if (!saved) {
      return window.innerWidth < 768 ? 'slideshow' : 'grid';
    }
    return saved;
  });
  const [isClosingSlideshow, setIsClosingSlideshow] = useState(false);
  const [originRect, setOriginRect] = useState(null);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);
  const [pullToRefresh, setPullToRefresh] = useState({ pulling: false, distance: 0, refreshing: false });
  const navigate = useNavigate();

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Check authentication on mount
  useEffect(() => {
    setIsAuthenticated(authAPI.isAuthenticated());
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [allPdfsRes, settingsRes] = await Promise.all([
        pdfAPI.getAll(isAuthenticated), // Include pending if authenticated
        settingsAPI.get(),
      ]);

      const allPdfs = allPdfsRes.data;

      if (isAuthenticated) {
        // Separate pending and visible PDFs for admins
        const visible = allPdfs.filter(pdf => !pdf.is_pending);
        const pending = allPdfs.filter(pdf => pdf.is_pending);
        setPdfs(visible);
        setPendingPdfs(pending);
      } else {
        // Only show published PDFs for public
        setPdfs(allPdfs);
      }

      setSettings({
        grid_rows: parseInt(settingsRes.data.grid_rows),
        grid_cols: parseInt(settingsRes.data.grid_cols),
        aspect_ratio_width: parseFloat(settingsRes.data.aspect_ratio_width || 11),
        aspect_ratio_height: parseFloat(settingsRes.data.aspect_ratio_height || 10),
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket connection for live updates
  const handleWebSocketMessage = useCallback((message) => {
    console.log('Received update:', message.type);

    // Handle metadata updates even during edit mode (OCR results)
    if (editMode && message.type === 'pdf_metadata_updated') {
      console.log('Updating metadata during edit mode:', message.data);
      const { id, job_number, construction_method } = message.data;

      // Update function to apply metadata changes to a PDF
      const updatePdfMetadata = (pdf) => {
        if (pdf.id === id) {
          return { ...pdf, job_number, construction_method };
        }
        return pdf;
      };

      // Update both working copies and main state
      setWorkingPdfs(prev => prev.map(updatePdfMetadata));
      setWorkingPendingPdfs(prev => prev.map(updatePdfMetadata));
      setPdfs(prev => prev.map(updatePdfMetadata));
      setPendingPdfs(prev => prev.map(updatePdfMetadata));
      return;
    }

    // Skip other reloads during edit mode
    if (editMode) {
      console.log('Skipping reload during edit mode');
      return;
    }

    const relevantTypes = [
      'pdf_uploaded',
      'pdf_deleted',
      'pdfs_reordered',
      'pdf_labels_updated',
      'pdf_status_updated',
      'pdf_metadata_updated',
      'pdf_dark_mode_ready',
      'label_created',
      'label_updated',
      'label_deleted',
      'settings_updated'
    ];

    if (relevantTypes.includes(message.type)) {
      // Edge case: If slideshow is open and grid is updated, clear originRect
      // It will be recaptured when user closes the slideshow
      if (viewMode === 'slideshow' &&
          ['pdf_deleted', 'pdfs_reordered', 'pdf_uploaded'].includes(message.type)) {
        console.log('[HomePage] Grid updated while slideshow open, clearing stale originRect');
        setOriginRect(null);
      }

      loadData();
    }
  }, [editMode, loadData, viewMode]);

  useWebSocket(handleWebSocketMessage, true);

  // Pull-to-refresh functionality
  useEffect(() => {
    let touchStartY = 0;
    let touchStartScrollTop = 0;

    const handleTouchStart = (e) => {
      // Only enable pull-to-refresh when in grid view and not in edit mode
      if (viewMode === 'slideshow' || editMode || pullToRefresh.refreshing) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // Only allow pull-to-refresh when at the top of the page
      if (scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        touchStartScrollTop = scrollTop;
      }
    };

    const handleTouchMove = (e) => {
      if (viewMode === 'slideshow' || editMode || pullToRefresh.refreshing) return;
      if (touchStartY === 0) return;

      const touchY = e.touches[0].clientY;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const pullDistance = touchY - touchStartY;

      // Only trigger if pulling down from top
      if (scrollTop === 0 && pullDistance > 0) {
        setPullToRefresh({ pulling: true, distance: Math.min(pullDistance, 100), refreshing: false });

        // Prevent default scroll when pulling
        if (pullDistance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (viewMode === 'slideshow' || editMode) return;

      const { pulling, distance } = pullToRefresh;

      if (pulling && distance > 60) {
        // Trigger refresh
        setPullToRefresh({ pulling: false, distance: 0, refreshing: true });

        try {
          await loadData();
        } finally {
          setTimeout(() => {
            setPullToRefresh({ pulling: false, distance: 0, refreshing: false });
          }, 500);
        }
      } else {
        // Reset if not pulled enough
        setPullToRefresh({ pulling: false, distance: 0, refreshing: false });
      }

      touchStartY = 0;
      touchStartScrollTop = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [viewMode, editMode, pullToRefresh, loadData]);

  const handleLogout = () => {
    authAPI.logout();
    setIsAuthenticated(false);
    setEditMode(false);
    setHasUnsavedChanges(false);
    navigate('/');
    // Reload to show only public PDFs
    loadData();
  };

  const handleReorder = (newPdfs) => {
    setWorkingPdfs(newPdfs);
    setHasUnsavedChanges(true);
  };

  const handleToggleEditMode = async () => {
    if (editMode) {
      // Exiting edit mode - save if there are changes
      if (hasUnsavedChanges) {
        try {
          const allPdfs = [];

          // Board PDFs - ensure they're marked as not pending
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
                position: allPdfs.length + index + 1,
                is_pending: 1
              });
            }
          });

          // Save positions
          await pdfAPI.reorder(allPdfs.map(p => ({ id: p.id, position: p.position })));

          // Update status for all PDFs that changed
          const statusUpdates = [];

          allPdfs.forEach(pdfUpdate => {
            const originalPdf = [...pdfs, ...pendingPdfs].find(p => p && p.id === pdfUpdate.id);
            if (originalPdf && originalPdf.is_pending !== pdfUpdate.is_pending) {
              statusUpdates.push(pdfAPI.updateStatus(pdfUpdate.id, pdfUpdate.is_pending));
            }
          });

          if (statusUpdates.length > 0) {
            await Promise.all(statusUpdates);
          }

          // Update metadata for all PDFs that changed
          const metadataUpdates = [];
          const workingAllPdfs = [...workingPdfs, ...workingPendingPdfs];

          workingAllPdfs.forEach(workingPdf => {
            if (!workingPdf) return;

            const originalPdf = [...pdfs, ...pendingPdfs].find(p => p && p.id === workingPdf.id);
            if (originalPdf) {
              const metadataChanged =
                originalPdf.job_number !== workingPdf.job_number ||
                originalPdf.construction_method !== workingPdf.construction_method ||
                originalPdf.placeholder_text !== workingPdf.placeholder_text;

              if (metadataChanged) {
                metadataUpdates.push(
                  pdfAPI.updateMetadata(workingPdf.id, {
                    job_number: workingPdf.job_number,
                    construction_method: workingPdf.construction_method,
                    placeholder_text: workingPdf.placeholder_text
                  })
                );
              }
            }
          });

          if (metadataUpdates.length > 0) {
            await Promise.all(metadataUpdates);
          }

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

      if (editMode) {
        setWorkingPdfs(workingPdfs.filter((pdf) => pdf && pdf.id !== id));
        setWorkingPendingPdfs(workingPendingPdfs.filter((pdf) => pdf && pdf.id !== id));
        setHasUnsavedChanges(true);
      } else {
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

    if (editMode && uploadedPdf) {
      if (uploadedPdf.is_pending) {
        setWorkingPendingPdfs([...workingPendingPdfs, uploadedPdf]);
      } else {
        if (uploadTargetPosition !== null) {
          const newWorkingPdfs = [...workingPdfs];
          newWorkingPdfs.splice(uploadTargetPosition - 1, 0, uploadedPdf);
          setWorkingPdfs(newWorkingPdfs);
        } else {
          setWorkingPdfs([...workingPdfs, uploadedPdf]);
        }
      }
      setHasUnsavedChanges(true);
    } else {
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
      try {
        const allPdfsRes = await pdfAPI.getAll(true);
        const allPdfs = allPdfsRes.data;
        const updatedPdf = allPdfs.find(p => p && p.id === pdfId);

        if (updatedPdf) {
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
      await loadData();
    }
  };

  const handleMetadataUpdate = (pdfId, metadata) => {
    setWorkingPdfs(prevWorking =>
      prevWorking.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
    );
    setWorkingPendingPdfs(prevWorking =>
      prevWorking.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
    );

    if (!editMode) {
      setPdfs(prevPdfs =>
        prevPdfs.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
      );
      setPendingPdfs(prevPending =>
        prevPending.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
      );
    } else {
      // Mark changes as unsaved when in edit mode
      setHasUnsavedChanges(true);
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

      if (editMode && placeholder) {
        const newWorkingPdfs = [...workingPdfs];
        newWorkingPdfs[position] = placeholder;
        setWorkingPdfs(newWorkingPdfs);
        setHasUnsavedChanges(true);
      } else {
        await loadData();
      }
    } catch (error) {
      console.error('Error creating placeholder:', error);
      alert('Failed to create placeholder');
    }
  };

  const handleEditPlaceholder = async (placeholder) => {
    const newText = prompt('Enter placeholder text:', placeholder.placeholder_text || 'PLACEHOLDER');
    if (newText === null) return; // User cancelled

    try {
      await pdfAPI.updateMetadata(placeholder.id, { placeholder_text: newText });
      await loadData(); // Reload to show the updated text
    } catch (error) {
      console.error('Error updating placeholder text:', error);
      alert('Failed to update placeholder text');
    }
  };

  const handleUploadToSlot = (position) => {
    setUploadTargetPosition(position + 1);
    setUploadToPending(false);
    setShowSlotMenu(null);
    setShowUpload(true);
  };

  const handleMovePdfToBoard = (pdfId) => {
    const pdfToMove = workingPendingPdfs.find(pdf => pdf && pdf.id === pdfId);
    if (!pdfToMove) return;

    const updatedPdf = { ...pdfToMove, is_pending: 0 };
    setWorkingPendingPdfs(workingPendingPdfs.filter(pdf => pdf && pdf.id !== pdfId));
    setWorkingPdfs([...workingPdfs, updatedPdf]);
    setHasUnsavedChanges(true);
  };

  const handleMoveAllPdfsToBoard = () => {
    if (workingPendingPdfs.length === 0) return;

    if (!confirm(`Add all ${workingPendingPdfs.length} pending PDFs to the board?`)) {
      return;
    }

    const movedPdfs = workingPendingPdfs.filter(pdf => pdf).map(pdf => ({ ...pdf, is_pending: 0 }));
    setWorkingPdfs([...workingPdfs, ...movedPdfs]);
    setWorkingPendingPdfs([]);
    setHasUnsavedChanges(true);
  };

  const handleMovePdfToPending = (pdfId) => {
    const pdfToMove = workingPdfs.find(pdf => pdf && pdf.id === pdfId);
    if (!pdfToMove) return;

    const updatedPdf = { ...pdfToMove, is_pending: 1 };
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

    let destContainer = null;
    let destIndex = null;

    if (typeof overId === 'string') {
      if (overId.startsWith('board-')) {
        destContainer = 'board';
        destIndex = parseInt(overId.split('-')[1]);
      } else if (overId === 'pending-container') {
        destContainer = 'pending';
        destIndex = workingPendingPdfs.length;
      }
    }

    if (!destContainer) {
      return;
    }

    // Handle dragging within board
    if (sourceContainer === 'board' && destContainer === 'board') {
      if (sourceIndex === destIndex) {
        return;
      }

      const newPdfs = [...workingPdfs];
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
      const destPdfItem = newBoardPdfs[destIndex];

      newBoardPdfs[destIndex] = updatedPdf;

      if (destPdfItem) {
        newBoardPdfs.push(destPdfItem);
      }

      setWorkingPendingPdfs(newPendingPdfs);
      setWorkingPdfs(newBoardPdfs);
      setHasUnsavedChanges(true);
    }
    // Handle dragging from board to pending
    else if (sourceContainer === 'board' && destContainer === 'pending') {
      if (sourcePdf.is_placeholder) {
        console.log('Cannot move placeholder to pending');
        return;
      }

      const newBoardPdfs = [...workingPdfs];
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

  const handlePdfClick = (pdf, event) => {
    // Only allow slideshow in non-edit mode
    if (editMode) return;

    // Use filtered pdfs (no nulls/undefined) for consistent indexing with SlideShowView
    const displayPdfs = pdfs.filter(p => p);
    const clickedIndex = displayPdfs.findIndex(p => p.id === pdf.id);

    console.log('[HomePage] handlePdfClick DEBUG:');
    console.log('  - Clicked PDF:', pdf);
    console.log('  - Total pdfs (with nulls):', pdfs.length);
    console.log('  - displayPdfs (filtered):', displayPdfs.length);
    console.log('  - Clicked index in displayPdfs:', clickedIndex);
    console.log('  - displayPdfs:', displayPdfs.map(p => ({ id: p.id, is_placeholder: p.is_placeholder })));

    // Capture the clicked element's position for zoom animation
    // Walk up the DOM to find the clickable div container
    let target = event.target;
    while (target && !target.classList.contains('cursor-pointer')) {
      target = target.parentElement;
    }

    if (target) {
      const rect = target.getBoundingClientRect();
      setOriginRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        // Store viewport scroll position for edge case handling
        scrollX: window.scrollX || window.pageXOffset,
        scrollY: window.scrollY || window.pageYOffset,
      });
      console.log('[HomePage] Captured origin rect:', rect);
    }

    setViewMode('slideshow');
    localStorage.setItem('viewMode', 'slideshow');

    if (clickedIndex >= 0) {
      setSelectedPdf(pdf);
    }
  };

  const toggleViewMode = () => {
    console.log('[HomePage] toggleViewMode called, current viewMode:', viewMode);
    if (viewMode === 'slideshow') {
      // Exiting slideshow - switch to grid immediately, capture rect, then animate
      console.log('[HomePage] Exiting slideshow via toggle');
      setViewMode('grid');
      localStorage.setItem('viewMode', 'grid');

      // Use filtered pdfs (no nulls/undefined) for consistent indexing with SlideShowView
      const displayPdfs = pdfs.filter(p => p);
      const targetPdf = displayPdfs[currentSlideshowIndex];
      if (targetPdf) {
        // Wait for grid to be rendered, then find the card
        requestAnimationFrame(() => {
          // Find the card by data-pdf-id attribute
          const foundCard = document.querySelector(`[data-pdf-id="${targetPdf.id}"]`);

          if (foundCard) {
            const rect = foundCard.getBoundingClientRect();
            setOriginRect({
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              scrollX: window.scrollX || window.pageXOffset,
              scrollY: window.scrollY || window.pageYOffset,
            });
            console.log('[HomePage] Captured origin rect for toggle exit:', rect);
          } else {
            console.warn('[HomePage] Could not find card for toggle exit, using fallback');
          }
        });
      }
      setIsClosingSlideshow(true);
    } else {
      // Entering slideshow - capture first item's rect before switching
      console.log('[HomePage] Entering slideshow via toggle, capturing first item rect');
      const gridContainer = document.querySelector('.grid');
      if (gridContainer) {
        const cards = gridContainer.querySelectorAll('.cursor-pointer');
        if (cards.length > 0) {
          const firstCard = cards[0];
          const rect = firstCard.getBoundingClientRect();
          setOriginRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            scrollX: window.scrollX || window.pageXOffset,
            scrollY: window.scrollY || window.pageYOffset,
          });
          console.log('[HomePage] Captured origin rect for toggle entry:', rect);
        }
      }
      // Switch to slideshow after capturing rect
      setViewMode('slideshow');
      localStorage.setItem('viewMode', 'slideshow');
      setSelectedPdf(null);
    }
  };

  const handleInitiateClose = () => {
    // Trigger zoom-out animation
    console.log('[HomePage] handleInitiateClose called');

    // Switch to grid view immediately so it's already rendered underneath
    setViewMode('grid');
    localStorage.setItem('viewMode', 'grid');

    // Use filtered pdfs (no nulls/undefined) for consistent indexing with SlideShowView
    const displayPdfs = pdfs.filter(p => p);
    // Get the currently viewed PDF based on slideshow index
    const currentPdf = displayPdfs[currentSlideshowIndex];
    console.log('[HomePage] Current slideshow index:', currentSlideshowIndex, 'PDF:', currentPdf);

    if (currentPdf) {
      // Wait for grid to render, then find the card for the currently viewed PDF
      requestAnimationFrame(() => {
        // Find the card by data-pdf-id attribute
        const foundCard = document.querySelector(`[data-pdf-id="${currentPdf.id}"]`);

        if (foundCard) {
          const rect = foundCard.getBoundingClientRect();
          const updatedOriginRect = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            scrollX: window.scrollX || window.pageXOffset,
            scrollY: window.scrollY || window.pageYOffset,
          };
          setOriginRect(updatedOriginRect);
          console.log('[HomePage] Captured origin rect for current item:', updatedOriginRect);
        } else {
          console.warn('[HomePage] Could not find current PDF in grid, using fallback close animation');
          setOriginRect(null);
        }
      });
    }

    setIsClosingSlideshow(true);
  };

  const handleSlideshowAnimationComplete = () => {
    // Called after zoom-out animation completes
    console.log('[HomePage] handleSlideshowAnimationComplete called, cleaning up');
    // Grid view already set in handleInitiateClose, just clean up states
    setSelectedPdf(null);
    setIsClosingSlideshow(false);
    setOriginRect(null); // Clear origin rect after animation
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-xl text-gray-600 dark:text-gray-400 transition-colors">Loading...</div>
      </div>
    );
  }

  const gridContent = () => {
    if (isAuthenticated && editMode) {
      return (
        <AdminGrid
          pdfs={workingPdfs}
          rows={settings.grid_rows}
          cols={settings.grid_cols}
          aspectWidth={settings.aspect_ratio_width}
          aspectHeight={settings.aspect_ratio_height}
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
          onEditPlaceholder={handleEditPlaceholder}
        />
      );
    }

    return (
      <PDFGrid
        pdfs={pdfs}
        rows={settings.grid_rows}
        cols={settings.grid_cols}
        aspectWidth={settings.aspect_ratio_width}
        aspectHeight={settings.aspect_ratio_height}
        onPdfClick={handlePdfClick}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 transition-colors">
      {/* Pull-to-Refresh Indicator */}
      {(pullToRefresh.pulling || pullToRefresh.refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-200"
          style={{
            transform: `translateY(${pullToRefresh.pulling ? Math.min(pullToRefresh.distance - 60, 40) : 0}px)`,
            opacity: pullToRefresh.refreshing ? 1 : Math.min(pullToRefresh.distance / 80, 1)
          }}
        >
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg">
            {pullToRefresh.refreshing ? (
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-gray-600 dark:text-gray-300 transition-transform duration-200"
                style={{ transform: `rotate(${Math.min(pullToRefresh.distance * 3, 180)}deg)` }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              <span className="hidden sm:inline">Kustom Kraft Cabinets - Job Board</span>
              <span className="sm:hidden">KK Cabinets</span>
            </h1>
            <div className="flex items-center space-x-2 sm:space-x-4">
            {!editMode && (
              <button
                onClick={toggleViewMode}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={viewMode === 'grid' ? 'Slideshow View' : 'Grid View'}
              >
                {viewMode === 'grid' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                )}
              </button>
            )}
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
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 sm:px-0 sm:py-0"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 sm:px-0 sm:py-0"
                >
                  Admin
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Admin Toolbar - Only visible when authenticated */}
      {isAuthenticated && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors overflow-x-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
            <div className="flex flex-nowrap sm:flex-wrap gap-2 sm:gap-3 min-w-max sm:min-w-0">
              <button
                onClick={handleToggleEditMode}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
                  editMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {editMode ? (hasUnsavedChanges ? 'Save' : 'Done') : 'Edit'}
              </button>
              {editMode && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm whitespace-nowrap"
                >
                  Settings
                </button>
              )}
              <button
                onClick={() => setShowLabelManagement(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm whitespace-nowrap"
              >
                <span className="hidden sm:inline">Manage Labels</span>
                <span className="sm:hidden">Labels</span>
              </button>
              <button
                onClick={() => navigate('/admin/ocr-settings')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors text-sm whitespace-nowrap"
              >
                <span className="hidden sm:inline">OCR Settings</span>
                <span className="sm:hidden">OCR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={viewMode === 'grid' ? 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8' : 'w-full'}>
        {isAuthenticated && editMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {editMode && (
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 transition-colors">
                <p className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm transition-colors">
                  <span className="hidden sm:inline">Drag and drop PDFs to reorder them. Click the tag icon to manage labels. Click the X to delete. Click the + button on empty slots to add placeholders.</span>
                  <span className="sm:hidden">Drag to reorder • Tag icon for labels • X to delete • + for placeholders</span>
                  {hasUnsavedChanges && <strong className="block sm:inline sm:ml-2 mt-1 sm:mt-0">Changes will be saved when you click "Save".</strong>}
                </p>
              </div>
            )}

            {/* Pending Section - Only visible to admins */}
            <PendingSection
              pdfs={editMode ? workingPendingPdfs : pendingPdfs}
              onMovePdfToBoard={editMode ? handleMovePdfToBoard : null}
              onMoveAllPdfsToBoard={editMode ? handleMoveAllPdfsToBoard : null}
              onDelete={editMode ? handleDelete : null}
              onUploadToPending={handleUploadToPending}
              editMode={editMode}
              onMetadataUpdate={handleMetadataUpdate}
            />

            {gridContent()}
          </DndContext>
        ) : (
          <>
            {/* Pending Section - Visible to admins even when not in edit mode */}
            {isAuthenticated && pendingPdfs.length > 0 && (
              <PendingSection
                pdfs={pendingPdfs}
                onMovePdfToBoard={null}
                onMoveAllPdfsToBoard={null}
                onDelete={null}
                onUploadToPending={handleUploadToPending}
                editMode={false}
              />
            )}

            {pdfs.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl text-gray-600 dark:text-gray-400 transition-colors">No job postings available</p>
              </div>
            ) : (
              <>
                {/* Grid is always loaded, hidden when in slideshow mode (unless closing) */}
                <div className={viewMode === 'slideshow' && !isClosingSlideshow ? 'hidden' : ''}>
                  {gridContent()}
                </div>

                {/* Show slideshow when in slideshow mode, or when closing (overlay on top) */}
                {(viewMode === 'slideshow' || isClosingSlideshow) && (() => {
                  // Use filtered pdfs (no nulls/undefined) for consistent indexing
                  const displayPdfs = pdfs.filter(p => p);
                  return (
                    <SlideShowView
                      pdfs={displayPdfs}
                      initialIndex={selectedPdf ? displayPdfs.findIndex(p => p.id === selectedPdf.id) : 0}
                      onClose={handleInitiateClose}
                      enteredViaClick={selectedPdf !== null}
                      isClosing={isClosingSlideshow}
                      onAnimationComplete={handleSlideshowAnimationComplete}
                      originRect={originRect}
                      onIndexChange={setCurrentSlideshowIndex}
                      aspectWidth={settings.aspect_ratio_width}
                      aspectHeight={settings.aspect_ratio_height}
                    />
                  );
                })()}
              </>
            )}
          </>
        )}
      </main>

      {/* Modals - Only available to admins */}
      {isAuthenticated && (
        <>
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
        </>
      )}
    </div>
  );
}

export default HomePage;
