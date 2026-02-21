import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Layer, CircleMarkerOptions, LatLngBounds } from "leaflet";
import type { MapLayer } from "../types";
import { ALBERTA_CENTER, DEFAULT_ZOOM } from "../config/layers";
import "leaflet/dist/leaflet.css";

const BASEMAPS = {
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    isDark: true,
  },
  light: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    isDark: false,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: '&copy; <a href="https://www.esri.com/">Esri</a>',
    isDark: true,
  },
  terrain: {
    label: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    isDark: false,
  },
  osm: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    isDark: false,
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

interface Props {
  layers: Record<string, MapLayer>;
  onFeatureClick?: (feature: GeoJSON.Feature) => void;
  onMapMove?: (bounds: LatLngBounds, zoom: number) => void;
}

function formatValue(
  val: unknown,
  format?: string
): string {
  if (val == null || val === "") return "N/A";
  const s = String(val);
  if (format === "currency") {
    const n = parseFloat(s);
    if (isNaN(n)) return s;
    return `$${n.toLocaleString()}`;
  }
  if (format === "year") return s;
  if (format === "number") {
    const n = parseFloat(s);
    if (isNaN(n)) return s;
    return n.toLocaleString();
  }
  if (s.includes("T00:00:00")) return s.split("T")[0];
  return s.length > 120 ? s.slice(0, 120) + "..." : s;
}

function buildPopupHtml(feature: GeoJSON.Feature, layer: MapLayer): string {
  const props = feature.properties ?? {};
  const fields = layer.config.popupFields;
  const rows = fields
    .map((f) => {
      const val = formatValue(props[f.key], f.format);
      return `<tr><td style="font-weight:600;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top">${f.label}</td><td style="padding:2px 0">${val}</td></tr>`;
    })
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:320px">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;border-bottom:1px solid currentColor;padding-bottom:4px;opacity:0.9">
        ${layer.config.name}
      </div>
      <table style="border-collapse:collapse">${rows}</table>
    </div>
  `;
}

function BasemapSwitcher({
  active,
  onChange,
}: {
  active: BasemapKey;
  onChange: (key: BasemapKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="basemap-switcher">
      <button
        className="basemap-toggle"
        onClick={() => setOpen(!open)}
        title="Change basemap"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
      {open && (
        <div className="basemap-menu">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              className={`basemap-option ${key === active ? "active" : ""}`}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
            >
              <span
                className="basemap-preview"
                data-basemap={key}
              />
              <span>{BASEMAPS[key].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

function MapEventHandler({
  onMapMove,
}: {
  onMapMove?: (bounds: LatLngBounds, zoom: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      onMapMove?.(map.getBounds(), map.getZoom());
    },
    zoomend: () => {
      onMapMove?.(map.getBounds(), map.getZoom());
    },
    load: () => {
      onMapMove?.(map.getBounds(), map.getZoom());
    },
  });

  useEffect(() => {
    onMapMove?.(map.getBounds(), map.getZoom());
  }, [map, onMapMove]);

  return null;
}

function PolygonLayer({
  layer,
}: {
  layer: MapLayer;
  onFeatureClick?: (f: GeoJSON.Feature) => void;
}) {
  if (!layer.data || !layer.visible) return null;

  return (
    <GeoJSON
      key={layer.config.id + "-" + layer.data.features.length}
      data={layer.data}
      style={() => layer.config.style}
      onEachFeature={(feature: GeoJSON.Feature, leafletLayer: Layer) => {
        leafletLayer.bindPopup(buildPopupHtml(feature, layer), {
          className: "civicscale-popup",
          maxWidth: 350,
        });
      }}
    />
  );
}

function PointLayer({
  layer,
}: {
  layer: MapLayer;
  onFeatureClick?: (f: GeoJSON.Feature) => void;
}) {
  if (!layer.data || !layer.visible) return null;

  const opts: CircleMarkerOptions = {
    radius: layer.config.pointRadius ?? 5,
    color: layer.config.pointColor ?? "#fff",
    weight: 1,
    opacity: 0.9,
    fillColor: layer.config.pointColor ?? "#fff",
    fillOpacity: 0.6,
  };

  return (
    <>
      {layer.data.features.map((feature, i) => {
        if (feature.geometry.type !== "Point") return null;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        return (
          <CircleMarker
            key={`${layer.config.id}-${i}`}
            center={[lat, lng]}
            pathOptions={opts}
          >
            <Popup className="civicscale-popup" maxWidth={350}>
              <div
                dangerouslySetInnerHTML={{
                  __html: buildPopupHtml(feature, layer),
                }}
              />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function MapView({ layers, onFeatureClick, onMapMove }: Props) {
  const [basemap, setBasemap] = useState<BasemapKey>("dark");
  const bm = BASEMAPS[basemap];

  return (
    <div className={`map-outer ${bm.isDark ? "theme-dark" : "theme-light"}`}>
      <MapContainer
        center={ALBERTA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="map-container"
        zoomControl={false}
      >
        <InvalidateSize />
        <MapEventHandler onMapMove={onMapMove} />
        <TileLayer
          key={basemap}
          attribution={bm.attr}
          url={bm.url}
        />

        {Object.values(layers).map((layer) => {
          if (!layer.visible || !layer.data) return null;

          if (layer.config.type === "point") {
            return (
              <PointLayer
                key={layer.config.id}
                layer={layer}
                onFeatureClick={onFeatureClick}
              />
            );
          }

          return (
            <PolygonLayer
              key={layer.config.id}
              layer={layer}
              onFeatureClick={onFeatureClick}
            />
          );
        })}
      </MapContainer>
      <BasemapSwitcher active={basemap} onChange={setBasemap} />
    </div>
  );
}
