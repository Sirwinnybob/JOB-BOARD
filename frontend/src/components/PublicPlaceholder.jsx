import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * PublicPlaceholder component for use in PDFGrid public view
 * Uses the same pattern as DraggableCoverSheetCard image transitions:
 * - delayedDarkMode state updates at the item's transition time
 * - Fast CSS transition with NO delay (state update controls timing)
 */
function PublicPlaceholder({ placeholder, colorTransitionDelay, onClick }) {
  const { darkMode, isTransitioning } = useDarkMode();

  // Delayed dark mode for this specific placeholder (updates at item's color transition time)
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
      onClick={onClick}
      className={`relative w-full h-full rounded-lg shadow-md border-2 border-dashed overflow-hidden cursor-pointer hover:opacity-90 ${!isTransitioning ? 'transition-all duration-500' : ''}`}
      data-pdf-id={placeholder.id}
      style={getBackgroundStyle()}
    >
      <div className="w-full h-full flex items-center justify-center p-2 sm:p-3 md:p-4">
        <p
          className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center break-words leading-tight"
          style={getTextStyle()}
        >
          {placeholder.placeholder_text || 'PLACEHOLDER'}
        </p>
      </div>
    </div>
  );
}

export default PublicPlaceholder;
