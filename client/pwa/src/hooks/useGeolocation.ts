import { useState, useEffect } from 'react';
import type { UserLocation } from '../types';

export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {
        // Default to Sydney CBD if geolocation denied
        setLocation({ latitude: -33.8688, longitude: 151.2093 });
      }
    );
  }, []);

  return location;
}
