import { useState } from "react";
import { BASEMAPS, type BasemapKey } from "../config/basemaps";

export default function BasemapSwitcher({
  active,
  onChange,
}: {
  active: BasemapKey;
  onChange: (key: BasemapKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="basemap-switcher">
      <button
        className="basemap-toggle"
        onClick={() => setOpen(!open)}
        title="Change basemap"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
      {open && (
        <div className="basemap-menu">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              className={`basemap-option ${key === active ? "active" : ""}`}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
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
