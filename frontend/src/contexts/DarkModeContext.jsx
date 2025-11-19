import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const DarkModeContext = createContext();

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}

export function DarkModeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Fall back to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetDarkMode, setTargetDarkMode] = useState(darkMode);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const transitionTimeoutRef = useRef(null);
  const classChangeTimeoutRef = useRef(null);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only update if user hasn't manually set a preference
      const saved = localStorage.getItem('darkMode');
      if (saved === null) {
        setDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Save preference to localStorage and update document class
  // BUT: Only apply DOM class change immediately if NOT transitioning
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());

    // If we're transitioning, the DOM class change will be handled by toggleDarkMode
    // Otherwise, apply immediately (e.g., on initial load)
    if (!isTransitioning) {
      console.log('[DarkModeContext] Applying DOM class immediately (not transitioning)', { darkMode });
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode, isTransitioning]);

  const toggleDarkMode = (event) => {
    const newDarkMode = !darkMode;

    // Capture button position from click event for circular reveal
    if (event) {
      const x = event.clientX;
      const y = event.clientY;
      setButtonPosition({ x, y });

      // Set CSS custom properties for circular reveal animation
      document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
      document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);

      // Calculate radius to cover entire viewport from click point
      // Add extra padding to ensure full coverage on all devices
      const maxX = Math.max(x, window.innerWidth - x);
      const maxY = Math.max(y, window.innerHeight - y);
      const maxRadius = Math.sqrt(maxX * maxX + maxY * maxY) * 1.5; // 1.5x for safety margin
      document.documentElement.style.setProperty('--theme-toggle-radius', `${maxRadius}px`);
    }

    // Set animation direction: expand for dark, retract for light
    // View Transitions API uses separate animations for new and old views
    if (newDarkMode) {
      // Going TO dark mode: animate the NEW dark view expanding
      console.log('[DarkMode] Setting dark mode animations: new=circle-expand, old=none');
      document.documentElement.style.setProperty('--transition-name-new', 'circle-expand');
      document.documentElement.style.setProperty('--transition-name-old', 'none');
    } else {
      // Going TO light mode: animate the OLD dark view retracting
      console.log('[DarkMode] Setting light mode animations: new=none, old=circle-retract');
      document.documentElement.style.setProperty('--transition-name-new', 'none');
      document.documentElement.style.setProperty('--transition-name-old', 'circle-retract');
    }

    console.log('[DarkMode] CSS Variables:', {
      x: document.documentElement.style.getPropertyValue('--theme-toggle-x'),
      y: document.documentElement.style.getPropertyValue('--theme-toggle-y'),
      radius: document.documentElement.style.getPropertyValue('--theme-toggle-radius'),
      newAnim: document.documentElement.style.getPropertyValue('--transition-name-new'),
      oldAnim: document.documentElement.style.getPropertyValue('--transition-name-old')
    });

    // Check if View Transitions API is supported
    if (!document.startViewTransition) {
      // Fallback: instant change without animation
      setDarkMode(newDarkMode);
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return;
    }

    // Clear any existing timeouts
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Use View Transitions API for smooth, native animation
    setIsTransitioning(true);
    setTargetDarkMode(newDarkMode);

    const transition = document.startViewTransition(() => {
      // Update React state and DOM
      setDarkMode(newDarkMode);
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });

    // Keep isTransitioning true until ALL grid animations complete
    // Grid items: last item (24) at 23*0.15s + 0.6s animation = ~4.05s
    // Using 5s to be safe for larger grids
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 5000);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (classChangeTimeoutRef.current) {
        clearTimeout(classChangeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, isTransitioning, targetDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}
