import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { usePropertySearch } from "../hooks/usePropertySearch";
import { SidebarInputPanel, SiteMapPanel } from "./SiteInputPanel";

// ─── Green-Ampt soil parameters ───
// Source: Rawls, Brakensiek & Miller (1983) "Green-Ampt Infiltration Parameters
// from Soils Data", J. Hydraulic Engineering, 109(1), pp. 62-70.
// As presented in CIV E 321 (Bedient et al., 2019).
const GA_SOILS = {
  sand:           { label: "Sand",              Ks: 117.8, psi: 49.5,  theta_e: 0.437, theta_i: 0.10 },
  loamySand:      { label: "Loamy Sand",        Ks: 29.9,  psi: 61.3,  theta_e: 0.437, theta_i: 0.12 },
  sandyLoam:      { label: "Sandy Loam",        Ks: 10.9,  psi: 110.1, theta_e: 0.453, theta_i: 0.15 },
  loam:           { label: "Loam",              Ks: 3.4,   psi: 88.9,  theta_e: 0.463, theta_i: 0.20 },
  siltLoam:       { label: "Silt Loam",         Ks: 6.5,   psi: 166.8, theta_e: 0.501, theta_i: 0.22 },
  sandyClayLoam:  { label: "Sandy Clay Loam",   Ks: 1.5,   psi: 218.5, theta_e: 0.398, theta_i: 0.20 },
  clayLoam:       { label: "Clay Loam",         Ks: 1.0,   psi: 208.8, theta_e: 0.464, theta_i: 0.25 },
  siltyClayLoam:  { label: "Silty Clay Loam",   Ks: 1.0,   psi: 273.0, theta_e: 0.471, theta_i: 0.25 },
  clay:           { label: "Clay (Glacial Till)",Ks: 0.3,   psi: 316.3, theta_e: 0.475, theta_i: 0.30 },
} as const;
type SoilKey = keyof typeof GA_SOILS;

// ─── SCS Type II 24-hr distribution ───
// Source: USDA NRCS TR-55 (1986), Urban Hydrology for Small Watersheds
// Standard temporal distribution for design storms in continental climates.
const SCS_TYPE_II: [number, number][] = [
  [0,0],[.042,.01],[.083,.022],[.125,.035],[.167,.048],[.208,.063],
  [.250,.080],[.292,.098],[.333,.120],[.375,.147],[.417,.181],
  [.438,.204],[.458,.235],[.479,.283],[.489,.357],[.500,.663],
  [.521,.735],[.542,.772],[.563,.799],[.583,.820],[.625,.850],
  [.667,.880],[.708,.916],[.750,.936],[.833,.952],[.917,.976],[1,1],
];

// APPROXIMATE IDF intensities representative of Edmonton.
// For verified data: https://climate-change.canada.ca/climate-data/#/short-duration-rainfall-intensity-idf
// Station: Edmonton City Centre AWOS — Climate ID 3012216
const IDF_RETURN_PERIODS = [2, 5, 10, 25, 50, 100];
const IDF: Record<number, Record<number, number>> = {
  2:{5:82,10:56,15:45,30:30,60:18,120:11,360:5.0,720:3.0,1440:1.7},
  5:{5:110,10:76,15:61,30:41,60:25,120:15,360:6.8,720:4.0,1440:2.3},
  10:{5:128,10:89,15:72,30:48,60:29,120:18,360:8.0,720:4.7,1440:2.7},
  25:{5:153,10:107,15:86,30:58,60:35,120:21,360:9.6,720:5.6,1440:3.3},
  50:{5:172,10:121,15:97,30:66,60:40,120:24,360:11,720:6.4,1440:3.7},
  100:{5:192,10:135,15:109,30:74,60:44,120:27,360:12,720:7.2,1440:4.2},
};

function getIntensity(rp: number, dur_min: number): number {
  const table = IDF[rp]; if (!table) return 0;
  const ds = Object.keys(table).map(Number).sort((a,b)=>a-b);
  if (dur_min <= ds[0]) return table[ds[0]];
  if (dur_min >= ds[ds.length-1]) return table[ds[ds.length-1]];
  for (let j=0;j<ds.length-1;j++) {
    if (dur_min>=ds[j]&&dur_min<=ds[j+1]) {
      const f=(Math.log(dur_min)-Math.log(ds[j]))/(Math.log(ds[j+1])-Math.log(ds[j]));
      return Math.exp(Math.log(table[ds[j]])+f*(Math.log(table[ds[j+1]])-Math.log(table[ds[j]])));
    }
  }
  return 0;
}

function interpolateSCS(tFrac: number): number {
  if (tFrac<=0) return 0; if (tFrac>=1) return 1;
  for (let i=0;i<SCS_TYPE_II.length-1;i++) {
    const [t1,p1]=SCS_TYPE_II[i],[t2,p2]=SCS_TYPE_II[i+1];
    if (tFrac>=t1&&tFrac<=t2) return p1+(tFrac-t1)/(t2-t1)*(p2-p1);
  }
  return 1;
}

interface SimStep {
  time: number; timeLabel: string;
  rainfall: number; intensity: number;
  infiltration: number; infRate: number;
  runoff: number; cumRain: number; cumInf: number; cumRunoff: number;
}

function runSimulation(totalDepth: number, duration_hr: number, soilKey: SoilKey, imperviousFrac: number): SimStep[] {
  const soil = GA_SOILS[soilKey];
  const { Ks, psi } = soil;
  const Md = soil.theta_e - soil.theta_i;
  const perviousFrac = 1 - imperviousFrac;
  const duration_min = duration_hr * 60;
  const dt_min = duration_hr <= 1 ? 2 : duration_hr <= 6 ? 5 : 10;
  const nSteps = Math.ceil(duration_min / dt_min);
  const dt_hr = dt_min / 60;
  let cumF = 0.001, ponded = false, cumRain = 0, cumInf = 0, cumRunoff = 0;
  const steps: SimStep[] = [];
  for (let s = 0; s < nSteps; s++) {
    const tStart = s*dt_min, tEnd = (s+1)*dt_min;
    const pStart = interpolateSCS(tStart/duration_min);
    const pEnd = interpolateSCS(tEnd/duration_min);
    const rainStep = (pEnd-pStart)*totalDepth;
    const intensity = rainStep/dt_hr;
    const fp = Ks*(1+(psi*Md)/cumF);
    const maxInf = fp*dt_hr;
    let pervInf: number, pervRunoff: number;
    if (!ponded && intensity <= fp) { pervInf = rainStep; pervRunoff = 0; }
    else { ponded = true; pervInf = Math.min(maxInf, rainStep); pervRunoff = Math.max(0, rainStep - pervInf); }
    cumF += pervInf;
    const infStep = pervInf * perviousFrac;
    const runoffStep = pervRunoff * perviousFrac + rainStep * imperviousFrac;
    cumRain += rainStep; cumInf += infStep; cumRunoff += runoffStep;
    const hr = Math.floor(tEnd/60), mn = tEnd%60;
    steps.push({
      time: tEnd, timeLabel: `${hr}:${mn.toString().padStart(2,"0")}`,
      rainfall: +rainStep.toFixed(3), intensity: +intensity.toFixed(1),
      infiltration: +infStep.toFixed(3), infRate: +(fp*perviousFrac).toFixed(1),
      runoff: +runoffStep.toFixed(3), cumRain: +cumRain.toFixed(2),
      cumInf: +cumInf.toFixed(2), cumRunoff: +cumRunoff.toFixed(2),
    });
  }
  return steps;
}

export default function StormSimulationView() {
  const ps = usePropertySearch();

  const [soilKey, setSoilKey] = useState<SoilKey>("clayLoam");
  const [returnPeriod, setReturnPeriod] = useState(100);
  const [stormDuration, setStormDuration] = useState(6);

  const lot = ps.analysisData?.lotSize ?? 0;
  const bldg = ps.analysisData?.buildingArea ?? 0;
  const paveFrac = ps.analysisData?.zoningPaveFrac ?? 0.15;
  const imperviousFrac = lot > 0 ? Math.min((bldg + lot * paveFrac) / lot, 0.95) : 0.5;
  const avgIntensity = getIntensity(returnPeriod, stormDuration * 60);
  const totalDepth = avgIntensity * stormDuration;
  const soil = GA_SOILS[soilKey];

  const steps = useMemo(() => {
    if (totalDepth <= 0 || lot <= 0) return [];
    return runSimulation(totalDepth, stormDuration, soilKey, imperviousFrac);
  }, [totalDepth, stormDuration, soilKey, imperviousFrac, lot]);

  const peakIntensity = steps.reduce((mx, s) => Math.max(mx, s.intensity), 0);
  const totalRunoff = steps.length > 0 ? steps[steps.length - 1].cumRunoff : 0;
  const totalInf = steps.length > 0 ? steps[steps.length - 1].cumInf : 0;
  const runoffVolume = lot > 0 ? (totalRunoff * lot) / 1000 : 0;
  const timeToPonding = steps.find(s => s.runoff > 0.01);

  const tooltipStyle = {
    background: "#0a150a", border: "1px solid rgba(57,211,83,0.35)",
    borderRadius: 2, color: "#39d353", fontSize: 11, fontFamily: "'Share Tech Mono', monospace",
  };

  const ready = lot > 0 && totalDepth > 0;

  return (
    <div className="precip-view">
      <div className="precip-sidebar eng-sidebar">
        <div className="precip-sidebar-header">
          <h2>Storm Simulation</h2>
          <p className="precip-subtitle">Green-Ampt Infiltration &middot; SCS Type II Hyetograph</p>
        </div>

        <SidebarInputPanel {...ps} />

        {ps.analysisData && (
          <>
            <div className="precip-section">
              <label className="precip-label">Design Storm</label>
              <div className="eng-manual-form">
                <div className="eng-field">
                  <label className="eng-field-label">Return Period</label>
                  <select className="dc-select" style={{width:"100%"}} value={returnPeriod} onChange={e=>setReturnPeriod(+e.target.value)}>
                    {IDF_RETURN_PERIODS.map(rp=>(<option key={rp} value={rp}>{rp}-year</option>))}
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Storm Duration</label>
                  <select className="dc-select" style={{width:"100%"}} value={stormDuration} onChange={e=>setStormDuration(+e.target.value)}>
                    <option value={1}>1 hour</option><option value={6}>6 hours</option>
                    <option value={12}>12 hours</option><option value={24}>24 hours</option>
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Soil Type (Green-Ampt)</label>
                  <select className="dc-select" style={{width:"100%"}} value={soilKey} onChange={e=>setSoilKey(e.target.value as SoilKey)}>
                    {(Object.keys(GA_SOILS) as SoilKey[]).map(k=>(<option key={k} value={k}>{GA_SOILS[k].label}</option>))}
                  </select>
                </div>
              </div>
            </div>

            <div className="precip-section">
              <label className="precip-label">Soil Properties</label>
              <div className="sim-soil-table">
                <div className="sim-soil-row"><span>K<sub>s</sub> (sat. conductivity)</span><strong>{soil.Ks} mm/hr</strong></div>
                <div className="sim-soil-row"><span>ψ (capillary suction)</span><strong>{soil.psi} mm</strong></div>
                <div className="sim-soil-row"><span>θ<sub>e</sub> (eff. porosity)</span><strong>{soil.theta_e}</strong></div>
                <div className="sim-soil-row"><span>M<sub>d</sub> (moisture deficit)</span><strong>{(soil.theta_e - soil.theta_i).toFixed(3)}</strong></div>
                <div className="sim-soil-row"><span>Impervious fraction</span><strong>{(imperviousFrac*100).toFixed(0)}%</strong></div>
              </div>
            </div>

            {ready && (
              <div className="precip-section">
                <label className="precip-label">Results</label>
                <div className="dc-stat-grid">
                  <div className="dc-stat highlight"><span className="dc-stat-value">{totalDepth.toFixed(1)} mm</span><span className="dc-stat-label">Total Rainfall</span></div>
                  <div className="dc-stat highlight"><span className="dc-stat-value">{totalRunoff.toFixed(1)} mm</span><span className="dc-stat-label">Total Runoff</span></div>
                  <div className="dc-stat"><span className="dc-stat-value">{totalInf.toFixed(1)} mm</span><span className="dc-stat-label">Infiltrated</span></div>
                  <div className="dc-stat"><span className="dc-stat-value">{peakIntensity.toFixed(0)} mm/hr</span><span className="dc-stat-label">Peak Intensity</span></div>
                  <div className="dc-stat"><span className="dc-stat-value">{runoffVolume.toFixed(1)} m³</span><span className="dc-stat-label">Runoff Volume</span></div>
                  <div className="dc-stat"><span className="dc-stat-value">{timeToPonding ? timeToPonding.timeLabel : "N/A"}</span><span className="dc-stat-label">Ponding Begins</span></div>
                </div>
              </div>
            )}

            <div className="precip-section">
              <p className="dc-note">
                Model: Green-Ampt (f = K<sub>s</sub>(1 + ψM<sub>d</sub>/F)) with SCS Type II temporal distribution.
                Parameters from Rawls et al. (1983) per CIV E 321.
              </p>
            </div>
          </>
        )}

        <div className="precip-section precip-footer-section">
          <p className="precip-hint" style={{fontSize:11}}>
            <strong>Real data:</strong> Property — Edmonton Open Data. Soil params — Rawls et al. (1983). SCS Type II — USDA TR-55 (1986).
            <br /><strong>Approximate:</strong> IDF intensities are representative of Edmonton, not verified from ECCC.
            <br />Theory: Bedient et al. (2019) &middot; CIV E 321, U of A
          </p>
          <p className="footer-credit">HackED 2026 - University of Alberta</p>
        </div>
      </div>

      {/* Main: compact map + charts */}
      <div className="precip-main theme-dark">
        <div className="sim-split-main">
          <SiteMapPanel handleMapClick={ps.handleMapClick} markerPos={ps.markerPos}
            visibleMarkers={ps.visibleMarkers} selected={ps.selected} setSelected={ps.setSelected}
            setClickMarker={ps.setClickMarker} clickMarker={ps.clickMarker}
            clickLoading={ps.clickLoading} mode={ps.mode} compact />

          {!ready ? (
            <div className="precip-overlay-loading" style={{flex:1}}>Search or enter a property to run simulation</div>
          ) : (
          <div className="sim-charts-area">
            <div className="sim-chart-card">
              <h4>Rainfall Hyetograph (SCS Type II)</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={steps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(57,211,83,0.12)" />
                  <XAxis dataKey="timeLabel" stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} minTickGap={30} />
                  <YAxis stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} unit=" mm/hr" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number|undefined)=>[`${v??0} mm/hr`]} />
                  <Bar dataKey="intensity" fill="#3b82f6" name="Rainfall Intensity" radius={[1,1,0,0]} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="sim-chart-card">
              <h4>Infiltration Capacity vs Rainfall (Green-Ampt)</h4>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={steps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(57,211,83,0.12)" />
                  <XAxis dataKey="timeLabel" stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} minTickGap={30} />
                  <YAxis stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} unit=" mm/hr" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="intensity" stroke="#3b82f6" name="Rainfall (mm/hr)" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="infRate" stroke="#22c55e" name="Infiltration Capacity (mm/hr)" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                  <Legend wrapperStyle={{fontSize:10}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="sim-chart-card">
              <h4>Cumulative: Rainfall, Infiltration, Runoff (mm)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={steps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(57,211,83,0.12)" />
                  <XAxis dataKey="timeLabel" stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} minTickGap={30} />
                  <YAxis stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} unit=" mm" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="cumRain" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Cumulative Rainfall" strokeWidth={2} />
                  <Area type="monotone" dataKey="cumInf" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} name="Cumulative Infiltration" strokeWidth={2} />
                  <Area type="monotone" dataKey="cumRunoff" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Cumulative Runoff" strokeWidth={2} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="sim-chart-card">
              <h4>Runoff Depth per Interval (mm)</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={steps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(57,211,83,0.12)" />
                  <XAxis dataKey="timeLabel" stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} minTickGap={30} />
                  <YAxis stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} unit=" mm" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number|undefined)=>[`${(v??0).toFixed(2)} mm`]} />
                  <Bar dataKey="runoff" fill="#ef4444" name="Runoff Depth" radius={[1,1,0,0]} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="sim-waterbalance">
              <h4>Water Balance (P − R − G − E − T = ΔS)</h4>
              <div className="sim-wb-row">
                <div className="sim-wb-item"><span className="sim-wb-label">P (Precipitation)</span><span className="sim-wb-val">{steps.length>0?steps[steps.length-1].cumRain.toFixed(1):0} mm</span></div>
                <span className="sim-wb-op">−</span>
                <div className="sim-wb-item"><span className="sim-wb-label">R (Surface Runoff)</span><span className="sim-wb-val">{totalRunoff.toFixed(1)} mm</span></div>
                <span className="sim-wb-op">−</span>
                <div className="sim-wb-item"><span className="sim-wb-label">Infiltration</span><span className="sim-wb-val">{totalInf.toFixed(1)} mm</span></div>
                <span className="sim-wb-op">=</span>
                <div className="sim-wb-item"><span className="sim-wb-label">ΔS (Residual)</span><span className="sim-wb-val">{(steps.length>0?steps[steps.length-1].cumRain-totalRunoff-totalInf:0).toFixed(2)} mm</span></div>
              </div>
              <p className="dc-note" style={{marginTop:8}}>
                Evaporation (E) and transpiration (T) neglected for storm-event timescale per CIV E 321 (Bedient et al., 2019). G (groundwater) included in infiltration term.
              </p>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
