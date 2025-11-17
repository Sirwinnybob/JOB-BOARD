import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import OCRSettingsPage from './pages/OCRSettingsPage';
import { authAPI } from './utils/api';
import { DarkModeProvider } from './contexts/DarkModeContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(authAPI.isAuthenticated());

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <DarkModeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/admin/ocr-settings"
            element={
              isAuthenticated ? (
                <OCRSettingsPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Router>
    </DarkModeProvider>
  );
}

export default App;
