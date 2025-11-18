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
    console.log('[DarkModeContext] ========== TOGGLE START ==========');
    console.log('[DarkModeContext] Current darkMode:', darkMode);
    const newDarkMode = !darkMode;
    console.log('[DarkModeContext] New darkMode will be:', newDarkMode);

    // Capture button position from click event
    if (event) {
      const x = event.clientX;
      const y = event.clientY;
      setButtonPosition({ x, y });

      // Set CSS custom properties for circular reveal animation
      document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
      document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);

      // Calculate the maximum distance from click point to corner of viewport
      const maxX = Math.max(x, window.innerWidth - x);
      const maxY = Math.max(y, window.innerHeight - y);
      const maxRadius = Math.sqrt(maxX * maxX + maxY * maxY);
      document.documentElement.style.setProperty('--theme-toggle-radius', `${maxRadius}px`);
    }

    // Clear any existing timeouts
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (classChangeTimeoutRef.current) {
      clearTimeout(classChangeTimeoutRef.current);
    }

    // Set transitioning flag FIRST and capture target theme
    setIsTransitioning(true);
    setTargetDarkMode(newDarkMode); // Capture the target theme for overlay
    console.log('[DarkModeContext] t=0ms: isTransitioning set to true');
    console.log('[DarkModeContext] t=0ms: targetDarkMode set to', newDarkMode);
    console.log('[DarkModeContext] t=0ms: darkMode state will update at t=400ms (NOT now!)');

    // CRITICAL: Delay BOTH the DOM class change AND React state update until animation midpoint
    // Background animation: 0.8s duration, midpoint at 0.4s
    // This is when opacity is lowest, so color change is less visible
    classChangeTimeoutRef.current = setTimeout(() => {
      console.log('[DarkModeContext] t=400ms: Applying BOTH DOM class AND React state change NOW');

      // Update React state AND DOM together at the same time
      setDarkMode(newDarkMode);
      console.log('[DarkModeContext] t=400ms: darkMode React state updated to', newDarkMode);

      if (newDarkMode) {
        document.documentElement.classList.add('dark');
        console.log('[DarkModeContext] t=400ms: Added "dark" class to DOM');
      } else {
        document.documentElement.classList.remove('dark');
        console.log('[DarkModeContext] t=400ms: Removed "dark" class from DOM');
      }
    }, 400); // 400ms = midpoint of 800ms background animation

    // Reset transition state after all animations complete
    // Longest: last item (24) at 0.8s + (23*0.15s) + 0.6s duration = ~4.85s
    transitionTimeoutRef.current = setTimeout(() => {
      console.log('[DarkModeContext] t=5000ms: Animation complete, resetting isTransitioning');
      setIsTransitioning(false);
      console.log('[DarkModeContext] ========== TOGGLE END ==========');
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
