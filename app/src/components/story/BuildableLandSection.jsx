import {
  useState,
} from "react";

import BuildableLandMap, {
  BUILDABLE_LAND_COLORS,
} from "./BuildableLandMap";


const CONSTRAINTS = [
  {
    stage: 1,

    label:
      "Protected land",

    color:
      BUILDABLE_LAND_COLORS.protected,

    sentence:
      "removes large areas from future development.",
  },

  {
    stage: 2,

    label:
      "Steep terrain",

    color:
      BUILDABLE_LAND_COLORS.slope,

    sentence:
      "further narrows where growth can safely occur.",
  },

  {
    stage: 3,

    label:
      "Existing built land",

    color:
      BUILDABLE_LAND_COLORS.built,

    sentence:
      "has already consumed part of the country’s limited developable footprint.",
  },

  {
    stage: 4,

    label:
      "Remaining buildable land",

    color:
      BUILDABLE_LAND_COLORS.remaining,

    sentence:
      "shows what is realistically left for future growth.",
  },
];


const LAND_METRICS = [
  "468 km² total",
  "~30 km² built",
  "~40 km² remaining",
];


export default function BuildableLandSection({
  step,
}) {
  const [
    stage,
    setStage,
  ] = useState(
    0
  );


  /*
    Stages 0–2:
    keep TOTAL LAND as the highlighted context.

    Stage 3:
    highlight EXISTING BUILT LAND.

    Stage 4:
    highlight REMAINING BUILDABLE LAND.
  */
  const activeMetricIndex =
    stage === 3
      ? 1
      : stage === 4
        ? 2
        : 0;


  return (
    <div className="story-buildable-layout">

      {/* LEFT — MAP */}

      <div className="story-buildable-map-column">

        <div
          id="story-buildable-map"
          className="story-map-card story-buildable-map-card"
        >
          <BuildableLandMap
            stage={
              stage
            }
          />
        </div>

      </div>


      {/* RIGHT — CLICKABLE NARRATIVE */}

      <div className="story-buildable-panel">

        <div className="story-buildable-inline-copy">

          <p className="story-buildable-inline-instruction">

            <strong>
              Click the highlighted terms
            </strong>{" "}

            below to see how each constraint reshapes the map.

          </p>


          <p className="story-buildable-inline-paragraph">

            {CONSTRAINTS.map(
              (
                constraint,
                index
              ) => {
                const isActive =
                  stage ===
                  constraint.stage;


                return (
                  <span
                    key={
                      constraint.label
                    }
                    className="story-buildable-inline-clause"
                  >

                    <button
                      type="button"
                      className={
                        `story-buildable-inline-control${
                          isActive
                            ? " is-active"
                            : ""
                        }`
                      }
                      style={{
                        "--constraint-color":
                          constraint.color,
                      }}
                      aria-pressed={
                        isActive
                      }
                      aria-controls="story-buildable-map"
                      onClick={() =>
                        setStage(
                          constraint.stage
                        )
                      }
                    >
                      {
                        constraint.label
                      }
                    </button>


                    {" "}


                    <span className="story-buildable-inline-description">
                      {
                        constraint.sentence
                      }
                    </span>


                    {index <
                      CONSTRAINTS.length -
                        1 && " "}

                  </span>
                );
              }
            )}

          </p>

        </div>


        {/* LAND-AREA STATS */}

        <div className="story-buildable-metrics">

          {LAND_METRICS.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  item
                }
                className={
                  `story-buildable-metric${
                    activeMetricIndex ===
                    index
                      ? " is-active"
                      : ""
                  }`
                }
              >

                <strong>
                  {
                    item
                  }
                </strong>

              </div>
            )
          )}

        </div>

      </div>

    </div>
  );
}