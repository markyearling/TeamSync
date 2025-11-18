import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { parseOAuthCallback } from '../utils/oauth';

export const useOAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleAppUrlOpen = (event: { url: string }) => {
      console.log('App URL opened:', event.url);

      if (event.url.includes('/connections/teamsnap/callback')) {
        const { code, error } = parseOAuthCallback(event.url);

        if (code) {
          console.log('TeamSnap OAuth code received via deep link:', code);
          navigate(`/connections/teamsnap/callback?code=${code}`);
        } else if (error) {
          console.error('TeamSnap OAuth error received via deep link:', error);
          navigate(`/connections/teamsnap/callback?error=${error}`);
        }
      } else if (event.url.includes('/connections/callback')) {
        const { code, error } = parseOAuthCallback(event.url);

        if (code) {
          console.log('SportsEngine OAuth code received via deep link:', code);
          navigate(`/connections/callback?code=${code}`);
        } else if (error) {
          console.error('SportsEngine OAuth error received via deep link:', error);
          navigate(`/connections/callback?error=${error}`);
        }
      }
    };

    const listener = App.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      listener.remove();
    };
  }, [navigate]);
};
