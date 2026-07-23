import { Fragment } from "react";

import {
  NarrativeCard,
  VisualPlaceholder,
} from "./StoryShared";

export default function BuildableLandSection({ step }) {
  return (
    <div className="story-split-grid">
      <VisualPlaceholder label="Interactive buildable-land map" />

      <div className="story-narrative-column">
        <NarrativeCard>
          <p>{step.annotation}</p>
        </NarrativeCard>

        <div className="story-metric-sequence">
          {(step.visualSequence ?? []).map((item, index) => (
            <Fragment key={item}>
              <div className="story-metric-step">
                {item}
              </div>

              {index < step.visualSequence.length - 1 && (
                <span className="story-metric-arrow">
                  →
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}