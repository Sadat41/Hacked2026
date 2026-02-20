import { useState, useCallback } from "react";
import type { LayerConfig, MapLayer } from "../types";
import { LAYER_CONFIGS } from "../config/layers";

function extractGeometry(
  item: Record<string, unknown>,
  config: LayerConfig
): GeoJSON.Geometry | null {
  // Polygon layers: geometry is in the "geometry" field
  if (config.type === "polygon" && item.geometry) {
    return item.geometry as GeoJSON.Geometry;
  }

  // GeoJSON layers: geometry in "the_geom" or custom geomField
  if (config.type === "geojson") {
    const field = config.geomField ?? "the_geom";
    if (item[field]) return item[field] as GeoJSON.Geometry;
  }

  // Point layers with a geometry object field (e.g. "point", "geometry", "geometry_point")
  if (config.latField) {
    const geom = item[config.latField] as
      | { type: string; coordinates: number[] }
      | undefined;
    if (geom?.coordinates) {
      return { type: "Point", coordinates: geom.coordinates };
    }
  }

  // Point layers: try geometry_point field first
  if (item.geometry_point) {
    const gp = item.geometry_point as
      | { type: string; coordinates: number[] }
      | undefined;
    if (gp?.coordinates) {
      return { type: "Point", coordinates: gp.coordinates };
    }
  }

  // Point layers: fallback to lat/lng fields
  if (config.type === "point") {
    const lat = parseFloat(String(item.latitude ?? ""));
    const lng = parseFloat(String(item.longitude ?? ""));
    if (!isNaN(lat) && !isNaN(lng)) {
      // Guard against swapped lat/lng (Edmonton is ~53N, ~-113W)
      if (Math.abs(lat) > 90 && Math.abs(lng) < 90) {
        return { type: "Point", coordinates: [lat, lng] };
      }
      return { type: "Point", coordinates: [lng, lat] };
    }
  }

  return null;
}

const SKIP_KEYS = new Set([
  "geometry",
  "the_geom",
  "geometry_multipolygon",
  "geometry_point",
  "location",
  "geocoded_column",
  "point",
]);

function toGeoJSON(
  raw: Record<string, unknown>[],
  config: LayerConfig
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const item of raw) {
    const geometry = extractGeometry(item, config);
    if (!geometry) continue;

    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item)) {
      if (!SKIP_KEYS.has(k) && !k.startsWith(":@")) {
        properties[k] = v;
      }
    }

    features.push({ type: "Feature", geometry, properties });
  }

  return { type: "FeatureCollection", features };
}

export function useMapData() {
  const [layers, setLayers] = useState<Record<string, MapLayer>>(() => {
    const initial: Record<string, MapLayer> = {};
    for (const config of LAYER_CONFIGS) {
      initial[config.id] = {
        config,
        data: null,
        loading: false,
        error: null,
        visible: config.enabled,
      };
    }
    return initial;
  });

  const fetchLayer = useCallback(async (config: LayerConfig) => {
    setLayers((prev) => ({
      ...prev,
      [config.id]: { ...prev[config.id], loading: true, error: null },
    }));

    try {
      const res = await fetch(config.endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const data = toGeoJSON(raw, config);

      setLayers((prev) => ({
        ...prev,
        [config.id]: { ...prev[config.id], data, loading: false },
      }));
    } catch (err) {
      setLayers((prev) => ({
        ...prev,
        [config.id]: {
          ...prev[config.id],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        },
      }));
    }
  }, []);

  const toggleLayer = useCallback(
    (layerId: string) => {
      setLayers((prev) => {
        const layer = prev[layerId];
        if (!layer) return prev;

        const newVisible = !layer.visible;

        if (newVisible && !layer.data && !layer.loading) {
          fetchLayer(layer.config);
        }

        return {
          ...prev,
          [layerId]: { ...layer, visible: newVisible },
        };
      });
    },
    [fetchLayer]
  );

  const loadVisibleLayers = useCallback(() => {
    for (const config of LAYER_CONFIGS) {
      if (config.enabled) {
        fetchLayer(config);
      }
    }
  }, [fetchLayer]);

  return { layers, toggleLayer, loadVisibleLayers, fetchLayer };
}
