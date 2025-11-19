import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { pdfAPI, settingsAPI, authAPI } from '../utils/api';
import PDFGrid from '../components/PDFGrid';
import AdminGrid from '../components/AdminGrid';
import SlideShowView from '../components/SlideShowView';
import UploadModal from '../components/UploadModal';
import SettingsModal from '../components/SettingsModal';
import LabelModal from '../components/LabelModal';
import LabelManagementModal from '../components/LabelManagementModal';
import PlaceholderEditModal from '../components/PlaceholderEditModal';
import AlertModal from '../components/AlertModal';
import PendingSection from '../components/PendingSection';
import DeliveryScheduleModal from '../components/DeliveryScheduleModal';
import useWebSocket from '../hooks/useWebSocket';
import { useDarkMode } from '../contexts/DarkModeContext';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  showNewJobNotification,
  showJobsMovedNotification,
  showCustomAlertNotification,
} from '../utils/notifications';

function HomePage() {
  const { darkMode, toggleDarkMode, isTransitioning, targetDarkMode } = useDarkMode();
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
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showDeliverySchedule, setShowDeliverySchedule] = useState(false);
  const [selectedPdfForLabels, setSelectedPdfForLabels] = useState(null);
  const [showPlaceholderEdit, setShowPlaceholderEdit] = useState(false);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState(null);
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
  const [editLock, setEditLock] = useState(null); // { lockedBy: sessionId, lockedAt: timestamp }
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);
  const [highlightedJobId, setHighlightedJobId] = useState(null);
  const navigate = useNavigate();

  // Configure drag sensors - both mouse/pointer and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms delay before drag starts on touch
        tolerance: 5, // 5px tolerance for movement during delay
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

  // Check URL parameter for highlightJob on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightJobId = urlParams.get('highlightJob');
    if (highlightJobId) {
      // Wait for PDFs to load, then highlight
      const waitForPdfs = setInterval(() => {
        if (pdfs.length > 0) {
          clearInterval(waitForPdfs);
          setHighlightedJobId(parseInt(highlightJobId));
          // Clean up URL
          window.history.replaceState({}, '', '/');
        }
      }, 100);
      // Clear interval after 5 seconds if PDFs don't load
      setTimeout(() => clearInterval(waitForPdfs), 5000);
    }
  }, [pdfs]);

  // Listen for service worker messages to highlight jobs
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event) => {
      if (event.data && event.data.type === 'HIGHLIGHT_JOB') {
        console.log('[HomePage] Received highlight job message:', event.data.jobId);
        setHighlightedJobId(event.data.jobId);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Scroll to and clear highlight after delay
  useEffect(() => {
    if (highlightedJobId && pdfs.length > 0) {
      // Scroll to the job card
      setTimeout(() => {
        const jobElement = document.querySelector(`[data-pdf-id="${highlightedJobId}"]`);
        if (jobElement) {
          jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      // Clear highlight after 5 seconds
      const timeout = setTimeout(() => {
        setHighlightedJobId(null);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [highlightedJobId, pdfs]);

  // WebSocket connection for live updates
  const handleWebSocketMessage = useCallback((message) => {
    console.log('Received update:', message.type);

    // Handle edit lock messages
    if (message.type === 'edit_lock_acquired') {
      const { sessionId: lockedBy, timestamp } = message.data;
      setEditLock({ lockedBy, lockedAt: timestamp });
      console.log('[Edit Lock] Acquired by session:', lockedBy);
      return;
    }

    if (message.type === 'edit_lock_released') {
      setEditLock(null);
      console.log('[Edit Lock] Released');
      return;
    }

    // Handle notifications (trigger browser notifications for updates)
    if (message.type === 'pdf_uploaded' && message.data?.is_pending === 0) {
      // Only notify for jobs uploaded directly to the board (not pending)
      showNewJobNotification(message.data?.id);
    } else if (message.type === 'job_activated') {
      // Notify when a job is moved from pending to active board
      showNewJobNotification(message.data?.id);
    } else if (message.type === 'pdfs_reordered') {
      showJobsMovedNotification();
    } else if (message.type === 'custom_alert') {
      showCustomAlertNotification(message.data?.message || 'Admin Alert');
    }

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

    // During edit mode, mark that external changes occurred but still apply them
    const relevantTypes = [
      'pdf_uploaded',
      'pdf_deleted',
      'pdfs_reordered',
      'pdf_labels_updated',
      'pdf_status_updated',
      'job_activated',
      'pdf_metadata_updated',
      'pdf_dark_mode_ready',
      'label_created',
      'label_updated',
      'label_deleted',
      'settings_updated',
      'custom_alert'
    ];

    if (relevantTypes.includes(message.type)) {
      // Edge case: If slideshow is open and grid is updated, clear originRect
      // It will be recaptured when user closes the slideshow
      if (viewMode === 'slideshow' &&
          ['pdf_deleted', 'pdfs_reordered', 'pdf_uploaded'].includes(message.type)) {
        console.log('[HomePage] Grid updated while slideshow open, clearing stale originRect');
        setOriginRect(null);
      }

      if (editMode) {
        // During edit mode, only apply pending uploads from other admins
        // Board changes are prevented by edit lock
        if (message.type === 'pdf_uploaded' && message.data?.is_pending) {
          console.log('Pending PDF uploaded while in edit mode - updating working copy');
          loadData().then(() => {
            setPendingPdfs(prev => {
              setWorkingPendingPdfs([...prev]);
              return prev;
            });
          });
        }
      } else {
        loadData();
      }
    }
  }, [editMode, loadData, viewMode]);

  const { send: sendWebSocketMessage } = useWebSocket(handleWebSocketMessage, true);

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

  // Track activity to prevent inactivity timeout
  const trackActivity = useCallback(() => {
    if (editMode) {
      lastActivityRef.current = Date.now();
    }
  }, [editMode]);

  const handleReorder = (newPdfs) => {
    setWorkingPdfs(newPdfs);
    setHasUnsavedChanges(true);
    trackActivity();
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return;
      }
    }

    // Release edit lock
    sendWebSocketMessage({
      type: 'edit_lock_released',
      data: { sessionId }
    });
    console.log('[Edit Lock] Released lock (cancelled)');

    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Discard changes and exit edit mode
    setEditMode(false);
    setHasUnsavedChanges(false);
    setWorkingPdfs([]);
    setWorkingPendingPdfs([]);
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

      // Release edit lock
      sendWebSocketMessage({
        type: 'edit_lock_released',
        data: { sessionId }
      });
      console.log('[Edit Lock] Released lock');

      // Clear inactivity timer
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }

      setEditMode(false);
      setHasUnsavedChanges(false);
    } else {
      // Check if edit mode is locked by another admin
      if (editLock && editLock.lockedBy !== sessionId) {
        // Check if lock is stale (more than 6 minutes old)
        const lockAge = Date.now() - editLock.lockedAt;
        if (lockAge < 6 * 60 * 1000) { // 6 minutes
          alert('Another admin is currently in edit mode. Please wait until they finish.');
          return;
        }
        console.log('[Edit Lock] Stale lock detected, proceeding');
      }

      // Entering edit mode - acquire lock
      sendWebSocketMessage({
        type: 'edit_lock_acquired',
        data: { sessionId, timestamp: Date.now() }
      });
      console.log('[Edit Lock] Acquired lock');

      setEditMode(true);
      setWorkingPdfs([...pdfs]);
      setWorkingPendingPdfs([...pendingPdfs]);
      setHasUnsavedChanges(false);
      lastActivityRef.current = Date.now();

      // Start inactivity timer (check every 30 seconds)
      inactivityTimerRef.current = setInterval(() => {
        const inactiveTime = Date.now() - lastActivityRef.current;
        if (inactiveTime >= 5 * 60 * 1000) { // 5 minutes
          console.log('[Edit Lock] Inactivity timeout - auto-exiting edit mode');
          alert('Edit mode automatically closed due to 5 minutes of inactivity.');
          handleCancelEdit();
        }
      }, 30000); // Check every 30 seconds

      // Request notification permission for admins and subscribe to push
      requestNotificationPermission()
        .then(async (permission) => {
          if (permission === 'granted') {
            // Subscribe to push notifications for background delivery
            await subscribeToPushNotifications();
          }
        })
        .catch(err => {
          console.error('Error requesting notification permission:', err);
        });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this PDF?')) {
      return;
    }

    try {
      // Check if this is a pending PDF before deleting
      const isPendingPdf = workingPendingPdfs.some(pdf => pdf && pdf.id === id);

      await pdfAPI.delete(id);

      if (editMode) {
        setWorkingPdfs(workingPdfs.filter((pdf) => pdf && pdf.id !== id));
        setWorkingPendingPdfs(workingPendingPdfs.filter((pdf) => pdf && pdf.id !== id));

        // Also update main state for pending PDFs to keep in sync
        if (isPendingPdf) {
          setPendingPdfs(pendingPdfs.filter((pdf) => pdf && pdf.id !== id));
          // Pending PDF deletes are independent - don't mark as having unsaved changes
        } else {
          // Board PDF deletes require clicking "Save" to update positions
          setHasUnsavedChanges(true);
          trackActivity();
        }
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
      // Uploads to pending are independent and don't require "Save"
      if (uploadedPdf.is_pending) {
        // Reload data to get the uploaded PDF from backend
        await loadData();
        // Update working copies to include the new pending PDF
        setPdfs(prev => {
          setWorkingPdfs([...prev]);
          return prev;
        });
        setPendingPdfs(prev => {
          setWorkingPendingPdfs([...prev]);
          return prev;
        });
        // Don't mark as having unsaved changes - pending uploads are independent
      } else {
        // Uploads to board positions still require saving
        if (uploadTargetPosition !== null) {
          const newWorkingPdfs = [...workingPdfs];
          newWorkingPdfs.splice(uploadTargetPosition - 1, 0, uploadedPdf);
          setWorkingPdfs(newWorkingPdfs);
        } else {
          setWorkingPdfs([...workingPdfs, uploadedPdf]);
        }
        setHasUnsavedChanges(true);
      }
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

    // Always refresh data after label changes to ensure consistency
    await loadData();
  };

  const handleMetadataUpdate = async (pdfId, metadata) => {
    // Check if this is a pending PDF
    const isPendingPdf = workingPendingPdfs.some(pdf => pdf && pdf.id === pdfId);

    // Update working copies
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
      // Pending PDF metadata updates are independent and save immediately
      if (isPendingPdf) {
        try {
          await pdfAPI.updateMetadata(pdfId, metadata);
          // Update main state as well to keep in sync
          setPendingPdfs(prevPending =>
            prevPending.map(pdf => (pdf && pdf.id === pdfId) ? { ...pdf, ...metadata } : pdf)
          );
          // Don't mark as having unsaved changes - pending metadata updates are independent
        } catch (error) {
          console.error('Error saving pending PDF metadata:', error);
          alert('Failed to save metadata changes');
        }
      } else {
        // Board PDF metadata updates require clicking "Save"
        setHasUnsavedChanges(true);
        trackActivity();
      }
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

  const handleEditPlaceholder = (placeholder) => {
    setSelectedPlaceholder(placeholder);
    setShowPlaceholderEdit(true);
  };

  const handleSavePlaceholder = async (newText) => {
    if (!selectedPlaceholder) return;

    try {
      await pdfAPI.updateMetadata(selectedPlaceholder.id, { placeholder_text: newText });
      setShowPlaceholderEdit(false);
      setSelectedPlaceholder(null);
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
          // Scroll the card into view first (centered if possible)
          foundCard.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });

          // Wait a frame for scroll to complete, then capture rect
          requestAnimationFrame(() => {
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

            // Start close animation after rect is captured
            setIsClosingSlideshow(true);
          });
        } else {
          console.warn('[HomePage] Could not find current PDF in grid, using fallback close animation');
          setOriginRect(null);
          setIsClosingSlideshow(true);
        }
      });
    } else {
      setIsClosingSlideshow(true);
    }
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
      <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center ${!isTransitioning ? 'transition-colors' : ''}`}>
        <div className={`text-xl text-gray-600 dark:text-gray-400 ${!isTransitioning ? 'transition-colors' : ''}`}>Loading...</div>
      </div>
    );
  }

  const gridContent = () => {
    // Only animate in grid view, not in slideshow
    const shouldAnimate = isTransitioning && viewMode === 'grid';

    console.log('[HomePage] gridContent render:', {
      isTransitioning,
      viewMode,
      shouldAnimate,
      editMode
    });

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
          isTransitioning={shouldAnimate}
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
        isTransitioning={shouldAnimate}
        highlightedJobId={highlightedJobId}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 relative transition-colors">
      {/* Pull-to-Refresh Indicator */}
      {(pullToRefresh.pulling || pullToRefresh.refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-200"
          style={{
            transform: `translateY(${pullToRefresh.pulling ? Math.min(pullToRefresh.distance - 60, 40) : 0}px) translateZ(0)`,
            opacity: pullToRefresh.refreshing ? 1 : Math.min(pullToRefresh.distance / 80, 1),
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
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
      <header className="bg-white dark:bg-gray-800 shadow-sm relative z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              <span className="hidden sm:inline">Kustom Kraft Cabinets - Job Board</span>
              <span className="sm:hidden">KKC - Job Board</span>
            </h1>
            <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={() => setShowDeliverySchedule(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
              title="View this week's delivery schedule"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Delivery Schedule</span>
            </button>
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
              onClick={(e) => toggleDarkMode(e)}
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
            <a
              href="/manage-notifications.html"
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Manage Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </a>
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 sm:px-0 sm:py-0"
                  title="Logout from admin account"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 sm:px-0 sm:py-0"
                  title="Login to admin panel"
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
        <div
          className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors overflow-x-auto relative z-10"
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          }}
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
            <div className="flex flex-nowrap sm:flex-wrap gap-2 sm:gap-3 min-w-max sm:min-w-0">
              <button
                onClick={handleToggleEditMode}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap ${
                  editMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
                title={editMode ? (hasUnsavedChanges ? 'Save changes and exit edit mode' : 'Exit edit mode') : 'Enter edit mode to reorder and manage jobs'}
              >
                {editMode ? 'Save' : 'Edit'}
              </button>
              {editMode && (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap`}
                    title="Discard all changes and exit edit mode"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap`}
                    title="Configure grid size and aspect ratio"
                  >
                    <span className="hidden sm:inline">Grid Settings</span>
                    <span className="sm:hidden">Grid</span>
                  </button>
                  <button
                    onClick={() => setShowLabelManagement(true)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap`}
                    title="Create, edit, and delete job labels"
                  >
                    <span className="hidden sm:inline">Manage Labels</span>
                    <span className="sm:hidden">Labels</span>
                  </button>
                  <button
                    onClick={() => navigate('/admin/ocr-settings')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap`}
                    title="Configure OCR extraction settings for job numbers and types"
                  >
                    <span className="hidden sm:inline">OCR Settings</span>
                    <span className="sm:hidden">OCR</span>
                  </button>
                </>
              )}
              {!editMode && (
                <button
                  onClick={handleUploadToPending}
                  disabled={editLock !== null}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap ${
                    editLock !== null
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                  title={editLock !== null ? 'Upload disabled while another admin is in edit mode' : 'Upload PDFs to pending section'}
                >
                  <span className="hidden sm:inline">Upload to Pending</span>
                  <span className="sm:hidden">Upload</span>
                </button>
              )}
              <button
                onClick={() => setShowAlertModal(true)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 ${!isTransitioning ? 'transition-colors' : ''} text-sm whitespace-nowrap`}
              >
                <span className="hidden sm:inline">Send Alert</span>
                <span className="sm:hidden">Alert</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main
        className={viewMode === 'grid' ? 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 relative z-10' : 'w-full relative z-10'}
        style={{
          // Only apply transform in grid mode - transform creates stacking context that breaks position:fixed in slideshow
          ...(viewMode === 'grid' && {
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          })
        }}
      >
        {isAuthenticated && editMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {editMode && (
              <div className={`mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 ${!isTransitioning ? 'transition-colors' : ''}`}>
                <p className={`text-blue-800 dark:text-blue-200 text-xs sm:text-sm ${!isTransitioning ? 'transition-colors' : ''}`}>
                  <span className="hidden sm:inline">Drag and drop PDFs to reorder them. Click the tag icon to manage labels. Click the X to delete. Click the + button on empty slots to add placeholders.</span>
                  <span className="sm:hidden">Drag to reorder • Tag icon for labels • X to delete • + for placeholders</span>
                  {hasUnsavedChanges && <strong className="block sm:inline sm:ml-2 mt-1 sm:mt-0">Unsaved position changes.</strong>}
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
                <p className={`text-xl text-gray-600 dark:text-gray-400 ${!isTransitioning ? 'transition-colors' : ''}`}>No job postings available</p>
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

          {showPlaceholderEdit && selectedPlaceholder && (
            <PlaceholderEditModal
              placeholder={selectedPlaceholder}
              onClose={() => {
                setShowPlaceholderEdit(false);
                setSelectedPlaceholder(null);
              }}
              onSave={handleSavePlaceholder}
            />
          )}

          {showAlertModal && (
            <AlertModal
              isOpen={showAlertModal}
              onClose={() => setShowAlertModal(false)}
            />
          )}
        </>
      )}

      {/* Delivery Schedule Modal - Available to all users */}
      {showDeliverySchedule && (
        <DeliveryScheduleModal
          onClose={() => setShowDeliverySchedule(false)}
          isAdmin={isAuthenticated}
        />
      )}
    </div>
  );
}

export default HomePage;
