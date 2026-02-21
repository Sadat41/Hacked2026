import { useState, useRef, useCallback, useMemo, useEffect } from "react";

const EDMONTON_API = "https://data.edmonton.ca/resource";

export interface PropertyResult {
  accountNumber: string;
  address: string;
  lat: number;
  lng: number;
  lotSize: string;
  totalGrossArea: string;
  zoning: string;
  yearBuilt: string;
  neighbourhood: string;
  garage: boolean;
  legalDescription: string;
  ward: string;
}

export interface NearbyFacility {
  name: string;
  type: string;
  owner: string;
  neighbourhood: string;
  distKm: number;
}

// Edmonton Zoning Bylaw land-use categories → typical impervious fraction.
// Zone labels are from the CoE Zoning Bylaw 20001.
// Impervious/pavement fractions are ESTIMATES based on typical land-use patterns
// and should be verified with actual site survey data for any real project.
export const ZONING_IMPERVIOUS: Record<string, { label: string; impervious: number; paveFrac: number }> = {
  RF1: { label: "Single Detached Residential", impervious: 0.45, paveFrac: 0.12 },
  RSL: { label: "Residential Small Lot", impervious: 0.55, paveFrac: 0.15 },
  RF2: { label: "Low Density Infill", impervious: 0.50, paveFrac: 0.13 },
  RF3: { label: "Small Scale Infill", impervious: 0.55, paveFrac: 0.15 },
  RF4: { label: "Semi-detached", impervious: 0.50, paveFrac: 0.14 },
  RF5: { label: "Row Housing", impervious: 0.65, paveFrac: 0.20 },
  RF6: { label: "Medium Density", impervious: 0.70, paveFrac: 0.22 },
  RA7: { label: "Low Rise Apartment", impervious: 0.70, paveFrac: 0.20 },
  RA8: { label: "Medium Rise Apartment", impervious: 0.80, paveFrac: 0.20 },
  RA9: { label: "High Rise Apartment", impervious: 0.85, paveFrac: 0.18 },
  RS:  { label: "Residential Small Lot (new)", impervious: 0.55, paveFrac: 0.15 },
  RM:  { label: "Residential Mixed", impervious: 0.60, paveFrac: 0.18 },
  RR:  { label: "Rural Residential", impervious: 0.15, paveFrac: 0.05 },
  CB1: { label: "Low Intensity Business", impervious: 0.85, paveFrac: 0.35 },
  CB2: { label: "General Business", impervious: 0.90, paveFrac: 0.30 },
  CB3: { label: "Commercial Mixed Business", impervious: 0.85, paveFrac: 0.30 },
  CHY: { label: "Highway Corridor", impervious: 0.90, paveFrac: 0.40 },
  CSC: { label: "Shopping Centre", impervious: 0.90, paveFrac: 0.45 },
  CNC: { label: "Neighbourhood Convenience", impervious: 0.80, paveFrac: 0.30 },
  CO:  { label: "Commercial Office", impervious: 0.85, paveFrac: 0.30 },
  MU:  { label: "Mixed Use", impervious: 0.75, paveFrac: 0.22 },
  DC1: { label: "Direct Control (provision)", impervious: 0.65, paveFrac: 0.20 },
  DC2: { label: "Direct Control (site specific)", impervious: 0.65, paveFrac: 0.20 },
  IB:  { label: "Industrial Business", impervious: 0.80, paveFrac: 0.35 },
  IL:  { label: "Light Industrial", impervious: 0.75, paveFrac: 0.35 },
  IM:  { label: "Medium Industrial", impervious: 0.80, paveFrac: 0.40 },
  IH:  { label: "Heavy Industrial", impervious: 0.85, paveFrac: 0.45 },
  AG:  { label: "Agricultural", impervious: 0.05, paveFrac: 0.02 },
  AGU: { label: "Agricultural Urban Reserve", impervious: 0.08, paveFrac: 0.03 },
  US:  { label: "Urban Services", impervious: 0.60, paveFrac: 0.25 },
  A:   { label: "Metropolitan Recreation", impervious: 0.10, paveFrac: 0.05 },
  AP:  { label: "Public Parks", impervious: 0.08, paveFrac: 0.03 },
  PU:  { label: "Public Utility", impervious: 0.50, paveFrac: 0.20 },
};

export function getZoningInfo(zoning: string): { label: string; impervious: number; paveFrac: number } | null {
  if (!zoning) return null;
  const code = zoning.toUpperCase().replace(/\s+/g, "");
  if (ZONING_IMPERVIOUS[code]) return ZONING_IMPERVIOUS[code];
  for (const key of Object.keys(ZONING_IMPERVIOUS)) {
    if (code.startsWith(key)) return ZONING_IMPERVIOUS[key];
  }
  return null;
}

export interface AnalysisData {
  lotSize: number;
  buildingArea: number;
  address: string;
  zoning: string;
  zoningLabel: string;
  zoningImpervious: number;
  zoningPaveFrac: number;
  neighbourhood: string;
  yearBuilt: string;
  garage: boolean;
  legalDescription: string;
  ward: string;
  lat: number;
  lng: number;
}

export type InputMode = "search" | "manual";

function parseSearchInput(raw: string): { houseNumber: string; street: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)\s+(.+)/);
  if (match) return { houseNumber: match[1], street: match[2] };
  return null;
}

function buildSearchUrl(q: string): string {
  const parsed = parseSearchInput(q);
  const params = new URLSearchParams();
  params.set("$limit", "15");
  if (parsed) {
    const streetUpper = parsed.street.toUpperCase().replace(/'/g, "''");
    params.set(
      "$where",
      `house_number='${parsed.houseNumber}' AND upper(street_name) LIKE '%${streetUpper}%' AND latitude IS NOT NULL`
    );
  } else {
    params.set("$q", q);
    params.set("$where", "latitude IS NOT NULL");
  }
  return `${EDMONTON_API}/dkk9-cj3x.json?${params.toString()}`;
}

export function fmtArea(val: string | number): string {
  const n = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(n) || n === 0) return "N/A";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`;
}

export function usePropertySearch() {
  const [mode, setMode] = useState<InputMode>("search");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PropertyResult[]>([]);
  const [selected, setSelected] = useState<PropertyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Manual state
  const [manualLot, setManualLot] = useState("");
  const [manualBuilding, setManualBuilding] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualZoning, setManualZoning] = useState("");
  const [manualNeighbourhood, setManualNeighbourhood] = useState("");
  const [manualYearBuilt, setManualYearBuilt] = useState("");
  const [manualGarage, setManualGarage] = useState(false);

  // Map click state
  const [clickMarker, setClickMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [clickLoading, setClickLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setSearched(true);
    setSelected(null);
    try {
      const res = await fetch(buildSearchUrl(trimmed), { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped: PropertyResult[] = data.map((item: Record<string, unknown>) => ({
        accountNumber: (item.account_number as string) || "",
        address: `${item.house_number || ""} ${item.street_name || ""}`.trim(),
        lat: parseFloat(item.latitude as string),
        lng: parseFloat(item.longitude as string),
        lotSize: (item.lot_size as string) || "",
        totalGrossArea: (item.total_gross_area as string) || "",
        zoning: (item.zoning as string) || "",
        yearBuilt: (item.year_built as string) || "",
        neighbourhood: (item.neighbourhood as string) || "",
        garage: !!item.garage,
        legalDescription: (item.legal_description as string) || "",
        ward: (item.ward as string) || "",
      }));
      setResults(mapped);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  }, [runSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { clearTimeout(debounceRef.current); runSearch(query); }
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (mode !== "search") return;
    setClickMarker({ lat, lng });
    setClickLoading(true);
    setSelected(null);
    try {
      const delta = 0.0005;
      const params = new URLSearchParams({
        $where: `latitude > ${lat - delta} AND latitude < ${lat + delta} AND longitude > ${lng - delta} AND longitude < ${lng + delta}`,
        $limit: "1",
      });
      const res = await fetch(`${EDMONTON_API}/dkk9-cj3x.json?${params.toString()}`);
      const data = await res.json();
      if (data[0]) {
        const item = data[0] as Record<string, unknown>;
        const prop: PropertyResult = {
          accountNumber: (item.account_number as string) || "",
          address: `${item.house_number || ""} ${item.street_name || ""}`.trim(),
          lat: parseFloat(item.latitude as string),
          lng: parseFloat(item.longitude as string),
          lotSize: (item.lot_size as string) || "",
          totalGrossArea: (item.total_gross_area as string) || "",
          zoning: (item.zoning as string) || "",
          yearBuilt: (item.year_built as string) || "",
          neighbourhood: (item.neighbourhood as string) || "",
          garage: !!item.garage,
          legalDescription: (item.legal_description as string) || "",
          ward: (item.ward as string) || "",
        };
        setSelected(prop);
        setClickMarker(null);
      }
    } catch { /* ignore */ }
    finally { setClickLoading(false); }
  }, [mode]);

  const analysisData = useMemo<AnalysisData | null>(() => {
    if (mode === "search" && selected) {
      const zi = getZoningInfo(selected.zoning);
      return {
        lotSize: parseFloat(selected.lotSize) || 0,
        buildingArea: parseFloat(selected.totalGrossArea) || 0,
        address: selected.address,
        zoning: selected.zoning,
        zoningLabel: zi?.label ?? "Unknown",
        zoningImpervious: zi?.impervious ?? 0.50,
        zoningPaveFrac: zi?.paveFrac ?? 0.15,
        neighbourhood: selected.neighbourhood,
        yearBuilt: selected.yearBuilt,
        garage: selected.garage,
        legalDescription: selected.legalDescription,
        ward: selected.ward,
        lat: selected.lat,
        lng: selected.lng,
      };
    }
    if (mode === "manual") {
      const lot = parseFloat(manualLot);
      const bldg = parseFloat(manualBuilding);
      if (lot > 0) {
        const zi = getZoningInfo(manualZoning);
        return {
          lotSize: lot,
          buildingArea: bldg > 0 ? bldg : 0,
          address: manualAddress || "Manual Entry",
          zoning: manualZoning,
          zoningLabel: zi?.label ?? (manualZoning ? manualZoning : "Not specified"),
          zoningImpervious: zi?.impervious ?? 0.50,
          zoningPaveFrac: zi?.paveFrac ?? 0.15,
          neighbourhood: manualNeighbourhood,
          yearBuilt: manualYearBuilt,
          garage: manualGarage,
          legalDescription: "",
          ward: "",
          lat: 0,
          lng: 0,
        };
      }
    }
    return null;
  }, [mode, selected, manualLot, manualBuilding, manualAddress, manualZoning, manualNeighbourhood, manualYearBuilt, manualGarage]);

  // Nearby stormwater facilities query
  const [nearbyFacilities, setNearbyFacilities] = useState<NearbyFacility[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);

  useEffect(() => {
    if (!analysisData || analysisData.lat === 0) {
      setNearbyFacilities([]);
      return;
    }
    const { lat, lng } = analysisData;
    const delta = 0.03; // ~3km radius
    setFacilitiesLoading(true);
    const url = `${EDMONTON_API}/kiu8-nsmp.json?$where=latitude>${lat-delta} AND latitude<${lat+delta} AND longitude>${lng-delta} AND longitude<${lng+delta}&$limit=10`;
    fetch(url)
      .then(r => r.json())
      .then((data: Record<string, unknown>[]) => {
        const facs: NearbyFacility[] = data.map(f => {
          const fLat = parseFloat(f.latitude as string);
          const fLng = parseFloat(f.longitude as string);
          const dLat = fLat - lat, dLng = fLng - lng;
          const distKm = Math.sqrt(dLat*dLat + dLng*dLng) * 111;
          return {
            name: (f.description as string) || "Unknown",
            type: (f.storm_type as string) || "",
            owner: (f.facility_owner as string) || "",
            neighbourhood: (f.neighbourhood_name as string) || "",
            distKm: +distKm.toFixed(2),
          };
        }).sort((a,b) => a.distKm - b.distKm);
        setNearbyFacilities(facs);
      })
      .catch(() => setNearbyFacilities([]))
      .finally(() => setFacilitiesLoading(false));
  }, [analysisData?.lat, analysisData?.lng]);

  const markerPos = useMemo(() => {
    if (selected) return { lat: selected.lat, lng: selected.lng };
    if (clickMarker) return clickMarker;
    return null;
  }, [selected, clickMarker]);

  const visibleMarkers = useMemo(() => {
    if (selected) return [selected];
    return results.filter((r) => !isNaN(r.lat) && !isNaN(r.lng));
  }, [results, selected]);

  return {
    mode, setMode,
    query, handleInput, handleKeyDown,
    results, selected, setSelected,
    loading, searched,
    manualLot, setManualLot,
    manualBuilding, setManualBuilding,
    manualAddress, setManualAddress,
    manualZoning, setManualZoning,
    manualNeighbourhood, setManualNeighbourhood,
    manualYearBuilt, setManualYearBuilt,
    manualGarage, setManualGarage,
    clickMarker, setClickMarker,
    clickLoading,
    handleMapClick,
    analysisData,
    markerPos,
    visibleMarkers,
    runSearch,
    debounceRef,
    nearbyFacilities,
    facilitiesLoading,
  };
}
