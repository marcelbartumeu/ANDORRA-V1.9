import { Fragment, useEffect, useState } from "react";
import AndorraTodaySection from "./story/AndorraTodaySection";
import BuildableLandSection from "./story/BuildableLandSection";
import SprawlDensitySection from "./story/SprawlDensitySection";
import ScenariosSection from "./story/ScenariosSection";
import DailyLifeSection from "./story/DailyLifeSection";
import ChooseFutureSection from "./story/ChooseFutureSection";

const PHOTO_PATHS = {
  hero: "/story/andorra-hero.jpg",
  town: "/story/andorra-town.jpg",
  valley: "/story/andorra-valley.jpg",
  dailyLife: "/story/andorra-daily-life.jpg",
};

function StorySectionHeader({ step }) {
  return (
    <header className="story-section-header">
      <h2>{step.section}</h2>
      <p className="story-section-subtitle">{step.title}</p>
    </header>
  );
}

function PhotoBreak({ src, label }) {
  return (
    <section className="story-photo-break-section" aria-label={label}>
      <div
        className="story-photo-break"
        role="img"
        aria-label={label}
        style={{
          backgroundImage: `
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.08),
              rgba(0, 0, 0, 0.4)
            ),
            url("${src}")
          `,
        }}
      />
    </section>
  );
}

const STORY_SECTION_COMPONENTS = {
  "andorra-today": AndorraTodaySection,
  "buildable-land": BuildableLandSection,
  "sprawl-vs-density": SprawlDensitySection,
  "population-scenarios": ScenariosSection,
  "accessibility-infrastructure": DailyLifeSection,
  "choose-future": ChooseFutureSection,
};

function renderStoryBody(step) {
  const SectionComponent =
    STORY_SECTION_COMPONENTS[step.id];

  if (!SectionComponent) {
    return null;
  }

  return (
    <SectionComponent
      step={step}
      photoPaths={PHOTO_PATHS}
    />
  );
}

export default function StoryScrolly() {
  const [steps, setSteps] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState("home");
  const [navOpen, setNavOpen] = useState(true);

  // Load the story structure and metadata.
  useEffect(() => {
    async function loadStorySteps() {
      try {
        const response = await fetch("/story_steps.json");

        if (!response.ok) {
          throw new Error(
            `Could not load story_steps.json: ${response.status}`
          );
        }

        const data = await response.json();
        setSteps(data);
      } catch (error) {
        console.error("Failed to load story steps:", error);
      }
    }

    loadStorySteps();
  }, []);

  // Watch the hero + each story section so the left navigation
  // knows which section is currently active.
  useEffect(() => {
    if (!steps.length) return;

    const sections = document.querySelectorAll("[data-story-section]");

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio
          );

        if (visibleEntries.length > 0) {
          setActiveSectionId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55],
      }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, [steps]);

  const scrollToSection = (sectionId) => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  return (
    <main className="story-page">

      {/* ── Sticky / collapsible story navigation ── */}
      <aside
        className={`story-side-nav ${
          navOpen ? "is-open" : "is-closed"
        }`}
      >
        <div className="story-side-nav-shell">

          <button
            className="story-nav-toggle"
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={
              navOpen
                ? "Close story navigation"
                : "Open story navigation"
            }
            aria-expanded={navOpen}
          >
            {navOpen ? "←" : "→"}
          </button>

          {navOpen && (
            <div className="story-nav-content">
              <p className="story-nav-brand">
                Andorra Living Lab
              </p>

              <nav className="story-nav-list">

                <button
                  type="button"
                  className={
                    activeSectionId === "home"
                      ? "is-active"
                      : ""
                  }
                  onClick={() => scrollToSection("home")}
                >
                  Home
                </button>

                {steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className={
                      activeSectionId === step.id
                        ? "is-active"
                        : ""
                    }
                    onClick={() =>
                      scrollToSection(step.id)
                    }
                  >
                    {step.section}
                  </button>
                ))}

              </nav>
            </div>
          )}

        </div>
      </aside>

      {/* ── Home / Hero ── */}
      <section
        id="home"
        data-story-section
        className="story-hero"
        style={{
          backgroundImage: `
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.1) 0%,
              rgba(0, 0, 0, 0.35) 48%,
              rgba(2, 4, 10, 0.96) 100%
            ),
            url("${PHOTO_PATHS.hero}")
          `,
        }}
      >
        <div className="story-hero-content">
          <h1>
            Andorra is home to roughly 89,000 people,
            but its size makes every future growth
            decision unusually consequential.
          </h1>
        </div>
        </section>

      {/* ── Six chronological story sections ── */}
      <div className="story-page-content">
        {steps.map((step) => (
          <Fragment key={step.id}>

            <section
              id={step.id}
              data-story-section
              className={`story-section ${
                activeSectionId === step.id
                  ? "is-active"
                  : ""
              }`}
            >
              <div className="story-section-inner">
                <StorySectionHeader step={step} />
                {renderStoryBody(step)}
              </div>
            </section>

            {/* Scenic visual break after the land-constraint chapter */}
            {step.id === "buildable-land" && (
              <PhotoBreak
                src={PHOTO_PATHS.valley}
                label="Andorra mountain valley"
              />
            )}

            {/* Human-scale visual break before the final decision chapter */}
            {step.id === "accessibility-infrastructure" && (
              <PhotoBreak
                src={PHOTO_PATHS.dailyLife}
                label="Daily life in Andorra"
              />
            )}

          </Fragment>
        ))}
      </div>
    </main>
  );
}