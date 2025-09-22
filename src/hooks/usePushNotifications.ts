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
      console.log('[PushNotifications] Initializing push notifications...');
      try {
        console.log('[PushNotifications] Platform check:', Capacitor.getPlatform());
        console.log('[PushNotifications] Is native platform:', Capacitor.isNativePlatform());
        
        // Request permission
        const permission = await PushNotifications.requestPermissions();
        
        console.log('[PushNotifications] Permission status:', permission.receive);
        console.log('[PushNotifications] Full permission object:', permission);
        
        if (permission.receive === 'granted') {
          // Register for push notifications
          console.log('[PushNotifications] Permission granted, registering for push notifications...');
          await PushNotifications.register();
          setIsRegistered(true);
        } else {
          console.log('[PushNotifications] Permission not granted:', permission.receive);
        }

        // Listen for registration
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success, token: ' + token.value);
          console.log('[PushNotifications] Token length:', token.value.length);
          console.log('[PushNotifications] Token preview:', token.value.substring(0, 20) + '...');
          setToken(token.value);
          
          console.log('[PushNotifications] Attempting to save FCM token to Supabase...');
          // Save FCM token to Supabase user_settings
          saveFCMTokenToSupabase(token.value);
          console.log('[PushNotifications] saveFCMTokenToSupabase called.');
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on registration: ' + JSON.stringify(error));
          console.error('[PushNotifications] Registration error details:', error);
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
      console.log('[saveFCMTokenToSupabase] Starting save process for token:', fcmToken ? fcmToken.substring(0, 10) + '...' : 'null');
      
      if (!fcmToken || fcmToken.trim() === '') {
        console.error('[saveFCMTokenToSupabase] Invalid FCM token provided');
        return;
      }
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user for FCM token save:', userError);
        console.error('[saveFCMTokenToSupabase] User error details:', userError.message);
        return;
      }
      
      if (!user) {
        console.log('No authenticated user found, skipping FCM token save');
        console.log('[saveFCMTokenToSupabase] Auth state check - no user found');
        return;
      }

      console.log('[saveFCMTokenToSupabase] Authenticated user ID:', user.id);
      console.log('[saveFCMTokenToSupabase] User email:', user.email);
      console.log('Saving FCM token for user:', user.id);
      
      // First, check if user_settings record exists
      const { data: existingSettings, error: checkError } = await supabase
        .from('user_settings')
        .select('user_id, fcm_token')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (checkError) {
        console.error('[saveFCMTokenToSupabase] Error checking existing settings:', checkError);
      } else {
        console.log('[saveFCMTokenToSupabase] Existing settings check:', {
          hasRecord: !!existingSettings,
          currentToken: existingSettings?.fcm_token ? 'Present' : 'None'
        });
      }
      
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
        console.log('[saveFCMTokenToSupabase] Supabase upsert failed:', error.message);
        console.error('[saveFCMTokenToSupabase] Full error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('FCM token saved to Supabase successfully');
        console.log('[saveFCMTokenToSupabase] Supabase upsert successful.');
        
        // Verify the token was saved by fetching it back
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_settings')
          .select('fcm_token')
          .eq('user_id', user.id)
          .single();
        
        if (verifyError) {
          console.error('[saveFCMTokenToSupabase] Error verifying saved token:', verifyError);
        } else {
          console.log('[saveFCMTokenToSupabase] Token verification:', {
            tokenSaved: !!verifyData?.fcm_token,
            tokenMatches: verifyData?.fcm_token === fcmToken
          });
        }
      }
    } catch (error) {
      console.error('Exception while saving FCM token:', error);
      console.error('[saveFCMTokenToSupabase] Exception details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
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