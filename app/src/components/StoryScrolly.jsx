import { useEffect, useRef, useState } from "react";

export default function StoryScrolly() {
  const [steps, setSteps] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const sectionRefs = useRef([]);

  useEffect(() => {
    async function loadStorySteps() {
      try {
        const response = await fetch("/story_steps.json");

        if (!response.ok) {
          throw new Error(`Could not load story_steps.json: ${response.status}`);
        }

        const data = await response.json();
        setSteps(data);
      } catch (error) {
        console.error("Failed to load story steps:", error);
      }
    }

    loadStorySteps();
  }, []);

  useEffect(() => {
    if (!steps.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const index = Number(entry.target.dataset.stepIndex);
          setActiveStepIndex(index);
        });
      },
      {
        threshold: 0.55
      }
    );

    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [steps]);

  const activeStep = steps[activeStepIndex];

  return (
    <main className="story-shell">
      <aside className="story-visual-panel">
        <p className="story-panel-eyebrow">Active scene</p>

        <h2>{activeStep?.title ?? "Loading story..."}</h2>

        <p>{activeStep?.annotation}</p>

        <div className="story-debug-card">
          <p>
            <strong>Scenario:</strong> {activeStep?.scenario ?? "—"}
          </p>
          <p>
            <strong>Year:</strong>{" "}
            {activeStep?.displayYear ?? activeStep?.year ?? "—"}
          </p>
          <p>
            <strong>Layers:</strong>{" "}
            {activeStep?.layers?.join(", ") ?? "—"}
          </p>
          <p>
            <strong>KPIs:</strong>{" "}
            {activeStep?.kpis?.join(", ") ?? "—"}
          </p>
        </div>
      </aside>

      <section className="story-scroll">
        {steps.map((step, index) => (
          <article
            key={step.id}
            ref={(element) => {
              sectionRefs.current[index] = element;
            }}
            data-step-index={index}
            className={`story-step ${
              index === activeStepIndex ? "is-active" : ""
            }`}
          >
            <p className="story-eyebrow">{step.eyebrow}</p>
            <h2>{step.title}</h2>
            <p>{step.annotation}</p>
          </article>
        ))}
      </section>
    </main>
  );
}