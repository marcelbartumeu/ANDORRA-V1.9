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

import {
  hideStoryFrameCorners,
} from "./StoryMapUtils";


/*
  These colors are exported so the map AND
  the clickable paragraph use the exact same colors.
*/
export const BUILDABLE_LAND_COLORS = {
  buildable: "#8b949e",
  protected: "#2f8f57",
  slope: "#2563eb",
  built: "#a93446",
  remaining: "#e3b341",
};


const LAYERS = {
  buildable:
    "story-buildable-land",

  protected:
    "story-protected-land",

  slope:
    "story-slope-constraints",

  built:
    "story-existing-built",

  remaining:
    "story-remaining-buildable",
};


/*
  Controls how visible each layer is
  at each story stage.

  Stage 0 = plain total land
  Stage 1 = protected land
  Stage 2 = steep terrain
  Stage 3 = existing built land
  Stage 4 = remaining buildable land
*/
const STAGE_OPACITY = [
  {
    buildable: 0,
    protected: 0,
    slope: 0,
    built: 0,
    remaining: 0,
  },

  {
    buildable: 0,
    protected: 0.62,
    slope: 0,
    built: 0,
    remaining: 0,
  },

  {
    buildable: 0.22,
    protected: 0.32,
    slope: 0.68,
    built: 0,
    remaining: 0,
  },

  {
    buildable: 0.14,
    protected: 0.18,
    slope: 0.2,
    built: 0.82,
    remaining: 0,
  },

  {
    buildable: 0.05,
    protected: 0.08,
    slope: 0.09,
    built: 0.16,
    remaining: 0.92,
  },
];


function featureCollection(
  features = []
) {
  return {
    type: "FeatureCollection",
    features,
  };
}


async function fetchGeoJSON(
  url,
  signal
) {
  const response =
    await fetch(
      url,
      {
        signal,
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Could not load ${url}: ${response.status}`
    );
  }

  return response.json();
}


function addFillLayer(
  map,
  id,
  data,
  color
) {
  if (
    !data
  ) {
    return;
  }


  if (
    !map.getSource(
      id
    )
  ) {
    map.addSource(
      id,
      {
        type: "geojson",
        data,
      }
    );
  }


  if (
    !map.getLayer(
      id
    )
  ) {
    addDataLayer(
      map,
      {
        id,

        type: "fill",

        source: id,

        layout: {
          visibility:
            "none",
        },

        paint: {
          "fill-color":
            color,

          "fill-opacity":
            0,

          "fill-outline-color":
            color,
        },
      }
    );
  }
}


function applyStage(
  map,
  stage
) {
  const safeStage =
    Math.max(
      0,
      Math.min(
        stage,
        STAGE_OPACITY.length -
          1
      )
    );


  const opacity =
    STAGE_OPACITY[
      safeStage
    ];


  Object.entries(
    LAYERS
  ).forEach(
    ([
      name,
      layerId,
    ]) => {
      if (
        !map.getLayer(
          layerId
        )
      ) {
        return;
      }


      const layerOpacity =
        opacity[
          name
        ] ?? 0;


      map.setLayoutProperty(
        layerId,
        "visibility",
        layerOpacity > 0
          ? "visible"
          : "none"
      );


      map.setPaintProperty(
        layerId,
        "fill-opacity",
        layerOpacity
      );
    }
  );
}


export default function BuildableLandMap({
  stage = 0,
  mapStyle = DEFAULT_MAP_STYLE,
}) {
  const containerRef =
    useRef(null);


  const mapDataRef =
    useRef(null);


  const stageRef =
    useRef(stage);


  const [
    error,
    setError,
  ] = useState(
    false
  );


  /*
    This function is still responsible
    for restoring all overlays whenever
    Mapbox reloads its style.
  */
  const addOverlays = useCallback((map) => {

  /*
    Hide the shared frame's red corner markers immediately,
    even before the async buildable-land data has loaded.
  */
  hideStoryFrameCorners(map);

  const data = mapDataRef.current;

  if (!data) return;


        /*
          Neutral background buildable cells.

          This is intentionally neutral now
          so STEEP TERRAIN can own blue.
        */
        addFillLayer(
          map,
          LAYERS.buildable,
          data.buildable,
          BUILDABLE_LAND_COLORS.buildable
        );


        /*
          PROTECTED LAND
          Green
        */
        addFillLayer(
          map,
          LAYERS.protected,
          data.protected,
          BUILDABLE_LAND_COLORS.protected
        );


        /*
          STEEP TERRAIN
          Blue
        */
        addFillLayer(
          map,
          LAYERS.slope,
          data.slope,
          BUILDABLE_LAND_COLORS.slope
        );


        /*
          EXISTING BUILT LAND
          Dark red
        */
        addFillLayer(
          map,
          LAYERS.built,
          data.built,
          BUILDABLE_LAND_COLORS.built
        );


        /*
          REMAINING BUILDABLE LAND
          Gold / yellow
        */
        addFillLayer(
          map,
          LAYERS.remaining,
          data.remaining,
          BUILDABLE_LAND_COLORS.remaining
        );


        applyStage(
          map,
          stageRef.current
        );


        hideStoryFrameCorners(
          map
        );
      },
      []
    );


  const {
    mapRef,
  } =
    useLockedMapbox(
      containerRef,
      mapStyle,
      addOverlays
    );


  /*
    Load and prepare the exact same
    underlying data sources as before.
  */
  useEffect(
    () => {
      const controller =
        new AbortController();


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

        .then(
          ([
            constraints,
            protectedAreas,
            population,
            growth,
          ]) => {

            /*
              Existing occupied H3 cells.
            */
            const builtFeatures =
              population.features.filter(
                (
                  feature
                ) => {
                  return (
                    Number(
                      feature
                        .properties
                        ?.population ??
                        0
                    ) >
                    0
                  );
                }
              );


            const builtH3Cells =
              new Set(
                builtFeatures
                  .map(
                    (
                      feature
                    ) =>
                      feature
                        .properties
                        ?.h3_cell
                  )
                  .filter(
                    Boolean
                  )
              );


            /*
              Physically buildable cells.
            */
            const buildableFeatures =
              growth.features.filter(
                (
                  feature
                ) => {
                  return (
                    feature
                      .properties
                      ?.buildable ===
                    true
                  );
                }
              );


            /*
              Buildable cells that are
              not already occupied.
            */
            const remainingFeatures =
              buildableFeatures.filter(
                (
                  feature
                ) => {
                  const h3Cell =
                    feature
                      .properties
                      ?.h3_cell;


                  return (
                    h3Cell &&
                    !builtH3Cells.has(
                      h3Cell
                    )
                  );
                }
              );


            /*
              Non-protected constraint cells
              represent slope / altitude
              limitations.
            */
            const slopeFeatures =
              constraints.features.filter(
                (
                  feature
                ) => {
                  return (
                    feature
                      .properties
                      ?.protected !==
                    true
                  );
                }
              );


            mapDataRef.current =
              {
                protected:
                  protectedAreas,

                slope:
                  featureCollection(
                    slopeFeatures
                  ),

                built:
                  featureCollection(
                    builtFeatures
                  ),

                buildable:
                  featureCollection(
                    buildableFeatures
                  ),

                remaining:
                  featureCollection(
                    remainingFeatures
                  ),
              };


            whenStyleReady(
              mapRef.current,
              () => {
                addOverlays(
                  mapRef.current
                );
              }
            );
          }
        )

        .catch(
          (
            err
          ) => {
            if (
              err.name !==
              "AbortError"
            ) {
              console.error(
                "Failed to load buildable-land data:",
                err
              );


              setError(
                true
              );
            }
          }
        );


      return () => {
        controller.abort();
      };
    },
    [
      addOverlays,
      mapRef,
    ]
  );


  /*
    Restore / update overlays whenever
    the selected story stage changes.
  */
  useEffect(
    () => {
      stageRef.current =
        stage;


      const map =
        mapRef.current;


      if (
        !map
      ) {
        return;
      }


      whenStyleReady(
        map,
        () => {
          if (
            !mapDataRef.current
          ) {
            return;
          }


          /*
            This ensures the layers exist
            before changing visibility.
          */
          addOverlays(
            map
          );
        }
      );
    },
    [
      stage,
      addOverlays,
      mapRef,
    ]
  );


  return (
    <div className="story-buildable-map">

      <div
        ref={
          containerRef
        }
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