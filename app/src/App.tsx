import { useEffect, useState } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import { useMapData } from "./hooks/useMapData";
import "./App.css";

export default function App() {
  const { layers, toggleLayer, loadVisibleLayers } = useMapData();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadVisibleLayers();
  }, [loadVisibleLayers]);

  return (
    <div className="app">
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
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      <main className="map-wrapper">
        <MapView layers={layers} />
      </main>
    </div>
  );
}
