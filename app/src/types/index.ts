import type { PathOptions } from "leaflet";

export interface LayerConfig {
  id: string;
  name: string;
  description: string;
  category: "infrastructure" | "environment" | "energy";
  endpoint: string;
  type: "point" | "polygon" | "geojson";
  style: PathOptions;
  pointColor?: string;
  pointRadius?: number;
  maxFeatures: number;
  popupFields: PopupField[];
  enabled: boolean;
}

export interface PopupField {
  key: string;
  label: string;
  format?: "currency" | "number" | "year" | "text";
}

export interface MapLayer {
  config: LayerConfig;
  data: GeoJSON.FeatureCollection | null;
  loading: boolean;
  error: string | null;
  visible: boolean;
}

export interface AppState {
  layers: Record<string, MapLayer>;
  selectedFeature: GeoJSON.Feature | null;
  sidebarOpen: boolean;
}
