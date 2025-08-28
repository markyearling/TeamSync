import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { usePushNotifications } from './usePushNotifications';

interface ScheduledNotification {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  body: string;
  trigger_time: string;
  status: 'pending' | 'scheduled' | 'cancelled' | 'sent';
  local_notification_id?: number;
  created_at: string;
  updated_at: string;
}

export const useScheduledNotifications = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { scheduleLocalNotification, cancelLocalNotification } = usePushNotifications();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let subscription: any = null;

    const initializeNotifications = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.log('No authenticated user, skipping notification initialization');
          return;
        }

        console.log('Initializing scheduled notifications for user:', user.id);

        // Process existing pending notifications
        await processPendingNotifications(user.id);

        // Set up real-time subscription for notification changes
        subscription = supabase
          .channel(`scheduled-notifications:user_id=eq.${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'scheduled_local_notifications',
              filter: `user_id=eq.${user.id}`
            },
            async (payload) => {
              console.log('Notification change received:', payload);
              
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const notification = payload.new as ScheduledNotification;
                await handleNotificationChange(notification);
              } else if (payload.eventType === 'DELETE') {
                const deletedNotification = payload.old as ScheduledNotification;
                if (deletedNotification.local_notification_id) {
                  await cancelLocalNotification(deletedNotification.local_notification_id);
                }
              }
            }
          )
          .subscribe((status) => {
            console.log('Scheduled notifications subscription status:', status);
          });

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing scheduled notifications:', error);
      }
    };

    // Listen for auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        initializeNotifications();
      } else if (event === 'SIGNED_OUT') {
        // Clean up subscription
        if (subscription) {
          subscription.unsubscribe();
          subscription = null;
        }
        setIsInitialized(false);
      }
    });

    // Initialize if already signed in
    initializeNotifications();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      authSubscription.unsubscribe();
    };
  }, [scheduleLocalNotification, cancelLocalNotification]);

  const processPendingNotifications = async (userId: string) => {
    try {
      // Fetch all pending notifications for this user
      const { data: pendingNotifications, error } = await supabase
        .from('scheduled_local_notifications')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending'])
        .order('trigger_time', { ascending: true });

      if (error) {
        console.error('Error fetching pending notifications:', error);
        return;
      }

      console.log(`Found ${pendingNotifications?.length || 0} pending notifications to schedule`);

      // Process each pending notification
      for (const notification of pendingNotifications || []) {
        await handleNotificationChange(notification);
      }
    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  };

  const handleNotificationChange = async (notification: ScheduledNotification) => {
    try {
      const triggerTime = new Date(notification.trigger_time);
      const now = new Date();

      if (notification.status === 'pending') {
        // Check if trigger time is still in the future
        if (triggerTime > now) {
          // Generate a unique numeric ID for the local notification
          const localNotificationId = Math.floor(Math.random() * 1000000) + Date.now();

          // Schedule the local notification
          const scheduledId = await scheduleLocalNotification({
            id: localNotificationId,
            title: notification.title,
            body: notification.body,
            schedule: { at: triggerTime },
            extra: {
              event_id: notification.event_id,
              notification_id: notification.id
            }
          });

          if (scheduledId) {
            // Update the notification status to scheduled
            const { error: updateError } = await supabase
              .from('scheduled_local_notifications')
              .update({
                status: 'scheduled',
                local_notification_id: localNotificationId,
                updated_at: new Date().toISOString()
              })
              .eq('id', notification.id);

            if (updateError) {
              console.error('Error updating notification status:', updateError);
            } else {
              console.log(`Scheduled notification for event: ${notification.title} at ${triggerTime}`);
            }
          }
        } else {
          // Trigger time is in the past, mark as cancelled
          const { error: updateError } = await supabase
            .from('scheduled_local_notifications')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          if (updateError) {
            console.error('Error marking past notification as cancelled:', updateError);
          }
        }
      } else if (notification.status === 'cancelled' && notification.local_notification_id) {
        // Cancel the local notification
        await cancelLocalNotification(notification.local_notification_id);
        
        // Delete the cancelled notification record
        const { error: deleteError } = await supabase
          .from('scheduled_local_notifications')
          .delete()
          .eq('id', notification.id);

        if (deleteError) {
          console.error('Error deleting cancelled notification:', deleteError);
        } else {
          console.log(`Cancelled and deleted notification: ${notification.title}`);
        }
      }
    } catch (error) {
      console.error('Error handling notification change:', error);
    }
  };

  return {
    isInitialized
  };
};