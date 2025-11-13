import React from 'react';

function PendingSection({ pdfs, onMovePdfToBoard, onDelete }) {
  if (pdfs.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-yellow-900 mb-2">
          📥 PENDING PDFs
        </h2>
        <p className="text-sm text-yellow-700">
          No pending PDFs. Upload PDFs in edit mode to add them here before placing them on the board.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold text-yellow-900 mb-4">
        📥 PENDING PDFs ({pdfs.length})
      </h2>
      <p className="text-sm text-yellow-700 mb-4">
        These PDFs are uploaded but not yet visible on the board. Click "Add to Board" to make them visible to others.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {pdfs.map((pdf) => (
          <div
            key={pdf.id}
            className="relative bg-white border-2 border-yellow-300 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            <div className="aspect-[5/7] bg-gray-100 flex items-center justify-center">
              {pdf.thumbnail ? (
                <img
                  src={`/thumbnails/${pdf.thumbnail}`}
                  alt={pdf.original_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 text-center p-4">
                  <svg
                    className="w-12 h-12 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-xs">PDF</span>
                </div>
              )}
            </div>

            {/* PDF Name */}
            <div className="p-2 bg-white border-t border-yellow-200">
              <p className="text-xs text-gray-700 truncate" title={pdf.original_name}>
                {pdf.original_name}
              </p>
            </div>

            {/* Actions */}
            <div className="p-2 bg-white border-t border-yellow-200 flex gap-2">
              <button
                onClick={() => onMovePdfToBoard(pdf.id)}
                className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                title="Add to Board"
              >
                Add to Board
              </button>
              <button
                onClick={() => onDelete(pdf.id)}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                title="Delete"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Actions */}
      {pdfs.length > 1 && (
        <div className="mt-4 pt-4 border-t border-yellow-300">
          <button
            onClick={() => {
              if (confirm(`Add all ${pdfs.length} pending PDFs to the board?`)) {
                pdfs.forEach(pdf => onMovePdfToBoard(pdf.id));
              }
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Add All to Board ({pdfs.length})
          </button>
        </div>
      )}
    </div>
  );
}

export default PendingSection;
