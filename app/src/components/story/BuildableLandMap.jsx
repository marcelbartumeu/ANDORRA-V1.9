import { useCallback, useEffect, useRef, useState } from "react";

import { useLockedMapbox } from "../../hooks/useLockedMapbox";
import {
  addDataLayer,
  whenStyleReady,
  DEFAULT_MAP_STYLE,
} from "../../utils/mapboxBase";

import "mapbox-gl/dist/mapbox-gl.css";

const LAYERS = {
  buildable: "story-buildable-land",
  protected: "story-protected-land",
  slope: "story-slope-constraints",
  built: "story-existing-built",
  remaining: "story-remaining-buildable",
};


// Controls how visible each layer is at each stage.
const STAGE_OPACITY = [
  // Stage 0: total country
  {
    buildable: 0,
    protected: 0,
    slope: 0,
    built: 0,
    remaining: 0,
  },

  // Stage 1: protected land
  {
    buildable: 0,
    protected: 0.6,
    slope: 0,
    built: 0,
    remaining: 0,
  },

  // Stage 2: slope constraints + resulting buildable cells
  {
    buildable: 0.28,
    protected: 0.55,
    slope: 0.6,
    built: 0,
    remaining: 0,
  },

  // Stage 3: existing built land
  {
    buildable: 0.18,
    protected: 0.28,
    slope: 0.32,
    built: 0.8,
    remaining: 0,
  },

  // Stage 4: remaining buildable land
  {
    buildable: 0.06,
    protected: 0.12,
    slope: 0.14,
    built: 0.22,
    remaining: 0.9,
  },
];


function featureCollection(features = []) {
  return {
    type: "FeatureCollection",
    features,
  };
}


async function fetchGeoJSON(url, signal) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }

  return response.json();
}


function addFillLayer(map, id, data, color) {
  if (!data) return;

  if (!map.getSource(id)) {
    map.addSource(id, {
      type: "geojson",
      data,
    });
  }

  if (!map.getLayer(id)) {
    addDataLayer(map, {
      id,
      type: "fill",
      source: id,

      layout: {
        visibility: "none",
      },

      paint: {
        "fill-color": color,
        "fill-opacity": 0,
        "fill-outline-color": color,
      },
    });
  }
}


function applyStage(map, stage) {
  const safeStage = Math.max(
    0,
    Math.min(stage, STAGE_OPACITY.length - 1)
  );

  const opacity = STAGE_OPACITY[safeStage];

  Object.entries(LAYERS).forEach(([name, layerId]) => {
    if (!map.getLayer(layerId)) return;

    const layerOpacity = opacity[name] ?? 0;

    map.setLayoutProperty(
      layerId,
      "visibility",
      layerOpacity > 0 ? "visible" : "none"
    );

    map.setPaintProperty(
      layerId,
      "fill-opacity",
      layerOpacity
    );
  });
}


export default function BuildableLandMap({
  stage = 0,
  mapStyle = DEFAULT_MAP_STYLE,
}) {
  const containerRef = useRef(null);
  const mapDataRef = useRef(null);
  const stageRef = useRef(stage);

  const [error, setError] = useState(false);


  const addOverlays = useCallback((map) => {
    const data = mapDataRef.current;

    if (!data) return;

    // Add lower/background layers first.
    addFillLayer(
      map,
      LAYERS.buildable,
      data.buildable,
      "#2563eb"
    );

    addFillLayer(
      map,
      LAYERS.protected,
      data.protected,
      "#166534"
    );

    addFillLayer(
      map,
      LAYERS.slope,
      data.slope,
      "#7c2d12"
    );

    addFillLayer(
      map,
      LAYERS.built,
      data.built,
      "#9333ea"
    );

    // Remaining land sits on top so it becomes the final focus.
    addFillLayer(
      map,
      LAYERS.remaining,
      data.remaining,
      "#fbbf24"
    );

    applyStage(map, stageRef.current);
  }, []);


  const { mapRef } = useLockedMapbox(
    containerRef,
    mapStyle,
    addOverlays
  );


  // Load and prepare all  map data.
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchGeoJSON(
        "/growth_constraints.geojson",
        controller.signal
      ),

      fetchGeoJSON(
        "/model/andorra_protected_areas.geojson",
        controller.signal
      ),

      fetchGeoJSON(
        "/model/accessibility_population.geojson",
        controller.signal
      ),

      fetchGeoJSON(
        "/growth_density.geojson",
        controller.signal
      ),
    ])
      .then(([
        constraints,
        protectedAreas,
        population,
        growth,
      ]) => {

        // Existing occupied H3 cells.
        const builtFeatures =
          population.features.filter((feature) => {
            return Number(
              feature.properties?.population ?? 0
            ) > 0;
          });


        const builtH3Cells = new Set(
          builtFeatures
            .map(
              (feature) =>
                feature.properties?.h3_cell
            )
            .filter(Boolean)
        );


        // Physically buildable cells.
        const buildableFeatures =
          growth.features.filter((feature) => {
            return (
              feature.properties?.buildable === true
            );
          });


        // Buildable cells that are not already occupied.
        const remainingFeatures =
          buildableFeatures.filter((feature) => {
            const h3Cell =
              feature.properties?.h3_cell;

            return (
              h3Cell &&
              !builtH3Cells.has(h3Cell)
            );
          });


        // Non-protected constraint cells represent
        // slope / altitude limitations.
        const slopeFeatures =
          constraints.features.filter((feature) => {
            return (
              feature.properties?.protected !== true
            );
          });


        mapDataRef.current = {
          protected: protectedAreas,

          slope: featureCollection(
            slopeFeatures
          ),

          built: featureCollection(
            builtFeatures
          ),

          buildable: featureCollection(
            buildableFeatures
          ),

          remaining: featureCollection(
            remainingFeatures
          ),
        };


        whenStyleReady(
          mapRef.current,
          () => {
            addOverlays(mapRef.current);
          }
        );
      })

      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(
            "Failed to load buildable-land data:",
            err
          );

          setError(true);
        }
      });


    return () => {
      controller.abort();
    };
  }, [addOverlays, mapRef]);


// Change / restore map overlays whenever the story stage changes.
useEffect(() => {
  stageRef.current = stage;

  const map = mapRef.current;

  if (!map) return;

  whenStyleReady(map, () => {
    if (!mapDataRef.current) return;

    // Important:
    // Make sure the sources/layers actually exist before
    // trying to change their visibility.
    addOverlays(map);
  });
}, [stage, addOverlays, mapRef]);


  return (
    <div className="story-buildable-map">
      <div
        ref={containerRef}
        className="story-buildable-map-canvas"
      />

      {error && (
        <div className="story-buildable-map-error">
          Buildable-land data could not be loaded.
        </div>
      )}
    </div>
  );
}