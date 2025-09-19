import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  ActionPerformed,
  Token
} from '@capacitor/push-notifications';
import { 
  LocalNotifications,
  LocalNotificationSchema
} from '@capacitor/local-notifications';
import { supabase } from '../lib/supabase';

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
          
          // Save FCM token to Supabase user_settings
          saveFCMTokenToSupabase(token.value);
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

  // Function to save FCM token to Supabase
  const saveFCMTokenToSupabase = async (fcmToken: string) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user for FCM token save:', userError);
        return;
      }
      
      if (!user) {
        console.log('No authenticated user found, skipping FCM token save');
        return;
      }

      console.log('Saving FCM token for user:', user.id);
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          fcm_token: fcmToken,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id' 
        });

      if (error) {
        console.error('Error saving FCM token to Supabase:', error);
      } else {
        console.log('FCM token saved to Supabase successfully');
      }
    } catch (error) {
      console.error('Exception while saving FCM token:', error);
    }
  };

  const scheduleLocalNotification = async (notification: LocalNotificationSchema) => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [notification]
      });
      return notification.id;
    } catch (error) {
      console.error('Error sending local notification:', error);
      return null;
    }
  };

  const cancelLocalNotification = async (id: number) => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.cancel({
        notifications: [{ id }]
      });
    } catch (error) {
      console.error('Error cancelling local notification:', error);
    }
  };

  return {
    token,
    isRegistered,
    scheduleLocalNotification,
    cancelLocalNotification
  };
};