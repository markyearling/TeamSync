import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth.ts] Auth state changed:', event, session ? 'Session exists' : 'No session');
      console.log('[useAuth.ts] Session details:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id || 'No user',
        accessToken: session?.access_token ? 'Present' : 'Missing',
        refreshToken: session?.refresh_token ? 'Present' : 'Missing',
        expiresAt: session?.expires_at || 'No expiry',
        timestamp: new Date().toISOString()
      });
      
      // Check localStorage for session data
      const storageKeys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('sb-'));
      console.log('[useAuth.ts] LocalStorage Supabase keys:', storageKeys);
      
      if (storageKeys.length > 0) {
        storageKeys.forEach(key => {
          const value = localStorage.getItem(key);
          console.log(`[useAuth.ts] LocalStorage ${key}:`, value ? 'Has value' : 'Empty');
        });
      }
      
      // Handle initial session and all subsequent auth state changes
      setUser(session?.user ?? null);
      
      // Only set loading to false after we've processed the initial session
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        console.log('[useAuth.ts] Setting loading to false for event:', event);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Log current state whenever it changes
  useEffect(() => {
    console.log('[useAuth.ts] State update:', {
      hasUser: !!user,
      userId: user?.id || 'No user',
      loading,
      timestamp: new Date().toISOString()
    });
  }, [user, loading]);
  return { user, loading };
}