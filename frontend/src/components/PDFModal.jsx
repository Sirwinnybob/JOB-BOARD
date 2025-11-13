import React, { useEffect, useState } from 'react';

function PDFModal({ pdf, onClose }) {
  const [useEmbed, setUseEmbed] = useState(true);

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
          <h2 className="text-white text-xl font-semibold truncate flex-1">
            {pdf.original_name}
          </h2>
          <div className="flex items-center gap-2">
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

        {/* PDF Viewer */}
        <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-2xl">
          {useEmbed ? (
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
          ) : (
            <iframe
              src={`/uploads/${pdf.filename}#view=FitH`}
              className="w-full h-full"
              title={pdf.original_name}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default PDFModal;
