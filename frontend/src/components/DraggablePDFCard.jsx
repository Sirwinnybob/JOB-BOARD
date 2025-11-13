import React from 'react';

function DraggablePDFCard({
  pdf,
  index,
  editMode,
  onDelete,
  onLabelClick,
  onMoveToPending,
  isDragging,
}) {
  return (
    <div
      className={`relative w-full h-full bg-white rounded-lg shadow-md overflow-hidden transition-all ${
        editMode ? 'cursor-move border-2 animate-border-pulse' : 'cursor-default border border-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <img
        src={`/thumbnails/${pdf.thumbnail}`}
        alt={pdf.original_name}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Labels */}
      {pdf.labels && pdf.labels.length > 0 && (
        <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
          {pdf.labels.map((label) => (
            <span
              key={label.id}
              className="px-2 py-0.5 text-xs font-bold text-white rounded shadow-lg"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-white text-xs truncate">
          {pdf.original_name.replace('.pdf', '')}
        </p>
      </div>

      {/* Label management button in edit mode */}
      {editMode && onLabelClick && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick(pdf);
          }}
          className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors z-10"
          aria-label="Manage Labels"
          title="Manage Labels"
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
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        </button>
      )}

      {/* Action buttons in edit mode */}
      {editMode && (
        <>
          {/* Move to Pending button */}
          {onMoveToPending && (
            <button
              onClick={() => onMoveToPending(pdf.id)}
              className="absolute top-2 right-12 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors z-10"
              aria-label="Move to Pending"
              title="Move to Pending"
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
          {/* Delete button */}
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
        </>
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
