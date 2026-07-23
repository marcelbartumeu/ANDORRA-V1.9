import {
  NarrativeCard,
  VisualPlaceholder,
} from "./StoryShared";

export default function SprawlDensitySection({ step }) {
  return (
    <>
      <div className="story-two-map-grid">
        <VisualPlaceholder label="Sprawl scenario map" />

        <VisualPlaceholder label="Density scenario map" />
      </div>

      <NarrativeCard>
        <p>{step.annotation}</p>
      </NarrativeCard>
    </>
  );
}