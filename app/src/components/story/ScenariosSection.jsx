import {
  NarrativeCard,
  VisualPlaceholder,
} from "./StoryShared";

export default function ScenariosSection({ step }) {
  return (
    <>
      <div className="story-three-map-grid">
        <VisualPlaceholder label="Baseline scenario map" />

        <VisualPlaceholder label="Density scenario map" />

        <VisualPlaceholder label="Overgrowth scenario map" />
      </div>

      <VisualPlaceholder
        label="Marcel's existing scenario timeline and line-chart visualization"
        className="story-visual-placeholder--wide"
      />

      <NarrativeCard>
        <p>{step.annotation}</p>
      </NarrativeCard>
    </>
  );
}