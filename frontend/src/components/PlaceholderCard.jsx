import React from 'react';

function PlaceholderCard({
  placeholder,
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
      onDragStart={(e) => editMode && onDragStart(e, index)}
      onDragEnd={onDragEnd}
      className={`relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg shadow-md overflow-hidden transition-all ${
        editMode ? 'cursor-move border-2 animate-border-pulse' : 'cursor-default border-2 border-dashed border-gray-300'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Placeholder Icon and Text */}
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="bg-gray-300 rounded-full p-4 mb-3">
          <svg
            className="w-12 h-12 text-gray-500"
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
        </div>
        <p className="text-gray-500 text-sm font-medium text-center">
          Placeholder
        </p>
      </div>

      {/* Delete button in edit mode */}
      {editMode && (
        <button
          onClick={() => onDelete(placeholder.id)}
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

export default PlaceholderCard;
