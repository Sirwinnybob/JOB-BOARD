import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * EmptySlot component for empty grid positions in PDFGrid
 * Implements delayed dark mode transitions to match the cascade animation
 * Uses the same pattern as DraggableCoverSheetCard
 */
function EmptySlot({ colorTransitionDelay }) {
  const { darkMode, isTransitioning } = useDarkMode();

  // Get style based on darkMode (not delayed)
  // The CSS transition delay handles the visual timing
  const getStyle = () => {
    const baseStyle = {
      backgroundColor: darkMode ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)', // gray-700 : gray-200
      borderColor: darkMode ? 'rgb(75, 85, 99)' : 'rgb(209, 213, 219)', // gray-600 : gray-300
    };

    // Add color transition delay during theme transitions
    // The delay in the CSS transition controls WHEN the visual change happens
    if (isTransitioning && colorTransitionDelay) {
      baseStyle.transition = `background-color 0.1s ease ${colorTransitionDelay}, border-color 0.1s ease ${colorTransitionDelay}`;
    }

    return baseStyle;
  };

  return (
    <div
      className={`w-full h-full rounded-lg border-2 border-dashed ${!isTransitioning ? 'transition-colors' : ''}`}
      style={getStyle()}
    />
  );
}

export default EmptySlot;
