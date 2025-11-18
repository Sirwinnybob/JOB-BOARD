import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * EmptySlot component for empty grid positions in PDFGrid
 * Implements delayed dark mode transitions to match the cascade animation
 */
function EmptySlot({ colorTransitionDelay }) {
  const { darkMode, isTransitioning } = useDarkMode();

  // Delayed dark mode for this specific slot (updates at item's color transition time)
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

  // Get style based on delayedDarkMode
  const getStyle = () => {
    const baseStyle = {
      backgroundColor: delayedDarkMode ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)', // gray-700 : gray-200
      borderColor: delayedDarkMode ? 'rgb(75, 85, 99)' : 'rgb(209, 213, 219)', // gray-600 : gray-300
    };

    // Add color transition delay during theme transitions
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
