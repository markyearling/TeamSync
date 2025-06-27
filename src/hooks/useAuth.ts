import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth.ts] Initial session check:', session ? 'Session exists' : 'No session');
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[useAuth.ts] Auth state changed:', _event, session ? 'Session exists' : 'No session');
      
      // Don't update user state if this is a password recovery event
      if (_event === 'PASSWORD_RECOVERY') {
        console.log('[useAuth.ts] Password recovery flow detected, not updating user state');
        return;
      }
      
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}