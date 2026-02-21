export const BASEMAPS = {
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    isDark: true,
    colorTheme: "dark" as const,
  },
  light: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    isDark: false,
    colorTheme: "light" as const,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labelsUrl: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://carto.com/">CARTO</a>',
    isDark: true,
    colorTheme: "satellite" as const,
  },
  terrain: {
    label: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    isDark: false,
    colorTheme: "light" as const,
    maxZoom: 17,
  },
  osm: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    isDark: false,
    colorTheme: "light" as const,
  },
} as const;

export type BasemapKey = keyof typeof BASEMAPS;
export type ColorTheme = "dark" | "light" | "satellite";

type LayerColorProfile = {
  pointColor: string;
  fillColor: string;
  strokeColor: string;
  weight: number;
  fillOpacity: number;
  strokeOpacity: number;
};

const LAYER_COLORS: Record<ColorTheme, Record<string, LayerColorProfile>> = {
  dark: {
    permits:          { pointColor: "#f97316", fillColor: "#fb923c", strokeColor: "#f97316", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    properties:       { pointColor: "#a855f7", fillColor: "#c084fc", strokeColor: "#a855f7", weight: 1, fillOpacity: 0.6, strokeOpacity: 0.9 },
    "property-details": { pointColor: "#d946ef", fillColor: "#e879f9", strokeColor: "#d946ef", weight: 1, fillOpacity: 0.6, strokeOpacity: 0.9 },
    lrt:              { pointColor: "#22d3ee", fillColor: "#06b6d4", strokeColor: "#22d3ee", weight: 1, fillOpacity: 0.8, strokeOpacity: 0.9 },
    traffic:          { pointColor: "#ef4444", fillColor: "#f87171", strokeColor: "#ef4444", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    recreation:       { pointColor: "#10b981", fillColor: "#34d399", strokeColor: "#10b981", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    neighbourhoods:   { pointColor: "#6ee7b7", fillColor: "#34d399", strokeColor: "#6ee7b7", weight: 1.5, fillOpacity: 0.05, strokeOpacity: 0.5 },
    subdivisions:     { pointColor: "#facc15", fillColor: "#eab308", strokeColor: "#facc15", weight: 2, fillOpacity: 0.25, strokeOpacity: 0.8 },
    drainage:         { pointColor: "#38bdf8", fillColor: "#0ea5e9", strokeColor: "#38bdf8", weight: 2, fillOpacity: 0.3, strokeOpacity: 0.8 },
    airquality:       { pointColor: "#a3e635", fillColor: "#84cc16", strokeColor: "#a3e635", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    waterstations:    { pointColor: "#60a5fa", fillColor: "#3b82f6", strokeColor: "#60a5fa", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    "climate-stations": { pointColor: "#fbbf24", fillColor: "#f59e0b", strokeColor: "#fbbf24", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    "precip-daily":   { pointColor: "#38bdf8", fillColor: "#0ea5e9", strokeColor: "#38bdf8", weight: 1, fillOpacity: 0.8, strokeOpacity: 0.9 },
    "precip-normals": { pointColor: "#818cf8", fillColor: "#6366f1", strokeColor: "#818cf8", weight: 1, fillOpacity: 0.8, strokeOpacity: 0.9 },
    "precip-monthly": { pointColor: "#c084fc", fillColor: "#a855f7", strokeColor: "#c084fc", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    "snowfall-normals": { pointColor: "#e2e8f0", fillColor: "#cbd5e1", strokeColor: "#e2e8f0", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    "hydro-stations": { pointColor: "#2dd4bf", fillColor: "#14b8a6", strokeColor: "#2dd4bf", weight: 1, fillOpacity: 0.7, strokeOpacity: 0.9 },
    "flood-hazard":   { pointColor: "#f43f5e", fillColor: "#e11d48", strokeColor: "#f43f5e", weight: 1.5, fillOpacity: 0.3, strokeOpacity: 0.8 },
    "flood-100yr":    { pointColor: "#3b82f6", fillColor: "#2563eb", strokeColor: "#3b82f6", weight: 1.5, fillOpacity: 0.3, strokeOpacity: 0.8 },
    "flood-200yr":    { pointColor: "#8b5cf6", fillColor: "#7c3aed", strokeColor: "#8b5cf6", weight: 1.5, fillOpacity: 0.25, strokeOpacity: 0.8 },
    "flood-icejam-100yr": { pointColor: "#06b6d4", fillColor: "#0891b2", strokeColor: "#06b6d4", weight: 1.5, fillOpacity: 0.3, strokeOpacity: 0.8 },
    "flood-500yr":    { pointColor: "#ec4899", fillColor: "#db2777", strokeColor: "#ec4899", weight: 1.5, fillOpacity: 0.2, strokeOpacity: 0.8 },
  },
  light: {
    permits:          { pointColor: "#c2410c", fillColor: "#ea580c", strokeColor: "#9a3412", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    properties:       { pointColor: "#7e22ce", fillColor: "#9333ea", strokeColor: "#6b21a8", weight: 1.5, fillOpacity: 0.75, strokeOpacity: 1 },
    "property-details": { pointColor: "#a21caf", fillColor: "#c026d3", strokeColor: "#86198f", weight: 1.5, fillOpacity: 0.75, strokeOpacity: 1 },
    lrt:              { pointColor: "#0e7490", fillColor: "#0891b2", strokeColor: "#155e75", weight: 1.5, fillOpacity: 0.85, strokeOpacity: 1 },
    traffic:          { pointColor: "#dc2626", fillColor: "#ef4444", strokeColor: "#b91c1c", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    recreation:       { pointColor: "#047857", fillColor: "#059669", strokeColor: "#065f46", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    neighbourhoods:   { pointColor: "#059669", fillColor: "#10b981", strokeColor: "#047857", weight: 2, fillOpacity: 0.08, strokeOpacity: 0.7 },
    subdivisions:     { pointColor: "#a16207", fillColor: "#ca8a04", strokeColor: "#854d0e", weight: 2.5, fillOpacity: 0.3, strokeOpacity: 0.9 },
    drainage:         { pointColor: "#0369a1", fillColor: "#0284c7", strokeColor: "#075985", weight: 2.5, fillOpacity: 0.35, strokeOpacity: 0.9 },
    airquality:       { pointColor: "#4d7c0f", fillColor: "#65a30d", strokeColor: "#3f6212", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    waterstations:    { pointColor: "#1d4ed8", fillColor: "#2563eb", strokeColor: "#1e40af", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    "climate-stations": { pointColor: "#b45309", fillColor: "#d97706", strokeColor: "#92400e", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    "precip-daily":   { pointColor: "#0369a1", fillColor: "#0284c7", strokeColor: "#075985", weight: 1.5, fillOpacity: 0.85, strokeOpacity: 1 },
    "precip-normals": { pointColor: "#4338ca", fillColor: "#4f46e5", strokeColor: "#3730a3", weight: 1.5, fillOpacity: 0.85, strokeOpacity: 1 },
    "precip-monthly": { pointColor: "#7e22ce", fillColor: "#9333ea", strokeColor: "#6b21a8", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    "snowfall-normals": { pointColor: "#475569", fillColor: "#64748b", strokeColor: "#334155", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    "hydro-stations": { pointColor: "#0f766e", fillColor: "#0d9488", strokeColor: "#115e59", weight: 1.5, fillOpacity: 0.8, strokeOpacity: 1 },
    "flood-hazard":   { pointColor: "#be123c", fillColor: "#e11d48", strokeColor: "#9f1239", weight: 2, fillOpacity: 0.35, strokeOpacity: 0.9 },
    "flood-100yr":    { pointColor: "#1d4ed8", fillColor: "#2563eb", strokeColor: "#1e40af", weight: 2, fillOpacity: 0.35, strokeOpacity: 0.9 },
    "flood-200yr":    { pointColor: "#6d28d9", fillColor: "#7c3aed", strokeColor: "#5b21b6", weight: 2, fillOpacity: 0.3, strokeOpacity: 0.9 },
    "flood-icejam-100yr": { pointColor: "#0e7490", fillColor: "#0891b2", strokeColor: "#155e75", weight: 2, fillOpacity: 0.35, strokeOpacity: 0.9 },
    "flood-500yr":    { pointColor: "#be185d", fillColor: "#db2777", strokeColor: "#9d174d", weight: 2, fillOpacity: 0.25, strokeOpacity: 0.9 },
  },
  satellite: {
    permits:          { pointColor: "#fdba74", fillColor: "#fb923c", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    properties:       { pointColor: "#d8b4fe", fillColor: "#c084fc", strokeColor: "#fff", weight: 2, fillOpacity: 0.85, strokeOpacity: 1 },
    "property-details": { pointColor: "#f0abfc", fillColor: "#e879f9", strokeColor: "#fff", weight: 2, fillOpacity: 0.85, strokeOpacity: 1 },
    lrt:              { pointColor: "#67e8f9", fillColor: "#22d3ee", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    traffic:          { pointColor: "#fca5a5", fillColor: "#f87171", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    recreation:       { pointColor: "#6ee7b7", fillColor: "#34d399", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    neighbourhoods:   { pointColor: "#6ee7b7", fillColor: "#34d399", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.1, strokeOpacity: 0.8 },
    subdivisions:     { pointColor: "#fde047", fillColor: "#facc15", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.35, strokeOpacity: 0.9 },
    drainage:         { pointColor: "#7dd3fc", fillColor: "#38bdf8", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.4, strokeOpacity: 0.9 },
    airquality:       { pointColor: "#bef264", fillColor: "#a3e635", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    waterstations:    { pointColor: "#93c5fd", fillColor: "#60a5fa", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "climate-stations": { pointColor: "#fde68a", fillColor: "#fbbf24", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "precip-daily":   { pointColor: "#7dd3fc", fillColor: "#38bdf8", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "precip-normals": { pointColor: "#a5b4fc", fillColor: "#818cf8", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "precip-monthly": { pointColor: "#d8b4fe", fillColor: "#c084fc", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "snowfall-normals": { pointColor: "#f1f5f9", fillColor: "#e2e8f0", strokeColor: "#334155", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "hydro-stations": { pointColor: "#5eead4", fillColor: "#2dd4bf", strokeColor: "#fff", weight: 2, fillOpacity: 0.9, strokeOpacity: 1 },
    "flood-hazard":   { pointColor: "#fda4af", fillColor: "#fb7185", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.4, strokeOpacity: 0.9 },
    "flood-100yr":    { pointColor: "#93c5fd", fillColor: "#60a5fa", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.4, strokeOpacity: 0.9 },
    "flood-200yr":    { pointColor: "#c4b5fd", fillColor: "#a78bfa", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.35, strokeOpacity: 0.9 },
    "flood-icejam-100yr": { pointColor: "#67e8f9", fillColor: "#22d3ee", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.4, strokeOpacity: 0.9 },
    "flood-500yr":    { pointColor: "#f9a8d4", fillColor: "#f472b6", strokeColor: "#fff", weight: 2.5, fillOpacity: 0.3, strokeOpacity: 0.9 },
  },
};

export function getLayerColors(layerId: string, theme: ColorTheme): LayerColorProfile | null {
  return LAYER_COLORS[theme]?.[layerId] ?? null;
}
