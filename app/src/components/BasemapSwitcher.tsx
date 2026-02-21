import { useState, useEffect } from "react";
import { BASEMAPS, type BasemapKey } from "../config/basemaps";

const LS_KEY = "hydrogrid-basemap";
const LS_SEEN_KEY = "hydrogrid-basemap-seen";

export function getSavedBasemap(): BasemapKey {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && saved in BASEMAPS) return saved as BasemapKey;
  } catch { /* ignore */ }
  return "dark";
}

export default function BasemapSwitcher({
  active,
  onChange,
}: {
  active: BasemapKey;
  onChange: (key: BasemapKey) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_SEEN_KEY)) {
        setFirstVisit(true);
        setExpanded(true);
      }
    } catch { /* ignore */ }
  }, []);

  const select = (key: BasemapKey) => {
    onChange(key);
    setExpanded(false);
    setFirstVisit(false);
    try {
      localStorage.setItem(LS_KEY, key);
      localStorage.setItem(LS_SEEN_KEY, "1");
    } catch { /* ignore */ }
  };

  const dismiss = () => {
    setExpanded(false);
    setFirstVisit(false);
    try {
      localStorage.setItem(LS_SEEN_KEY, "1");
    } catch { /* ignore */ }
  };

  if (firstVisit && expanded) {
    return (
      <div className="basemap-first-visit">
        <div className="basemap-first-header">
          <span className="basemap-first-title">Choose Map Style</span>
          <button className="basemap-first-dismiss" onClick={dismiss}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="basemap-first-grid">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              className={`basemap-first-tile ${key === active ? "active" : ""}`}
              onClick={() => select(key)}
            >
              <span className="basemap-first-preview" data-basemap={key} />
              <span className="basemap-first-label">{BASEMAPS[key].label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="basemap-switcher">
      <button
        className="basemap-toggle"
        onClick={() => setExpanded(!expanded)}
        title="Change map style"
      >
        <span className="basemap-preview-mini" data-basemap={active} />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
      {expanded && (
        <div className="basemap-menu">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              className={`basemap-option ${key === active ? "active" : ""}`}
              onClick={() => select(key)}
            >
              <span className="basemap-preview" data-basemap={key} />
              <span>{BASEMAPS[key].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
