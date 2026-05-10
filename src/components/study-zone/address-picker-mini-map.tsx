"use client";

type AddressPickerMiniMapProps = {
  lat: number;
  lng: number;
  label: string;
};

export function AddressPickerMiniMap({ lat, lng, label }: AddressPickerMiniMapProps) {
  const delta = 0.01;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;

  return (
    <div className="h-48 overflow-hidden rounded-2xl border border-border bg-surface">
      <iframe
        title={`Map preview for ${label}`}
        src={src}
        className="h-full w-full"
        loading="lazy"
      />
    </div>
  );
}
