import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

function PlaceholderCard({
  placeholder,
  index,
  editMode,
  onDelete,
  isDragging,
  onEdit,
  colorTransitionDelay,
}) {
  const { isTransitioning } = useDarkMode();

  // Helper to get transition style for colored elements
  const getColorTransitionStyle = (properties = ['color']) => {
    if (!isTransitioning || !colorTransitionDelay) return {};
    const transitions = properties.map(prop => `${prop} 0.1s ease ${colorTransitionDelay}`);
    return { transition: transitions.join(', ') };
  };

  // Log when isTransitioning changes
  React.useEffect(() => {
    if (isTransitioning) {
      console.log(`[PlaceholderCard] Card ${index}:`, {
        isTransitioning,
        willSwitchToSolid: isTransitioning
      });
    }
  }, [isTransitioning, index]);

  return (
    <div
      className={`relative w-full h-full ${isTransitioning ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800'} rounded-lg shadow-md overflow-hidden ${!isTransitioning ? 'transition-all' : ''} ${
        editMode ? 'cursor-move border-2 animate-border-pulse' : 'cursor-default border-2 border-dashed border-gray-300 dark:border-gray-600'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={getColorTransitionStyle(['background-color', 'border-color'])}
    >
      {/* Placeholder Text */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <p
          className="text-gray-600 dark:text-gray-700 text-4xl font-bold text-center break-words leading-tight"
          style={getColorTransitionStyle(['color'])}
        >
          {placeholder.placeholder_text || 'PLACEHOLDER'}
        </p>
      </div>

      {/* Edit and Delete buttons in edit mode */}
      {editMode && (
        <>
          {/* Edit button */}
          <button
            onClick={() => onEdit && onEdit(placeholder)}
            className={`absolute top-2 right-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg ${!isTransitioning ? 'transition-colors' : ''} z-10`}
            aria-label="Edit"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(placeholder.id)}
            className={`absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg ${!isTransitioning ? 'transition-colors' : ''} z-10`}
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

export default PlaceholderCard;
