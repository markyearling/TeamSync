import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { User } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  ActionPerformed,
  Token
} from '@capacitor/push-notifications';
import { 
  LocalNotifications,
  LocalNotificationSchema
}
from '@capacitor/local-notifications';
import { supabase } from '../lib/supabase';
// Declare global window property for initialization flag
declare global {
  interface Window {
    __PUSH_NOTIFICATIONS_INITIALIZED__?: boolean;
  }
}
export const usePushNotifications = (user: User | null, authLoading: boolean) => {
  console.log('User provided to hook:', user ? 'Present' : 'Not present');
  console.log('Auth loading state:', authLoading);
  console.log('User provided to hook:', user ? 'Present' : 'Not present');
  console.log('Auth loading state:', authLoading);
  
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const fcmTokenRef = useRef<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => {
    console.log('=== usePushNotifications useEffect (initialization) starting ===');
    console.log('Capacitor.isNativePlatform() in useEffect:', Capacitor.isNativePlatform());
    console.log('Platform in useEffect:', Capacitor.getPlatform());
    
    // Initialize the global flag if it doesn't exist
    if (window.__PUSH_NOTIFICATIONS_INITIALIZED__ === undefined) {
      window.__PUSH_NOTIFICATIONS_INITIALIZED__ = false;
    }
    
    // Prevent multiple initializations using global window flag
    if (window.__PUSH_NOTIFICATIONS_INITIALIZED__) {
      window.__PUSH_NOTIFICATIONS_INITIALIZED__ = false;
    }
    
    // Prevent multiple initializations using global window flag
    if (window.__PUSH_NOTIFICATIONS_INITIALIZED__) {
      console.log('[PushNotifications] Already initialized, skipping duplicate initialization');
      return;
    }
    
    console.log('[PushNotifications] First initialization, proceeding...');
    window.__PUSH_NOTIFICATIONS_INITIALIZED__ = true;
    
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
      console.log('[PushNotifications] Raw token.value from Capacitor registration event: ' + token.value);
      console.log('[PushNotifications] Token length:', token.value.length);
      // Based on length, we can infer if it's likely an APNs token (64 hex chars) or FCM token (~152 alphanumeric chars)
      if (token.value.length === 64 && /^[0-9a-fA-F]+$/.test(token.value)) {
        console.log('[PushNotifications] WARNING: Token format (64 hex characters) strongly suggests an APNs device token. FCM registration tokens are usually longer and alphanumeric.');
        console.log('[PushNotifications] This often indicates that Firebase Messaging is not correctly initialized in your native iOS project (AppDelegate.swift).');
      } else {
        console.log('[PushNotifications] Token format appears typical for an FCM registration token.');
      }
      console.log('[PushNotifications] Token preview:', token.value.substring(0, 20) + '...');
      // Note: We now use getToken() method instead of relying on this event
      console.log('[PushNotifications] Registration event received, but using getToken() method for actual token retrieval');
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
          await PushNotifications.register();
          console.log('[PushNotifications] PushNotifications.register() completed. Now getting FCM token...');
          
          // Explicitly get the FCM token after registration
          const tokenResult = await PushNotifications.getToken();
          if (tokenResult && tokenResult.value) {
            console.log('[PushNotifications] Successfully retrieved FCM token via getToken(): ' + tokenResult.value);
            console.log('[PushNotifications] Token length: ' + tokenResult.value.length);
            // Based on length, we can infer if it's likely an APNs token (64 hex chars) or FCM token (~152 alphanumeric chars)
            if (tokenResult.value.length === 64 && /^[0-9a-fA-F]+$/.test(tokenResult.value)) {
              console.log('[PushNotifications] WARNING: Token format (64 hex characters) strongly suggests an APNs device token. FCM registration tokens are usually longer and alphanumeric.');
              console.log('[PushNotifications] This often indicates that Firebase Messaging is not correctly initialized in your native iOS project (AppDelegate.swift).');
            } else {
              console.log('[PushNotifications] Token format appears typical for an FCM registration token.');
            }
            setFcmToken(tokenResult.value);
            fcmTokenRef.current = tokenResult.value;
            setIsRegistered(true);
            // If user is already authenticated, save the token immediately
            if (user && !authLoading) {
              console.log('[PushNotifications] User already authenticated, saving FCM token from getToken()...');
              saveFCMTokenToSupabase(tokenResult.value, user);
            } else {
              console.log('[PushNotifications] User not yet authenticated or auth loading, token will be saved when auth state changes.');
            }
          } else {
            console.error('[PushNotifications] Failed to retrieve FCM token via getToken().');
          }
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
      // Clean up specific listeners
      registrationListener.remove();
      registrationErrorListener.remove();
      pushReceivedListener.remove();
      pushActionListener.remove();
    };
  }, []); // Empty dependency array ensures this runs only once

  // Separate effect to handle saving FCM token when user becomes available
  useEffect(() => {
    console.log('[PushNotifications] Auth state effect triggered (for saving token):', {
      hasUser: !!user,
      userId: user?.id || 'No user',
      authLoading,
      hasFcmTokenInRef: !!fcmTokenRef.current,
      fcmTokenRefPreview: fcmTokenRef.current ? fcmTokenRef.current.substring(0, 10) + '...' : 'None'
    });

    // Only save token when we have a user, auth is not loading, and we have an FCM token in the ref
    if (user && !authLoading && fcmTokenRef.current) {
      console.log('[PushNotifications] Conditions met for saving FCM token, proceeding...');
      saveFCMTokenToSupabase(fcmTokenRef.current, user);
    } else {
      console.log('[PushNotifications] Conditions not met for saving FCM token:', {
        hasUser: !!user,
        authNotLoading: !authLoading,
        hasFcmTokenInRef: !!fcmTokenRef.current
      });
    }
  }, [user, authLoading]);

  // Function to save FCM token to Supabase
  const saveFCMTokenToSupabase = async (tokenToSave: string, authenticatedUser: User) => {
    try {
      console.log('[saveFCMTokenToSupabase] Starting FCM token save process...');
      console.log('[saveFCMTokenToSupabase] Token to save (preview):', tokenToSave.substring(0, 20) + '...');
      console.log('[saveFCMTokenToSupabase] Authenticated user ID:', authenticatedUser.id);
      console.log('[saveFCMTokenToSupabase] User email:', authenticatedUser.email);
      console.log('[saveFCMTokenToSupabase] Saving FCM token for user:', authenticatedUser.id);
      
      // First check if we already have this token stored
      console.log('[saveFCMTokenToSupabase] Checking existing token in database...');
      const { data: existingSettings, error: fetchError } = await supabase
        .from('user_settings')
        .select('fcm_token')
        .eq('user_id', authenticatedUser.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('[saveFCMTokenToSupabase] Error fetching existing settings:', fetchError);
      }
      
      // Only update if the token is different from what's already stored
      if (existingSettings?.fcm_token === tokenToSave) {
        console.log('[saveFCMTokenToSupabase] FCM token already matches database, skipping update.');
        return;
      }
      
      console.log('[saveFCMTokenToSupabase] Attempting upsert to user_settings table...');
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: authenticatedUser.id,
          fcm_token: tokenToSave,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id' 
        });
      
      if (error) {
        console.error('[saveFCMTokenToSupabase] *** UPSERT ERROR ***');
        console.error('[saveFCMTokenToSupabase] Error saving FCM token to Supabase:', error);
        console.log('[saveFCMTokenToSupabase] Supabase upsert failed:', error.message);
        console.error('[saveFCMTokenToSupabase] Error details:', {
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
          .eq('user_id', authenticatedUser.id)
          .single();
        
        if (verifyError) {
          console.error('[saveFCMTokenToSupabase] Error verifying saved token:', verifyError);
        } else {
          console.log('[saveFCMTokenToSupabase] Token verification result:', {
            tokenSaved: !!verifyData?.fcm_token,
            tokenMatches: verifyData?.fcm_token === tokenToSave
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
    token: fcmToken,
    isRegistered,
    scheduleLocalNotification,
    cancelLocalNotification
  };
};