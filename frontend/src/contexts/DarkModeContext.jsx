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
  const [showCircularReveal, setShowCircularReveal] = useState(false);
  const [targetDarkMode, setTargetDarkMode] = useState(darkMode);
  const [previousDarkMode, setPreviousDarkMode] = useState(darkMode);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const transitionTimeoutRef = useRef(null);
  const classChangeTimeoutRef = useRef(null);
  const circularRevealTimeoutRef = useRef(null);

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

  // Save preference to localStorage (but don't update document class here)
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Initialize document class on mount (only once)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = (event) => {
    const newDarkMode = !darkMode;

    // Capture button position from the click event
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      setButtonPosition({ x, y });

      // Set CSS custom properties for circular reveal animation
      document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
      document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
    }

    // Clear any existing timeouts
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (classChangeTimeoutRef.current) {
      clearTimeout(classChangeTimeoutRef.current);
    }
    if (circularRevealTimeoutRef.current) {
      clearTimeout(circularRevealTimeoutRef.current);
    }

    // Set transitioning flags and capture old/target themes
    setIsTransitioning(true);
    setShowCircularReveal(true);
    setPreviousDarkMode(darkMode); // Capture old theme for overlay background
    setTargetDarkMode(newDarkMode); // Capture new theme for overlay expanding circle
    console.log('[DarkModeContext] t=0ms: isTransitioning set to true');
    console.log('[DarkModeContext] t=0ms: showCircularReveal set to true');
    console.log('[DarkModeContext] t=0ms: previousDarkMode set to', darkMode, '(old theme)');
    console.log('[DarkModeContext] t=0ms: targetDarkMode set to', newDarkMode, '(new theme)');

    // Update React state immediately (for grid cascade to start at t=0ms)
    setDarkMode(newDarkMode);
    console.log('[DarkModeContext] t=0ms: darkMode React state updated to', newDarkMode, '(triggers grid cascade)');

    // At t=800ms: Hide circular reveal and apply DOM class change
    classChangeTimeoutRef.current = setTimeout(() => {
      console.log('[DarkModeContext] t=800ms: Circular reveal animation complete');

      setShowCircularReveal(false);
      console.log('[DarkModeContext] t=800ms: showCircularReveal set to false');

      if (newDarkMode) {
        document.documentElement.classList.add('dark');
        console.log('[DarkModeContext] t=800ms: Added "dark" class to DOM');
      } else {
        document.documentElement.classList.remove('dark');
        console.log('[DarkModeContext] t=800ms: Removed "dark" class from DOM');
      }
    }, 800);

    // At t=5000ms: Reset transitioning state (after grid cascade completes)
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      console.log('[DarkModeContext] t=5000ms: isTransitioning set to false');
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
      if (circularRevealTimeoutRef.current) {
        clearTimeout(circularRevealTimeoutRef.current);
      }
    };
  }, []);

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, isTransitioning, showCircularReveal, targetDarkMode, previousDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}
