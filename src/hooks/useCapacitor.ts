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
    const initializeCapacitor = async () => {
      const native = Capacitor.isNativePlatform();
      const currentPlatform = Capacitor.getPlatform();
      
      setIsNative(native);
      setPlatform(currentPlatform);

      if (native) {
        // Configure status bar
        try {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#2563eb' });
        } catch (error) {
          console.log('StatusBar not available:', error);
        }

        // Hide splash screen
        try {
          await SplashScreen.hide();
        } catch (error) {
          console.log('SplashScreen not available:', error);
        }

        // Handle app state changes
        App.addListener('appStateChange', ({ isActive }) => {
          console.log('App state changed. Is active?', isActive);
        });

        // Handle back button on Android
        App.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            App.exitApp();
          } else {
            window.history.back();
          }
        });

        // Handle keyboard events
        Keyboard.addListener('keyboardWillShow', info => {
          console.log('Keyboard will show with height:', info.keyboardHeight);
        });

        Keyboard.addListener('keyboardDidShow', info => {
          console.log('Keyboard did show with height:', info.keyboardHeight);
        });

        Keyboard.addListener('keyboardWillHide', () => {
          console.log('Keyboard will hide');
        });

        Keyboard.addListener('keyboardDidHide', () => {
          console.log('Keyboard did hide');
        });
      }
    };

    initializeCapacitor();

    return () => {
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