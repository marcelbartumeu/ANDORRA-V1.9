import {
  NarrativeCard,
  PhotoPanel,
  VisualPlaceholder,
} from "./StoryShared";

export default function AndorraTodaySection({
  step,
  photoPaths,
}) {
  return (
    <>
      <div className="story-split-grid">
        <VisualPlaceholder label="Current Andorra map" />

        <NarrativeCard>
          <p>{step.annotation}</p>
        </NarrativeCard>
      </div>

      <div className="story-split-grid story-section-secondary-row">
        <NarrativeCard>
          <p>{step.secondaryAnnotation}</p>
        </NarrativeCard>

        <PhotoPanel
          src={photoPaths.town}
          label="Andorra town and built environment"
        />
      </div>
    </>
  );
}