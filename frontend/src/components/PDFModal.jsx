import React, { useEffect, useState } from 'react';

function PDFModal({ pdf, onClose }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('images'); // 'images' or 'pdf'
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first, then fall back to system preference
    const saved = localStorage.getItem('pdfViewerDarkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Determine if we have page images available
  const hasPageImages = pdf.page_count && pdf.images_base;
  const totalPages = pdf.page_count || 1;

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('pdfViewerDarkMode', darkMode.toString());
  }, [darkMode]);

  // Close on Escape key and handle arrow keys for pagination
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (hasPageImages && viewMode === 'images') {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          setCurrentPage(prev => Math.min(prev + 1, totalPages));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          setCurrentPage(prev => Math.max(prev - 1, 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasPageImages, viewMode, totalPages]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-6xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-white text-xl font-semibold truncate">
              {pdf.original_name}
            </h2>
            {hasPageImages && (
              <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-lg">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasPageImages && (
              <>
                <button
                  onClick={() => setViewMode(viewMode === 'images' ? 'pdf' : 'images')}
                  className="text-white hover:text-gray-300 transition-colors px-3 py-2 bg-purple-600 rounded-lg text-sm font-medium flex items-center gap-2"
                  title={viewMode === 'images' ? 'View PDF' : 'View Images'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">{viewMode === 'images' ? 'PDF' : 'Images'}</span>
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="text-white hover:text-gray-300 transition-colors px-3 py-2 bg-gray-700 rounded-lg text-sm font-medium flex items-center gap-2"
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
                  <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
                </button>
              </>
            )}
            <a
              href={`/uploads/${pdf.filename}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-300 transition-colors px-3 py-2 bg-blue-600 rounded-lg text-sm font-medium flex items-center gap-2"
              title="Open in New Tab"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden sm:inline">Open</span>
            </a>
            <a
              href={`/uploads/${pdf.filename}`}
              download={pdf.original_name}
              className="text-white hover:text-gray-300 transition-colors px-3 py-2 bg-green-600 rounded-lg text-sm font-medium flex items-center gap-2"
              title="Download PDF"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors p-2"
              aria-label="Close"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF/Image Viewer */}
        <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-2xl flex flex-col">
          {hasPageImages && viewMode === 'images' ? (
            <>
              {/* Image Viewer */}
              <div className={`flex-1 flex items-center justify-center p-4 overflow-auto transition-colors ${
                darkMode ? 'bg-gray-900' : 'bg-gray-100'
              }`}>
                <img
                  src={`/thumbnails/${pdf.images_base}-${currentPage}.png`}
                  alt={`${pdf.original_name} - Page ${currentPage}`}
                  className="max-w-full max-h-full object-contain transition-all"
                  style={{
                    filter: darkMode ? 'invert(1)' : 'none'
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="gray"%3EImage not found%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>

              {/* Page Navigation */}
              {totalPages > 1 && (
                <div className="bg-gray-800 p-4 flex items-center justify-center gap-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-white">Page</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const page = parseInt(e.target.value, 10);
                        if (page >= 1 && page <= totalPages) {
                          setCurrentPage(page);
                        }
                      }}
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded"
                    />
                    <span className="text-white">of {totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* PDF Viewer fallback */
            <object
              data={`/uploads/${pdf.filename}#view=FitH`}
              type="application/pdf"
              className="w-full h-full"
              title={pdf.original_name}
            >
              <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-100">
                <svg className="w-24 h-24 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 text-lg mb-4">Cannot display PDF in this browser</p>
                <div className="flex gap-4">
                  <a
                    href={`/uploads/${pdf.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Open in New Tab
                  </a>
                  <a
                    href={`/uploads/${pdf.filename}`}
                    download={pdf.original_name}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            </object>
          )}
        </div>
      </div>
    </div>
  );
}

export default PDFModal;
