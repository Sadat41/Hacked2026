import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { Layer, CircleMarkerOptions } from "leaflet";
import type { MapLayer } from "../types";
import { EDMONTON_CENTER, DEFAULT_ZOOM } from "../config/layers";
import "leaflet/dist/leaflet.css";

interface Props {
  layers: Record<string, MapLayer>;
  onFeatureClick?: (feature: GeoJSON.Feature) => void;
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
      return `<tr><td style="font-weight:600;padding:2px 8px 2px 0;color:#94a3b8;white-space:nowrap;vertical-align:top">${f.label}</td><td style="padding:2px 0;color:#e2e8f0">${val}</td></tr>`;
    })
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;max-width:320px">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#f8fafc;border-bottom:1px solid #334155;padding-bottom:4px">
        ${layer.config.name}
      </div>
      <table style="border-collapse:collapse">${rows}</table>
    </div>
  `;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
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

export default function MapView({ layers, onFeatureClick }: Props) {
  return (
    <MapContainer
      center={EDMONTON_CENTER}
      zoom={DEFAULT_ZOOM}
      className="map-container"
      zoomControl={false}
    >
      <InvalidateSize />
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
  );
}
