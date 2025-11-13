import React from 'react';

function DraggablePDFCard({
  pdf,
  index,
  editMode,
  onDragStart,
  onDragEnd,
  onDelete,
  isDragging,
}) {
  return (
    <div
      draggable={editMode}
      onDragStart={() => onDragStart(index)}
      onDragEnd={onDragEnd}
      className={`relative w-full h-full bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 transition-all ${
        editMode ? 'cursor-move' : 'cursor-default'
      } ${isDragging ? 'opacity-50 scale-95' : ''} ${
        editMode ? 'animate-wiggle' : ''
      }`}
    >
      <img
        src={`/thumbnails/${pdf.thumbnail}`}
        alt={pdf.original_name}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-white text-xs truncate">
          {pdf.original_name.replace('.pdf', '')}
        </p>
      </div>

      {/* Delete button in edit mode */}
      {editMode && (
        <button
          onClick={() => onDelete(pdf.id)}
          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors z-10"
          aria-label="Delete"
        >
          <svg
            className="w-5 h-5"
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
      )}

      {/* Drag indicator */}
      {editMode && !isDragging && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export default DraggablePDFCard;
