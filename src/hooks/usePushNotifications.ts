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
  const isInitializedRef = useRef(false);
  console.log('=== usePushNotifications hook called ===');
  console.log('Capacitor.isNativePlatform() at hook start:', Capacitor.isNativePlatform());
  console.log('Current platform at hook start:', Capacitor.getPlatform());
  
  const [token, setToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    console.log('=== usePushNotifications useEffect starting ===');
    console.log('Capacitor.isNativePlatform() in useEffect:', Capacitor.isNativePlatform());
    console.log('Platform in useEffect:', Capacitor.getPlatform());
    
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      console.log('[PushNotifications] Already initialized, skipping duplicate initialization');
      return;
    }
    
    console.log('[PushNotifications] First initialization, proceeding...');
    isInitializedRef.current = true;
    
    if (!Capacitor.isNativePlatform()) {
      console.log('usePushNotifications: Not a native platform, exiting early');
      return;
    }

    console.log('usePushNotifications: Native platform detected, proceeding with initialization');
    
    // Set up all event listeners FIRST, before any registration attempts
    console.log('[PushNotifications] Setting up event listeners BEFORE registration...');
    
    // Listen for registration SUCCESS
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('[PushNotifications] *** REGISTRATION SUCCESS ***');
      console.log('[PushNotifications] Push registration success, token: ' + token.value);
      console.log('[PushNotifications] Token length:', token.value.length);
      console.log('[PushNotifications] Token preview:', token.value.substring(0, 20) + '...');
      setToken(token.value);
      
      console.log('[PushNotifications] Attempting to save FCM token to Supabase...');
      // Save FCM token to Supabase user_settings
      saveFCMTokenToSupabase(token.value);
      console.log('[PushNotifications] saveFCMTokenToSupabase called.');
    });

    // Listen for registration ERRORS
    const registrationErrorListener = PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[PushNotifications] *** REGISTRATION ERROR ***');
      console.error('[PushNotifications] Error on registration: ' + JSON.stringify(error));
      console.error('[PushNotifications] Registration error details:', error);
    });

    // Listen for push notifications received
    const pushReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('[PushNotifications] Push notification received: ', notification);
        // Handle notification when app is in foreground
      },
    );

    // Listen for push notification actions
    const pushActionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('[PushNotifications] Push notification action performed', notification);
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

    console.log('[PushNotifications] All event listeners set up, now proceeding with initialization...');

    const initializePushNotifications = async () => {
      console.log('[PushNotifications] Initializing push notifications...');
      try {
        console.log('[PushNotifications] Platform check:', Capacitor.getPlatform());
        console.log('[PushNotifications] Is native platform:', Capacitor.isNativePlatform());
        console.log('[PushNotifications] PushNotifications module available:', !!PushNotifications);
        
        console.log('[PushNotifications] About to request permissions...');
        // Request permission
        const permission = await PushNotifications.requestPermissions();
        
        console.log('[PushNotifications] Permission status:', permission.receive);
        console.log('[PushNotifications] Full permission object:', permission);
        
        if (permission.receive === 'granted') {
          // Register for push notifications
          console.log('[PushNotifications] Permission granted, registering for push notifications...');
          console.log('[PushNotifications] Calling PushNotifications.register()...');
          console.log('[PushNotifications] NOTE: Event listeners are already set up and waiting for registration event...');
          await PushNotifications.register();
          console.log('[PushNotifications] PushNotifications.register() completed');
          console.log('[PushNotifications] Now waiting for registration event callback...');
          setIsRegistered(true);
        } else {
          console.log('[PushNotifications] Permission not granted:', permission.receive);
          console.log('[PushNotifications] Cannot proceed without permission');
          console.log('[PushNotifications] User needs to grant permission in device settings');
        }

        console.log('[PushNotifications] Initialization complete');


      } catch (error) {
        console.error('[PushNotifications] *** INITIALIZATION ERROR ***');
        console.error('[PushNotifications] Error initializing push notifications:', error);
        console.error('[PushNotifications] Error type:', typeof error);
        console.error('[PushNotifications] Error name:', error instanceof Error ? error.name : 'Unknown');
        console.error('[PushNotifications] Error message:', error instanceof Error ? error.message : 'Unknown');
        console.error('[PushNotifications] Error stack:', error instanceof Error ? error.stack : 'No stack');
      }
    };

    console.log('[PushNotifications] About to call initializePushNotifications()');
    initializePushNotifications();
    console.log('[PushNotifications] initializePushNotifications() called');

    return () => {
      console.log('[PushNotifications] Cleaning up listeners');
      // Reset initialization flag on cleanup
      isInitializedRef.current = false;
      // Clean up specific listeners
      registrationListener.remove();
      registrationErrorListener.remove();
      pushReceivedListener.remove();
      pushActionListener.remove();
    };
  }, []); // Empty dependency array ensures this runs only once

  // Function to save FCM token to Supabase
  const saveFCMTokenToSupabase = async (fcmToken: string) => {
    try {
      console.log('[saveFCMTokenToSupabase] *** STARTING TOKEN SAVE PROCESS ***');
      console.log('[saveFCMTokenToSupabase] Starting save process for token:', fcmToken ? fcmToken.substring(0, 10) + '...' : 'null');
      
      if (!fcmToken || fcmToken.trim() === '') {
        console.error('[saveFCMTokenToSupabase] Invalid FCM token provided');
        return;
      }
      
      console.log('[saveFCMTokenToSupabase] Getting current user from Supabase auth...');
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
      console.log('[saveFCMTokenToSupabase] Saving FCM token for user:', user.id);
      
      // First, check if user_settings record exists
      console.log('[saveFCMTokenToSupabase] Checking if user_settings record exists...');
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
      
      console.log('[saveFCMTokenToSupabase] Attempting upsert to user_settings table...');
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
        console.error('[saveFCMTokenToSupabase] *** UPSERT ERROR ***');
        console.error('[saveFCMTokenToSupabase] Error saving FCM token to Supabase:', error);
        console.log('[saveFCMTokenToSupabase] Supabase upsert failed:', error.message);
        console.error('[saveFCMTokenToSupabase] Full error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('[saveFCMTokenToSupabase] *** UPSERT SUCCESS ***');
        console.log('[saveFCMTokenToSupabase] FCM token saved to Supabase successfully');
        console.log('[saveFCMTokenToSupabase] Supabase upsert successful.');
        
        // Verify the token was saved by fetching it back
        console.log('[saveFCMTokenToSupabase] Verifying token was saved...');
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
      console.error('[saveFCMTokenToSupabase] *** EXCEPTION ***');
      console.error('[saveFCMTokenToSupabase] Exception while saving FCM token:', error);
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