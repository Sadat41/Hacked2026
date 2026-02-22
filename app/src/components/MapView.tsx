import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Layer, CircleMarkerOptions, LatLngBounds } from "leaflet";
import type { MapLayer } from "../types";
import { ALBERTA_CENTER, DEFAULT_ZOOM } from "../config/layers";
import { BASEMAPS, type BasemapKey, type ColorTheme, getLayerColors } from "../config/basemaps";
import BasemapSwitcher, { getSavedBasemap } from "./BasemapSwitcher";
import "leaflet/dist/leaflet.css";

interface Props {
  layers: Record<string, MapLayer>;
  onFeatureClick?: (feature: GeoJSON.Feature) => void;
  onMapMove?: (bounds: LatLngBounds, zoom: number) => void;
  sidebarOpen?: boolean;
}

function formatValue(
  val: unknown,
  format?: string
): string {
  if (val == null || val === "") return "N/A";
  if (typeof val === "boolean") return val ? "Yes" : "No";
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
      return `<tr><td style="font-weight:600;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top;text-transform:uppercase;font-size:10px;letter-spacing:0.06em;color:rgba(0,255,65,0.5)">${f.label}</td><td style="padding:2px 0;color:#00ff41">${val}</td></tr>`;
    })
    .join("");

  return `
    <div style="font-family:'Share Tech Mono','Courier New',monospace;font-size:12px;max-width:320px;color:#00ff41">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;border-bottom:1px solid #00ff41;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.08em;text-shadow:0 0 5px rgba(0,255,65,0.4)">
        ${layer.config.name}
      </div>
      <table style="border-collapse:collapse">${rows}</table>
    </div>
  `;
}

function InvalidateSize({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  // Re-measure after sidebar slide transition (300ms) completes
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 350);
  }, [map, sidebarOpen]);
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

const LAYER_ICONS: Record<string, { svg: string; size: [number, number] }> = {
  lrt: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28">
      <rect x="4" y="3" width="24" height="22" rx="4" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2"/>
      <rect x="9" y="8" width="14" height="7" rx="1.5" fill="{{stroke}}" opacity="0.35"/>
      <circle cx="11" cy="21" r="2" fill="{{stroke}}"/><circle cx="21" cy="21" r="2" fill="{{stroke}}"/>
      <line x1="11" y1="27" x2="8" y2="31" stroke="{{stroke}}" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="27" x2="24" y2="31" stroke="{{stroke}}" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    size: [28, 28],
  },
  recreation: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="26" height="26">
      <circle cx="16" cy="16" r="14" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2"/>
      <path d="M16 7 L18.5 12.5 L24.5 13 L20 17 L21.5 23 L16 20 L10.5 23 L12 17 L7.5 13 L13.5 12.5Z" fill="{{stroke}}" opacity="0.9"/>
    </svg>`,
    size: [26, 26],
  },
  traffic: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24">
      <polygon points="16,2 30,28 2,28" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2" stroke-linejoin="round"/>
      <line x1="16" y1="11" x2="16" y2="19" stroke="{{stroke}}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="16" cy="23" r="1.5" fill="{{stroke}}"/>
    </svg>`,
    size: [24, 24],
  },
  permits: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="22" height="22">
      <rect x="5" y="6" width="22" height="22" rx="3" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2"/>
      <rect x="10" y="2" width="12" height="8" rx="2" fill="{{stroke}}" opacity="0.5"/>
      <line x1="10" y1="16" x2="22" y2="16" stroke="{{stroke}}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="10" y1="20" x2="18" y2="20" stroke="{{stroke}}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="10" y1="24" x2="20" y2="24" stroke="{{stroke}}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    size: [22, 22],
  },
  airquality: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24">
      <circle cx="16" cy="16" r="14" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2"/>
      <path d="M10 18 Q13 10, 16 14 Q19 18, 22 12" stroke="{{stroke}}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="3" fill="{{stroke}}" opacity="0.4"/>
    </svg>`,
    size: [24, 24],
  },
  waterstations: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24">
      <path d="M16 4 C16 4, 6 16, 6 21 C6 26.5 10.5 28 16 28 C21.5 28 26 26.5 26 21 C26 16 16 4 16 4Z" fill="{{fill}}" stroke="{{stroke}}" stroke-width="2"/>
      <path d="M12 20 Q16 16, 20 20" stroke="{{stroke}}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>
    </svg>`,
    size: [24, 24],
  },
};

function buildLayerIcon(
  layerId: string,
  fillColor: string,
  strokeColor: string
): L.DivIcon | null {
  const iconDef = LAYER_ICONS[layerId];
  if (!iconDef) return null;
  const html = iconDef.svg
    .replace(/\{\{fill\}\}/g, fillColor)
    .replace(/\{\{stroke\}\}/g, strokeColor);
  return L.divIcon({
    html,
    className: "hydrogrid-icon",
    iconSize: iconDef.size,
    iconAnchor: [iconDef.size[0] / 2, iconDef.size[1] / 2],
    popupAnchor: [0, -iconDef.size[1] / 2],
  });
}

function PolygonLayer({
  layer,
  colorTheme,
}: {
  layer: MapLayer;
  colorTheme: ColorTheme;
  onFeatureClick?: (f: GeoJSON.Feature) => void;
}) {
  if (!layer.data || !layer.visible) return null;

  const colors = getLayerColors(layer.config.id, colorTheme);
  const style = colors
    ? {
        color: colors.strokeColor,
        weight: colors.weight,
        opacity: colors.strokeOpacity,
        fillColor: colors.fillColor,
        fillOpacity: colors.fillOpacity,
      }
    : layer.config.style;

  return (
    <GeoJSON
      key={layer.config.id + "-" + layer.data.features.length + "-" + colorTheme}
      data={layer.data}
      style={() => style}
      onEachFeature={(feature: GeoJSON.Feature, leafletLayer: Layer) => {
        leafletLayer.bindPopup(buildPopupHtml(feature, layer), {
          className: "hydrogrid-popup",
          maxWidth: 350,
        });
      }}
    />
  );
}

function PointLayer({
  layer,
  colorTheme,
}: {
  layer: MapLayer;
  colorTheme: ColorTheme;
  onFeatureClick?: (f: GeoJSON.Feature) => void;
}) {
  if (!layer.data || !layer.visible) return null;

  const colors = getLayerColors(layer.config.id, colorTheme);
  const pointColor = colors?.pointColor ?? layer.config.pointColor ?? "#fff";
  const fillColor = colors?.fillColor ?? layer.config.pointColor ?? "#fff";
  const strokeColor = colors?.strokeColor ?? layer.config.pointColor ?? "#fff";
  const weight = colors?.weight ?? 1;
  const fillOpacity = colors?.fillOpacity ?? 0.6;
  const strokeOpacity = colors?.strokeOpacity ?? 0.9;

  const icon = useMemo(
    () => buildLayerIcon(layer.config.id, fillColor, strokeColor),
    [layer.config.id, fillColor, strokeColor]
  );

  const opts: CircleMarkerOptions = {
    radius: layer.config.pointRadius ?? 5,
    color: pointColor,
    weight,
    opacity: strokeOpacity,
    fillColor,
    fillOpacity,
  };

  return (
    <>
      {layer.data.features.map((feature, i) => {
        if (feature.geometry.type !== "Point") return null;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;

        if (icon) {
          return (
            <Marker
              key={`${layer.config.id}-${i}`}
              position={[lat, lng]}
              icon={icon}
            >
              <Popup className="hydrogrid-popup" maxWidth={350}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: buildPopupHtml(feature, layer),
                  }}
                />
              </Popup>
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={`${layer.config.id}-${i}`}
            center={[lat, lng]}
            pathOptions={opts}
          >
            <Popup className="hydrogrid-popup" maxWidth={350}>
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

export default function MapView({ layers, onFeatureClick, onMapMove, sidebarOpen }: Props) {
  const [basemap, setBasemap] = useState<BasemapKey>(getSavedBasemap);
  const bm = BASEMAPS[basemap];
  const colorTheme = bm.colorTheme;

  return (
    <div className={`map-outer ${bm.isDark ? "theme-dark" : "theme-light"}`}>
      <MapContainer
        center={ALBERTA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="map-container"
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <InvalidateSize sidebarOpen={sidebarOpen} />
        <MapEventHandler onMapMove={onMapMove} />
        <TileLayer
          key={basemap}
          attribution={bm.attr}
          url={bm.url}
          {...("maxZoom" in bm ? { maxZoom: bm.maxZoom } : {})}
        />
        {"labelsUrl" in bm && (
          <TileLayer
            key={basemap + "-labels"}
            url={bm.labelsUrl as string}
            zIndex={650}
          />
        )}

        {Object.values(layers).map((layer) => {
          if (!layer.visible || !layer.data) return null;

          if (layer.config.type === "point") {
            return (
              <PointLayer
                key={layer.config.id + "-" + colorTheme}
                layer={layer}
                colorTheme={colorTheme}
                onFeatureClick={onFeatureClick}
              />
            );
          }

          return (
            <PolygonLayer
              key={layer.config.id + "-" + colorTheme}
              layer={layer}
              colorTheme={colorTheme}
              onFeatureClick={onFeatureClick}
            />
          );
        })}
      </MapContainer>
      <BasemapSwitcher active={basemap} onChange={setBasemap} />
    </div>
  );
}
