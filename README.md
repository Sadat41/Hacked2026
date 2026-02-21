# HydroGrid

**Real-Time Hydrology & Infrastructure Analysis Platform**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)](https://vite.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r183-000000?style=flat&logo=three.js&logoColor=white)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)
[![HackED 2026](https://img.shields.io/badge/HackED-2026-orange?style=flat)](https://hacked.compeclub.com/)

[Live Demo](https://sadat41.github.io/Hacked2026/) · [Features](#features) · [Architecture](#architecture) · [Installation](#installation) · [Data Sources](#data-sources) · [Team](#team)

---

## Overview

HydroGrid is an interactive geospatial platform that unifies municipal open data, real-time weather information, and hydrology models into a single browser-based tool. Built for the **HackED 2026** hackathon at the University of Alberta, it is designed to help urban planners and civil engineers make informed decisions about flood risk, stormwater drainage, and infrastructure development in the Edmonton and Alberta region.

Everything runs client-side. There is no backend server -- the app fetches data directly from public APIs and performs all analysis in the browser.

---

## Features

### Map Layers
- 20+ toggleable GeoJSON and point layers covering infrastructure, environment, flood hazard, and energy
- 5 basemap options: Dark (CARTO), Light (CARTO Voyager), Satellite (Esri), Terrain (OpenTopoMap), Street (OpenStreetMap)
- 3 UI themes: Terminal (green-on-black), Dark (navy blue), Accessible (WCAG AAA light)
- Dynamic layer styling that adapts to the selected basemap

### Flood Hazard
- Alberta flood mapping overlays (100-year, 200-year, 500-year return periods, ice-jam scenarios)
- Sourced from Alberta Environment ArcGIS FeatureServer

### Precipitation Explorer
- Browse 1,500+ Environment Canada climate stations across Alberta
- Query daily, monthly, and normal precipitation data with custom date ranges
- Interactive timeseries charts (bar, line, area) via Recharts
- Snowfall normals and climate station metadata

### Hydrometric (River Flow)
- Real-time and historical river discharge data from Environment Canada hydrometric stations
- Flow timeseries visualization with station-level detail

### Property Lookup
- Search any Edmonton address against the city assessment database
- Returns assessed value, zoning, lot size, building area, year built, garage type, tax class
- Cross-references nearby facilities (recreation centres, LRT stations, schools)
- Instant fly-to on the map with property marker

### Drainage Design (Engineering)
- Select a property or enter site parameters manually
- Applies the **Rational Method** (Q = C * i * A) for peak flow estimation
- **SCS Curve-Number** runoff modelling with soil group selection (A/B/C/D)
- **IDF curve** lookup for Edmonton design storms (2yr through 100yr return periods)
- Design storm table with pipe sizing recommendations
- **Low-Impact Development (LID) simulator** -- toggle rain gardens, permeable pavement, green roofs, bioswales and see runoff reduction in real time

### Storm Simulation
- Full hyetograph-based storm simulation over a selected property
- Time-step runoff, infiltration, and cumulative water balance breakdown
- Visual hydrograph and soil absorption charts

### Cost Analysis
- Unit-cost estimation for storm pipes, catch basins, manholes, grading, and LID features
- Material and labour breakdowns with contingency
- Total project cost summary with per-hectare and per-metre rates

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 19, TypeScript | Component architecture, type safety |
| **Build Tool** | Vite 7 | Development server, HMR, production bundling |
| **Mapping** | Leaflet 1.9, React-Leaflet 5 | Interactive map, GeoJSON layers, tile rendering |
| **Basemaps** | OpenStreetMap, CARTO, Esri, OpenTopoMap | Dark, light, satellite, terrain, street tile layers |
| **Charts** | Recharts 3 | Precipitation timeseries, flow charts, cost breakdowns |
| **3D Globe** | Three.js r183, React Three Fiber 9 | Landing page Earth with NASA Blue Marble textures |
| **Styling** | Vanilla CSS | 3 switchable themes, no external CSS framework |
| **Deployment** | GitHub Pages (gh-pages) | Static hosting of production build |

**Frontend:** React + TypeScript with Vite for bundling. No backend server required.
**State Management:** React hooks and localStorage persistence for theme/basemap preferences.
**Charts & Visualization:** Recharts for all bar, line, area, and pie charts.
**Mapping:** Leaflet.js handles all interactive map rendering, GeoJSON overlay management, marker clustering, and popup display. Tile layers served from CARTO, OpenStreetMap, Esri, and OpenTopoMap CDNs.
**3D Landing Page:** Three.js globe with NASA Blue Marble colour texture, bump map, specular ocean map, cloud layer, and custom atmosphere shader. Canvas unmounts on scroll for zero GPU overhead on other sections.

---

## Architecture

```
                           DATA SOURCES
          ┌────────────────────┬────────────────────┬──────────────────┐
          │                    │                    │                  │
          v                    v                    v                  v
 ┌─────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────┐
 │ Edmonton Open   │  │ Environment    │  │ Alberta Flood  │  │ Tile CDNs   │
 │ Data Portal     │  │ Canada         │  │ ArcGIS Server  │  │             │
 │                 │  │                │  │                │  │ CARTO       │
 │ data.edmonton.  │  │ api.weather.   │  │ services.      │  │ OSM         │
 │ ca/resource     │  │ gc.ca          │  │ arcgis.com     │  │ Esri        │
 │                 │  │                │  │                │  │ OpenTopoMap │
 │ Properties      │  │ Climate        │  │ 100yr flood    │  │             │
 │ Permits         │  │ stations       │  │ 200yr flood    │  │ Basemap     │
 │ Drainage        │  │ Precipitation  │  │ 500yr flood    │  │ tiles       │
 │ Air quality     │  │ River flow     │  │ Ice-jam zones  │  │ (raster)    │
 │ Recreation      │  │ Snowfall       │  │                │  │             │
 └────────┬────────┘  └───────┬────────┘  └───────┬────────┘  └──────┬──────┘
          │                   │                    │                   │
          └───────────────────┴────────────────────┴───────────────────┘
                                       │
                                 REST / Fetch
                                       │
                                       v
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                         FRONTEND (client-side)                         │
 │                                                                        │
 │  React 19 + TypeScript + Vite                                          │
 │                                                                        │
 │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
 │  │ Leaflet.js   │  │ Recharts     │  │ Three.js  │  │ Hydrology    │  │
 │  │              │  │              │  │           │  │ Engine       │  │
 │  │ Map layers   │  │ Precip.      │  │ 3D globe  │  │              │  │
 │  │ GeoJSON      │  │ charts       │  │ landing   │  │ Rational     │  │
 │  │ Basemaps     │  │ Flow data    │  │ page      │  │ Method       │  │
 │  │ Markers      │  │ Cost graphs  │  │           │  │ SCS CN       │  │
 │  │ Popups       │  │              │  │           │  │ IDF curves   │  │
 │  └──────────────┘  └──────────────┘  └───────────┘  └──────────────┘  │
 │                                                                        │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                              Analysis Output
                                     │
          ┌──────────────┬───────────┴──────────┬──────────────┐
          v              v                      v              v
  ┌──────────────┐ ┌───────────┐  ┌──────────────┐  ┌──────────────┐
  │ Flood Risk   │ │ Drainage  │  │ Storm        │  │ Cost         │
  │ Mapping      │ │ Design    │  │ Simulation   │  │ Estimation   │
  │              │ │           │  │              │  │              │
  │ Multi-return │ │ Pipe      │  │ Hyetograph   │  │ Pipes,       │
  │ period zones │ │ sizing    │  │ runoff model │  │ catch basins │
  │ on map       │ │ LID sim.  │  │ water balance│  │ LID, grading │
  └──────────────┘ └───────────┘  └──────────────┘  └──────────────┘
```

---

## Data Sources

| Source | Endpoint | Datasets Used |
|--------|----------|---------------|
| **City of Edmonton Open Data** | `data.edmonton.ca/resource` | Property assessments, property details (lot size, zoning, year built), building permits, neighbourhood boundaries, subdivision boundaries, drainage infrastructure, recreation facilities, LRT stations, traffic signals, air quality monitoring, water level stations, climate stations |
| **Environment Canada** | `api.weather.gc.ca` | Climate station inventory (1,500+ AB stations), daily precipitation, monthly precipitation, precipitation normals, snowfall normals, hydrometric river flow gauges and discharge data |
| **Alberta Flood Mapping** | `services.arcgis.com` (ArcGIS FeatureServer) | 100-year flood zones, 200-year flood zones, 500-year flood zones, 100-year ice-jam flood zones, flood hazard areas |
| **Basemap Tiles** | CARTO, OSM, Esri, OpenTopoMap | Dark, Light (Voyager), Satellite (World Imagery), Terrain, Street map tiles |

All data is fetched at runtime from public APIs. No data is bundled with the application.

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

### Clone and Install

```bash
git clone https://github.com/Sadat41/Hacked2026.git
cd Hacked2026/app
npm install
```

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173`. Vite provides hot module replacement -- changes reflect instantly.

### Production Build

```bash
npm run build
```

Outputs optimised static files to `app/dist/`. The build can be served from any static hosting provider.

### Preview Production Build Locally

```bash
npm run preview
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

Builds the project and pushes the `dist/` folder to the `gh-pages` branch.

---

## Project Structure

```
Hacked2026/
├── README.md
└── app/
    ├── public/                     Static assets (favicon, logo)
    ├── src/
    │   ├── assets/                 Earth textures, logo SVG
    │   ├── components/
    │   │   ├── LandingPage.tsx     3D globe landing with scroll sections
    │   │   ├── MapView.tsx         Main Leaflet map with layer rendering
    │   │   ├── Sidebar.tsx         Layer toggle sidebar
    │   │   ├── BasemapSwitcher.tsx Basemap selection dropdown
    │   │   ├── PropertyToolsView.tsx  Property search and detail panel
    │   │   ├── PrecipitationView.tsx  Climate station explorer + charts
    │   │   ├── HydrometricView.tsx    River flow data + charts
    │   │   ├── EngineeringView.tsx    Drainage design entry point
    │   │   ├── DrainageCalculator.tsx Rational Method, SCS, IDF, LID
    │   │   ├── StormSimulationView.tsx Storm hyetograph simulation
    │   │   ├── CostAnalysisView.tsx   Infrastructure cost estimation
    │   │   └── SiteInputPanel.tsx     Shared property/site input
    │   ├── config/
    │   │   ├── layers.ts           Layer definitions, API endpoints
    │   │   └── basemaps.ts         Basemap tile URLs and colour profiles
    │   ├── hooks/
    │   │   ├── useMapData.ts       Layer fetching and state management
    │   │   └── usePropertySearch.ts Property API search logic
    │   ├── types/
    │   │   └── index.ts            Shared TypeScript interfaces
    │   ├── App.tsx                 Root component, routing, theme state
    │   ├── App.css                 All application styles (3 themes)
    │   ├── index.css               Base reset styles
    │   └── main.tsx                Entry point
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    └── eslint.config.js
```

---

## Browser Support

Tested on modern Chromium-based browsers (Chrome, Edge) and Firefox. Requires WebGL for the 3D landing page globe. The main application (map, charts, analysis) works without WebGL.

---

## Team

**Team Redacted** -- HackED 2026, University of Alberta

- Md Sadat Hossain
- Muhammed Ahmedtanov
- Kai Renschler

Department of Civil and Environmental Engineering.

---

## License

MIT

---

*Built for HackED 2026 at the University of Alberta.*
