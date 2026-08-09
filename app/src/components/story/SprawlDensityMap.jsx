import { useCallback, useEffect, useRef, useState } from "react";

import { useLockedMapbox } from "../../hooks/useLockedMapbox";
import {
  addDataLayer,
  whenStyleReady,
  DEFAULT_MAP_STYLE,
} from "../../utils/mapboxBase";

import "mapbox-gl/dist/mapbox-gl.css";


const SCENARIOS = {
  overgrowth: {
    file: "/growth_overgrowth.geojson",
    color: "#bd0638",
  },

  density: {
    file: "/growth_density.geojson",
    color: "#eab308",
  },
};


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}


function computePopulationData(rawData, targetPopulation) {
  const total2024 = rawData.features.reduce(
    (sum, feature) =>
      sum + Number(feature.properties?.pop_2024 ?? 0),
    0
  );

  const total2049 = rawData.features.reduce(
    (sum, feature) =>
      sum + Number(feature.properties?.pop_2049 ?? 0),
    0
  );

  const progress =
    total2049 === total2024
      ? 0
      : clamp(
          (targetPopulation - total2024) /
            (total2049 - total2024),
          0,
          1
        );


  const populations = rawData.features.map((feature) => {
    const start =
      Number(feature.properties?.pop_2024 ?? 0);

    const end =
      Number(feature.properties?.pop_2049 ?? 0);

    return start + (end - start) * progress;
  });


  const maxPopulation = Math.max(
    1,
    ...populations
  );


  return {
    ...rawData,

    features: rawData.features.map(
      (feature, index) => {
        const population = populations[index];

        const alpha =
          population <= 0
            ? 0
            : 0.15 +
              0.75 *
                (
                  Math.log1p(population) /
                  Math.log1p(maxPopulation)
                );

        return {
          ...feature,

          properties: {
            ...feature.properties,

            _population: population,

            _alpha: alpha,
          },
        };
      }
    ),
  };
}


function formatAccess(access) {
  if (access == null) return "—";

  return access.toFixed(3);
}


export default function SprawlDensityMap({
  scenario,
  targetPopulation,
  access,
  mapStyle = DEFAULT_MAP_STYLE,
}) {
  const containerRef = useRef(null);

  const rawDataRef = useRef(null);
  const targetPopulationRef =
    useRef(targetPopulation);

  const [error, setError] = useState(false);

  const config = SCENARIOS[scenario];

  const sourceId =
    `story-${scenario}-population`;

  const layerId =
    `story-${scenario}-population-layer`;


  const addOverlay = useCallback(
    (map) => {
      if (!rawDataRef.current) return;

      const data = computePopulationData(
        rawDataRef.current,
        targetPopulationRef.current
      );


      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data,
        });
      } else {
        map.getSource(sourceId).setData(data);
      }


      if (!map.getLayer(layerId)) {
        addDataLayer(map, {
          id: layerId,

          type: "fill",

          source: sourceId,

          paint: {
            "fill-color": config.color,

            "fill-opacity": [
              "get",
              "_alpha",
            ],

            "fill-outline-color":
              config.color,
          },
        });
      }
    },

    [
      config.color,
      layerId,
      sourceId,
    ]
  );


  const { mapRef } = useLockedMapbox(
    containerRef,
    mapStyle,
    addOverlay
  );


  useEffect(() => {
    const controller =
      new AbortController();

    fetch(config.file, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Could not load ${config.file}`
          );
        }

        return response.json();
      })

      .then((data) => {
        rawDataRef.current = data;

        whenStyleReady(
          mapRef.current,
          () => addOverlay(mapRef.current)
        );
      })

      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(
            `Failed to load ${scenario} map:`,
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


  useEffect(() => {
    targetPopulationRef.current =
      targetPopulation;

    const map = mapRef.current;

    if (
      !map ||
      !map.isStyleLoaded() ||
      !rawDataRef.current
    ) {
      return;
    }

    addOverlay(map);
  }, [
    targetPopulation,
    addOverlay,
    mapRef,
  ]);


  const accessWidth =
    `${clamp((access ?? 0) * 100, 0, 100)}%`;


  return (
    <div className="story-sprawl-density-map">

      <div
        ref={containerRef}
        className="story-sprawl-density-map-canvas"
      />


      <div className="story-map-access-indicator">

        <div className="story-map-access-heading">
          <span>Access</span>

          <strong>
            {formatAccess(access)}
          </strong>
        </div>


        <div className="story-map-access-track">
          <div
            className="story-map-access-fill"
            style={{
              width: accessWidth,
              background: config.color,
            }}
          />
        </div>

      </div>


      {error && (
        <div className="story-sprawl-density-error">
          Scenario map could not be loaded.
        </div>
      )}

    </div>
  );
}