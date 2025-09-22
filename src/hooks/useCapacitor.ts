import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';

export const useCapacitor = () => {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<string>('web');

  useEffect(() => {
    console.log('=== useCapacitor hook initializing ===');
    console.log('Capacitor.isNativePlatform():', Capacitor.isNativePlatform());
    console.log('Capacitor.getPlatform():', Capacitor.getPlatform());
    
    const initializeCapacitor = async () => {
      const native = Capacitor.isNativePlatform();
      const currentPlatform = Capacitor.getPlatform();
      
      console.log('useCapacitor: native =', native);
      console.log('useCapacitor: currentPlatform =', currentPlatform);
      
      setIsNative(native);
      setPlatform(currentPlatform);

      if (native) {
        console.log('useCapacitor: Device detected as native, initializing Capacitor features...');
        // Configure status bar
        try {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#2563eb' });
          console.log('useCapacitor: StatusBar configured successfully');
        } catch (error) {
          console.log('useCapacitor: StatusBar not available:', error);
        }

        // Hide splash screen
        try {
          await SplashScreen.hide();
          console.log('useCapacitor: SplashScreen hidden successfully');
        } catch (error) {
          console.log('useCapacitor: SplashScreen not available:', error);
        }

        // Handle app state changes
        App.addListener('appStateChange', ({ isActive }) => {
          console.log('useCapacitor: App state changed. Is active?', isActive);
        });

        // Handle back button on Android
        App.addListener('backButton', ({ canGoBack }) => {
          console.log('useCapacitor: Back button pressed. Can go back?', canGoBack);
          if (!canGoBack) {
            App.exitApp();
          } else {
            window.history.back();
          }
        });

        // Handle keyboard events
        Keyboard.addListener('keyboardWillShow', info => {
          console.log('useCapacitor: Keyboard will show with height:', info.keyboardHeight);
          
          // Adjust scroll position to keep focused element visible
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            setTimeout(() => {
              activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        });

        Keyboard.addListener('keyboardDidShow', info => {
          console.log('useCapacitor: Keyboard did show with height:', info.keyboardHeight);
        });

        Keyboard.addListener('keyboardWillHide', () => {
          console.log('useCapacitor: Keyboard will hide');
        });

        Keyboard.addListener('keyboardDidHide', () => {
          console.log('useCapacitor: Keyboard did hide');
        });
      } else {
        console.log('useCapacitor: Device detected as web platform, skipping native features');
      }
    };

    initializeCapacitor();

    return () => {
      console.log('useCapacitor: Cleaning up listeners');
      if (isNative) {
        App.removeAllListeners();
        Keyboard.removeAllListeners();
      }
    };
  }, [isNative]);

  return {
    isNative,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web'
  };
};