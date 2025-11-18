import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * EmptySlot component for empty grid positions in PDFGrid
 * Uses the same pattern as DraggableCoverSheetCard image transitions:
 * - delayedDarkMode state updates at the item's transition time
 * - Fast CSS transition with NO delay (state update controls timing)
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

    // Fast transition with NO delay during theme transitions
    if (isTransitioning) {
      baseStyle.transition = 'background-color 0.2s ease, border-color 0.2s ease';
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
