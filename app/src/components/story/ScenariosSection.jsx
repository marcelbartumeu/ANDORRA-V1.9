import {
  useEffect,
  useMemo,
  useState,
} from "react";

import ScenarioGrowthMap from "./ScenarioGrowthMap";
import { NarrativeCard } from "./StoryShared";


const START_YEAR = 2026;
const END_YEAR = 2049;


const SCENARIOS = [
  {
    id: "continuity",

    label: "Continuity",

    subtitle: "Baseline",

    timeseries:
      "/model/Continuity_timeseries.json",

    narrativeTitle:
      "If current trajectories broadly continue",

    narrative:
      "Continuity acts as the baseline future: population, economic activity, and development pressure continue to grow without the acceleration seen in Overgrowth or the tighter growth pattern represented by Density.",
  },

  {
    id: "density",

    label: "Density",

    subtitle: "More constrained growth",

    timeseries:
      "/model/Density_timeseries.json",

    narrativeTitle:
      "If future growth remains more compact",

    narrative:
      "Density represents a more constrained growth path. Population grows more slowly and future development remains more concentrated, reducing some of the physical and environmental pressure created by faster expansion.",
  },

  {
    id: "overgrowth",

    label: "Overgrowth",

    subtitle: "Rapid growth",

    timeseries:
      "/model/Overgrowth_timeseries.json",

    narrativeTitle:
      "If growth accelerates",

    narrative:
      "Overgrowth represents the highest-growth future. Population and economic activity expand much faster, creating greater development pressure and substantially larger environmental impacts by the end of the model period.",
  },
];


function findYear(rows, year) {
  return (
    rows?.find(
      (row) =>
        Number(row.Year) === year
    ) ?? null
  );
}


function formatPopulation(value) {
  if (value == null) return "—";

  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 0,
    }
  ).format(value);
}


function formatGDP(value) {
  if (value == null) return "—";

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}


function formatCO2(value) {
  if (value == null) return "—";

  return new Intl.NumberFormat(
    "en-US",
    {
      notation: "compact",
      maximumFractionDigits: 2,
    }
  ).format(value);
}


function ScenarioKpis({ row }) {
  return (
    <div className="story-scenario-kpis">

      <div className="story-scenario-kpi">
        <span>Population</span>

        <strong>
          {formatPopulation(row?.Pop)}
        </strong>
      </div>


      <div className="story-scenario-kpi">
        <span>GDP per capita</span>

        <strong>
          {formatGDP(row?.GDPpc)}
        </strong>
      </div>


      <div className="story-scenario-kpi">
        <span>Total CO₂</span>

        <strong>
          {formatCO2(row?.CO2_total)}
        </strong>
      </div>

    </div>
  );
}


export default function ScenariosSection({
  step,
}) {
  const [selectedYear, setSelectedYear] =
    useState(START_YEAR);

  const [scenarioData, setScenarioData] =
    useState({});

  const [error, setError] =
    useState(false);


  // Load the three scenario timeseries.
  useEffect(() => {
    const controller =
      new AbortController();


    Promise.all(
      SCENARIOS.map(
        async (scenario) => {
          const response =
            await fetch(
              scenario.timeseries,
              {
                signal:
                  controller.signal,
              }
            );


          if (!response.ok) {
            throw new Error(
              `Could not load ${scenario.timeseries}`
            );
          }


          const rows =
            await response.json();


          return [
            scenario.id,
            rows,
          ];
        }
      )
    )

      .then((entries) => {
        setScenarioData(
          Object.fromEntries(entries)
        );
      })

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


  // Pull out the selected year's KPI row
  // for each scenario.
  const selectedRows =
    useMemo(() => {
      return Object.fromEntries(
        SCENARIOS.map(
          (scenario) => [
            scenario.id,

            findYear(
              scenarioData[
                scenario.id
              ],
              selectedYear
            ),
          ]
        )
      );
    }, [
      scenarioData,
      selectedYear,
    ]);


  return (
    <>

      {/* Transition from Buildable Land */}
      <NarrativeCard>
        <p>{step.annotation}</p>
      </NarrativeCard>


      {/* Three synchronized scenario maps */}
      <div className="story-three-map-grid story-scenarios-grid">

        {SCENARIOS.map(
          (scenario) => (
            <article
              key={scenario.id}
              className="story-scenario-column"
            >

              <header className="story-scenario-heading">

                <span>
                  {scenario.label}
                </span>

                <p>
                  {scenario.subtitle}
                </p>

              </header>


              <div className="story-map-card story-scenario-map-card">

                <ScenarioGrowthMap
                  scenario={
                    scenario.id
                  }
                  selectedYear={
                    selectedYear
                  }
                />

              </div>


              <ScenarioKpis
                row={
                  selectedRows[
                    scenario.id
                  ]
                }
              />

            </article>
          )
        )}

      </div>


      {/* Shared timeline */}
      <div className="story-scenarios-slider">

        <div className="story-year-slider-header">

          <span>{START_YEAR}</span>

          <strong>
            {selectedYear}
          </strong>

          <span>{END_YEAR}</span>

        </div>


        <input
          type="range"
          min={START_YEAR}
          max={END_YEAR}
          step="1"
          value={selectedYear}
          onChange={(event) =>
            setSelectedYear(
              Number(
                event.target.value
              )
            )
          }
          aria-label="Scenario year"
        />

      </div>


      {/* One legend shared by all maps */}
      <div className="story-growth-legend">

        <div className="story-growth-legend-title">
          Population growth since 2024
        </div>


        <div className="story-growth-legend-row">

          <span>Lower growth</span>

          <div className="story-growth-gradient" />

          <span>Higher growth</span>

        </div>

      </div>


      {error && (
        <p className="story-scenario-data-error">
          Some scenario data could not be loaded.
        </p>
      )}


      {/* Narrative / tradeoffs */}
      <div className="story-scenario-narrative-grid">

        {SCENARIOS.map(
          (scenario) => (
            <div
              key={scenario.id}
              className="story-scenario-narrative"
            >

              <span>
                {scenario.label}
              </span>

              <strong>
                {
                  scenario.narrativeTitle
                }
              </strong>

              <p>
                {scenario.narrative}
              </p>

            </div>
          )
        )}

      </div>

    </>
  );
}