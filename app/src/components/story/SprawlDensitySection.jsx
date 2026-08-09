import {
  useEffect,
  useMemo,
  useState,
} from "react";

import SprawlDensityMap
  from "./SprawlDensityMap";

import {
  NarrativeCard,
} from "./StoryShared";


const START_YEAR = 2026;
const END_YEAR = 2049;


function findYear(data, year) {
  return data.find(
    (row) => row.Year === year
  );
}


function AccessSummary({
  scenario,
  value,
}) {
  return (
    <div className="story-access-summary">

      <span>
        {scenario} access
      </span>

      <strong>
        {value == null
          ? "—"
          : value.toFixed(3)}
      </strong>

    </div>
  );
}


export default function SprawlDensitySection({
  step,
}) {
  const [selectedYear, setSelectedYear] =
    useState(START_YEAR);

  const [overgrowthData, setOvergrowthData] =
    useState([]);

  const [densityData, setDensityData] =
    useState([]);

  const [error, setError] =
    useState(false);


  useEffect(() => {
    const controller =
      new AbortController();


    Promise.all([
      fetch(
        "/model/Overgrowth_timeseries.json",
        {
          signal: controller.signal,
        }
      ).then((response) =>
        response.json()
      ),

      fetch(
        "/model/Density_timeseries.json",
        {
          signal: controller.signal,
        }
      ).then((response) =>
        response.json()
      ),
    ])

      .then(
        ([
          overgrowth,
          density,
        ]) => {
          setOvergrowthData(overgrowth);
          setDensityData(density);
        }
      )

      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(
            "Failed to load scenario timeseries:",
            err
          );

          setError(true);
        }
      });


    return () => {
      controller.abort();
    };
  }, []);


  const overgrowthYear =
    useMemo(
      () =>
        findYear(
          overgrowthData,
          selectedYear
        ),
      [
        overgrowthData,
        selectedYear,
      ]
    );


  const densityYear =
    useMemo(
      () =>
        findYear(
          densityData,
          selectedYear
        ),
      [
        densityData,
        selectedYear,
      ]
    );


  return (
    <>

      <div className="story-two-map-grid">

        {/* SPRAWL */}
        <div className="story-scenario-column">

          <div className="story-scenario-heading">

            <span>
              Overgrowth / Sprawl
            </span>

            <p>
              Population distributed
              across more H3 cells.
            </p>

          </div>


          <div className="story-map-card story-comparison-map-card">

            <SprawlDensityMap
              scenario="overgrowth"
              targetPopulation={
                overgrowthYear?.Pop
              }
              access={
                overgrowthYear?.Access
              }
            />

          </div>


          <AccessSummary
            scenario="Sprawl"
            value={
              overgrowthYear?.Access
            }
          />

        </div>


        {/* DENSITY */}
        <div className="story-scenario-column">

          <div className="story-scenario-heading">

            <span>
              Density
            </span>

            <p>
              Population concentrated
              into fewer H3 cells.
            </p>

          </div>


          <div className="story-map-card story-comparison-map-card">

            <SprawlDensityMap
              scenario="density"
              targetPopulation={
                densityYear?.Pop
              }
              access={
                densityYear?.Access
              }
            />

          </div>


          <AccessSummary
            scenario="Density"
            value={
              densityYear?.Access
            }
          />

        </div>

      </div>


      <div className="story-year-slider">

        <div className="story-year-slider-header">

          <span>
            {START_YEAR}
          </span>

          <strong>
            {selectedYear}
          </strong>

          <span>
            {END_YEAR}
          </span>

        </div>


        <input
          type="range"
          min={START_YEAR}
          max={END_YEAR}
          step="1"
          value={selectedYear}
          aria-label="Scenario year"
          onChange={(event) =>
            setSelectedYear(
              Number(
                event.target.value
              )
            )
          }
        />

      </div>


      {error && (
        <p className="story-scenario-data-error">
          Scenario data could not be loaded.
        </p>
      )}


      <NarrativeCard>
        <p>{step.annotation}</p>
      </NarrativeCard>

    </>
  );
}