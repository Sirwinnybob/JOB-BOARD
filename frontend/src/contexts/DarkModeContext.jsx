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
  const isManualTransition = useRef(false);

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
  // Skip immediate class update during manual transitions
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());

    // Don't update the class immediately if we're in a manual transition
    // (the toggleDarkMode function will handle it at the right time)
    if (!isManualTransition.current) {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    isManualTransition.current = true;
    setIsTransitioning(true);

    // Switch theme early in the cascade so items transition through the color change
    // This happens when background/header are mid-fade and grid items are starting
    setTimeout(() => {
      const newDarkMode = !darkMode;

      // Manually update the document class
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Update state (this will also update localStorage via useEffect)
      setDarkMode(newDarkMode);
      isManualTransition.current = false;
    }, 450); // Switch while elements are fading, giving time for rendering

    // Reset transition state after all animations complete
    // Longest: last item (24) at 300ms + (23*80ms) + 600ms = ~2740ms
    setTimeout(() => {
      setIsTransitioning(false);
    }, 3000); // Allow enough time for all cascading animations
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, isTransitioning }}>
      {children}
    </DarkModeContext.Provider>
  );
}
