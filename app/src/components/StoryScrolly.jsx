import { Fragment, useEffect, useMemo, useState } from "react";
import AndorraTodaySection from "./story/AndorraTodaySection";
import BuildableLandSection from "./story/BuildableLandSection";
import ScenariosSection from "./story/ScenariosSection";
import DailyLifeSection from "./story/DailyLifeSection";
import ChooseFutureSection from "./story/ChooseFutureSection";

const PHOTO_PATHS = {
  hero: "/story/andorra-hero.jpg",
  town: "/story/andorra-town.jpg",
  valley: "/story/andorra-valley.jpg",
  dailyLife: "/story/andorra-daily-life.jpg",
};

const STORY_SECTION_COMPONENTS = {
  "andorra-today": AndorraTodaySection,
  "buildable-land": BuildableLandSection,
  "population-scenarios": ScenariosSection,
  "accessibility-infrastructure": DailyLifeSection,
  "choose-future": ChooseFutureSection,
};

const SECTION_TITLES = {
  "andorra-today": "Andorra Today",
  "buildable-land": "Buildable Land Constraint",
  "population-scenarios": "Scenarios to 2049",
  "accessibility-infrastructure": "Effects on Daily Life",
  "choose-future": "Choose Andorra's Future",
};

const SECTION_TONES = {
  "andorra-today": "light",
  "buildable-land": "dark",
  "population-scenarios": "light",
  "accessibility-infrastructure": "dark",
  "choose-future": "light",
};

function sectionTitle(step) {
  return SECTION_TITLES[step.id] ?? step.section;
}

function StorySectionHeader({ step, index }) {
  return (
    <header className="story-section-header">
      <div className="story-section-index">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="story-section-heading-copy">
        <p className="story-section-kicker">
          Chapter {String(index + 1).padStart(2, "0")}
        </p>

        <h2>{sectionTitle(step)}</h2>
        <p className="story-section-subtitle">{step.title}</p>
      </div>
    </header>
  );
}

function PhotoBreak({ src, label, caption }) {
  return (
    <section className="story-photo-break-section" aria-label={label}>
      <div
        className="story-photo-break"
        role="img"
        aria-label={label}
        style={{ backgroundImage: `url("${src}")` }}
      >
        <span className="story-photo-break-caption">{caption}</span>
      </div>
    </section>
  );
}

function ProjectSection() {
  return (
    <section
      id="project"
      data-story-section
      className="story-project-section"
    >
      <div className="story-project-inner">
        <header className="story-section-header story-project-header">
          <div className="story-section-index">06</div>

          <div className="story-section-heading-copy">
            <p className="story-section-kicker">Chapter 06</p>
            <h2>About the Project</h2>
            <p className="story-section-subtitle">
              Andorra as a country-scale living laboratory for exploring possible futures.
            </p>
          </div>
        </header>

        <div className="story-project-grid">
          <div className="story-project-copy">
            <p className="story-project-eyebrow">MIT Media Lab · City Science</p>

            <p className="story-project-lede">
              The Andorra Country Scale Digital Twin brings together national,
              spatial, social, economic, environmental, and infrastructure data
              so alternative long-term futures can be compared in one interactive system.
            </p>

            <p className="story-project-body">
              Rather than presenting one forecast as inevitable, the project is designed
              to make trade-offs visible and support more informed conversations about
              growth, land, public services, resources, and quality of life.
            </p>

            <div className="story-project-links">
              <a
                href="https://www.media.mit.edu/projects/andorra/overview/"
                target="_blank"
                rel="noreferrer"
              >
                Andorra Country Scale Digital Twin <span aria-hidden="true">↗</span>
              </a>

              <a
                href="https://www.media.mit.edu/projects/city-science-andorra/overview/"
                target="_blank"
                rel="noreferrer"
              >
                City Science Lab @ Andorra <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <div
            className="story-project-image"
            role="img"
            aria-label="Andorra mountain landscape"
            style={{ backgroundImage: `url("${PHOTO_PATHS.valley}")` }}
          >
            <span>MIT MEDIA LAB · CITY SCIENCE · ANDORRA</span>
          </div>
        </div>

        <div className="story-project-footer">
          <span>Research · Data · Scenario exploration</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to top ↑
          </button>
        </div>
      </div>
    </section>
  );
}

function renderStoryBody(step) {
  const SectionComponent = STORY_SECTION_COMPONENTS[step.id];
  if (!SectionComponent) return null;

  return <SectionComponent step={step} photoPaths={PHOTO_PATHS} />;
}

export default function StoryScrolly() {
  const [steps, setSteps] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState("home");
  const [navOpen, setNavOpen] = useState(true);

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

  const displaySteps = useMemo(
    () => steps.filter((step) => STORY_SECTION_COMPONENTS[step.id]),
    [steps]
  );

  useEffect(() => {
    if (!displaySteps.length) return;

    const sections = document.querySelectorAll("[data-story-section]");

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries.length > 0) {
          setActiveSectionId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -58% 0px",
        threshold: [0.12, 0.3, 0.5],
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [displaySteps]);

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="story-page">
      <aside
        className={`story-side-nav ${navOpen ? "is-open" : "is-closed"}`}
      >
        <div className="story-side-nav-shell">
          <button
            className="story-nav-toggle"
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Close story navigation" : "Open story navigation"}
            aria-expanded={navOpen}
          >
            {navOpen ? "‹" : "›"}
          </button>

          {navOpen ? (
            <div className="story-nav-content">
              <div className="story-nav-brand-block">
                <p className="story-nav-brand">ANDORRA FUTURES</p>
                <p className="story-nav-tagline">
                  A living inquiry into land, life, and choices for 2049.
                </p>
              </div>

              <nav className="story-nav-list" aria-label="Story chapters">
                <button
                  type="button"
                  className={activeSectionId === "home" ? "is-active" : ""}
                  onClick={() => scrollToSection("home")}
                >
                  <span className="story-nav-number">00</span>
                  <span>Home</span>
                </button>

                {displaySteps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    className={activeSectionId === step.id ? "is-active" : ""}
                    onClick={() => scrollToSection(step.id)}
                  >
                    <span className="story-nav-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{sectionTitle(step)}</span>
                  </button>
                ))}

                <button
                  type="button"
                  className={activeSectionId === "project" ? "is-active" : ""}
                  onClick={() => scrollToSection("project")}
                >
                  <span className="story-nav-number">06</span>
                  <span>The Project</span>
                </button>
              </nav>

              <div className="story-nav-footer">
                <span>MIT Media Lab</span>
                <span>City Science</span>
              </div>
            </div>
          ) : (
            <div className="story-nav-collapsed-mark" aria-hidden="true">
              A
            </div>
          )}
        </div>
      </aside>

      <section id="home" data-story-section className="story-hero">
        <div className="story-hero-copy">
          <p className="story-hero-kicker">MIT Media Lab · City Science · Andorra</p>

          <h1>
            ANDORRA:
            <br />
            CHOOSING A FUTURE
          </h1>

          <p className="story-hero-deck">
            A country-scale exploration of how land, population, infrastructure,
            prosperity, and environmental pressure could evolve through 2049.
          </p>

          <button
            className="story-hero-cta"
            type="button"
            onClick={() => scrollToSection(displaySteps[0]?.id ?? "andorra-today")}
          >
            Explore the story <span aria-hidden="true">↓</span>
          </button>
        </div>

        <div className="story-hero-mosaic" aria-hidden="true">
          <div
            className="story-hero-tile story-hero-tile--a"
            style={{ backgroundImage: `url("${PHOTO_PATHS.hero}")` }}
          />
          <div
            className="story-hero-tile story-hero-tile--b"
            style={{ backgroundImage: `url("${PHOTO_PATHS.valley}")` }}
          />
          <div
            className="story-hero-tile story-hero-tile--c"
            style={{ backgroundImage: `url("${PHOTO_PATHS.town}")` }}
          />
          <div
            className="story-hero-tile story-hero-tile--d"
            style={{ backgroundImage: `url("${PHOTO_PATHS.dailyLife}")` }}
          />
          <div className="story-hero-accent-block" />
        </div>
      </section>

      <div className="story-page-content">
        {displaySteps.map((step, index) => (
          <Fragment key={step.id}>
            <section
              id={step.id}
              data-story-section
              className={`story-section story-section--${SECTION_TONES[step.id] ?? "dark"} ${
                activeSectionId === step.id ? "is-active" : ""
              }`}
            >
              <div className="story-section-inner">
                <StorySectionHeader step={step} index={index} />
                {renderStoryBody(step)}
              </div>
            </section>

            {step.id === "buildable-land" && (
              <PhotoBreak
                src={PHOTO_PATHS.valley}
                label="Andorra mountain valley"
                caption="FIG. 02 · LAND IS NEVER JUST EMPTY SPACE"
              />
            )}

            {step.id === "accessibility-infrastructure" && (
              <PhotoBreak
                src={PHOTO_PATHS.dailyLife}
                label="Daily life in Andorra"
                caption="FIG. 04 · GROWTH IS FELT THROUGH EVERYDAY SYSTEMS"
              />
            )}
          </Fragment>
        ))}
      </div>

      <ProjectSection />
    </main>
  );
}
