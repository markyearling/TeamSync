import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../context/ModalContext';

interface ModalPortalProps {
  children: React.ReactNode;
}

const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  const { registerModal, unregisterModal } = useModal();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!hasRegistered.current) {
      registerModal();
      hasRegistered.current = true;
      console.log('[ModalPortal] Modal registered');
    }

    return () => {
      if (hasRegistered.current) {
        unregisterModal();
        hasRegistered.current = false;
        console.log('[ModalPortal] Modal unregistered');
      }
    };
  }, [registerModal, unregisterModal]);

  const modalRoot = document.getElementById('modal-root');

  if (!modalRoot) {
    console.error('[ModalPortal] modal-root element not found!');
    return null;
  }

  // Ensure modal-root has proper z-index
  if (modalRoot && !modalRoot.style.zIndex) {
    modalRoot.style.position = 'fixed';
    modalRoot.style.zIndex = '200';
  }

  return createPortal(children, modalRoot);
};

export default ModalPortal;
