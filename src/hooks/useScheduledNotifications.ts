import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

interface ScheduledNotification {
  user_id: string;
  event_id: string;
  title: string;
  body: string;
  trigger_time: string;
  status: 'pending' | 'scheduled' | 'cancelled' | 'sent';
  local_notification_id?: number; // This field is now primarily for historical context or if you still use local notifications for other purposes
  created_at: string;
  updated_at: string;
}

export const useScheduledNotifications = (fcmToken: string | null, isRegistered: boolean) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let subscription: any = null;

    const initializeNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No authenticated user, skipping notification initialization');
          return;
        }

        console.log('Initializing scheduled notifications for user:', user.id);

        // Process existing pending notifications (ensure their status is correct)
        await processPendingNotifications(user.id);

        // Set up real-time subscription for notification changes
        // This is primarily for the database to update the status, not for client-side scheduling
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
              console.log('Scheduled notification change received:', payload);
              
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const notification = payload.new as ScheduledNotification;
                await handleNotificationChange(notification);
              } else if (payload.eventType === 'DELETE') {
                const deletedNotification = payload.old as ScheduledNotification;
                // No client-side action needed for deleted notifications, as they are handled by backend
                console.log(`Scheduled notification ${deletedNotification.id} deleted from DB.`);
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
  }, []); // Dependencies are empty as the internal functions handle their own dependencies

  const processPendingNotifications = async (userId: string) => {
    try {
      // Fetch all pending notifications for this user
      const { data: pendingNotifications, error } = await supabase
        .from('scheduled_local_notifications')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending']) // Only process 'pending'
        .lte('trigger_time', new Date().toISOString()); // Notifications whose trigger time is now or in the past

      if (error) {
        console.error('Error fetching pending notifications for processing:', error);
        return;
      }

      console.log(`Found ${pendingNotifications?.length || 0} overdue pending notifications to mark as sent.`);

      // Mark these as 'sent' as the backend cron job should have picked them up
      if (pendingNotifications && pendingNotifications.length > 0) {
        const { error: updateError } = await supabase
          .from('scheduled_local_notifications')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .in('id', pendingNotifications.map(n => n.id));
        
        if (updateError) {
          console.error('Error updating overdue pending notifications to sent:', updateError);
        } else {
          console.log(`Marked ${pendingNotifications.length} overdue pending notifications as 'sent'.`);
        }
      }
    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  };

  const handleNotificationChange = async (notification: ScheduledNotification) => {
    try {
      const triggerTime = new Date(notification.trigger_time);
      const now = new Date();

      // If a notification is inserted or updated and its trigger time has passed,
      // mark it as 'sent' because the backend cron job should have processed it.
      if (notification.status === 'pending' && triggerTime <= now) {
        console.log(`Notification for event "${notification.title}" is overdue or due. Marking as 'sent'.`);
        const { error: updateError } = await supabase
          .from('scheduled_local_notifications')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error('Error updating notification status to sent:', updateError);
        } else {
          console.log(`Notification for event: ${notification.title} marked as 'sent'.`);
        }
      } 
      // If a notification is explicitly 'cancelled' (e.g., by backend due to event deletion)
      else if (notification.status === 'cancelled') {
        console.log(`Notification for event "${notification.title}" is cancelled. No client-side action needed.`);
        // No client-side action needed as local notifications are no longer scheduled by client
      }
      // For 'pending' notifications in the future, no client-side action is needed as backend handles FCM
      else if (notification.status === 'pending' && triggerTime > now) {
        console.log(`Notification for event "${notification.title}" is pending and in the future. No client-side action.`);
      }
    } catch (error) {
      console.error('Error handling notification change:', error);
    }
  };

  return {
    isInitialized
  };
};