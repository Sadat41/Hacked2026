import { useState, useCallback, useRef } from "react";
import type { LatLngBounds } from "leaflet";
import type { LayerConfig, MapLayer } from "../types";
import { LAYER_CONFIGS } from "../config/layers";

function extractGeometry(
  item: Record<string, unknown>,
  config: LayerConfig
): GeoJSON.Geometry | null {
  if (config.type === "polygon" && item.geometry) {
    return item.geometry as GeoJSON.Geometry;
  }

  if (config.type === "geojson") {
    const field = config.geomField ?? "the_geom";
    if (item[field]) return item[field] as GeoJSON.Geometry;
  }

  if (config.latField) {
    const geom = item[config.latField] as
      | { type: string; coordinates: number[] }
      | undefined;
    if (geom?.coordinates) {
      return { type: "Point", coordinates: geom.coordinates };
    }
  }

  if (item.geometry_point) {
    const gp = item.geometry_point as
      | { type: string; coordinates: number[] }
      | undefined;
    if (gp?.coordinates) {
      return { type: "Point", coordinates: gp.coordinates };
    }
  }

  if (config.type === "point") {
    const lat = parseFloat(String(item.latitude ?? ""));
    const lng = parseFloat(String(item.longitude ?? ""));
    if (!isNaN(lat) && !isNaN(lng)) {
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
  "point_location",
  "multipolygon",
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

function buildArcGISUrl(
  baseEndpoint: string,
  bounds: LatLngBounds,
  zoom: number
): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;

  // Simplify geometry based on zoom — fewer vertices at wider zooms
  const offset = 360 / (256 * Math.pow(2, zoom)) * 2;

  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: "2000",
    geometry: bbox,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    maxAllowableOffset: offset.toFixed(6),
  });

  return `${baseEndpoint}/query?${params.toString()}`;
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

  const boundsRef = useRef<LatLngBounds | null>(null);
  const zoomRef = useRef<number>(6);
  const abortRef = useRef<Record<string, AbortController>>({});

  const fetchLayer = useCallback(
    async (config: LayerConfig, bounds?: LatLngBounds, zoom?: number) => {
      // Cancel any in-flight request for this layer
      abortRef.current[config.id]?.abort();
      const controller = new AbortController();
      abortRef.current[config.id] = controller;

      setLayers((prev) => ({
        ...prev,
        [config.id]: { ...prev[config.id], loading: true, error: null },
      }));

      try {
        let url: string;

        if (config.source === "arcgis") {
          const b = bounds ?? boundsRef.current;
          const z = zoom ?? zoomRef.current;
          if (!b) {
            setLayers((prev) => ({
              ...prev,
              [config.id]: { ...prev[config.id], loading: false },
            }));
            return;
          }
          url = buildArcGISUrl(config.endpoint, b, z);
        } else {
          url = config.endpoint;
        }

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        let data: GeoJSON.FeatureCollection;
        if (
          (config.source === "arcgis" || config.source === "geojson") &&
          raw.type === "FeatureCollection"
        ) {
          data = raw as GeoJSON.FeatureCollection;
        } else {
          data = toGeoJSON(raw, config);
        }

        setLayers((prev) => ({
          ...prev,
          [config.id]: { ...prev[config.id], data, loading: false },
        }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLayers((prev) => ({
          ...prev,
          [config.id]: {
            ...prev[config.id],
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load",
          },
        }));
      }
    },
    []
  );

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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onMapMove = useCallback(
    (bounds: LatLngBounds, zoom: number) => {
      boundsRef.current = bounds;
      zoomRef.current = zoom;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setLayers((prev) => {
          for (const layer of Object.values(prev)) {
            if (layer.visible && layer.config.source === "arcgis") {
              fetchLayer(layer.config, bounds, zoom);
            }
          }
          return prev;
        });
      }, 400);
    },
    [fetchLayer]
  );

  return { layers, toggleLayer, loadVisibleLayers, fetchLayer, onMapMove };
}
