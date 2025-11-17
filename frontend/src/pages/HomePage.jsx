import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pdfAPI, settingsAPI } from '../utils/api';
import PDFGrid from '../components/PDFGrid';
import SlideShowView from '../components/SlideShowView';
import useWebSocket from '../hooks/useWebSocket';
import { useDarkMode } from '../contexts/DarkModeContext';

function HomePage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [pdfs, setPdfs] = useState([]);
  const [settings, setSettings] = useState({ grid_rows: 6, grid_cols: 4 });
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('viewMode');
    return saved || 'grid';
  });
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [pdfsRes, settingsRes] = await Promise.all([
        pdfAPI.getAll(),
        settingsAPI.get(),
      ]);
      setPdfs(pdfsRes.data);
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
    console.log('Received update:', message.type);
    // Reload data when any relevant update is received
    const relevantTypes = [
      'pdf_uploaded',
      'pdf_deleted',
      'pdfs_reordered',
      'pdf_labels_updated',
      'pdf_status_updated',
      'pdf_metadata_updated',    // OCR extraction complete
      'pdf_dark_mode_ready',      // Dark mode conversion complete
      'label_created',
      'label_deleted',
      'settings_updated'
    ];

    if (relevantTypes.includes(message.type)) {
      loadData();
    }
  }, [loadData]);

  useWebSocket(handleWebSocketMessage, true);

  const handlePdfClick = (pdf) => {
    // Switch to slideshow view and focus on clicked PDF
    const displayPdfs = pdfs.filter(p => p && !p.is_placeholder);
    const clickedIndex = displayPdfs.findIndex(p => p.id === pdf.id);

    setViewMode('slideshow');
    localStorage.setItem('viewMode', 'slideshow');

    // Store the index to scroll to it after view changes
    if (clickedIndex >= 0) {
      setSelectedPdf(pdf);
    }
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'slideshow' : 'grid';
    setViewMode(newMode);
    localStorage.setItem('viewMode', newMode);
    setSelectedPdf(null); // Clear selection when toggling
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-xl text-gray-600 dark:text-gray-400 transition-colors">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
            Kustom Kraft Cabinets - Job Board
          </h1>
          <div className="flex items-center space-x-4">
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
              onClick={() => navigate('/login')}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={viewMode === 'grid' ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' : 'w-full'}>
        {pdfs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600 dark:text-gray-400 transition-colors">No job postings available</p>
          </div>
        ) : viewMode === 'slideshow' ? (
          <SlideShowView
            pdfs={pdfs}
            initialIndex={selectedPdf ? pdfs.filter(p => p && !p.is_placeholder).findIndex(p => p.id === selectedPdf.id) : 0}
          />
        ) : (
          <PDFGrid
            pdfs={pdfs}
            rows={settings.grid_rows}
            cols={settings.grid_cols}
            onPdfClick={handlePdfClick}
          />
        )}
      </main>
    </div>
  );
}

export default HomePage;
