"use client";

import dynamic from "next/dynamic";
import { LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PickedAddress = {
  lat: number;
  lng: number;
  address: string;
  location_name: string;
};

type AddressPickerProps = {
  value: PickedAddress | null;
  onChange: (value: PickedAddress) => void;
};

type NominatimSearchResult = {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
};

type NominatimReverseResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: {
    amenity?: string;
    building?: string;
    cafe?: string;
    library?: string;
    shop?: string;
    road?: string;
    suburb?: string;
    town?: string;
    city?: string;
    state?: string;
  };
};

const MiniMap = dynamic(() => import("./address-picker-mini-map").then((module) => module.AddressPickerMiniMap), {
  ssr: false,
  loading: () => <div className="h-48 rounded-2xl border border-border bg-surface-muted" />,
});

function getLocationName(result: NominatimSearchResult | NominatimReverseResult) {
  if ("name" in result && result.name?.trim()) {
    return result.name.trim();
  }

  const address = "address" in result ? result.address : undefined;
  const candidate =
    address?.amenity ??
    address?.building ??
    address?.cafe ??
    address?.library ??
    address?.shop ??
    address?.road ??
    address?.suburb ??
    address?.town ??
    address?.city ??
    address?.state;

  if (candidate?.trim()) {
    return candidate.trim();
  }

  return result.display_name?.split(",")[0]?.trim() || "Selected location";
}

export function AddressPicker({ value, onChange }: AddressPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const hasQuery = query.trim().length >= 3;

  const selectedCoordinates = useMemo(() => {
    if (!value) return "";
    return `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`;
  }, [value]);

  function selectAddress(result: NominatimSearchResult) {
    onChange({
      lat: Number(result.lat),
      lng: Number(result.lon),
      address: result.display_name,
      location_name: getLocationName(result),
    });
    setQuery(result.display_name);
    setResults([]);
    setError("");
  }

  async function searchPlaces() {
    if (!hasQuery || searching) {
      return;
    }

    setSearching(true);
    setError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query.trim())}`,
      );

      if (!response.ok) {
        throw new Error("Place search is unavailable right now.");
      }

      const data = (await response.json()) as NominatimSearchResult[];
      setResults(data);
      if (data.length === 0) {
        setError("No places found. Try a nearby landmark or a more specific name.");
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to search for places.");
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void searchPlaces();
  }

  async function reverseGeocode(lat: number, lng: number) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`,
    );

    if (!response.ok) {
      throw new Error("Unable to fetch the address for your location.");
    }

    const data = (await response.json()) as NominatimReverseResult;
    const address = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    onChange({
      lat,
      lng,
      address,
      location_name: getLocationName(data),
    });
    setQuery(address);
    setResults([]);
  }

  function useCurrentLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void reverseGeocode(position.coords.latitude, position.coords.longitude)
          .catch((locationError) => {
            setError(locationError instanceof Error ? locationError.message : "Unable to use your current location.");
          })
          .finally(() => setLocating(false));
      },
      (positionError) => {
        setLocating(false);
        setError(positionError.code === positionError.PERMISSION_DENIED ? "Location permission was denied." : "Unable to get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pr-24 pl-9"
            placeholder="Search cafes, libraries, campuses..."
          />
          <Button type="button" size="sm" className="absolute right-1 top-1" disabled={!hasQuery || searching} onClick={() => void searchPlaces()}>
            {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
          {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? "Finding..." : "Use My Current Location"}
        </Button>
      </div>

      {results.length > 0 ? (
        <div className="max-h-56 overflow-auto rounded-2xl border border-border bg-surface">
          {results.map((result) => (
            <button
              key={`${result.lat}-${result.lon}-${result.display_name}`}
              type="button"
              className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface-muted"
              onClick={() => selectAddress(result)}
            >
              <span className="block text-sm font-semibold text-foreground">{getLocationName(result)}</span>
              <span className="mt-1 block text-xs text-text-muted">{result.display_name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {value ? (
        <div className="space-y-3">
          <MiniMap lat={value.lat} lng={value.lng} label={value.location_name} />
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-brand" />
              {value.location_name}
            </p>
            <p className="mt-1 text-sm text-text-muted">{value.address}</p>
            <p className="mt-1 text-xs text-text-soft">{selectedCoordinates}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}
    </div>
  );
}
