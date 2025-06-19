import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  ActionPerformed,
  Token 
} from '@capacitor/push-notifications';

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const initializePushNotifications = async () => {
      try {
        // Request permission
        const permission = await PushNotifications.requestPermissions();
        
        if (permission.receive === 'granted') {
          // Register for push notifications
          await PushNotifications.register();
          setIsRegistered(true);
        }

        // Listen for registration
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success, token: ' + token.value);
          setToken(token.value);
          // TODO: Send token to your backend
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });

        // Listen for push notifications received
        PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            console.log('Push notification received: ', notification);
            // Handle notification when app is in foreground
          },
        );

        // Listen for push notification actions
        PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (notification: ActionPerformed) => {
            console.log('Push notification action performed', notification);
            // Handle notification tap
            const data = notification.notification.data;
            
            // Navigate based on notification type
            if (data?.type === 'message') {
              // Navigate to chat
              window.location.href = '/friends';
            } else if (data?.type === 'friend_request') {
              // Navigate to friends
              window.location.href = '/friends';
            } else if (data?.type === 'schedule_change') {
              // Navigate to calendar
              window.location.href = '/calendar';
            }
          },
        );

      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    };

    initializePushNotifications();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  const sendLocalNotification = async (title: string, body: string, data?: any) => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Date.now(),
            extra: data,
            schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
          }
        ]
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  };

  return {
    token,
    isRegistered,
    sendLocalNotification
  };
};