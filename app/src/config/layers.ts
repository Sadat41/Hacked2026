import type { LayerConfig } from "../types";

const EDMONTON_API = "https://data.edmonton.ca/resource";

export const LAYER_CONFIGS: LayerConfig[] = [
  {
    id: "drainage",
    name: "Stormwater Facilities",
    description:
      "Storm water management facilities including wet/dry ponds across Edmonton. Data from EPCOR and City of Edmonton drainage services.",
    category: "environment",
    endpoint: `${EDMONTON_API}/kiu8-nsmp.json?$limit=500`,
    type: "polygon",
    style: {
      color: "#38bdf8",
      weight: 2,
      opacity: 0.8,
      fillColor: "#0ea5e9",
      fillOpacity: 0.3,
    },
    maxFeatures: 500,
    popupFields: [
      { key: "description", label: "Name" },
      { key: "storm_type", label: "Type" },
      { key: "facility_owner", label: "Owner" },
      { key: "year", label: "Year Built", format: "year" },
      { key: "neighbourhood_name", label: "Neighbourhood" },
      { key: "ward", label: "Ward" },
    ],
    enabled: true,
  },
  {
    id: "permits",
    name: "Building Permits",
    description:
      "Recent building permits issued by the City of Edmonton, showing construction activity and development patterns.",
    category: "infrastructure",
    endpoint: `${EDMONTON_API}/24uj-dj8v.json?$limit=800&$where=latitude IS NOT NULL&$order=issue_date DESC`,
    type: "point",
    style: {
      color: "#f97316",
      weight: 1,
      opacity: 0.9,
      fillColor: "#fb923c",
      fillOpacity: 0.7,
    },
    pointColor: "#f97316",
    pointRadius: 5,
    maxFeatures: 800,
    popupFields: [
      { key: "job_description", label: "Description" },
      { key: "job_category", label: "Category" },
      { key: "work_type", label: "Work Type" },
      { key: "building_type", label: "Building Type" },
      {
        key: "construction_value",
        label: "Construction Value",
        format: "currency",
      },
      { key: "address", label: "Address" },
      { key: "neighbourhood", label: "Neighbourhood" },
      { key: "issue_date", label: "Issue Date" },
    ],
    enabled: false,
  },
  {
    id: "properties",
    name: "Property Assessments",
    description:
      "Property assessment values across Edmonton. Useful for understanding land value distribution and urban density.",
    category: "infrastructure",
    endpoint: `${EDMONTON_API}/q7d6-ambg.json?$limit=1000&$where=latitude IS NOT NULL&$order=assessed_value DESC`,
    type: "point",
    style: {
      color: "#a855f7",
      weight: 1,
      opacity: 0.9,
      fillColor: "#c084fc",
      fillOpacity: 0.6,
    },
    pointColor: "#a855f7",
    pointRadius: 4,
    maxFeatures: 1000,
    popupFields: [
      { key: "street_name", label: "Address" },
      { key: "assessed_value", label: "Assessed Value", format: "currency" },
      { key: "tax_class", label: "Tax Class" },
      { key: "neighbourhood", label: "Neighbourhood" },
      { key: "ward", label: "Ward" },
      { key: "garage", label: "Garage" },
    ],
    enabled: false,
  },
  {
    id: "neighbourhoods",
    name: "Neighbourhood Boundaries",
    description:
      "Official City of Edmonton neighbourhood boundaries (2019). Provides spatial context for all other data layers.",
    category: "infrastructure",
    endpoint: `${EDMONTON_API}/xu6q-xcmj.json?$limit=500`,
    type: "geojson",
    style: {
      color: "#6ee7b7",
      weight: 1.5,
      opacity: 0.5,
      fillColor: "#34d399",
      fillOpacity: 0.05,
    },
    maxFeatures: 500,
    popupFields: [
      { key: "descriptiv", label: "Name" },
      { key: "neighbourh", label: "ID" },
    ],
    enabled: false,
  },
];

export const EDMONTON_CENTER: [number, number] = [53.5461, -113.4938];
export const DEFAULT_ZOOM = 11;

export const CATEGORY_META = {
  infrastructure: { label: "Infrastructure", icon: "building" },
  environment: { label: "Environment", icon: "leaf" },
  energy: { label: "Energy & Mining", icon: "bolt" },
} as const;
