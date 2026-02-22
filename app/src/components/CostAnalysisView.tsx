import { useState, useMemo, useEffect } from "react";
import { downloadCSV } from "../utils/export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import { usePropertySearch } from "../hooks/usePropertySearch";
import { SidebarInputPanel, SiteMapPanel } from "./SiteInputPanel";

// ─── Pipe catalogue (installed CAD/m) ───
// DEFAULT ESTIMATES — these are approximate unit rates for planning purposes.
// Users should replace with actual supplier quotes for any real project.
// Rates reflect typical Western Canadian installed costs (supply + install).
type PipeMaterial = "pvc" | "hdpe" | "concrete";
interface PipeOption { dia_mm: number; pvc: number; hdpe: number; concrete: number; }

const PIPE_CATALOGUE: PipeOption[] = [
  {dia_mm:100,pvc:95,hdpe:110,concrete:0},{dia_mm:150,pvc:125,hdpe:140,concrete:0},
  {dia_mm:200,pvc:160,hdpe:175,concrete:195},{dia_mm:250,pvc:195,hdpe:215,concrete:240},
  {dia_mm:300,pvc:240,hdpe:265,concrete:285},{dia_mm:375,pvc:300,hdpe:330,concrete:355},
  {dia_mm:450,pvc:420,hdpe:460,concrete:430},{dia_mm:525,pvc:0,hdpe:560,concrete:520},
  {dia_mm:600,pvc:0,hdpe:650,concrete:600},{dia_mm:750,pvc:0,hdpe:0,concrete:780},
  {dia_mm:900,pvc:0,hdpe:0,concrete:980},{dia_mm:1050,pvc:0,hdpe:0,concrete:1250},
  {dia_mm:1200,pvc:0,hdpe:0,concrete:1500},
];

const MATERIAL_LABELS: Record<PipeMaterial,string> = {
  pvc:"PVC (Polyvinyl Chloride)", hdpe:"HDPE (High-Density Polyethylene)", concrete:"Reinforced Concrete",
};

const ENGINEERING_PCT = 0.15, CONTINGENCY_PCT = 0.10;

// APPROXIMATE IDF intensities representative of Edmonton.
// For verified data: https://climate-change.canada.ca/climate-data/#/short-duration-rainfall-intensity-idf
const IDF_RETURN_PERIODS = [2,5,10,25,50,100];
const IDF: Record<number,Record<number,number>> = {
  2:{5:82,10:56,15:45,30:30,60:18,120:11,360:5.0,720:3.0,1440:1.7},
  5:{5:110,10:76,15:61,30:41,60:25,120:15,360:6.8,720:4.0,1440:2.3},
  10:{5:128,10:89,15:72,30:48,60:29,120:18,360:8.0,720:4.7,1440:2.7},
  25:{5:153,10:107,15:86,30:58,60:35,120:21,360:9.6,720:5.6,1440:3.3},
  50:{5:172,10:121,15:97,30:66,60:40,120:24,360:11,720:6.4,1440:3.7},
  100:{5:192,10:135,15:109,30:74,60:44,120:27,360:12,720:7.2,1440:4.2},
};

function getIntensity(rp:number,dur:number):number{
  const t=IDF[rp];if(!t)return 0;
  const ds=Object.keys(t).map(Number).sort((a,b)=>a-b);
  if(dur<=ds[0])return t[ds[0]];if(dur>=ds[ds.length-1])return t[ds[ds.length-1]];
  for(let j=0;j<ds.length-1;j++){
    if(dur>=ds[j]&&dur<=ds[j+1]){
      const f=(Math.log(dur)-Math.log(ds[j]))/(Math.log(ds[j+1])-Math.log(ds[j]));
      return Math.exp(Math.log(t[ds[j]])+f*(Math.log(t[ds[j+1]])-Math.log(t[ds[j]])));
    }
  }
  return 0;
}

const STANDARD_PIPES = [100,150,200,250,300,375,450,525,600,750,900,1050,1200];
function calcPipeDia(Q:number):number{
  const n=0.013,S=0.005;
  const Ar=Q*n/Math.sqrt(S);
  const d=Math.pow((Ar*Math.pow(4,2/3))/Math.PI,3/8)*2;
  return d*1000;
}
function roundUpPipe(d:number):number{return STANDARD_PIPES.find(p=>p>=d)??STANDARD_PIPES[STANDARD_PIPES.length-1];}

export default function CostAnalysisView() {
  const ps = usePropertySearch();

  const [returnPeriod, setReturnPeriod] = useState(100);
  const [pipeMaterial, setPipeMaterial] = useState<PipeMaterial>("pvc");
  const [pipeLength, setPipeLength] = useState("");
  const [numCatchBasins, setNumCatchBasins] = useState("");
  const [numManholes, setNumManholes] = useState("");
  const [lidGreenRoof, setLidGreenRoof] = useState(false);
  const [lidRainGarden, setLidRainGarden] = useState(false);
  const [lidPermPave, setLidPermPave] = useState(false);
  const [lidBioswale, setLidBioswale] = useState(false);

  // User-editable unit costs (no verified public source found for Alberta)
  const [costCB, setCostCB] = useState("3500");
  const [costMH, setCostMH] = useState("6000");
  const [costExc, setCostExc] = useState("22");
  const [costBF, setCostBF] = useState("15");
  const [costGreenRoof, setCostGreenRoof] = useState("250");
  const [costRainGarden, setCostRainGarden] = useState("175");
  const [costPermPave, setCostPermPave] = useState("140");
  const [costBioswale, setCostBioswale] = useState("110");

  const cbUnit = parseFloat(costCB) || 0;
  const mhUnit = parseFloat(costMH) || 0;
  const excUnit = parseFloat(costExc) || 0;
  const bfUnit = parseFloat(costBF) || 0;
  const grUnit = parseFloat(costGreenRoof) || 0;
  const rgUnit = parseFloat(costRainGarden) || 0;
  const ppUnit = parseFloat(costPermPave) || 0;
  const bsUnit = parseFloat(costBioswale) || 0;

  const lot = ps.analysisData?.lotSize ?? 0;
  const bldg = ps.analysisData?.buildingArea ?? 0;
  const paveFrac = ps.analysisData?.zoningPaveFrac ?? 0.15;

  useEffect(() => {
    if (lot <= 0) return;
    const sideLen = Math.sqrt(lot);
    const estPipeRun = Math.round(sideLen * 0.6 + 3);
    setPipeLength(String(estPipeRun));

    const imperviousArea = bldg + lot * paveFrac;
    const estCB = Math.max(1, Math.ceil(imperviousArea / 400));
    setNumCatchBasins(String(estCB));

    const estMH = Math.max(1, Math.ceil(estPipeRun / 90));
    setNumManholes(String(estMH));
  }, [lot, bldg, paveFrac]);

  const pipeLenM = parseFloat(pipeLength) || 0;
  const catchBasins = parseInt(numCatchBasins) || 0;
  const manholes = parseInt(numManholes) || 0;

  const calc = useMemo(()=>{
    if(lot<=0) return null;
    const paveArea=lot*paveFrac, lawnArea=Math.max(0,lot-bldg-paveArea);
    const C=(bldg*0.95+paveArea*0.90+lawnArea*0.30)/lot;
    const tc_raw=0.0195*Math.pow(Math.sqrt(lot),0.77)/Math.pow(0.005,0.385);
    const tc=Math.min(30,Math.max(5,tc_raw));
    const i=getIntensity(returnPeriod,tc);
    const Q=(C*i*(lot/10000))/360;
    const d_mm=calcPipeDia(Q);
    const pipe_mm=roundUpPipe(d_mm);
    return {C,tc,i,Q,pipe_mm};
  },[lot,bldg,returnPeriod,paveFrac]);

  const costs = useMemo(()=>{
    if(!calc) return null;
    const pipeRow=PIPE_CATALOGUE.find(p=>p.dia_mm>=calc.pipe_mm);
    if(!pipeRow) return null;
    let unitCost=pipeRow[pipeMaterial];
    if(unitCost===0){
      const avail=(["pvc","hdpe","concrete"] as PipeMaterial[]).filter(m=>pipeRow[m]>0);
      unitCost=avail.length>0?pipeRow[avail[0]]:500;
    }
    const pipeCost=unitCost*pipeLenM;
    const cbCost=catchBasins*cbUnit, mhCost=manholes*mhUnit;
    const pipeOD = pipeRow.dia_mm / 1000;
    const MIN_COVER = 2.4;
    const BEDDING = 0.15;
    const trenchDepth = Math.max(MIN_COVER + pipeOD + BEDDING, 2.1 + pipeOD + BEDDING);
    const trenchWidth = Math.max(0.6, pipeOD + 0.45);
    const excavVol = trenchDepth * trenchWidth * pipeLenM;
    const excCost=excavVol*excUnit, bfCost=excavVol*bfUnit;

    const greenRoofArea=lidGreenRoof?bldg*0.5:0;
    const rainGardenArea=lidRainGarden?lot*0.05:0;
    const permPaveArea=lidPermPave?lot*0.15:0;
    const bioswaleLen=lidBioswale?Math.sqrt(lot)*0.5:0;
    const greenRoofCost=greenRoofArea*grUnit;
    const rainGardenCost=rainGardenArea*rgUnit;
    const permPaveCost=permPaveArea*ppUnit;
    const bioswaleCost=bioswaleLen*bsUnit;
    const lidTotal=greenRoofCost+rainGardenCost+permPaveCost+bioswaleCost;

    const infraTotal=pipeCost+cbCost+mhCost+excCost+bfCost;
    const subtotal=infraTotal+lidTotal;
    const engineering=subtotal*ENGINEERING_PCT, contingency=subtotal*CONTINGENCY_PCT;
    const grandTotal=subtotal+engineering+contingency;

    return {
      pipe:{dia:pipeRow.dia_mm,material:pipeMaterial,unitCost,length:pipeLenM,cost:pipeCost},
      catchBasins:{count:catchBasins,unitCost:cbUnit,cost:cbCost},
      manholes:{count:manholes,unitCost:mhUnit,cost:mhCost},
      excavation:{vol:excavVol,cost:excCost,depth:trenchDepth,width:trenchWidth},
      backfill:{vol:excavVol,cost:bfCost},
      lid:{greenRoof:{area:greenRoofArea,cost:greenRoofCost},rainGarden:{area:rainGardenArea,cost:rainGardenCost},
        permPave:{area:permPaveArea,cost:permPaveCost},bioswale:{len:bioswaleLen,cost:bioswaleCost},total:lidTotal},
      infraTotal,lidTotal,subtotal,engineering,contingency,grandTotal,
    };
  },[calc,pipeMaterial,pipeLenM,catchBasins,manholes,lidGreenRoof,lidRainGarden,lidPermPave,lidBioswale,lot,bldg,cbUnit,mhUnit,excUnit,bfUnit,grUnit,rgUnit,ppUnit,bsUnit]);

  const chartData = useMemo(()=>{
    if(!costs) return [];
    return [
      {name:"Storm Pipe",cost:costs.pipe.cost},{name:"Catch Basins",cost:costs.catchBasins.cost},
      {name:"Manholes",cost:costs.manholes.cost},{name:"Excavation",cost:costs.excavation.cost},
      {name:"Backfill",cost:costs.backfill.cost},
      ...(costs.lid.greenRoof.cost>0?[{name:"Green Roof",cost:costs.lid.greenRoof.cost}]:[]),
      ...(costs.lid.rainGarden.cost>0?[{name:"Rain Garden",cost:costs.lid.rainGarden.cost}]:[]),
      ...(costs.lid.permPave.cost>0?[{name:"Perm. Pave",cost:costs.lid.permPave.cost}]:[]),
      ...(costs.lid.bioswale.cost>0?[{name:"Bio-swale",cost:costs.lid.bioswale.cost}]:[]),
      {name:"Engineering (15%)",cost:costs.engineering},{name:"Contingency (10%)",cost:costs.contingency},
    ];
  },[costs]);

  const pieData = useMemo(()=>{
    if(!costs)return[];
    return [{name:"Storm Infrastructure",value:costs.infraTotal},{name:"LID Features",value:costs.lidTotal},
      {name:"Eng. & Contingency",value:costs.engineering+costs.contingency}].filter(d=>d.value>0);
  },[costs]);

  const PIE_COLORS=["#3b82f6","#22c55e","#f59e0b","#ef4444"];
  const tooltipStyle={background:"#0a150a",border:"1px solid rgba(57,211,83,0.35)",borderRadius:2,color:"#39d353",fontSize:11,fontFamily:"'Share Tech Mono', monospace"};
  const fmt=(n:number)=>"$"+n.toLocaleString("en-CA",{minimumFractionDigits:0,maximumFractionDigits:0});

  return (
    <div className="precip-view">
      <div className="precip-sidebar eng-sidebar">
        <div className="precip-sidebar-header">
          <h2>Cost Analysis</h2>
          <p className="precip-subtitle">Stormwater Infrastructure &middot; LID Features</p>
        </div>

        <SidebarInputPanel {...ps} />

        {ps.analysisData && (
          <>
            <div className="precip-section">
              <label className="precip-label">Pipe Infrastructure</label>
              <div className="eng-manual-form">
                <div className="eng-field">
                  <label className="eng-field-label">Design Return Period</label>
                  <select className="dc-select" style={{width:"100%"}} value={returnPeriod} onChange={e=>setReturnPeriod(+e.target.value)}>
                    {IDF_RETURN_PERIODS.map(rp=>(<option key={rp} value={rp}>{rp}-year</option>))}
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Pipe Material</label>
                  <select className="dc-select" style={{width:"100%"}} value={pipeMaterial} onChange={e=>setPipeMaterial(e.target.value as PipeMaterial)}>
                    <option value="pvc">PVC</option><option value="hdpe">HDPE</option><option value="concrete">Reinforced Concrete</option>
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Pipe Run Length (m)</label>
                  <input type="number" className="prop-input" value={pipeLength} onChange={e=>setPipeLength(e.target.value)} min="1" />
                  <span style={{fontSize:9,opacity:0.5,marginTop:2,display:"block"}}>Auto-estimated from lot (&asymp; 60% of side length + 3m connection)</span>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Catch Basins</label>
                  <input type="number" className="prop-input" value={numCatchBasins} onChange={e=>setNumCatchBasins(e.target.value)} min="0" />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Manholes</label>
                  <input type="number" className="prop-input" value={numManholes} onChange={e=>setNumManholes(e.target.value)} min="0" />
                </div>
              </div>
            </div>

            <div className="precip-section">
              <label className="precip-label">Unit Rates (CAD) <span style={{fontSize:9,opacity:0.5}}>— enter your own</span></label>
              <p style={{fontSize:9,opacity:0.5,margin:"0 0 6px"}}>No verified public source found. Defaults are placeholders — replace with actual quotes.</p>
              <div className="eng-manual-form" style={{gap:4}}>
                <div className="eng-field"><label className="eng-field-label">Catch Basin ($/ea)</label><input type="number" className="prop-input" value={costCB} onChange={e=>setCostCB(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Manhole ($/ea)</label><input type="number" className="prop-input" value={costMH} onChange={e=>setCostMH(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Excavation ($/m³)</label><input type="number" className="prop-input" value={costExc} onChange={e=>setCostExc(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Backfill ($/m³)</label><input type="number" className="prop-input" value={costBF} onChange={e=>setCostBF(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Green Roof ($/m²)</label><input type="number" className="prop-input" value={costGreenRoof} onChange={e=>setCostGreenRoof(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Rain Garden ($/m²)</label><input type="number" className="prop-input" value={costRainGarden} onChange={e=>setCostRainGarden(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Permeable Pave ($/m²)</label><input type="number" className="prop-input" value={costPermPave} onChange={e=>setCostPermPave(e.target.value)} min="0" /></div>
                <div className="eng-field"><label className="eng-field-label">Bio-swale ($/lm)</label><input type="number" className="prop-input" value={costBioswale} onChange={e=>setCostBioswale(e.target.value)} min="0" /></div>
              </div>
            </div>

            <div className="precip-section">
              <label className="precip-label">LID Features (Optional)</label>
              <div className="dc-lid-grid" style={{gap:6}}>
                {[
                  {key:"greenRoof",label:"Green Roof",desc:`~${bldg>0?(bldg*0.5).toFixed(0):0} m²`,val:lidGreenRoof,set:setLidGreenRoof},
                  {key:"rainGarden",label:"Rain Garden",desc:`~${lot>0?(lot*0.05).toFixed(0):0} m²`,val:lidRainGarden,set:setLidRainGarden},
                  {key:"permPave",label:"Permeable Pave",desc:`~${lot>0?(lot*0.15).toFixed(0):0} m²`,val:lidPermPave,set:setLidPermPave},
                  {key:"bioswale",label:"Bio-swale",desc:`~${lot>0?(Math.sqrt(lot)*0.5).toFixed(0):0} m`,val:lidBioswale,set:setLidBioswale},
                ].map(lid=>(
                  <button key={lid.key} className={`dc-lid-btn ${lid.val?"dc-lid-on":""}`} onClick={()=>lid.set(!lid.val)}>
                    <strong>{lid.label}</strong><span style={{fontSize:10,opacity:0.7}}>{lid.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {calc && (
              <div className="precip-section">
                <label className="precip-label">Drainage Design Basis <span style={{fontSize:9,opacity:0.5}}>(approx. IDF)</span></label>
                <div className="sim-soil-table">
                  <div className="sim-soil-row"><span>Composite C</span><strong>{calc.C.toFixed(2)}</strong></div>
                  <div className="sim-soil-row"><span>Design Intensity</span><strong>{calc.i.toFixed(1)} mm/hr</strong></div>
                  <div className="sim-soil-row"><span>Peak Discharge (Q)</span><strong>{(calc.Q*1000).toFixed(1)} L/s</strong></div>
                  <div className="sim-soil-row"><span>Required Pipe</span><strong>{calc.pipe_mm} mm</strong></div>
                  {costs && <div className="sim-soil-row"><span>Trench Depth (2.4m min cover)</span><strong>{costs.excavation.depth.toFixed(2)} m</strong></div>}
                  {costs && <div className="sim-soil-row"><span>Trench Width</span><strong>{costs.excavation.width.toFixed(2)} m</strong></div>}
                </div>
              </div>
            )}
          </>
        )}

        <div className="precip-section precip-footer-section">
          <p className="precip-hint" style={{fontSize:11}}>
            <strong>Real data:</strong> Property &amp; stormwater facilities — Edmonton Open Data API.
            Engineering formulas (Rational Method, Manning's) are standard methods.
            <br />
            <strong>User-provided:</strong> All unit costs are editable — no verified public source
            exists for Alberta infrastructure unit rates. Pipe catalogue rates are defaults only.
            <br />
            <strong>Approximate:</strong> IDF intensities for Edmonton. Impervious ratios from zoning.
          </p>
          <p className="footer-credit">HackED 2026 - University of Alberta</p>
        </div>
      </div>

      {/* Main area: compact map + costs */}
      <div className="precip-main theme-dark">
        <div className="sim-split-main">
          <SiteMapPanel handleMapClick={ps.handleMapClick} markerPos={ps.markerPos}
            visibleMarkers={ps.visibleMarkers} selected={ps.selected} setSelected={ps.setSelected}
            setClickMarker={ps.setClickMarker} clickMarker={ps.clickMarker}
            clickLoading={ps.clickLoading} mode={ps.mode} compact />

          {!costs ? (
            <div className="precip-overlay-loading" style={{flex:1}}>Search or enter a property to calculate costs</div>
          ) : (
          <div className="sim-charts-area">
            <div className="sim-chart-card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h4>Cost Estimate Summary <span style={{fontSize:10,opacity:0.5,fontWeight:400}}>(based on user-provided unit rates)</span></h4>
                <button className="export-btn" onClick={() => downloadCSV(chartData.map(d => ({Item: d.name, Cost: d.cost})), "cost_analysis.csv")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  CSV
                </button>
              </div>
              <div className="cost-summary-grid">
                <div className="cost-summary-item cost-total"><span className="cost-summary-label">Total Project Estimate</span><span className="cost-summary-value">{fmt(costs.grandTotal)}</span></div>
                <div className="cost-summary-item"><span className="cost-summary-label">Storm Infrastructure</span><span className="cost-summary-value">{fmt(costs.infraTotal)}</span></div>
                <div className="cost-summary-item"><span className="cost-summary-label">LID Features</span><span className="cost-summary-value">{fmt(costs.lidTotal)}</span></div>
                <div className="cost-summary-item"><span className="cost-summary-label">Engineering (15%)</span><span className="cost-summary-value">{fmt(costs.engineering)}</span></div>
                <div className="cost-summary-item"><span className="cost-summary-label">Contingency (10%)</span><span className="cost-summary-value">{fmt(costs.contingency)}</span></div>
              </div>
            </div>

            <div className="sim-chart-card">
              <h4>Detailed Cost Breakdown</h4>
              <table className="cost-table">
                <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead>
                <tbody>
                  <tr className="cost-row-header"><td colSpan={5}>Storm Pipe Infrastructure</td></tr>
                  <tr><td>Storm Pipe</td><td>{costs.pipe.dia} mm {MATERIAL_LABELS[costs.pipe.material]}</td><td>{costs.pipe.length} m</td><td>{fmt(costs.pipe.unitCost)}/m</td><td>{fmt(costs.pipe.cost)}</td></tr>
                  <tr><td>Catch Basins</td><td>Standard CB w/ grate</td><td>{costs.catchBasins.count} ea</td><td>{fmt(costs.catchBasins.unitCost)}/ea</td><td>{fmt(costs.catchBasins.cost)}</td></tr>
                  <tr><td>Manholes</td><td>Standard MH</td><td>{costs.manholes.count} ea</td><td>{fmt(costs.manholes.unitCost)}/ea</td><td>{fmt(costs.manholes.cost)}</td></tr>
                  <tr><td>Excavation</td><td>Trench {costs.excavation.depth.toFixed(1)}m deep &times; {costs.excavation.width.toFixed(2)}m wide</td><td>{costs.excavation.vol.toFixed(1)} m³</td><td>{fmt(excUnit)}/m³</td><td>{fmt(costs.excavation.cost)}</td></tr>
                  <tr><td>Backfill</td><td>Granular bedding & backfill</td><td>{costs.backfill.vol.toFixed(1)} m³</td><td>{fmt(bfUnit)}/m³</td><td>{fmt(costs.backfill.cost)}</td></tr>
                  {costs.lidTotal>0 && (
                    <>
                      <tr className="cost-row-header"><td colSpan={5}>Low Impact Development (LID)</td></tr>
                      {costs.lid.greenRoof.cost>0 && <tr><td>Green Roof</td><td>Extensive sedum system</td><td>{costs.lid.greenRoof.area.toFixed(0)} m²</td><td>{fmt(grUnit)}/m²</td><td>{fmt(costs.lid.greenRoof.cost)}</td></tr>}
                      {costs.lid.rainGarden.cost>0 && <tr><td>Rain Garden</td><td>Bioretention cell</td><td>{costs.lid.rainGarden.area.toFixed(0)} m²</td><td>{fmt(rgUnit)}/m²</td><td>{fmt(costs.lid.rainGarden.cost)}</td></tr>}
                      {costs.lid.permPave.cost>0 && <tr><td>Permeable Pavement</td><td>Interlocking concrete pavers</td><td>{costs.lid.permPave.area.toFixed(0)} m²</td><td>{fmt(ppUnit)}/m²</td><td>{fmt(costs.lid.permPave.cost)}</td></tr>}
                      {costs.lid.bioswale.cost>0 && <tr><td>Bio-swale</td><td>Vegetated channel</td><td>{costs.lid.bioswale.len.toFixed(0)} m</td><td>{fmt(bsUnit)}/m</td><td>{fmt(costs.lid.bioswale.cost)}</td></tr>}
                    </>
                  )}
                  <tr className="cost-row-header"><td colSpan={5}>Professional Services & Contingency</td></tr>
                  <tr><td>Engineering</td><td>Design, permitting, inspection</td><td>15%</td><td>-</td><td>{fmt(costs.engineering)}</td></tr>
                  <tr><td>Contingency</td><td>Unforeseen conditions</td><td>10%</td><td>-</td><td>{fmt(costs.contingency)}</td></tr>
                  <tr className="cost-row-total"><td colSpan={4}>GRAND TOTAL</td><td>{fmt(costs.grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="sim-chart-card">
              <h4>Cost Breakdown by Item</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{left:100}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(57,211,83,0.12)" />
                  <XAxis type="number" stroke="rgba(57,211,83,0.4)" tick={{fontSize:9,fill:"rgba(57,211,83,0.5)"}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" stroke="rgba(57,211,83,0.4)" tick={{fontSize:10,fill:"rgba(57,211,83,0.6)"}} width={95} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v:number|undefined)=>[fmt(v??0)]} />
                  <Bar dataKey="cost" fill="#39d353" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="sim-chart-card">
              <h4>Cost Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                    label={({name,percent}:{name?:string;percent?:number})=>`${name??""} (${((percent??0)*100).toFixed(0)}%)`}>
                    {pieData.map((_,i)=>(<Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v:number|undefined)=>[fmt(v??0)]} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="sim-chart-card">
              <h4>Pipe Cost Reference (Installed, CAD/m)</h4>
              <table className="cost-table cost-ref-table">
                <thead><tr><th>Diameter (mm)</th><th>PVC</th><th>HDPE</th><th>Concrete</th></tr></thead>
                <tbody>
                  {PIPE_CATALOGUE.map(p=>(
                    <tr key={p.dia_mm} className={calc&&p.dia_mm===calc.pipe_mm?"cost-row-active":""}>
                      <td>{p.dia_mm}</td><td>{p.pvc>0?fmt(p.pvc):"-"}</td><td>{p.hdpe>0?fmt(p.hdpe):"-"}</td><td>{p.concrete>0?fmt(p.concrete):"-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dc-note" style={{marginTop:8}}>
                Highlighted row: required pipe size based on {returnPeriod}-year design storm.
                <strong>Pipe catalogue rates are defaults</strong> — no verified public source.
                Edit unit rates in the sidebar to use your own data.
              </p>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
