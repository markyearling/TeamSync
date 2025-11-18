import { Capacitor } from '@capacitor/core';

export const getOAuthRedirectUri = (provider: 'teamsnap' | 'sportsengine'): string => {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    if (provider === 'teamsnap') {
      return 'capacitor://localhost/connections/teamsnap/callback';
    } else if (provider === 'sportsengine') {
      return 'capacitor://localhost/connections/callback';
    }
  }

  if (provider === 'teamsnap') {
    return `${window.location.origin}/connections/teamsnap/callback`;
  } else if (provider === 'sportsengine') {
    return `${window.location.origin}/connections/callback`;
  }

  return `${window.location.origin}/connections/callback`;
};

export const parseOAuthCallback = (url: string): { code?: string; error?: string; state?: string } => {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    return {
      code: params.get('code') || undefined,
      error: params.get('error') || undefined,
      state: params.get('state') || undefined,
    };
  } catch (error) {
    console.error('Error parsing OAuth callback URL:', error);
    return {};
  }
};
