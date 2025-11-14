import React, { useEffect, useState } from 'react';

function PDFModal({ pdf, onClose, pdfs = null, currentIndex = null, onNavigate = null }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first, then fall back to system preference
    const saved = localStorage.getItem('pdfViewerDarkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const isPlaceholder = pdf.is_placeholder;
  const totalPages = isPlaceholder ? 1 : (pdf.page_count || 1);

  // Navigation helpers
  const canNavigatePrev = pdfs && currentIndex !== null && currentIndex > 0;
  const canNavigateNext = pdfs && currentIndex !== null && currentIndex < pdfs.length - 1;

  const handlePreviousJob = () => {
    if (canNavigatePrev && onNavigate) {
      setCurrentPage(1); // Reset to first page of new job
      onNavigate(currentIndex - 1);
    }
  };

  const handleNextJob = () => {
    if (canNavigateNext && onNavigate) {
      setCurrentPage(1); // Reset to first page of new job
      onNavigate(currentIndex + 1);
    }
  };

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

  // Close on Escape key and handle arrow keys for pagination and job navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        // If we're on the last page and can navigate to next job, do that
        if (currentPage === totalPages && canNavigateNext) {
          handleNextJob();
        } else {
          setCurrentPage(prev => Math.min(prev + 1, totalPages));
        }
      } else if (e.key === 'ArrowLeft') {
        // If we're on the first page and can navigate to previous job, do that
        if (currentPage === 1 && canNavigatePrev) {
          handlePreviousJob();
        } else {
          setCurrentPage(prev => Math.max(prev - 1, 1));
        }
      } else if (e.key === 'ArrowDown') {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
      } else if (e.key === 'ArrowUp') {
        setCurrentPage(prev => Math.max(prev - 1, 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, totalPages, currentPage, canNavigatePrev, canNavigateNext]);

  const downloadCurrentImage = () => {
    const imageUrl = `/thumbnails/${pdf.images_base}-${currentPage}.png`;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${pdf.original_name.replace('.pdf', '')}-page-${currentPage}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openImageInNewTab = () => {
    const imageUrl = `/thumbnails/${pdf.images_base}-${currentPage}.png`;
    window.open(imageUrl, '_blank');
  };

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
              {isPlaceholder ? pdf.text || 'Placeholder' : pdf.original_name}
            </h2>
            {!isPlaceholder && (
              <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-lg">
                Page {currentPage} of {totalPages}
              </span>
            )}
            {isPlaceholder && (
              <span className="text-white text-sm bg-yellow-600/70 px-3 py-1 rounded-lg">
                Placeholder
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            {!isPlaceholder && (
              <>
                <button
                  onClick={openImageInNewTab}
                  className="text-white hover:text-gray-300 transition-colors px-3 py-2 bg-blue-600 rounded-lg text-sm font-medium flex items-center gap-2"
                  title="Open in New Tab"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="hidden sm:inline">Open</span>
                </button>
                <button
                  onClick={downloadCurrentImage}
                  className="text-white hover:text-gray-300 transition-colors px-3 py-2 bg-green-600 rounded-lg text-sm font-medium flex items-center gap-2"
                  title="Download Image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">Download</span>
                </button>
              </>
            )}
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

        {/* Image Viewer */}
        <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-2xl flex flex-col relative">
          <div className={`flex-1 flex items-center justify-center p-4 overflow-auto transition-colors ${
            darkMode ? 'bg-gray-900' : 'bg-gray-100'
          }`}>
            {isPlaceholder ? (
              <div className="flex flex-col items-center justify-center max-w-full max-h-full">
                {pdf.image_url ? (
                  <img
                    src={pdf.image_url}
                    alt={pdf.text || 'Placeholder'}
                    className="max-w-full max-h-full object-contain transition-all"
                    style={{
                      filter: darkMode ? 'invert(1)' : 'none'
                    }}
                  />
                ) : (
                  <div className={`text-center p-8 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                    <svg
                      className="w-24 h-24 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-2xl font-medium">{pdf.text || 'Placeholder'}</p>
                  </div>
                )}
              </div>
            ) : (
              <img
                src={`/thumbnails/${pdf.images_base}-${currentPage}.png`}
                alt={`${pdf.original_name} - Page ${currentPage}`}
                className="max-w-full max-h-full object-contain transition-all"
                style={{
                  filter: darkMode ? 'invert(1)' : 'none'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" fill="gray">Image not found</text></svg>';
                  e.target.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
                }}
              />
            )}
          </div>

          {/* Job Navigation Arrows */}
          {pdfs && currentIndex !== null && (
            <>
              {canNavigatePrev && (
                <button
                  onClick={handlePreviousJob}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-blue-600/90 hover:bg-blue-700 text-white p-3 rounded-full transition-all shadow-lg z-10"
                  title="Previous Job"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {canNavigateNext && (
                <button
                  onClick={handleNextJob}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600/90 hover:bg-blue-700 text-white p-3 rounded-full transition-all shadow-lg z-10"
                  title="Next Job"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

          {/* Page Navigation */}
          {!isPlaceholder && totalPages > 1 && (
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
        </div>
      </div>
  );
}

export default PDFModal;
