import { useEffect, useState } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import PrecipitationView from "./components/PrecipitationView";
import { useMapData } from "./hooks/useMapData";
import "./App.css";

type Tab = "map" | "precipitation";

export default function App() {
  const { layers, toggleLayer, loadVisibleLayers, onMapMove } = useMapData();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("map");

  useEffect(() => {
    loadVisibleLayers();
  }, [loadVisibleLayers]);

  return (
    <div className="app">
      <nav className="tab-bar">
        <div className="tab-brand">CivicScale</div>
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Map
          </button>
          <button
            className={`tab-btn ${activeTab === "precipitation" ? "active" : ""}`}
            onClick={() => setActiveTab("precipitation")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
              <path d="M8 16l-2.3 2.3" />
              <path d="M12 12l-2.3 2.3" />
              <path d="M16 16l-2.3 2.3" />
            </svg>
            Precipitation
          </button>
        </div>
      </nav>

      <div className="app-content">
        {activeTab === "map" ? (
          <>
            <Sidebar
              layers={layers}
              onToggle={toggleLayer}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
            {!sidebarOpen && (
              <button
                className="sidebar-open-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
            <MapView layers={layers} onMapMove={onMapMove} />
          </>
        ) : (
          <PrecipitationView />
        )}
      </div>
    </div>
  );
}
