import React, { createContext, useContext, useState, useCallback } from 'react';

interface PageRefreshContextType {
  registerRefreshHandler: (handler: () => void) => void;
  unregisterRefreshHandler: () => void;
  triggerRefresh: () => void;
}

const PageRefreshContext = createContext<PageRefreshContextType | undefined>(undefined);

export const PageRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshHandler, setRefreshHandler] = useState<(() => void) | null>(null);

  const registerRefreshHandler = useCallback((handler: () => void) => {
    setRefreshHandler(() => handler);
  }, []);

  const unregisterRefreshHandler = useCallback(() => {
    setRefreshHandler(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    if (refreshHandler) {
      refreshHandler();
    }
  }, [refreshHandler]);

  return (
    <PageRefreshContext.Provider value={{ registerRefreshHandler, unregisterRefreshHandler, triggerRefresh }}>
      {children}
    </PageRefreshContext.Provider>
  );
};

export const usePageRefresh = () => {
  const context = useContext(PageRefreshContext);
  if (context === undefined) {
    throw new Error('usePageRefresh must be used within a PageRefreshProvider');
  }
  return context;
};
