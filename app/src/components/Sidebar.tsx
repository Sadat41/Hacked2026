import type { MapLayer } from "../types";
import { CATEGORY_META } from "../config/layers";

interface Props {
  layers: Record<string, MapLayer>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function CategoryIcon({ cat }: { cat: string }) {
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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

export default function Sidebar({ layers, onToggle, isOpen, onClose }: Props) {
  const grouped = Object.values(layers).reduce(
    (acc, layer) => {
      const cat = layer.config.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(layer);
      return acc;
    },
    {} as Record<string, MapLayer[]>
  );

  return (
    <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">CivicScale</h1>
            <p className="brand-sub">Edmonton Engineering Intelligence</p>
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
            Visualize Edmonton's infrastructure, environment, and resource data
            on an interactive map. Toggle layers to explore municipal datasets.
          </p>
        </div>

        {Object.entries(grouped).map(([category, categoryLayers]) => {
          const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
          return (
            <div key={category} className="sidebar-section">
              <h2 className="section-title">
                <CategoryIcon cat={category} />
                {meta?.label ?? category}
              </h2>
              <div className="layer-list">
                {categoryLayers.map((layer) => (
                  <div
                    key={layer.config.id}
                    className={`layer-card ${layer.visible ? "active" : ""}`}
                    onClick={() => onToggle(layer.config.id)}
                  >
                    <div className="layer-card-header">
                      <div
                        className="layer-swatch"
                        style={{
                          backgroundColor:
                            layer.config.pointColor ??
                            (layer.config.style.fillColor as string) ??
                            "#fff",
                        }}
                      />
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
            </div>
          );
        })}

        <div className="sidebar-section sidebar-footer">
          <p>
            Data sourced from{" "}
            <a
              href="https://data.edmonton.ca"
              target="_blank"
              rel="noopener noreferrer"
            >
              City of Edmonton Open Data Portal
            </a>
          </p>
          <p className="footer-credit">HackED 2026 - University of Alberta</p>
        </div>
      </div>
    </aside>
  );
}
