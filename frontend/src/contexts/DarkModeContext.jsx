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

  const toggleDarkMode = () => {
    console.log('[DarkModeContext] ========== TOGGLE START ==========');
    console.log('[DarkModeContext] Current darkMode:', darkMode);
    const newDarkMode = !darkMode;
    console.log('[DarkModeContext] New darkMode:', newDarkMode);

    // Clear any existing timeouts
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (classChangeTimeoutRef.current) {
      clearTimeout(classChangeTimeoutRef.current);
    }

    // Set transitioning flag FIRST
    setIsTransitioning(true);
    console.log('[DarkModeContext] t=0ms: isTransitioning set to true');

    // Update state immediately (for React state, but NOT DOM yet)
    setDarkMode(newDarkMode);
    console.log('[DarkModeContext] t=0ms: darkMode state updated to', newDarkMode);

    // CRITICAL: Delay the DOM class change until the animation midpoint
    // Background animation: 0.8s duration, midpoint at 0.4s
    // This is when opacity is lowest, so color change is less visible
    classChangeTimeoutRef.current = setTimeout(() => {
      console.log('[DarkModeContext] t=400ms: Applying DOM class change NOW');
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
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, isTransitioning }}>
      {children}
    </DarkModeContext.Provider>
  );
}
