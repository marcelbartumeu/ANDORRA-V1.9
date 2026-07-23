import {
  NarrativeCard,
  VisualPlaceholder,
} from "./StoryShared";

export default function DailyLifeSection({ step }) {
  return (
    <div className="story-split-grid">
      <VisualPlaceholder label="Interactive accessibility map" />

      <NarrativeCard>
        <p>{step.annotation}</p>
      </NarrativeCard>
    </div>
  );
}