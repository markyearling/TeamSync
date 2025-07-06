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

        /* Fix for modals on mobile */
        .mobile-app .fixed {
          position: fixed !important;
        }
        
        /* Ensure proper safe area insets */
        .mobile-app .safe-area-top {
          padding-top: var(--safe-area-inset-top);
        }
        
        .mobile-app .safe-area-bottom {
          padding-bottom: var(--safe-area-inset-bottom);
        }
        
        .mobile-app .safe-area-left {
          padding-left: var(--safe-area-inset-left);
        }
        
        .mobile-app .safe-area-right {
          padding-right: var(--safe-area-inset-right);
        }
        
        /* Pull to refresh styles */
        .mobile-app {
          overscroll-behavior-y: contain;
        }
        
        .mobile-app .pull-indicator {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          pointer-events: none;
          z-index: 50;
          transition: height 0.2s ease-out;
        }
        
        .mobile-app .pull-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .mobile-app .safe-area-bottom {
          padding-bottom: var(--safe-area-inset-bottom);
        }
        
        .mobile-app .safe-area-left {
          padding-left: var(--safe-area-inset-left);
        }
        
        .mobile-app .safe-area-right {
          padding-right: var(--safe-area-inset-right);
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