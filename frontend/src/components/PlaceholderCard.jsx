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
  const { darkMode, isTransitioning } = useDarkMode();

  // Delayed dark mode for this specific card (updates at item's color transition time)
  const [delayedDarkMode, setDelayedDarkMode] = React.useState(darkMode);

  // Update delayedDarkMode with per-item timing during transitions
  React.useEffect(() => {
    if (isTransitioning && colorTransitionDelay) {
      // Parse the delay value (e.g., "0.7s" -> 700ms)
      const delayMs = parseFloat(colorTransitionDelay) * 1000;
      const timeout = setTimeout(() => {
        setDelayedDarkMode(darkMode);
      }, delayMs);
      return () => clearTimeout(timeout);
    } else {
      // When not transitioning, update immediately
      setDelayedDarkMode(darkMode);
    }
  }, [darkMode, isTransitioning, colorTransitionDelay]);

  // Log when isTransitioning changes
  React.useEffect(() => {
    if (isTransitioning) {
      console.log(`[PlaceholderCard] Card ${index}:`, {
        isTransitioning,
        darkMode,
        delayedDarkMode,
        willSwitchToSolid: isTransitioning
      });
    }
  }, [isTransitioning, index, darkMode, delayedDarkMode]);

  // Get background style based on delayedDarkMode
  const getBackgroundStyle = () => {
    const baseStyle = {};

    if (isTransitioning) {
      // During transition, use solid color
      baseStyle.backgroundColor = delayedDarkMode ? 'rgb(55, 65, 81)' : 'rgb(243, 244, 246)'; // gray-700 : gray-100
      // Fast transition with NO delay - timing controlled by state update
      baseStyle.transition = 'background-color 0.2s ease, border-color 0.2s ease';
    } else {
      // Normal state, use gradient via inline style
      baseStyle.backgroundImage = delayedDarkMode
        ? 'linear-gradient(to bottom right, rgb(55, 65, 81), rgb(31, 41, 55))' // gray-700 to gray-800
        : 'linear-gradient(to bottom right, rgb(243, 244, 246), rgb(229, 231, 235))'; // gray-100 to gray-200
    }

    // Add border color
    baseStyle.borderColor = delayedDarkMode ? 'rgb(75, 85, 99)' : 'rgb(209, 213, 219)'; // gray-600 : gray-300

    return baseStyle;
  };

  // Get text color based on delayedDarkMode
  const getTextStyle = () => {
    const baseStyle = {
      color: delayedDarkMode ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' // gray-400 : gray-600
    };

    // Fast transition with NO delay during theme transitions
    if (isTransitioning) {
      baseStyle.transition = 'color 0.2s ease';
    }

    return baseStyle;
  };

  return (
    <div
      className={`relative w-full h-full rounded-lg shadow-md overflow-hidden ${!isTransitioning ? 'transition-all' : ''} ${
        editMode ? 'cursor-move border-2 animate-border-pulse' : 'cursor-default border-2 border-dashed'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={getBackgroundStyle()}
    >
      {/* Placeholder Text */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <p
          className="font-bold text-center break-words leading-tight"
          style={{
            ...getTextStyle(),
            fontSize: 'clamp(0.75rem, 4vw, 2.5rem)'
          }}
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
