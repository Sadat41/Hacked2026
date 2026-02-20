import { useState, useCallback } from "react";
import type { LayerConfig, MapLayer } from "../types";
import { LAYER_CONFIGS } from "../config/layers";

function toGeoJSON(
  raw: Record<string, unknown>[],
  config: LayerConfig
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const item of raw) {
    let geometry: GeoJSON.Geometry | null = null;

    if (config.type === "polygon" && item.geometry) {
      geometry = item.geometry as GeoJSON.Geometry;
    } else if (config.type === "geojson" && item.the_geom) {
      geometry = item.the_geom as GeoJSON.Geometry;
    } else if (config.type === "point") {
      const lat = parseFloat(
        (item.latitude as string) ?? (item.lat as string) ?? ""
      );
      const lng = parseFloat(
        (item.longitude as string) ?? (item.lng as string) ?? ""
      );
      if (!isNaN(lat) && !isNaN(lng)) {
        geometry = { type: "Point", coordinates: [lng, lat] };
      }
    }

    if (!geometry) continue;

    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item)) {
      if (
        k !== "geometry" &&
        k !== "the_geom" &&
        k !== "location" &&
        !k.startsWith(":@")
      ) {
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
