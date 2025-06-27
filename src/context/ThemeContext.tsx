import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isAuthPage: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as Theme) || 'light';
  });
  
  const location = useLocation();
  
  // Check if current route is an auth page
  const isAuthPage = 
    location.pathname.startsWith('/auth/signin') ||
    location.pathname.startsWith('/auth/signup') ||
    location.pathname.startsWith('/auth/forgot-password') ||
    location.pathname.startsWith('/auth/reset-password');

  useEffect(() => {
    // Only save and apply theme if not on auth pages
    if (!isAuthPage) {
      localStorage.setItem('theme', theme);
    }
    
    // Apply theme class to document
    if ((isAuthPage && theme === 'dark') || (!isAuthPage && theme === 'dark')) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Force light mode on auth pages
    if (isAuthPage) {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isAuthPage, location]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isAuthPage }}>
      {children}
    </ThemeContext.Provider>
  );
};