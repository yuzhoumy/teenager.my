"use client";

import L from "leaflet";
import type { LatLngBounds } from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type { StudySessionMapItem, StudyZoneBounds, StudyZoneZoomCommand } from "./study-zone-page-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudyZoneMapProps = {
  sessions: StudySessionMapItem[];
  locateSignal: number;
  zoomCommand: StudyZoneZoomCommand | null;
  onBoundsChange: (bounds: StudyZoneBounds) => void;
  onLocateError: (message: string) => void;
  onScrollToPost: (sessionId: string) => void;
  className?: string;
};

const malaysiaCenter: [number, number] = [4.2105, 101.9758];

function toStudyZoneBounds(bounds: LatLngBounds): StudyZoneBounds {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();

  return {
    south: southWest.lat,
    west: southWest.lng,
    north: northEast.lat,
    east: northEast.lng,
  };
}

function MapEvents({ locateSignal, onBoundsChange, onLocateError }: Pick<StudyZoneMapProps, "locateSignal" | "onBoundsChange" | "onLocateError">) {
  const map = useMap();

  useMapEvents({
    moveend() {
      onBoundsChange(toStudyZoneBounds(map.getBounds()));
    },
    zoomend() {
      onBoundsChange(toStudyZoneBounds(map.getBounds()));
    },
  });

  useEffect(() => {
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    onBoundsChange(toStudyZoneBounds(map.getBounds()));
  }, [map, onBoundsChange]);

  useEffect(() => {
    if (locateSignal === 0) {
      return;
    }

    if (!navigator.geolocation) {
      onLocateError("Location is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.flyTo([position.coords.latitude, position.coords.longitude], 14, { duration: 0.8 });
      },
      () => onLocateError("Unable to get your location. Check browser permission and try again."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [locateSignal, map, onLocateError]);

  return null;
}

function MapZoomController({ zoomCommand }: Pick<StudyZoneMapProps, "zoomCommand">) {
  const map = useMap();

  useEffect(() => {
    if (!zoomCommand) {
      return;
    }

    if (zoomCommand.direction === "in") {
      map.zoomIn();
      return;
    }

    map.zoomOut();
  }, [map, zoomCommand]);

  return null;
}

function MapSizeController({ sessions, onBoundsChange }: Pick<StudyZoneMapProps, "sessions" | "onBoundsChange">) {
  const map = useMap();
  const sessionBoundsKey = useMemo(
    () => sessions.map((session) => `${session.id}:${session.lat}:${session.lng}`).join("|"),
    [sessions],
  );

  useEffect(() => {
    const container = map.getContainer();

    const refreshSize = () => {
      map.invalidateSize({ pan: false });
      onBoundsChange(toStudyZoneBounds(map.getBounds()));
    };

    const animationFrame = window.requestAnimationFrame(refreshSize);
    const shortTimeout = window.setTimeout(refreshSize, 120);
    const longTimeout = window.setTimeout(refreshSize, 450);
    const resizeObserver = new ResizeObserver(refreshSize);
    resizeObserver.observe(container);
    window.addEventListener("resize", refreshSize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(shortTimeout);
      window.clearTimeout(longTimeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", refreshSize);
    };
  }, [map, onBoundsChange]);

  useEffect(() => {
    map.invalidateSize({ pan: false });
    const refreshAfterMove = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
      onBoundsChange(toStudyZoneBounds(map.getBounds()));
    }, 350);

    if (sessions.length === 1) {
      map.setView([sessions[0].lat, sessions[0].lng], 14, { animate: true });
      onBoundsChange(toStudyZoneBounds(map.getBounds()));
      return () => window.clearTimeout(refreshAfterMove);
    }

    if (sessions.length > 1) {
      const bounds = L.latLngBounds(sessions.map((session) => [session.lat, session.lng]));
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14, animate: true });
      onBoundsChange(toStudyZoneBounds(map.getBounds()));
    }

    return () => window.clearTimeout(refreshAfterMove);
  }, [map, onBoundsChange, sessionBoundsKey, sessions]);

  return null;
}

export function StudyZoneMap({ sessions, locateSignal, zoomCommand, onBoundsChange, onLocateError, onScrollToPost, className }: StudyZoneMapProps) {
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "study-zone-marker-icon",
        html: '<span class="study-zone-marker"></span>',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -30],
      }),
    [],
  );

  return (
    <div className={cn("study-zone-map relative z-0 isolate h-[58vh] min-h-[420px] touch-none overflow-hidden overscroll-contain rounded-[28px] border border-border-strong bg-surface shadow-[0_10px_40px_var(--shadow)]", className)}>
      <MapContainer center={malaysiaCenter} zoom={6} zoomControl={false} dragging touchZoom scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents locateSignal={locateSignal} onBoundsChange={onBoundsChange} onLocateError={onLocateError} />
        <MapZoomController zoomCommand={zoomCommand} />
        <MapSizeController sessions={sessions} onBoundsChange={onBoundsChange} />
        <MarkerClusterGroup chunkedLoading>
          {sessions.map((session) => (
            <Marker key={session.id} position={[session.lat, session.lng]} icon={markerIcon}>
              <Popup>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-text-soft">{session.location_name}</p>
                    <h3 className="mt-1 font-serif text-lg leading-tight text-foreground">{session.title}</h3>
                    {session.subject ? <p className="mt-1 text-sm text-text-muted">{session.subject}</p> : null}
                    {session.starts_at ? (
                      <p className="mt-1 text-sm text-text-muted">{new Date(session.starts_at).toLocaleString()}</p>
                    ) : null}
                  </div>
                  <Button type="button" size="sm" onClick={() => onScrollToPost(session.id)}>
                    Scroll to Post
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
