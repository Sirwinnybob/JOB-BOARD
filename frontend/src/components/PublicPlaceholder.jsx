import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * PublicPlaceholder component for use in PDFGrid public view
 * Implements delayed dark mode transitions to match the cascade animation
 * Uses the same pattern as DraggableCoverSheetCard
 */
function PublicPlaceholder({ placeholder, colorTransitionDelay, onClick }) {
  const { darkMode, isTransitioning } = useDarkMode();

  // Get background style based on darkMode (not delayed)
  // The CSS transition delay handles the visual timing
  const getBackgroundStyle = () => {
    const baseStyle = {};

    if (isTransitioning) {
      // During transition, use solid color based on current darkMode
      baseStyle.backgroundColor = darkMode ? 'rgb(55, 65, 81)' : 'rgb(243, 244, 246)'; // gray-700 : gray-100
    } else {
      // Normal state, use gradient via inline style
      baseStyle.backgroundImage = darkMode
        ? 'linear-gradient(to bottom right, rgb(55, 65, 81), rgb(31, 41, 55))' // gray-700 to gray-800
        : 'linear-gradient(to bottom right, rgb(243, 244, 246), rgb(229, 231, 235))'; // gray-100 to gray-200
    }

    // Add border color
    baseStyle.borderColor = darkMode ? 'rgb(75, 85, 99)' : 'rgb(209, 213, 219)'; // gray-600 : gray-300

    // Add color transition delay during theme transitions
    // The delay in the CSS transition controls WHEN the visual change happens
    if (isTransitioning && colorTransitionDelay) {
      baseStyle.transition = `background-color 0.1s ease ${colorTransitionDelay}, background-image 0.1s ease ${colorTransitionDelay}, border-color 0.1s ease ${colorTransitionDelay}`;
    }

    return baseStyle;
  };

  // Get text color based on darkMode (not delayed)
  const getTextStyle = () => {
    const baseStyle = {
      color: darkMode ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' // gray-400 : gray-600
    };

    // Add color transition delay during theme transitions
    if (isTransitioning && colorTransitionDelay) {
      baseStyle.transition = `color 0.1s ease ${colorTransitionDelay}`;
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
