/// <reference types="vite/client" />

declare global {
  interface Window {
    __PUSH_NOTIFICATIONS_INITIALIZED__?: boolean;
  }
}

export {};