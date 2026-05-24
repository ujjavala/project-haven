import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  const handleOnline  = useCallback(() => setOnline(true),  []);
  const handleOffline = useCallback(() => setOnline(false), []);

  useEffect(() => {
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return online;
}
