import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLockedMapbox,
} from "../../hooks/useLockedMapbox";

import {
  addDataLayer,
  whenStyleReady,
  DEFAULT_MAP_STYLE,
} from "../../utils/mapboxBase";

import "mapbox-gl/dist/mapbox-gl.css";

import {
  hideStoryFrameCorners,
} from "./StoryMapUtils";


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

  degrowth: {
    file: "/growth_degrowth.geojson",
  },
};


const DATA_BASE_YEAR = 2024;
const START_YEAR = 2026;
const END_YEAR = 2049;


function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}


function mixColor(
  a,
  b,
  t
) {
  return [
    Math.round(
      a[0] +
        (b[0] - a[0]) * t
    ),

    Math.round(
      a[1] +
        (b[1] - a[1]) * t
    ),

    Math.round(
      a[2] +
        (b[2] - a[2]) * t
    ),
  ];
}


function growthColor(
  magnitude
) {
  const dark = [
    25,
    25,
    25,
  ];

  const middle = [
    150,
    150,
    150,
  ];

  const pale = [
    255,
    255,
    255,
  ];


  const t =
    clamp(
      magnitude / 80,
      0,
      1
    );


  let rgb;


  if (
    t < 0.5
  ) {
    rgb =
      mixColor(
        dark,
        middle,
        t * 2
      );
  } else {
    rgb =
      mixColor(
        middle,
        pale,
        (t - 0.5) * 2
      );
  }


  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}


function estimate2026Population(
  pop2024,
  pop2049
) {
  const progress =
    (
      START_YEAR -
      DATA_BASE_YEAR
    ) /
    (
      END_YEAR -
      DATA_BASE_YEAR
    );


  return (
    pop2024 +
    (
      pop2049 -
      pop2024
    ) *
      progress
  );
}


function computeGrowthData(
  rawData,
  year
) {
  const yearProgress =
    clamp(
      (
        year -
        START_YEAR
      ) /
        (
          END_YEAR -
          START_YEAR
        ),
      0,
      1
    );


  return {
    ...rawData,

    features:
      rawData.features.map(
        (
          feature
        ) => {
          const properties =
            feature.properties ??
            {};


          const pop2024 =
            Number(
              properties.pop_2024 ??
                0
            );


          const pop2049 =
            Number(
              properties.pop_2049 ??
                0
            );


          const pop2026 =
            estimate2026Population(
              pop2024,
              pop2049
            );


          const finalChange =
            pop2049 -
            pop2026;


          const currentChange =
            finalChange *
            yearProgress;


          const shouldShow =
            properties.buildable !==
              false &&
            Math.abs(currentChange) >=
              0.01;


          if (
            !shouldShow
          ) {
            return {
              ...feature,

              properties: {
                ...properties,

                _lineColor:
                  "#191919",

                _lineOpacity:
                  0,

                _lineWidth:
                  0.5,
              },
            };
          }


          const magnitude =
            Math.sqrt(
              Math.abs(
                currentChange
              )
            ) * 6;


          const lineColor =
  currentChange < 0
    ? "#191919"
    : growthColor(
        magnitude
      );


          const lineOpacity =
            clamp(
              0.4 +
                yearProgress *
                  0.5,
              0.4,
              0.9
            );


          const lineWidth =
            clamp(
              0.65 +
                magnitude /
                  45,
              0.65,
              1.6
            );


          return {
            ...feature,

            properties: {
              ...properties,

              _growthSince2026:
                currentChange,

              _lineColor:
                lineColor,

              _lineOpacity:
                lineOpacity,

              _lineWidth:
                lineWidth,
            },
          };
        }
      ),
  };
}


export default function ScenarioGrowthMap({
  scenario,
  selectedYear,
  mapStyle = DEFAULT_MAP_STYLE,
}) {
  const containerRef =
    useRef(null);

  const rawDataRef =
    useRef(null);

  const yearRef =
    useRef(selectedYear);

  const [
    error,
    setError,
  ] =
    useState(false);


  const config =
    SCENARIOS[scenario];


  const sourceId =
    `story-${scenario}-scenario-growth`;


  const layerId =
    `story-${scenario}-scenario-growth-lines`;


  const addOverlay =
    useCallback(
      (
        map
      ) => {
        hideStoryFrameCorners(
          map
        );


        if (
          !rawDataRef.current
        ) {
          return;
        }


        const data =
          computeGrowthData(
            rawDataRef.current,
            yearRef.current
          );


        if (
          !map.getSource(
            sourceId
          )
        ) {
          map.addSource(
            sourceId,
            {
              type: "geojson",
              data,
            }
          );
        } else {
          map
            .getSource(
              sourceId
            )
            .setData(
              data
            );
        }


        /*
          IMPORTANT:
          Use a LINE layer.

          We have experimentally proven
          that the H3 boundaries render
          reliably across a hard refresh.
        */
        if (
          !map.getLayer(
            layerId
          )
        ) {
          addDataLayer(
            map,
            {
              id: layerId,

              type: "line",

              source: sourceId,

              layout: {
                visibility:
                  "visible",

                "line-join":
                  "round",

                "line-cap":
                  "round",
              },

              paint: {
                "line-color": [
                  "get",
                  "_lineColor",
                ],

                "line-opacity": [
                  "get",
                  "_lineOpacity",
                ],

                "line-width": [
                  "get",
                  "_lineWidth",
                ],
              },
            }
          );
        }


        hideStoryFrameCorners(
          map
        );
      },

      [
        layerId,
        sourceId,
      ]
    );


  const {
    mapRef,
  } =
    useLockedMapbox(
      containerRef,
      mapStyle,
      addOverlay
    );


  /*
    Load spatial scenario data once.
  */
  useEffect(
    () => {
      const controller =
        new AbortController();


      setError(false);


      fetch(
        config.file,
        {
          signal:
            controller.signal,
        }
      )

        .then(
          (
            response
          ) => {
            if (
              !response.ok
            ) {
              throw new Error(
                `Could not load ${config.file}: ${response.status}`
              );
            }


            return response.json();
          }
        )

        .then(
          (
            data
          ) => {
            rawDataRef.current =
              data;


            whenStyleReady(
              mapRef.current,
              () => {
                const map =
                  mapRef.current;


                if (
                  map
                ) {
                  addOverlay(
                    map
                  );
                }
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
                `Failed to load ${scenario} scenario map:`,
                err
              );


              setError(true);
            }
          }
        );


      return () => {
        controller.abort();
      };
    },

    [
      addOverlay,
      config.file,
      mapRef,
      scenario,
    ]
  );


  /*
    Shared scenario year slider.
  */
  useEffect(
    () => {
      yearRef.current =
        selectedYear;


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
            !rawDataRef.current
          ) {
            return;
          }


          addOverlay(
            map
          );
        }
      );
    },

    [
      selectedYear,
      addOverlay,
      mapRef,
    ]
  );


  return (
    <div className="story-scenario-growth-map">

      <div
        ref={
          containerRef
        }
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