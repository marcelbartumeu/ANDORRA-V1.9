import { useEffect, useRef } from "react";


const BOSTON_COMPARISON_IMAGE =
  "/story/andorra-boston-comparison.png";


/*
  Simple one-time scroll reveal.

  Each fact waits until it is more clearly
  inside the viewport, then fades/slides in
  more slowly.
*/
function Reveal({
  children,
  className = "",
}) {
  const elementRef = useRef(null);

  useEffect(() => {
    const element =
      elementRef.current;

    if (!element) return;

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          if (
            entry.isIntersecting
          ) {
            element.classList.add(
              "is-visible"
            );

            observer.unobserve(
              element
            );
          }
        },
        {
          threshold: 0.28,
          rootMargin:
            "0px 0px -10% 0px",
        }
      );

    observer.observe(
      element
    );

    return () =>
      observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className={`story-today-reveal ${className}`}
    >
      {children}
    </div>
  );
}


export default function AndorraTodaySection() {
  return (
    <div className="story-today-editorial">

      {/* ======================================================
          AREA + DENSITY
          ====================================================== */}

      <Reveal className="story-today-area-beat">

        <div className="story-today-area-intro">
          <p>
            Andorra is about{" "}
            <strong>
              3.7× the land area of
              Boston proper.
            </strong>
          </p>
        </div>


        <div className="story-today-area-layout">

          <figure className="story-today-comparison-figure">
            <img
              src={
                BOSTON_COMPARISON_IMAGE
              }
              alt="Map comparison showing the relative land area of Andorra and Boston proper"
            />
          </figure>


          <div className="story-today-density-copy">

            <span className="story-today-density-intro">
              Andorra has
            </span>


            <div className="story-today-density-number">
              <span className="story-today-big-stat">
                482
              </span>

              <span className="story-today-big-stat-unit">
                people/mi²
              </span>
            </div>


            <p className="story-today-density-comparison">
              but is{" "}
              <strong>
                about 30× less dense than
                Boston proper.
              </strong>
            </p>

          </div>

        </div>
      </Reveal>


      {/* ======================================================
          MOUNTAINS
          ====================================================== */}

      <Reveal className="story-today-beat story-today-beat--left">

        <div className="story-today-beat-stat">
          <span className="story-today-big-stat">
            65+
          </span>

          <span className="story-today-stat-caption">
            PEAKS
          </span>
        </div>


        <p className="story-today-beat-copy">
          Andorra is extremely
          mountainous, with over 65
          peaks rise above 6,000 feet,
          concentrating most settlement
          and infrastructure in Andorra’s
          narrow valleys.
        </p>

      </Reveal>


      {/* ======================================================
          URBANIZED LAND
          ====================================================== */}

      <Reveal className="story-today-beat story-today-beat--right">

        <div className="story-today-beat-stat">
          <span className="story-today-big-stat">
            ~8%
          </span>

          <span className="story-today-stat-caption">
            OF LAND URBANIZED
          </span>
        </div>


        <p className="story-today-beat-copy">
          That helps explain why,
          despite a population of just
          89,000, only ~8% of Andorra’s
          land is urbanized.
        </p>

      </Reveal>


      {/* ======================================================
          ROAD ACCESS
          ====================================================== */}

      <Reveal className="story-today-beat story-today-beat--left story-today-road-beat">

        <div className="story-today-road-word">
          BY ROAD
        </div>


        <p className="story-today-beat-copy story-today-road-copy">
          It’s also the reason why
          Andorra has no airport or rail
          stations; all entry and exit is
          by road.
        </p>

      </Reveal>


      {/* ======================================================
          TRANSITION INTO BUILDABLE LAND
          ====================================================== */}

      <Reveal className="story-today-question-beat">

        <p className="story-today-question-setup">
          <strong>
            Steep terrain and debris-flow
            risk further limit where
            development can safely expand,
          </strong>

          <span>
            which begs the question:
          </span>
        </p>


        <p className="story-today-question">
          how much land is actually
          left to build on?
        </p>


        <span
          className="story-today-question-arrow"
          aria-hidden="true"
        >
          ↓
        </span>

      </Reveal>

    </div>
  );
}