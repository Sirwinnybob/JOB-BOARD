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
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    // Update state immediately - the CSS animations will handle the visual transition
    setDarkMode(prev => !prev);
    setIsTransitioning(true);

    // Reset transition state after all animations complete
    // Longest: last item (24) at 0.8s + (23*0.15s) + 0.6s duration = ~4.85s
    setTimeout(() => {
      setIsTransitioning(false);
    }, 5000);
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, isTransitioning }}>
      {children}
    </DarkModeContext.Provider>
  );
}
