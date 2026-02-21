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
import { BASEMAPS, type BasemapKey } from "../config/basemaps";
import BasemapSwitcher from "./BasemapSwitcher";
import "leaflet/dist/leaflet.css";

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
