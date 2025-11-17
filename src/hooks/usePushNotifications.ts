import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
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
} from '@capacitor/local-notifications';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from '../lib/supabase';

export const usePushNotifications = (user: User | null, authLoading: boolean) => {
  console.log('User provided to hook:', user ? 'Present' : 'Not present');
  console.log('Auth loading state:', authLoading);
  
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const isInitializedRef = useRef(false);

  // Function to get or generate a unique device ID
  const getDeviceId = useCallback(async (): Promise<string> => {
    try {
      console.log('[getDeviceId] Getting device identifier...');
      const deviceInfo = await Device.getId();
      console.log('[getDeviceId] Device UUID:', deviceInfo.identifier);
      return deviceInfo.identifier;
    } catch (error) {
      console.error('[getDeviceId] Error getting device ID, generating fallback:', error);
      // Fallback: generate a stable ID based on platform and store in localStorage
      const storageKey = 'famsink_device_id';
      let deviceId = localStorage.getItem(storageKey);
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem(storageKey, deviceId);
        console.log('[getDeviceId] Generated and stored fallback device ID:', deviceId);
      } else {
        console.log('[getDeviceId] Retrieved fallback device ID from storage:', deviceId);
      }
      return deviceId;
    }
  }, []);

  // Function to save FCM token to Supabase user_devices table (multi-device support)
  const saveFCMTokenToSupabase = useCallback(async (tokenToSave: string, authenticatedUser: User) => {
    try {
      console.log('[saveFCMTokenToSupabase] Starting FCM token save process (multi-device)...');
      console.log('[saveFCMTokenToSupabase] Token to save (preview):', tokenToSave.substring(0, 20) + '...');
      console.log('[saveFCMTokenToSupabase] Authenticated user ID:', authenticatedUser.id);
      console.log('[saveFCMTokenToSupabase] User email:', authenticatedUser.email);

      // Get device information
      const deviceId = await getDeviceId();
      const deviceInfo = await Device.getInfo();
      const platform = Capacitor.getPlatform() as 'ios' | 'android';

      // Create a user-friendly device name
      const deviceName = `${deviceInfo.manufacturer || ''} ${deviceInfo.model || platform}`.trim();

      console.log('[saveFCMTokenToSupabase] Device information:', {
        deviceId: deviceId.substring(0, 20) + '...',
        platform,
        deviceName,
        model: deviceInfo.model,
        osVersion: deviceInfo.osVersion
      });

      // Check if this FCM token already exists for this user (regardless of device_id)
      console.log('[saveFCMTokenToSupabase] Checking if FCM token already exists in database...');
      const { data: existingDevice, error: fetchError } = await supabase
        .from('user_devices')
        .select('device_id, fcm_token, device_name')
        .eq('user_id', authenticatedUser.id)
        .eq('fcm_token', tokenToSave)
        .maybeSingle();

      if (fetchError) {
        console.error('[saveFCMTokenToSupabase] Error fetching existing device:', fetchError);
      }

      // If this exact token is already registered for this user
      if (existingDevice) {
        if (existingDevice.device_id === deviceId) {
          console.log('[saveFCMTokenToSupabase] FCM token and device_id already match in database, skipping update.');
          return;
        } else {
          console.log(`[saveFCMTokenToSupabase] FCM token exists but device_id changed: ${existingDevice.device_id.substring(0, 20)}... -> ${deviceId.substring(0, 20)}...`);
          console.log('[saveFCMTokenToSupabase] This typically happens after OS update. Will delete old record and create new one.');

          // Delete the old device record with the same FCM token but different device_id
          const { error: deleteError } = await supabase
            .from('user_devices')
            .delete()
            .eq('user_id', authenticatedUser.id)
            .eq('fcm_token', tokenToSave);

          if (deleteError) {
            console.error('[saveFCMTokenToSupabase] Error deleting old device record:', deleteError);
          } else {
            console.log('[saveFCMTokenToSupabase] Successfully deleted old device record');
          }
        }
      }

      // Insert the new device record
      // Note: We use insert instead of upsert because we want to ensure clean replacement
      console.log('[saveFCMTokenToSupabase] Inserting device record to user_devices table...');
      const { error } = await supabase
        .from('user_devices')
        .insert({
          user_id: authenticatedUser.id,
          device_id: deviceId,
          device_name: deviceName,
          platform: platform,
          device_model: deviceInfo.model || null,
          os_version: deviceInfo.osVersion || null,
          fcm_token: tokenToSave,
          last_active: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('[saveFCMTokenToSupabase] *** INSERT ERROR ***');
        console.error('[saveFCMTokenToSupabase] Error saving FCM token to Supabase:', error);
        console.log('[saveFCMTokenToSupabase] Supabase insert failed:', error.message);
        console.error('[saveFCMTokenToSupabase] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('[saveFCMTokenToSupabase] *** INSERT SUCCESS ***');
        console.log('[saveFCMTokenToSupabase] FCM token saved to user_devices table successfully');
        console.log('[saveFCMTokenToSupabase] Device registered for multi-device notifications');

        // Verify the token was saved by fetching it back
        console.log('[saveFCMTokenToSupabase] Verifying token was saved...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_devices')
          .select('fcm_token, device_name, platform, device_id')
          .eq('user_id', authenticatedUser.id)
          .eq('fcm_token', tokenToSave)
          .maybeSingle();

        if (verifyError) {
          console.error('[saveFCMTokenToSupabase] Error verifying saved token:', verifyError);
        } else {
          console.log('[saveFCMTokenToSupabase] Token verification result:', {
            tokenSaved: !!verifyData?.fcm_token,
            tokenMatches: verifyData?.fcm_token === tokenToSave,
            deviceIdMatches: verifyData?.device_id === deviceId,
            deviceName: verifyData?.device_name,
            platform: verifyData?.platform
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
  }, [getDeviceId]);

  useEffect(() => {
    console.log('=== usePushNotifications useEffect (initialization) starting ===');
    console.log('Capacitor.isNativePlatform() in useEffect:', Capacitor.isNativePlatform());
    console.log('Platform in useEffect:', Capacitor.getPlatform());
    
    // Prevent multiple initializations using useRef
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
    
    const platform = Capacitor.getPlatform();
    
    // Listen for registration SUCCESS
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('[PushNotifications] *** REGISTRATION SUCCESS ***');
      console.log('[PushNotifications] Raw token.value from Capacitor registration event: ' + token.value);
      console.log('[PushNotifications] Token length:', token.value.length);
      // Based on length, we can infer if it's likely an APNs token (64 hex chars) or FCM token (~152 alphanumeric chars)
      if (token.value.length === 64 && /^[0-9a-fA-F]+$/.test(token.value)) {
        console.log('[PushNotifications] WARNING: Token format (64 hex characters) strongly suggests an APNs device token. FCM registration tokens are usually longer and alphanumeric.');
        console.log('[PushNotifications] This often indicates that Firebase Messaging is not correctly initialized in your native iOS project (AppDelegate.swift).');
        
        // For iOS, we'll use FirebaseMessaging.getToken() instead of this APNs token
        if (platform === 'ios') {
          console.log('[PushNotifications] iOS detected - will use FirebaseMessaging.getToken() for FCM token');
          return;
        }
      } else {
        console.log('[PushNotifications] Token format appears typical for an FCM registration token.');
      }
      console.log('[PushNotifications] Token preview:', token.value.substring(0, 20) + '...');
      
      // For Android, use this token directly
      if (platform === 'android') {
        console.log('[PushNotifications] Android FCM token received via registration event');
        setFcmToken(token.value);
        setIsRegistered(true);
      }
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

    // Add listener for FirebaseMessaging token changes (iOS specific)
    let firebaseMessagingTokenListener: any = null;
    if (platform === 'ios') {
      firebaseMessagingTokenListener = FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
        console.log('[FirebaseMessaging] Token received event:', token);
        setFcmToken(token);
      });
    }

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
          
          // Get FCM token based on platform
          let tokenValue: string | null = null;
          
          if (platform === 'ios') {
            console.log('[PushNotifications] iOS platform detected, getting FCM token via FirebaseMessaging.getToken()...');
            try {
              const { token } = await FirebaseMessaging.getToken();
              tokenValue = token;
              console.log('[PushNotifications] Successfully retrieved FCM token via FirebaseMessaging.getToken(): ' + (token ? token.substring(0, 20) + '...' : 'null'));
            } catch (firebaseError) {
              console.error('[PushNotifications] Error getting FCM token via FirebaseMessaging:', firebaseError);
            }
          } else if (platform === 'android') {
            console.log('[PushNotifications] Android platform detected, getting FCM token via PushNotifications.getToken()...');
            try {
              const { value } = await PushNotifications.getToken();
              tokenValue = value;
              console.log('[PushNotifications] Successfully retrieved FCM token via PushNotifications.getToken(): ' + (value ? value.substring(0, 20) + '...' : 'null'));
            } catch (androidError) {
              console.error('[PushNotifications] Error getting FCM token via PushNotifications:', androidError);
            }
          }
          
          if (tokenValue) {
            console.log('[PushNotifications] Token length: ' + tokenValue.length);
            // Based on length, we can infer if it's likely an APNs token (64 hex chars) or FCM token (~152 alphanumeric chars)
            if (tokenValue.length === 64 && /^[0-9a-fA-F]+$/.test(tokenValue)) {
              console.log('[PushNotifications] WARNING: Token format (64 hex characters) strongly suggests an APNs device token. FCM registration tokens are usually longer and alphanumeric.');
            } else {
              console.log('[PushNotifications] Token format appears typical for an FCM registration token.');
            }
            setFcmToken(tokenValue);
            setIsRegistered(true);
            console.log('[PushNotifications] Token set in state, will be saved via separate effect when user is available.');
          } else {
            console.error('[PushNotifications] Failed to retrieve FCM token for platform:', platform);
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
      if (firebaseMessagingTokenListener) {
        firebaseMessagingTokenListener.remove();
      }
    };
  }, []); // Empty dependency array - only initialize once

  // Separate effect to handle saving FCM token when user becomes available or token changes
  useEffect(() => {
    console.log('[PushNotifications] Auth/Token state effect triggered (for saving token):', {
      hasUser: !!user,
      userId: user?.id || 'No user',
      authLoading,
      hasFcmToken: !!fcmToken,
      fcmTokenPreview: fcmToken ? fcmToken.substring(0, 20) + '...' : 'None'
    });

    // Save token whenever:
    // 1. We have an authenticated user
    // 2. Auth is not loading
    // 3. We have an FCM token
    if (user && !authLoading && fcmToken) {
      console.log('[PushNotifications] All conditions met - saving FCM token to database');
      saveFCMTokenToSupabase(fcmToken, user);
    } else {
      const reasons = [];
      if (!user) reasons.push('no user');
      if (authLoading) reasons.push('auth still loading');
      if (!fcmToken) reasons.push('no FCM token yet');
      console.log('[PushNotifications] Conditions not met for saving FCM token: ' + reasons.join(', '));
    }
  }, [user, authLoading, fcmToken, saveFCMTokenToSupabase]);

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