import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useLockedMapbox } from "../../hooks/useLockedMapbox";

import {
  addDataLayer,
  whenStyleReady,
  DEFAULT_MAP_STYLE,
} from "../../utils/mapboxBase";

import "mapbox-gl/dist/mapbox-gl.css";


const SCENARIOS = {
  continuity: {
    file: "/growth_continuity.geojson",
  },

  density: {
    file: "/growth_density.geojson",
  },

  overgrowth: {
    file: "/growth_overgrowth.geojson",
  },
};


const BASE_YEAR = 2024;
const END_YEAR = 2049;


// Shared scale used by ALL THREE maps.
//
// This is important:
// blue means the same amount of population growth
// whether we're looking at Continuity, Density,
// or Overgrowth.
const GROWTH_COLOR_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["get", "_visualGrowth"],

  0,
  "#2447ff",

  1,
  "#4161ff",

  2,
  "#6965ff",

  4,
  "#9b6dff",

  7,
  "#f07cc3",

  12,
  "#ff9fb0",

  20,
  "#ffd878",

  30,
  "#fff0ad",
];


const GROWTH_OPACITY_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["get", "_visualGrowth"],

  0,
  0,

  0.5,
  0.55,

  1,
  0.7,

  2,
  0.8,

  4,
  0.9,

  7,
  0.95,

  12,
  1,
];


function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}


// Estimate the population of each H3 cell
// for the selected year.
//
// The GeoJSON gives us:
// pop_2024
// pop_2049
//
// We interpolate between those endpoints.
function computeGrowthData(rawData, year) {
  const progress = clamp(
    (year - BASE_YEAR) /
      (END_YEAR - BASE_YEAR),
    0,
    1
  );

  return {
    ...rawData,

    features: rawData.features.map((feature) => {
      const properties =
        feature.properties ?? {};

      const startPopulation = Number(
        properties.pop_2024 ?? 0
      );

      const endPopulation = Number(
        properties.pop_2049 ?? 0
      );

      const population =
        startPopulation +
        (endPopulation - startPopulation) *
          progress;

      const growth = Math.max(
        0,
        population - startPopulation
      );
      // Stretch smaller and medium growth differences visually.
    // Every scenario uses the exact same transformation.
    const visualGrowth = Math.sqrt(growth);

      return {
        ...feature,

        properties: {
          ...properties,

          _population: population,

          // Non-buildable cells should not
          // appear as future development.
          _growth:
        properties.buildable === false
            ? 0
            : growth,

        _visualGrowth:
        properties.buildable === false
            ? 0
            : visualGrowth,
        },
      };
    }),
  };
}


export default function ScenarioGrowthMap({
  scenario,
  selectedYear,
  mapStyle = DEFAULT_MAP_STYLE,
}) {
  const containerRef = useRef(null);

  const rawDataRef = useRef(null);

  const yearRef = useRef(selectedYear);

  const [error, setError] =
    useState(false);


  const config = SCENARIOS[scenario];

  const sourceId =
    `story-${scenario}-scenario-growth`;

  const layerId =
    `story-${scenario}-scenario-growth-layer`;


  // Add the scenario layer if it doesn't
  // exist yet, or update its data if it does.
  const addOverlay = useCallback(
    (map) => {
      if (!rawDataRef.current) return;

      const data = computeGrowthData(
        rawDataRef.current,
        yearRef.current
      );


      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data,
        });
      } else {
        map
          .getSource(sourceId)
          .setData(data);
      }


      if (!map.getLayer(layerId)) {
        addDataLayer(map, {
          id: layerId,

          type: "fill",

          source: sourceId,

          paint: {
            "fill-color":
              GROWTH_COLOR_EXPRESSION,

            "fill-opacity":
              GROWTH_OPACITY_EXPRESSION,

            "fill-outline-color":
              "rgba(255,255,255,0.05)",
          },
        });
      }
    },

    [
      layerId,
      sourceId,
    ]
  );


  const { mapRef } =
    useLockedMapbox(
      containerRef,
      mapStyle,
      addOverlay
    );


  // Load this scenario's GeoJSON once.
  useEffect(() => {
    const controller =
      new AbortController();


    fetch(config.file, {
      signal: controller.signal,
    })

      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Could not load ${config.file}: ${response.status}`
          );
        }

        return response.json();
      })

      .then((data) => {
        rawDataRef.current = data;

        whenStyleReady(
          mapRef.current,
          () => {
            addOverlay(mapRef.current);
          }
        );
      })

      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(
            `Failed to load ${scenario} scenario map:`,
            err
          );

          setError(true);
        }
      });


    return () => {
      controller.abort();
    };
  }, [
    addOverlay,
    config.file,
    mapRef,
    scenario,
  ]);


  // Update the map whenever the shared
  // year slider changes.
  useEffect(() => {
    yearRef.current = selectedYear;

    const map = mapRef.current;

    if (!map) return;


    whenStyleReady(
      map,
      () => {
        if (!rawDataRef.current) return;

        addOverlay(map);
      }
    );
  }, [
    selectedYear,
    addOverlay,
    mapRef,
  ]);


  return (
    <div className="story-scenario-growth-map">

      <div
        ref={containerRef}
        className="story-scenario-growth-map-canvas"
      />


      <div className="story-scenario-map-year">
        {selectedYear}
      </div>


      {error && (
        <div className="story-scenario-map-error">
          Scenario map could not be loaded.
        </div>
      )}

    </div>
  );
}