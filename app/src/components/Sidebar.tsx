import { useState } from "react";
import type { MapLayer } from "../types";
import { CATEGORY_META } from "../config/layers";
import logoSvg from "../assets/logo.svg";

interface Props {
  layers: Record<string, MapLayer>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  categoryFilter?: string[];
}

const CATEGORY_ORDER: (keyof typeof CATEGORY_META)[] = [
  "infrastructure",
  "environment",
  "flood",
  "energy",
];

function CategoryIcon({ cat }: { cat: string }) {
  if (cat === "flood")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
        <path d="M8 16l-2.3 2.3" />
        <path d="M12 12l-2.3 2.3" />
        <path d="M16 16l-2.3 2.3" />
        <path d="M12 20l-2.3 2.3" />
      </svg>
    );
  if (cat === "infrastructure")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="9" y1="6" x2="9" y2="6.01" />
        <line x1="15" y1="6" x2="15" y2="6.01" />
        <line x1="9" y1="10" x2="9" y2="10.01" />
        <line x1="15" y1="10" x2="15" y2="10.01" />
        <line x1="9" y1="14" x2="9" y2="14.01" />
        <line x1="15" y1="14" x2="15" y2="14.01" />
        <line x1="9" y1="18" x2="15" y2="18" />
      </svg>
    );
  if (cat === "environment")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8c.7-1 1-2.2 1-3.5C18 2.6 16.4 1 14.5 1c-.5 0-1 .1-1.4.3C12.4.5 11.5 0 10.5 0 8.6 0 7 1.6 7 3.5c0 .6.1 1.1.3 1.6" />
        <path d="M12 22V8" />
        <path d="M5 12c-1.1.6-2 1.8-2 3.2 0 2 1.6 3.8 3.5 3.8.7 0 1.3-.2 1.8-.5" />
        <path d="M19 12c1.1.6 2 1.8 2 3.2 0 2-1.6 3.8-3.5 3.8-.7 0-1.3-.2-1.8-.5" />
      </svg>
    );
  if (cat === "precipitation")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
        <path d="M8 16l-2.3 2.3" />
        <path d="M12 12l-2.3 2.3" />
        <path d="M16 16l-2.3 2.3" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function LayerIcon({ id }: { id: string }) {
  const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (id) {
    case "neighbourhoods":
      return <svg {...s}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>;
    case "permits":
      return <svg {...s}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 1v3M15 1v3" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="13" y2="14" /><line x1="9" y1="18" x2="11" y2="18" /></svg>;
    case "properties":
      return <svg {...s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M10 15h4" strokeWidth="2.5" /></svg>;
    case "property-details":
      return <svg {...s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="14" cy="14" r="3" /><line x1="16.5" y1="16.5" x2="19" y2="19" /></svg>;
    case "subdivisions":
      return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /></svg>;
    case "lrt":
      return <svg {...s}><rect x="4" y="3" width="16" height="14" rx="2" /><line x1="4" y1="10" x2="20" y2="10" /><circle cx="8" cy="21" r="1.5" /><circle cx="16" cy="21" r="1.5" /><line x1="8" y1="17" x2="8" y2="19.5" /><line x1="16" y1="17" x2="16" y2="19.5" /></svg>;
    case "traffic":
      return <svg {...s}><polygon points="12 2 22 22 2 22 12 2" fill="none" /><line x1="12" y1="9" x2="12" y2="15" /><circle cx="12" cy="18.5" r="0.5" fill="currentColor" stroke="none" /></svg>;
    case "recreation":
      return <svg {...s}><circle cx="12" cy="12" r="10" /><polygon points="12 6 13.8 10 18 10.5 15 13.5 15.8 18 12 15.8 8.2 18 9 13.5 6 10.5 10.2 10 12 6" fill="currentColor" fillOpacity="0.25" /></svg>;
    case "drainage":
      return <svg {...s}><path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" /><path d="M2 20c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" /><path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" /></svg>;
    case "airquality":
      return <svg {...s}><path d="M9.59 4.59A2 2 0 1 1 11 8H2" /><path d="M12.59 19.41A2 2 0 1 0 14 16H2" /><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" /></svg>;
    case "waterstations":
      return <svg {...s}><path d="M12 2C12 2 5 12 5 16a7 7 0 0 0 14 0c0-4-7-14-7-14z" /><path d="M8 18q4-3 8 0" /></svg>;
    case "climate-stations":
      return <svg {...s}><path d="M14 14.76V3a2 2 0 0 0-4 0v11.76" /><circle cx="12" cy="18" r="4" /><circle cx="12" cy="18" r="1.5" fill="currentColor" fillOpacity="0.3" /></svg>;
    case "precip-daily":
      return <svg {...s}><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" /><line x1="8" y1="16" x2="8" y2="20" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="16" y1="16" x2="16" y2="20" /></svg>;
    case "precip-normals":
      return <svg {...s}><polyline points="4 18 8 14 12 16 16 10 20 6" /><line x1="4" y1="22" x2="4" y2="4" /><line x1="4" y1="22" x2="22" y2="22" /><line x1="4" y1="14" x2="20" y2="14" strokeDasharray="3 3" strokeOpacity="0.4" /></svg>;
    case "precip-monthly":
      return <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="8" y1="14" x2="8" y2="16" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="16" y1="14" x2="16" y2="16" /></svg>;
    case "snowfall-normals":
      return <svg {...s}><line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /><line x1="19.07" y1="4.93" x2="4.93" y2="19.07" /><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" /></svg>;
    case "hydro-stations":
      return <svg {...s}><path d="M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>;
    case "flood-hazard":
      return <svg {...s}><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M12 2v10" /><path d="M8 6l4-4 4 4" /></svg>;
    case "flood-100yr":
      return <svg {...s}><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><text x="12" y="10" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="700">100</text></svg>;
    case "flood-200yr":
      return <svg {...s}><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><text x="12" y="10" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="700">200</text></svg>;
    case "flood-500yr":
      return <svg {...s}><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><text x="12" y="6" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">500</text></svg>;
    default:
      return <svg {...s}><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /></svg>;
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`cat-chevron ${open ? "open" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function FeatureCount({ layer }: { layer: MapLayer }) {
  if (layer.loading) return <span className="layer-status loading">Loading...</span>;
  if (layer.error) return <span className="layer-status error">Error</span>;
  if (layer.data)
    return (
      <span className="layer-status count">
        {layer.data.features.length} features
      </span>
    );
  return null;
}

function ActiveCount({ layers }: { layers: MapLayer[] }) {
  const count = layers.filter((l) => l.visible).length;
  if (count === 0) return null;
  return <span className="cat-active-count">{count}</span>;
}

export default function Sidebar({ layers, onToggle, isOpen, onClose, categoryFilter }: Props) {
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const grouped = Object.values(layers).reduce(
    (acc, layer) => {
      const cat = layer.config.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(layer);
      return acc;
    },
    {} as Record<string, MapLayer[]>
  );

  const toggleCat = (cat: string) => {
    setOpenCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const orderedCategories = CATEGORY_ORDER.filter(
    (c) => grouped[c] && (!categoryFilter || categoryFilter.includes(c))
  );

  return (
    <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">
            <img src={logoSvg} alt="HydroGrid logo" width="30" height="30" />
          </div>
          <div>
            <h1 className="brand-title">HydroGrid</h1>
            <p className="brand-sub">See the grid. Know the flow.</p>
          </div>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section">
          <p className="sidebar-desc">
            Toggle data layers to explore Alberta's infrastructure, environment,
            precipitation, and flood hazard datasets.
          </p>
        </div>

        {orderedCategories.map((category) => {
          const categoryLayers = grouped[category];
          const meta = CATEGORY_META[category];
          const singleCategory = orderedCategories.length === 1;
          const isOpen = singleCategory || !!openCats[category];
          return (
            <div key={category} className="sidebar-section cat-section">
              {!singleCategory && (
                <button className="cat-header" onClick={() => toggleCat(category)}>
                  <CategoryIcon cat={category} />
                  <span className="cat-label">{meta?.label ?? category}</span>
                  <ActiveCount layers={categoryLayers} />
                  <ChevronIcon open={isOpen} />
                </button>
              )}
              {isOpen && (
                <div className="layer-list">
                  {categoryLayers.map((layer) => (
                    <div
                      key={layer.config.id}
                      className={`layer-card ${layer.visible ? "active" : ""}`}
                      onClick={() => onToggle(layer.config.id)}
                    >
                      <div className="layer-card-header">
                        <span className="layer-icon">
                          <LayerIcon id={layer.config.id} />
                        </span>
                        <span className="layer-name">{layer.config.name}</span>
                        <div className={`toggle ${layer.visible ? "on" : "off"}`}>
                          <div className="toggle-thumb" />
                        </div>
                      </div>
                      <p className="layer-desc">{layer.config.description}</p>
                      <FeatureCount layer={layer} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="sidebar-section sidebar-footer">
          <p>
            Data:{" "}
            <a href="https://api.weather.gc.ca" target="_blank" rel="noopener noreferrer">
              ECCC
            </a>
            {" / "}
            <a href="https://floods.alberta.ca" target="_blank" rel="noopener noreferrer">
              AB Flood Hazard
            </a>
            {" / "}
            <a href="https://data.edmonton.ca" target="_blank" rel="noopener noreferrer">
              Edmonton Open Data
            </a>
          </p>
          <p className="footer-credit">HackED 2026 - University of Alberta</p>
        </div>
      </div>
    </aside>
  );
}
