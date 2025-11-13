import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pdfAPI, settingsAPI } from '../utils/api';
import PDFGrid from '../components/PDFGrid';
import PDFModal from '../components/PDFModal';
import useWebSocket from '../hooks/useWebSocket';

function HomePage() {
  const [pdfs, setPdfs] = useState([]);
  const [settings, setSettings] = useState({ grid_rows: 4, grid_cols: 6 });
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [loading, setLoading] = useState(true);
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
    setSelectedPdf(pdf);
  };

  const handleCloseModal = () => {
    setSelectedPdf(null);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Kustom Kraft Cabinets - Job Board
          </h1>
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Admin
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pdfs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">No job postings available</p>
          </div>
        ) : (
          <PDFGrid
            pdfs={pdfs}
            rows={settings.grid_rows}
            cols={settings.grid_cols}
            onPdfClick={handlePdfClick}
          />
        )}
      </main>

      {/* PDF Modal */}
      {selectedPdf && (
        <PDFModal pdf={selectedPdf} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default HomePage;
