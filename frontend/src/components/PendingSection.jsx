import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

function DraggablePendingItem({ pdf, index, onMovePdfToBoard, onDelete, editMode }) {
  const [showViewer, setShowViewer] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `pending-pdf-${pdf.id}`,
    data: {
      pdf,
      index,
      container: 'pending',
    },
    disabled: !editMode,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handleClick = () => {
    if (!editMode) {
      setShowViewer(true);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className={`relative bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all ${
          editMode ? 'cursor-move' : 'cursor-pointer'
        } ${isDragging ? 'opacity-40' : ''}`}
      >
      {/* Thumbnail */}
      <div className="aspect-[5/7] bg-gray-100 dark:bg-gray-700 flex items-center justify-center transition-colors">
        {pdf.thumbnail ? (
          <img
            src={`/thumbnails/${pdf.thumbnail}`}
            alt={pdf.original_name}
            className="w-full h-full object-cover dark:invert transition-all"
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
      <div className="p-2 bg-white dark:bg-gray-800 border-t border-yellow-200 dark:border-yellow-700 transition-colors">
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate transition-colors" title={pdf.original_name}>
          {pdf.original_name}
        </p>
      </div>

      {/* Actions - Only in edit mode */}
      {editMode && onMovePdfToBoard && onDelete && (
        <div className="p-2 bg-white dark:bg-gray-800 border-t border-yellow-200 dark:border-yellow-700 flex gap-2 transition-colors">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMovePdfToBoard(pdf.id);
            }}
            className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
            title="Add to Board"
          >
            Add to Board
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(pdf.id);
            }}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            title="Delete"
          >
            Delete
          </button>
        </div>
      )}

      {/* Drag indicator - Only in edit mode */}
      {editMode && !isDragging && (
        <div className="absolute top-2 left-2 bg-yellow-600 dark:bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-xs transition-colors">
          ⋮⋮
        </div>
      )}
    </div>

    {/* PDF Viewer Modal */}
    {showViewer && (
      <div
        className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
        onClick={() => setShowViewer(false)}
      >
        <div className="relative w-full h-full max-w-6xl max-h-screen flex flex-col">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowViewer(false);
              }}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{pdf.original_name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {pdf.page_count} {pdf.page_count === 1 ? 'page' : 'pages'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-gray-800">
              <div className="space-y-4">
                {Array.from({ length: pdf.page_count || 0 }, (_, i) => (
                  <img
                    key={i}
                    src={`/thumbnails/${pdf.images_base}-${i + 1}.png`}
                    alt={`Page ${i + 1}`}
                    className="w-full max-w-3xl mx-auto shadow-lg rounded dark:invert"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function PendingSection({ pdfs, onMovePdfToBoard, onMoveAllPdfsToBoard, onDelete, onUploadToPending, editMode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'pending-container',
  });

  if (pdfs.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6 transition-colors">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 transition-colors">
            📥 PENDING PDFs
          </h2>
          {editMode && (
            <button
              onClick={onUploadToPending}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              + Upload to Pending
            </button>
          )}
        </div>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 transition-colors">
          {editMode
            ? 'No pending PDFs. Upload PDFs to pending using the button above.'
            : 'No pending PDFs. Enter edit mode to upload PDFs.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6 transition-colors">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 transition-colors">
            📥 PENDING PDFs ({pdfs.length})
          </h2>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 transition-colors">
            {editMode
              ? 'These PDFs are uploaded but not yet visible on the board. Drag them to the board or click "Add to Board".'
              : 'These PDFs are uploaded but not yet visible on the board. Click to view. Enter edit mode to add them to the board.'
            }
          </p>
        </div>
        {editMode && (
          <button
            onClick={onUploadToPending}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
          >
            + Upload to Pending
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 ${
          isOver && editMode ? 'ring-2 ring-yellow-500' : ''
        }`}
      >
        {pdfs.map((pdf, index) => (
          <DraggablePendingItem
            key={pdf.id}
            pdf={pdf}
            index={index}
            onMovePdfToBoard={onMovePdfToBoard}
            onDelete={onDelete}
            editMode={editMode}
          />
        ))}
      </div>

      {/* Bulk Actions - Only in edit mode */}
      {editMode && pdfs.length > 1 && onMoveAllPdfsToBoard && (
        <div className="mt-4 pt-4 border-t border-yellow-300">
          <button
            onClick={onMoveAllPdfsToBoard}
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
