import {
  NarrativeCard,
  VisualPlaceholder,
} from "./StoryShared";

export default function ChooseFutureSection({ step }) {
  return (
    <>
      <VisualPlaceholder
        label="Marcel's existing policy timeline and scenario controls"
        className="story-visual-placeholder--timeline"
      />

      <div className="story-decision-grid">
        <VisualPlaceholder label="Dynamic policy-result map" />

        <div className="story-graph-stack">
          <VisualPlaceholder
            label="Existing KPI graph"
            className="story-visual-placeholder--graph"
          />

          <VisualPlaceholder
            label="Existing KPI graph"
            className="story-visual-placeholder--graph"
          />

          <VisualPlaceholder
            label="Existing KPI graph"
            className="story-visual-placeholder--graph"
          />
        </div>
      </div>

      <NarrativeCard>
        <p>{step.annotation}</p>
      </NarrativeCard>

      <div className="story-decision-summary">
        <div>
          <span>What this future improves</span>
          <p>Decision summary will appear here.</p>
        </div>

        <div>
          <span>What this future strains</span>
          <p>Decision summary will appear here.</p>
        </div>

        <div>
          <span>Who is most affected</span>
          <p>Decision summary will appear here.</p>
        </div>
      </div>
    </>
  );
}