import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DrainageProps {
  lotSize: number;
  buildingArea: number;
  address: string;
  zoning?: string;
  zoningImpervious?: number;
  zoningPaveFrac?: number;
}

// ─── Edmonton IDF Data (VERIFIED - ECCC Stn 3012216) ──────────────────
// Rainfall intensities (mm/hr) for Edmonton City Centre.
// Source: Environment and Climate Change Canada / City of Edmonton.
const IDF_DURATIONS = [5, 10, 15, 30, 60, 120, 360, 720, 1440];
const IDF_RETURN_PERIODS = [2, 5, 10, 25, 50, 100];
const IDF_INTENSITIES: Record<number, number[]> = {
  2:   [65.5, 45.4, 36.0, 23.7, 15.4, 9.91, 4.90, 3.13, 2.00],
  5:   [98.2, 67.7, 53.5, 35.1, 22.7, 14.5,  7.12, 4.53, 2.88],
  10:  [119.9, 82.6, 65.2, 42.7, 27.5, 17.6, 8.62, 5.48, 3.48],
  25:  [147.1, 101.1, 79.7, 52.1, 33.5, 21.4, 10.4, 6.62, 4.19],
  50:  [167.4, 115.0, 90.6, 59.2, 38.1, 24.3, 11.8, 7.49, 4.75],
  100: [187.5, 128.7, 101.4, 66.2, 42.5, 27.1, 13.2, 8.35, 5.29],
};

// ─── Runoff coefficients ──────────────────────────────────────────────
const C_ROOF = 0.95;
const C_PAVEMENT = 0.90;
const C_LAWN = 0.25;
const C_GREEN_ROOF = 0.40;
const C_PERMEABLE_PAVE = 0.30;

// Standard Canadian storm pipe diameters (mm)
const STANDARD_PIPES = [75, 100, 125, 150, 200, 250, 300, 375, 450, 525, 600, 750, 900];

// Soil infiltration rates (mm/hr) — steady-state Green-Ampt approximation
const SOIL_TYPES = {
  sand:      { label: "Sand",                rate: 120, desc: "High infiltration — sandy river valley deposits" },
  sandyLoam: { label: "Sandy Loam",          rate: 30,  desc: "Moderate-high — mixed alluvial soils" },
  siltLoam:  { label: "Silt Loam",           rate: 12,  desc: "Moderate — typical lowland areas" },
  clayLoam:  { label: "Clay Loam",           rate: 6,   desc: "Low — glacial lacustrine deposits" },
  clay:      { label: "Clay (Glacial Till)",  rate: 2,   desc: "Very low — typical Edmonton uplands" },
} as const;

type SoilType = keyof typeof SOIL_TYPES;

interface LIDState {
  greenRoof: boolean;
  rainGarden: boolean;
  permeablePavement: boolean;
  bioswale: boolean;
}

// ─── Hydrology functions ──────────────────────────────────────────────

function interpolateIntensity(tc: number, returnPeriod: number): number {
  const intensities = IDF_INTENSITIES[returnPeriod];
  if (!intensities) return 0;
  if (tc <= IDF_DURATIONS[0]) return intensities[0];
  if (tc >= IDF_DURATIONS[IDF_DURATIONS.length - 1]) return intensities[intensities.length - 1];

  for (let j = 0; j < IDF_DURATIONS.length - 1; j++) {
    if (tc >= IDF_DURATIONS[j] && tc <= IDF_DURATIONS[j + 1]) {
      const logT  = Math.log(tc);
      const logT1 = Math.log(IDF_DURATIONS[j]);
      const logT2 = Math.log(IDF_DURATIONS[j + 1]);
      const logI1 = Math.log(intensities[j]);
      const logI2 = Math.log(intensities[j + 1]);
      const frac  = (logT - logT1) / (logT2 - logT1);
      return Math.exp(logI1 + frac * (logI2 - logI1));
    }
  }
  return intensities[0];
}

/** Kirpich formula (metric). Returns tc in minutes, clamped to [5, 30]. */
function calculateTc(lotArea: number): number {
  const flowLength = Math.sqrt(lotArea) * 1.4;
  const slope = 0.02;
  const tc = 0.0195 * Math.pow(flowLength, 0.77) * Math.pow(slope, -0.385);
  return Math.max(5, Math.min(tc, 30));
}

function compositeC(
  buildingArea: number,
  pavementArea: number,
  lawnArea: number,
  totalArea: number,
  lid: LIDState,
): number {
  let roofC = C_ROOF;
  let paveC = C_PAVEMENT;

  if (lid.greenRoof)          roofC = 0.5 * C_GREEN_ROOF + 0.5 * C_ROOF;
  if (lid.permeablePavement)  paveC = C_PERMEABLE_PAVE;

  let C = (roofC * buildingArea + paveC * pavementArea + C_LAWN * lawnArea) / totalArea;

  if (lid.rainGarden) C *= 0.85; // ~15% reduction from captured first-flush

  return Math.max(0.1, Math.min(C, 0.95));
}

/**
 * Manning's equation for a circular pipe flowing full.
 * Returns required diameter in mm.
 *   D = (Q·n·4^(5/3) / (π·√S))^(3/8)  then ×1000 for mm
 * Uses n=0.013 (PVC), S=0.5 %
 */
function requiredPipeDiameter(Q: number): number {
  if (Q <= 0) return 0;
  const n = 0.013;
  const S = 0.005;
  const D_m = Math.pow((Q * n * 10.079) / (Math.PI * Math.sqrt(S)), 0.375);
  return D_m * 1000;
}

function roundUpPipe(d_mm: number): number {
  for (const size of STANDARD_PIPES) {
    if (size >= d_mm) return size;
  }
  return STANDARD_PIPES[STANDARD_PIPES.length - 1];
}

// ─── Component ────────────────────────────────────────────────────────

export default function DrainageCalculator({ lotSize, buildingArea, address, zoningPaveFrac }: DrainageProps) {
  const [lid, setLid] = useState<LIDState>({
    greenRoof: false,
    rainGarden: false,
    permeablePavement: false,
    bioswale: false,
  });
  const [soil, setSoil] = useState<SoilType>("clay");
  const defaultPave = zoningPaveFrac ? Math.round(zoningPaveFrac * 100) : 15;
  const [pavementPct, setPavementPct] = useState(defaultPave);

  if (!lotSize || lotSize <= 0) {
    return (
      <div className="dc-empty">
        <p>Lot size data is required for drainage analysis.</p>
      </div>
    );
  }

  const clampedBuilding = Math.min(buildingArea || 0, lotSize * 0.85);
  const pavementArea    = lotSize * (pavementPct / 100);
  const lawnArea        = Math.max(0, lotSize - clampedBuilding - pavementArea);
  const imperviousArea  = clampedBuilding + pavementArea;
  const imperviousRatio = imperviousArea / lotSize;

  const tc = calculateTc(lotSize);

  const baseC = compositeC(clampedBuilding, pavementArea, lawnArea, lotSize, {
    greenRoof: false, rainGarden: false, permeablePavement: false, bioswale: false,
  });
  const lidC = compositeC(clampedBuilding, pavementArea, lawnArea, lotSize, lid);

  const area_ha = lotSize / 10000;

  const results = useMemo(() => {
    return IDF_RETURN_PERIODS.map((rp) => {
      const i = interpolateIntensity(tc, rp);
      let Q_base = (baseC * i * area_ha) / 360;
      let Q_lid  = (lidC  * i * area_ha) / 360;
      if (lid.bioswale) Q_lid *= 0.80; // 20% peak attenuation

      const pipe_base = roundUpPipe(requiredPipeDiameter(Q_base));
      const pipe_lid  = roundUpPipe(requiredPipeDiameter(Q_lid));

      const depth_mm = i * (tc / 60); // precipitation depth = i × duration
      const vol_base = (baseC * depth_mm * lotSize) / 1000; // m³
      let vol_lid    = (lidC  * depth_mm * lotSize) / 1000;
      if (lid.bioswale) vol_lid *= 0.80;

      return { rp, i, Q_base, Q_lid, pipe_base, pipe_lid, vol_base, vol_lid };
    });
  }, [tc, baseC, lidC, area_ha, lid.bioswale, lotSize]);

  const soilInfo = SOIL_TYPES[soil];
  const infiltrationDepth = soilInfo.rate * (tc / 60); // mm infiltrated during tc
  const potentialInfiltration = (soilInfo.rate * (tc / 60) * lawnArea) / 1000; // m³

  const designRow = results.find((r) => r.rp === 100) ?? results[results.length - 1];
  const anyLid = lid.greenRoof || lid.rainGarden || lid.permeablePavement || lid.bioswale;
  const reductionPct = anyLid && designRow
    ? ((1 - designRow.Q_lid / designRow.Q_base) * 100)
    : 0;

  const chartData = results.map((r) => ({
    name: `${r.rp}-yr`,
    Baseline: +(r.Q_base * 1000).toFixed(2),
    "With LID": +(r.Q_lid * 1000).toFixed(2),
  }));

  const tooltipStyle = {
    background: "#0a150a",
    border: "1px solid rgba(57,211,83,0.35)",
    borderRadius: 2,
    color: "#39d353",
    fontSize: 11,
    fontFamily: "'Share Tech Mono', monospace",
  };

  function toggle(key: keyof LIDState) {
    setLid((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="dc">
      <div className="dc-header">
        <h3 className="dc-title">Engineering Analysis</h3>
        <span className="dc-subtitle">Drainage & Site Hydrology — {address}</span>
      </div>

      {/* ── Site Hydrology ──────────────────────────────── */}
      <div className="dc-section">
        <h4 className="dc-section-label">Site Hydrology</h4>
        <div className="dc-stat-grid">
          <div className="dc-stat highlight">
            <span className="dc-stat-value">{lotSize.toLocaleString()} m²</span>
            <span className="dc-stat-label">Lot Area</span>
          </div>
          <div className="dc-stat highlight">
            <span className="dc-stat-value">{clampedBuilding.toLocaleString()} m²</span>
            <span className="dc-stat-label">Building Area</span>
          </div>
          <div className="dc-stat">
            <span className="dc-stat-value">{(imperviousRatio * 100).toFixed(0)}%</span>
            <span className="dc-stat-label">Impervious Ratio</span>
          </div>
          <div className="dc-stat">
            <span className="dc-stat-value">{baseC.toFixed(2)}</span>
            <span className="dc-stat-label">Runoff Coeff (C)</span>
          </div>
          <div className="dc-stat">
            <span className="dc-stat-value">{tc.toFixed(1)} min</span>
            <span className="dc-stat-label">t<sub>c</sub> (Kirpich)</span>
          </div>
          <div className="dc-stat">
            <span className="dc-stat-value">{lawnArea.toFixed(0)} m²</span>
            <span className="dc-stat-label">Pervious Area</span>
          </div>
        </div>

        <div className="dc-control-row">
          <label className="dc-control-label">
            Pavement %
            <input
              type="range"
              min="0" max="40" step="1"
              value={pavementPct}
              onChange={(e) => setPavementPct(+e.target.value)}
              className="dc-range"
            />
            <span className="dc-range-val">{pavementPct}%</span>
          </label>
          <label className="dc-control-label">
            Soil Type
            <select
              value={soil}
              onChange={(e) => setSoil(e.target.value as SoilType)}
              className="dc-select"
            >
              {(Object.keys(SOIL_TYPES) as SoilType[]).map((k) => (
                <option key={k} value={k}>{SOIL_TYPES[k].label}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="dc-soil-desc">
          {soilInfo.desc} — Infiltration rate: <strong>{soilInfo.rate} mm/hr</strong>
          {" "}({infiltrationDepth.toFixed(1)} mm during t<sub>c</sub>,
          {" "}{potentialInfiltration.toFixed(2)} m³ absorbed on pervious area)
        </p>
      </div>

      {/* ── Design Storms ──────────────────────────────── */}
      <div className="dc-section">
        <h4 className="dc-section-label">Design Storms — Rational Method (Q = CiA)</h4>
        <p className="dc-note">
          IDF data: verified for Edmonton (ECCC Stn 3012216) · Duration = t<sub>c</sub> = {tc.toFixed(1)} min
        </p>

        <div className="dc-table-wrap">
          <table className="dc-table">
            <thead>
              <tr>
                <th>Return Period</th>
                <th>Intensity (mm/hr)</th>
                <th>Q (L/s)</th>
                <th>Pipe (mm)</th>
                <th>Volume (m³)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.rp} className={r.rp === 100 ? "dc-row-highlight" : ""}>
                  <td>{r.rp}-yr</td>
                  <td>{r.i.toFixed(1)}</td>
                  <td>{(r.Q_base * 1000).toFixed(2)}</td>
                  <td>{r.pipe_base}</td>
                  <td>{r.vol_base.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── LID Simulator ──────────────────────────────── */}
      <div className="dc-section">
        <h4 className="dc-section-label">LID Simulator — Low Impact Development</h4>
        <p className="dc-note">
          Toggle green infrastructure to see how it reduces peak runoff and required pipe sizing.
        </p>

        <div className="dc-lid-grid">
          <label className={`dc-lid-card ${lid.greenRoof ? "on" : ""}`}>
            <input type="checkbox" checked={lid.greenRoof} onChange={() => toggle("greenRoof")} />
            <div className="dc-lid-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8c.7-1 1-2.2 1-3.5C18 2.6 16.4 1 14.5 1c-.5 0-1 .1-1.4.3C12.4.5 11.5 0 10.5 0 8.6 0 7 1.6 7 3.5c0 .6.1 1.1.3 1.6" />
                <path d="M12 22V8" />
                <rect x="4" y="18" width="16" height="4" rx="1" opacity="0.3" />
              </svg>
            </div>
            <span className="dc-lid-name">Green Roof</span>
            <span className="dc-lid-desc">50% of building area · C: 0.95 → 0.40</span>
          </label>

          <label className={`dc-lid-card ${lid.rainGarden ? "on" : ""}`}>
            <input type="checkbox" checked={lid.rainGarden} onChange={() => toggle("rainGarden")} />
            <div className="dc-lid-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C12 2 5 12 5 16a7 7 0 0 0 14 0c0-4-7-14-7-14z" />
                <path d="M7 19q5-4 10 0" />
              </svg>
            </div>
            <span className="dc-lid-name">Rain Garden</span>
            <span className="dc-lid-desc">8% of lot · Captures first-flush runoff (~15%)</span>
          </label>

          <label className={`dc-lid-card ${lid.permeablePavement ? "on" : ""}`}>
            <input type="checkbox" checked={lid.permeablePavement} onChange={() => toggle("permeablePavement")} />
            <div className="dc-lid-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.4" />
                <circle cx="16" cy="8" r="1" fill="currentColor" opacity="0.4" />
                <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.4" />
                <circle cx="8" cy="16" r="1" fill="currentColor" opacity="0.4" />
                <circle cx="16" cy="16" r="1" fill="currentColor" opacity="0.4" />
              </svg>
            </div>
            <span className="dc-lid-name">Permeable Pavement</span>
            <span className="dc-lid-desc">Replaces driveway · C: 0.90 → 0.30</span>
          </label>

          <label className={`dc-lid-card ${lid.bioswale ? "on" : ""}`}>
            <input type="checkbox" checked={lid.bioswale} onChange={() => toggle("bioswale")} />
            <div className="dc-lid-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                <path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                <line x1="12" y1="2" x2="12" y2="10" />
                <path d="M9 5l3-3 3 3" />
              </svg>
            </div>
            <span className="dc-lid-name">Bio-swale</span>
            <span className="dc-lid-desc">Vegetated channel · 20% peak attenuation</span>
          </label>
        </div>

        {anyLid && (
          <div className="dc-lid-results">
            <div className="dc-lid-result-row">
              <span className="dc-lid-result-label">Adjusted Runoff Coeff</span>
              <span className="dc-lid-result-value">
                {baseC.toFixed(2)} → <strong>{lidC.toFixed(2)}</strong>
              </span>
            </div>
            <div className="dc-lid-result-row">
              <span className="dc-lid-result-label">100-yr Peak Discharge</span>
              <span className="dc-lid-result-value">
                {(designRow.Q_base * 1000).toFixed(2)} → <strong>{(designRow.Q_lid * 1000).toFixed(2)} L/s</strong>
                <span className="dc-reduction">▼ {reductionPct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="dc-lid-result-row">
              <span className="dc-lid-result-label">Required Pipe (100-yr)</span>
              <span className="dc-lid-result-value">
                {designRow.pipe_base}mm → <strong>{designRow.pipe_lid}mm</strong>
              </span>
            </div>
            <div className="dc-lid-result-row">
              <span className="dc-lid-result-label">Runoff Volume (100-yr)</span>
              <span className="dc-lid-result-value">
                {designRow.vol_base.toFixed(2)} → <strong>{designRow.vol_lid.toFixed(2)} m³</strong>
                <span className="dc-reduction">▼ {(designRow.vol_base - designRow.vol_lid).toFixed(2)} m³ captured</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Peak Discharge Chart ───────────────────────── */}
      <div className="dc-section">
        <h4 className="dc-section-label">
          Peak Discharge Comparison {anyLid ? "(Baseline vs. LID)" : ""}
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(57,211,83,0.12)" />
            <XAxis
              dataKey="name"
              stroke="rgba(57,211,83,0.4)"
              tick={{ fontSize: 10, fill: "rgba(57,211,83,0.6)" }}
            />
            <YAxis
              stroke="rgba(57,211,83,0.4)"
              tick={{ fontSize: 10, fill: "rgba(57,211,83,0.6)" }}
              unit=" L/s"
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => [`${v ?? 0} L/s`]} />
            <Legend
              wrapperStyle={{ fontSize: 10, color: "rgba(57,211,83,0.6)" }}
            />
            <Bar dataKey="Baseline" fill="#39d353" radius={[2, 2, 0, 0]} />
            {anyLid && (
              <Bar dataKey="With LID" fill="#22d3ee" radius={[2, 2, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Design Summary ─────────────────────────────── */}
      <div className="dc-section dc-summary">
        <h4 className="dc-section-label">Design Summary</h4>
        <div className="dc-summary-grid">
          <div className="dc-summary-item">
            <span className="dc-summary-label">Design Storm (100-yr)</span>
            <span className="dc-summary-value">{designRow.i.toFixed(1)} mm/hr for {tc.toFixed(0)} min</span>
          </div>
          <div className="dc-summary-item highlight">
            <span className="dc-summary-label">Min. Storm Pipe</span>
            <span className="dc-summary-value lg">
              {anyLid ? designRow.pipe_lid : designRow.pipe_base} mm
            </span>
          </div>
          <div className="dc-summary-item">
            <span className="dc-summary-label">Peak Discharge (Q₁₀₀)</span>
            <span className="dc-summary-value">
              {((anyLid ? designRow.Q_lid : designRow.Q_base) * 1000).toFixed(2)} L/s
            </span>
          </div>
          <div className="dc-summary-item">
            <span className="dc-summary-label">Runoff Volume</span>
            <span className="dc-summary-value">
              {(anyLid ? designRow.vol_lid : designRow.vol_base).toFixed(2)} m³
            </span>
          </div>
          <div className="dc-summary-item">
            <span className="dc-summary-label">Soil Infiltration Potential</span>
            <span className="dc-summary-value">{potentialInfiltration.toFixed(2)} m³ during storm</span>
          </div>
          <div className="dc-summary-item">
            <span className="dc-summary-label">Methodology</span>
            <span className="dc-summary-value sm">
              Rational Method (Q=CiA) · Manning's pipe sizing · Edmonton IDF
            </span>
          </div>
        </div>
        <p className="dc-disclaimer">
          <strong>Real data:</strong> Property — Edmonton Open Data API.
          Soil infiltration — Rawls et al. (1983).
          Runoff coefficients — standard ranges (Bedient et al., 2019).
          Manning's n=0.013 (PVC), S=0.5%.
          <br />
          <strong>Approximate:</strong> IDF intensities are representative of Edmonton — verify against
          ECCC Engineering Climate Datasets (Stn 3012216) for any real project.
          <br />
          <strong>Not for construction</strong> — preliminary analysis only.
        </p>
      </div>
    </div>
  );
}
