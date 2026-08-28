import { Fragment, useState } from "react";

import BuildableLandMap from "./BuildableLandMap";

import {
  NarrativeCard,
} from "./StoryShared";


const MAP_STAGES = [
  "Total land",
  "Protected land",
  "Steep terrain",
  "Existing built land",
  "Remaining buildable land",
];


export default function BuildableLandSection({
  step,
}) {
  const [stage, setStage] = useState(0);

  // The map has 5 explanatory stages,
  // but the story has 3 headline area numbers.
  const activeMetricIndex =
    stage === 0
      ? 0
      : stage === 4
        ? 2
        : 1;
 
  return (
    <div className="story-split-grid">

      <div className="story-buildable-map-column">

        <div className="story-map-card story-buildable-map-card">
          <BuildableLandMap stage={stage} />
        </div>


        <div className="story-buildable-stage-controls">

          {MAP_STAGES.map((label, index) => (
            <button
              key={label}
              type="button"
              className={
                `story-buildable-stage-button` +
                (stage === index
                  ? " is-active"
                  : "")
              }
              onClick={() => setStage(index)}
            >
              {label}
            </button>
          ))}

        </div>

      </div>


      <div className="story-narrative-column">

        <NarrativeCard>
          <p>{step.annotation}</p>
        </NarrativeCard>


        <div className="story-metric-sequence">

          {(step.visualSequence ?? []).map(
            (item, index) => (

              <Fragment key={item}>

                <div
                  className={
                    `story-metric-step` +
                    (
                      activeMetricIndex === index
                        ? " is-active"
                        : ""
                    )
                  }
                >
                  {item}
                </div>


                {index <
                  step.visualSequence.length - 1 && (

                  <span className="story-metric-arrow">
                    →
                  </span>

                )}

              </Fragment>

            )
          )}

        </div>

      </div>

    </div>
  );
}