import React, { useState } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

function DraggableCoverSheetCard({
  pdf,
  index,
  editMode,
  onDelete,
  onLabelClick,
  onMoveToPending,
  isDragging,
  onMetadataUpdate,
  colorTransitionDelay,
  isHighlighted = false,
}) {
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const { darkMode, isTransitioning } = useDarkMode();

  // Delayed dark mode for this specific card (updates at item's color transition time)
  const [delayedDarkMode, setDelayedDarkMode] = useState(darkMode);

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
    if (isTransitioning && index < 3) {
      console.log(`[DraggableCoverSheetCard] Card ${index} (${pdf?.job_number || 'unknown'}):`, {
        isTransitioning,
        darkMode,
        delayedDarkMode,
        colorTransitionDelay,
        willDisableTransitions: !isTransitioning
      });
    }
  }, [isTransitioning, index, pdf?.job_number, darkMode, delayedDarkMode, colorTransitionDelay]);

  // Determine which image to use based on DELAYED dark mode
  const lightImageBase = pdf.images_base;
  const darkImageBase = pdf.dark_mode_images_base;

  // Generate both image sources for cross-fade
  const lightImageSrc = lightImageBase ? `/thumbnails/${lightImageBase}-1.png` : `/thumbnails/${pdf.thumbnail}`;
  const darkImageSrc = darkImageBase ? `/thumbnails/${darkImageBase}-1.png` : lightImageSrc;

  // For backward compatibility with single image
  const imageSrc = delayedDarkMode && darkImageBase ? darkImageSrc : lightImageSrc;

  const handleStartEdit = (field, currentValue) => {
    setEditing(field);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = (field) => {
    const updates = {};
    if (field === 'job_number') {
      updates.job_number = editValue;
      updates.construction_method = pdf.construction_method;
    } else {
      updates.job_number = pdf.job_number;
      updates.construction_method = editValue;
    }

    // Only update local state - don't save to backend until Save button is pressed
    if (onMetadataUpdate) {
      onMetadataUpdate(pdf.id, updates);
    }
    setEditing(null);
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  // Determine header background color based on construction method
  const getHeaderStyle = () => {
    const baseStyle = {
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden'
    };

    if (!pdf.construction_method) {
      baseStyle.backgroundColor = darkMode
        ? 'rgb(55, 65, 81)' // dark:bg-gray-700
        : 'white';
    } else {
      const colorMap = {
        'Face Frame': 'rgb(150, 179, 82)',
        'Frameless': 'rgb(237, 146, 35)',
        'Both': 'rgb(0, 133, 138)'
      };
      baseStyle.backgroundColor = colorMap[pdf.construction_method] || 'white';
    }

    // Add color transition delay during theme transitions
    if (isTransitioning && colorTransitionDelay) {
      baseStyle.transition = `background-color 0.1s ease ${colorTransitionDelay}, border-color 0.1s ease ${colorTransitionDelay}`;
    }

    return baseStyle;
  };

  // Helper to get transition style for colored elements
  const getColorTransitionStyle = (properties = ['color']) => {
    if (!isTransitioning || !colorTransitionDelay) {
      return {
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
      };
    }
    const transitions = properties.map(prop => `${prop} 0.1s ease ${colorTransitionDelay}`);
    return {
      transition: transitions.join(', '),
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden'
    };
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Job Info Section - At top of slot */}
      <div
        className={`border border-gray-300 dark:border-gray-600 rounded-t px-2 py-1 flex justify-between items-center text-xs ${!isTransitioning ? 'transition-colors' : ''} shadow-sm z-10 flex-shrink-0`}
        style={getHeaderStyle()}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={`font-semibold hidden md:inline ${pdf.construction_method ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}
              style={getColorTransitionStyle(['color'])}
            >
              Job#:
            </span>
            {editMode && editing === 'job_number' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit('job_number');
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={() => handleSaveEdit('job_number')}
                className="flex-1 px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none"
                style={getColorTransitionStyle(['background-color', 'color', 'border-color'])}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onClick={(e) => {
                  if (editMode) {
                    e.stopPropagation();
                    handleStartEdit('job_number', pdf.job_number);
                  }
                }}
                className={`flex-1 truncate px-1 rounded font-bold ${
                  pdf.construction_method ? 'text-white' : 'text-gray-900 dark:text-white'
                } ${
                  editMode ? 'cursor-pointer hover:bg-black/10' : 'cursor-default'
                }`}
                style={getColorTransitionStyle(['color'])}
                title={editMode ? (pdf.job_number || 'Click to add job number') : pdf.job_number}
              >
                {pdf.job_number || '—'}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={`font-semibold hidden md:inline ${pdf.construction_method ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}
              style={getColorTransitionStyle(['color'])}
            >
              Type:
            </span>
            {editMode && editing === 'construction_method' ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSaveEdit('construction_method')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit('construction_method');
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="flex-1 px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none"
                style={getColorTransitionStyle(['background-color', 'color', 'border-color'])}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">—</option>
                <option value="Frameless">Frameless</option>
                <option value="Face Frame">Face Frame</option>
                <option value="Both">Both</option>
              </select>
            ) : (
              <>
                <span
                  onClick={(e) => {
                    if (editMode) {
                      e.stopPropagation();
                      handleStartEdit('construction_method', pdf.construction_method);
                    }
                  }}
                  className={`hidden md:inline flex-1 truncate px-1 rounded font-bold ${
                    pdf.construction_method ? 'text-white' : 'text-gray-900 dark:text-white'
                  } ${
                    editMode ? 'cursor-pointer hover:bg-black/10' : 'cursor-default'
                  }`}
                  style={getColorTransitionStyle(['color'])}
                  title={editMode ? (pdf.construction_method || 'Click to select type') : pdf.construction_method}
                >
                  {pdf.construction_method || '—'}
                </span>
                <span
                  onClick={(e) => {
                    if (editMode) {
                      e.stopPropagation();
                      handleStartEdit('construction_method', pdf.construction_method);
                    }
                  }}
                  className={`md:hidden flex-1 truncate px-1 rounded font-bold ${
                    pdf.construction_method ? 'text-white' : 'text-gray-900 dark:text-white'
                  } ${
                    editMode ? 'cursor-pointer hover:bg-black/10' : 'cursor-default'
                  }`}
                  style={getColorTransitionStyle(['color'])}
                  title={editMode ? (pdf.construction_method || 'Click to select type') : pdf.construction_method}
                >
                  {pdf.construction_method === 'Face Frame' ? 'FF' : pdf.construction_method === 'Frameless' ? 'FL' : pdf.construction_method || '—'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cover Sheet Card */}
      <div
        className={`flex-1 relative bg-white dark:bg-gray-800 rounded-b-lg shadow-md overflow-hidden ${!isTransitioning ? 'transition-all' : ''} min-h-0 ${
          editMode ? 'cursor-move border-2 animate-border-pulse' : 'cursor-default border border-gray-200 dark:border-gray-700'
        } ${isDragging ? 'opacity-50' : ''} ${isHighlighted ? 'notification-glow' : ''}`}
        style={getColorTransitionStyle(['background-color', 'border-color'])}
      >
      {/* Cross-fade between light and dark images */}
      {darkImageBase && darkImageBase !== lightImageBase ? (
        <>
          {/* Light mode image */}
          <img
            src={lightImageSrc}
            alt={pdf.original_name}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{
              opacity: delayedDarkMode ? 0 : 1,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
            draggable={false}
          />
          {/* Dark mode image */}
          <img
            src={darkImageSrc}
            alt={pdf.original_name}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{
              opacity: delayedDarkMode ? 1 : 0,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
            draggable={false}
          />
        </>
      ) : (
        /* Single image (no dark mode variant) */
        <img
          src={imageSrc}
          alt={pdf.original_name}
          className={`w-full h-full object-cover ${!isTransitioning ? 'transition-all' : ''}`}
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden'
          }}
          draggable={false}
        />
      )}

      {/* Labels */}
      {pdf.labels && pdf.labels.length > 0 && (
        <div className="absolute top-1 left-1 right-1 flex flex-wrap gap-0.5 sm:gap-1 sm:top-2 sm:left-2 sm:right-2">
          {pdf.labels.map((label) => (
            <span
              key={label.id}
              className="px-1 py-0.5 text-[8px] sm:text-xs font-bold text-white rounded shadow-lg"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Label management button in edit mode */}
      {editMode && onLabelClick && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick(pdf);
          }}
          className={`absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg ${!isTransitioning ? 'transition-colors' : ''} z-10`}
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
              className={`absolute top-2 right-12 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg ${!isTransitioning ? 'transition-colors' : ''} z-10`}
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
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          )}
          {/* Delete button */}
          <button
            onClick={() => onDelete(pdf.id)}
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
    </div>
  );
}

export default DraggableCoverSheetCard;
