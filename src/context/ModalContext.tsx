import React, { createContext, useContext, useState, useCallback } from 'react';

interface ModalContextType {
  isAnyModalOpen: boolean;
  registerModal: () => void;
  unregisterModal: () => void;
  modalCount: number;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalCount, setModalCount] = useState(0);

  const registerModal = useCallback(() => {
    setModalCount(prev => {
      const newCount = prev + 1;
      console.log('[ModalContext] Modal registered, count:', newCount);
      
      // Add body class when first modal opens
      if (newCount === 1) {
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
      }
      
      return newCount;
    });
  }, []);

  const unregisterModal = useCallback(() => {
    setModalCount(prev => {
      const newCount = Math.max(0, prev - 1);
      console.log('[ModalContext] Modal unregistered, count:', newCount);
      
      // Remove body class when last modal closes
      if (newCount === 0) {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
      }
      
      return newCount;
    });
  }, []);

  const isAnyModalOpen = modalCount > 0;

  return (
    <ModalContext.Provider value={{ isAnyModalOpen, registerModal, unregisterModal, modalCount }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
