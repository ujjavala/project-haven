import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import type { SafeSpaceDto, PredictionDto, UserLocation } from '../types';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const safeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface Props {
  center: UserLocation;
  safeSpaces: SafeSpaceDto[];
  predictions: PredictionDto[];
}

export default function HavenMap({ center, safeSpaces, predictions }: Props) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
      aria-label="Emergency map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* User location */}
      <Marker position={[center.latitude, center.longitude]}>
        <Popup>Your location</Popup>
      </Marker>

      {/* Safe spaces */}
      {safeSpaces.map((s) => (
        <Marker key={s.id} position={[s.latitude, s.longitude]} icon={safeIcon}>
          <Popup>
            <strong>{s.name}</strong><br />
            {s.address}<br />
            {s.distanceKm != null && `${s.distanceKm} km · ~${s.etaMinutes} min`}
          </Popup>
        </Marker>
      ))}

      {/* Fire prediction zones */}
      {predictions.map((p) => (
        <Circle
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={p.radiusKm * 1000}
          pathOptions={{
            color: p.severity > 0.7 ? '#dc2626' : p.severity > 0.4 ? '#ea580c' : '#ca8a04',
            fillOpacity: 0.15,
            weight: 2,
          }}
        >
          <Popup>
            Severity: {Math.round(p.severity * 100)}%<br />
            Confidence: {Math.round(p.confidence * 100)}%<br />
            Spread: {p.spreadDirection}
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  );
}
