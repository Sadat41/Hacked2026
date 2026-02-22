<div align="center">

# HydroGrid

**Real-Time Hydrology & Infrastructure Analysis Platform**

<br>

![HydroGrid Demo](Previews/Demo.gif)

<br>

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)](https://vite.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r183-000000?style=flat&logo=three.js&logoColor=white)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)
[![HackED 2026](https://img.shields.io/badge/HackED-2026-orange?style=flat)](https://hacked.compeclub.com/)

[Live Demo](https://hydrogrid.app) · [Features](#features) · [Architecture](#architecture) · [Installation](#installation) · [Data Sources](#data-sources) · [Team](#team)

</div>

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
- Alberta flood mapping overlays (100-year, 200-year, 500-year return periods)
- Sourced from Alberta Environment ArcGIS FeatureServer

<div align="center">

**Flood Hazard Mapping**

<img src="Previews/Flood Hazard Preview.png" alt="Flood Hazard Preview" width="80%">

</div>

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

<div align="center">

**Property Assessment**

<img src="Previews/Property Assessment .png" alt="Property Assessment" width="80%">

</div>

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

<div align="center">

**Cost Analysis**

<img src="Previews/Cost Analysis.png" alt="Cost Analysis" width="80%">

</div>

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
 │ Air quality     │  │ River flow     │  │                │  │ (raster)    │
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

## APIs & Data Sources — Comprehensive Credit

> **All data is fetched at runtime from public APIs. No data is bundled with the application. No API keys are required — every endpoint used is open and free.**

---

### 1. City of Edmonton Open Data Portal (Socrata)

**Base URL:** `https://data.edmonton.ca/resource`
**Protocol:** Socrata Open Data API (SODA) — REST/JSON with SoQL query language
**Documentation:** [https://dev.socrata.com/](https://dev.socrata.com/) · [https://data.edmonton.ca](https://data.edmonton.ca)

| Dataset | Socrata ID | API Endpoint | Used In | Description |
|---------|-----------|--------------|---------|-------------|
| Neighbourhood Boundaries | `xu6q-xcmj` | `/xu6q-xcmj.json` | Map Layers (GeoJSON overlay) | Official 2019 neighbourhood boundary polygons for Edmonton |
| Building Permits | `24uj-dj8v` | `/24uj-dj8v.json` | Map Layers (point layer) | Recent building permits showing construction activity, type, value, and location |
| Property Assessments | `q7d6-ambg` | `/q7d6-ambg.json` | Map Layers, Property Lookup | Assessed property values, tax class, ward, and neighbourhood |
| Property Details | `dkk9-cj3x` | `/dkk9-cj3x.json` | Map Layers, Property Lookup, Engineering View | Lot size (m²), building area, zoning, year built, legal description — used for Rational Method site input |
| Subdivision Applications | `5mh4-z7dk` | `/5mh4-z7dk.json` | Map Layers (polygon overlay) | Residential subdivision applications in mature neighbourhoods |
| LRT Stations | `fhxi-cnhe` | `/fhxi-cnhe.json` | Map Layers (point layer), Property Lookup (nearby facilities) | All 36 LRT stations with stop names and numbers |
| Traffic Disruptions | `k4tx-5k8p` | `/k4tx-5k8p.json` | Map Layers (point layer) | Active road closures, construction, and travel delays |
| Recreation Facilities | `nz3t-vyg3` | `/nz3t-vyg3.json` | Map Layers (point layer), Property Lookup (nearby facilities) | City-owned recreation facilities including pools, arenas, community centres |
| Stormwater Facilities | `kiu8-nsmp` | `/kiu8-nsmp.json` | Map Layers (polygon overlay), Property Lookup (nearby facilities) | Storm water management ponds (wet/dry) from EPCOR and City drainage |
| Air Quality Stations | `44dx-d5qn` | `/44dx-d5qn.json` | Map Layers (point layer) | Air quality monitoring stations with daily readings from Alberta Capital Airshed |
| Water Filling Stations | `dj78-t8ab` | `/dj78-t8ab.json` | Map Layers (point layer) | Seasonal and year-round public water bottle filling stations |
| Drainage Pipes | `bh8y-pn5j` | `/bh8y-pn5j.json` | Drainage & Water tab | 133,000+ drainage pipe segments (Storm, Sanitary, Combined, Fnd Drain, Water) with geometry, type, and construction year |
| Manholes | `6waz-yxqq` | `/6waz-yxqq.json` | Drainage & Water tab | 106,000+ manhole locations with type, construction year, road name, and coordinates |

**Query techniques used:**
- `$select` — column projection to minimise payload size
- `$where` — spatial and attribute filtering (e.g. `latitude IS NOT NULL`, bounding-box queries for viewport loading)
- `$group` / `count(*)` — server-side aggregation for statistics (pipe/manhole counts by type and year)
- `$limit` / `$offset` — pagination for batch-fetching large datasets (pipes fetched in 50,000-record batches)
- `$order` — sorting by date, value, or Socrata row ID

---

### 2. Environment and Climate Change Canada (ECCC) — Meteorological Service

**Base URL:** `https://api.weather.gc.ca`
**Protocol:** OGC API — Features (OAFeat) — REST/GeoJSON
**Documentation:** [https://eccc-msc.github.io/open-data/msc-geomet/web-services_en/](https://eccc-msc.github.io/open-data/msc-geomet/web-services_en/)

| Collection | API Endpoint | Used In | Description |
|-----------|--------------|---------|-------------|
| Climate Stations | `/collections/climate-stations/items` | Map Layers, Precipitation Explorer | 1,500+ weather stations across Alberta — location, type, elevation, data period |
| Climate Daily | `/collections/climate-daily/items` | Map Layers, Precipitation Explorer | Daily precipitation, rain, snow, snow depth, and temperature observations |
| Climate Monthly | `/collections/climate-monthly/items` | Map Layers, Precipitation Explorer | Monthly precipitation totals, snowfall, temperature summaries |
| Climate Normals (Precipitation) | `/collections/climate-normals/items` (NORMAL_ID=56) | Map Layers | 30-year average annual precipitation depth (mm), 1981–2010 baseline |
| Climate Normals (Snowfall) | `/collections/climate-normals/items` (NORMAL_ID=54) | Map Layers | 30-year average annual snowfall depth (cm), 1981–2010 baseline |
| Hydrometric Stations | `/collections/hydrometric-stations/items` | Map Layers, Hydrometric View | River/lake water level and flow monitoring stations across Alberta |
| Hydrometric Monthly Mean | `/collections/hydrometric-monthly-mean/items` | Hydrometric View | Monthly mean river discharge (m³/s) time series |
| Hydrometric Annual Peaks | `/collections/hydrometric-annual-peaks/items` | Hydrometric View | Annual peak flow records for flood frequency analysis |

**Query parameters used:**
- `f=json` — GeoJSON response format
- `PROVINCE_CODE=AB` / `PROV_TERR_STATE_LOC=AB` — filter to Alberta stations
- `CLIMATE_IDENTIFIER` / `STATION_NUMBER` — station-specific queries
- `datetime=YYYY-MM-DD/YYYY-MM-DD` — date range filtering
- `sortby` — chronological ordering
- `properties` — field selection for payload reduction

---

### 3. Alberta Flood Mapping — ArcGIS FeatureServer

**Base URL:** `https://services.arcgis.com/wjcPoefzjpzCgffS/arcgis/rest/services/AlbertaFloodMapping_gdb/FeatureServer`
**Protocol:** Esri ArcGIS REST API — FeatureServer with JSON/GeoJSON output
**Documentation:** [https://floods.alberta.ca](https://floods.alberta.ca) · [ArcGIS REST API Reference](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)

| Layer ID | API Endpoint | Used In | Description |
|----------|--------------|---------|-------------|
| Layer 0 | `/FeatureServer/0` | Map Layers (Flood Hazard Areas) | Provincial flood hazard zones — floodway and flood fringe delineation |
| Layer 11 | `/FeatureServer/11` | Map Layers (100-Year Flood) | 1:100 year return period flood inundation extent (1% annual probability) |
| Layer 12 | `/FeatureServer/12` | Map Layers (200-Year Flood) | 1:200 year return period flood inundation extent (0.5% annual probability) |
| Layer 14 | `/FeatureServer/14` | Map Layers (500-Year Flood) | 1:500 year return period flood inundation extent (0.2% annual probability) |

**Query parameters used:**
- `f=geojson` — GeoJSON output format
- `where=1=1` — retrieve all features
- `outFields=*` — return all attribute columns
- `resultRecordCount` — pagination for large polygon datasets
- `geometry` / `geometryType` / `spatialRel` — spatial queries

---

### 4. Basemap Tile Providers

| Provider | Tile URL | Used For | License |
|----------|----------|----------|---------|
| **CARTO** (Dark) | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | Default dark basemap | [CARTO Attribution](https://carto.com/attributions) |
| **CARTO** (Voyager) | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` | Light basemap | [CARTO Attribution](https://carto.com/attributions) |
| **CARTO** (Labels) | `https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png` | Label overlay on satellite | [CARTO Attribution](https://carto.com/attributions) |
| **Esri** (World Imagery) | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Satellite basemap | [Esri Attribution](https://www.esri.com/) |
| **OpenTopoMap** | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` | Terrain basemap | [OpenTopoMap](https://opentopomap.org) (CC-BY-SA) |
| **OpenStreetMap** | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Street basemap | [ODbL](https://www.openstreetmap.org/copyright) |

---

### 5. Reference Data (Non-API)

| Source | Used In | Description |
|--------|---------|-------------|
| **ECCC IDF Curves** | Engineering View (Drainage Design) | Intensity-Duration-Frequency data for Edmonton design storms (2yr–100yr). Reference: [ECCC IDF Tool](https://climate-change.canada.ca/climate-data/#/short-duration-rainfall-intensity-idf). Values are embedded as constants derived from published tables. |
| **NASA Blue Marble** | Landing Page (3D Globe) | Earth colour texture (`earth_8k.jpg`), bump map, specular ocean map, and cloud layer. Bundled as static assets from [NASA Visible Earth](https://visibleearth.nasa.gov/collection/1484/blue-marble). |

---

### Summary

| Provider | # of Endpoints | Data Format | Auth Required |
|----------|---------------|-------------|---------------|
| City of Edmonton Open Data | 13 datasets | JSON (Socrata) | No |
| Environment Canada (ECCC) | 8 collections | GeoJSON (OGC API) | No |
| Alberta Flood Mapping (ArcGIS) | 4 layers | GeoJSON (ArcGIS REST) | No |
| Basemap Tile CDNs | 6 tile layers | Raster PNG tiles | No |
| **Total** | **31 unique data endpoints** | | |

All API calls are made client-side using the browser `fetch()` API. There is no backend server, no proxy, and no API keys. Every endpoint is publicly accessible.

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

### Clone and Install

```bash
git clone https://github.com/Sadat41/HydroGrid.git
cd HydroGrid/app
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
HydroGrid/
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

## Acknowledgements

This project was built in under 48 hours with the help of [Cursor](https://cursor.com) and [Claude](https://anthropic.com). What would have taken weeks of manual development was possible in a single weekend thanks to AI-assisted coding. The architecture, 10+ API integrations, analysis engine, 3D landing page, and full deployment were all completed during the HackED 2026 hackathon.

---

## License

MIT

---

*Built for HackED 2026 at the University of Alberta.*
