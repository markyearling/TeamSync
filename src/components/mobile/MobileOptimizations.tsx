import React, { useEffect } from 'react';
import { useCapacitor } from '../../hooks/useCapacitor';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface MobileOptimizationsProps {
  children: React.ReactNode;
}

const MobileOptimizations: React.FC<MobileOptimizationsProps> = ({ children }) => {
  const { isNative, isIOS, isAndroid } = useCapacitor();
  const { sendLocalNotification } = usePushNotifications();

  useEffect(() => {
    if (isNative) {
      // Add mobile-specific CSS classes
      document.body.classList.add('mobile-app');
      
      if (isIOS) {
        document.body.classList.add('ios');
        // Add iOS-specific safe area handling
        document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
        document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
        document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');
        document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');
      }
      
      if (isAndroid) {
        document.body.classList.add('android');
      }

      // Set viewport meta tag with viewport-fit=cover for iOS safe areas
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }

      // Handle touch events for better mobile experience
      document.addEventListener('touchstart', () => {}, { passive: true });
      document.addEventListener('touchmove', () => {}, { passive: true });
    }

    return () => {
      if (isNative) {
        document.body.classList.remove('mobile-app', 'ios', 'android');
      }
    };
  }, [isNative, isIOS, isAndroid]);

  // Add mobile-specific styles
  useEffect(() => {
    if (isNative) {
      const style = document.createElement('style');
      style.textContent = `
        .mobile-app {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          overscroll-behavior: none;
        }
        
        .ios {
          /* Removed padding-top and padding-bottom to handle in the Header component */
        }
        
        .mobile-app input,
        .mobile-app textarea {
          font-size: 16px !important; /* Prevent zoom on iOS */
        }
        
        .mobile-app .scroll-container {
          -webkit-overflow-scrolling: touch;
        }
        
        /* Better touch targets */
        .mobile-app button,
        .mobile-app a {
          min-height: 44px;
          min-width: 44px;
        }
        
        /* Smooth scrolling */
        .mobile-app {
          scroll-behavior: smooth;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, [isNative]);

  return <>{children}</>;
};

export default MobileOptimizations;