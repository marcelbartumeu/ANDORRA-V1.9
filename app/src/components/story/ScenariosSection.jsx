import {
  useEffect,
  useMemo,
  useState,
} from "react";

import ScenarioGrowthMap from "./ScenarioGrowthMap";


const START_YEAR = 2026;
const END_YEAR = 2049;


const SCENARIOS = [
  {
    id: "degrowth",
    label: "Degrowth",
    subtitle: "Population contraction",
    color: "#067137",
    timeseries:
      "/model/Degrowth_timeseries.json",
    narrativeTitle:
      "A smaller Andorra",
    narrative:
      "Population and economic activity contract over time, reducing pressure on land and public systems while also shrinking the country's economic base.",
  },

  {
    id: "continuity",
    label: "Continuity",
    subtitle: "Baseline trajectory",
    color: "#2a4dad",
    timeseries:
      "/model/Continuity_timeseries.json",
    narrativeTitle:
      "More of today's trajectory",
    narrative:
      "Population, economic activity, and development pressure continue to grow without the acceleration of Overgrowth or the tighter pattern represented by Density.",
  },

  {
    id: "density",
    label: "Density",
    subtitle: "More compact growth",
    color: "#e8b30c",
    timeseries:
      "/model/Density_timeseries.json",
    narrativeTitle:
      "Growth in a tighter footprint",
    narrative:
      "Population grows more slowly and future development remains more concentrated, changing how physical and infrastructure pressure is distributed.",
  },

  {
    id: "overgrowth",
    label: "Overgrowth",
    subtitle: "Rapid growth",
    color: "#bc0638",
    timeseries:
      "/model/Overgrowth_timeseries.json",
    narrativeTitle:
      "The highest-growth future",
    narrative:
      "Population and economic activity expand much faster, producing substantially greater development and infrastructure pressure by the end of the model period.",
  },
];


function findYear(
  rows,
  year
) {
  return (
    rows?.find(
      (row) =>
        Number(
          row.Year
        ) === year
    ) ?? null
  );
}


function formatPopulation(
  value
) {
  if (
    value == null
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 0,
    }
  ).format(
    value
  );
}


function formatGDP(
  value
) {
  if (
    value == null
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }
  ).format(
    value
  );
}


function formatCO2(
  value
) {
  if (
    value == null
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      notation: "compact",
      maximumFractionDigits: 2,
    }
  ).format(
    value
  );
}


function ScenarioKpis({
  row,
}) {
  return (
    <dl className="story-scenario-kpis">

      <div className="story-scenario-kpi">
        <dt>
          Population
        </dt>

        <dd>
          {formatPopulation(
            row?.Pop
          )}
        </dd>
      </div>


      <div className="story-scenario-kpi">
        <dt>
          GDP / capita
        </dt>

        <dd>
          {formatGDP(
            row?.GDPpc
          )}
        </dd>
      </div>


      <div className="story-scenario-kpi">
        <dt>
          Total CO₂
        </dt>

        <dd>
          {formatCO2(
            row?.CO2_total
          )}
        </dd>
      </div>

    </dl>
  );
}


export default function ScenariosSection({
  step,
}) {
  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    START_YEAR
  );


  const [
    scenarioData,
    setScenarioData,
  ] = useState(
    {}
  );


  const [
    error,
    setError,
  ] = useState(
    false
  );


  /*
    Load all four scenario
    timeseries files.
  */
  useEffect(
    () => {
      const controller =
        new AbortController();


      Promise.all(
        SCENARIOS.map(
          async (
            scenario
          ) => {
            const response =
              await fetch(
                scenario.timeseries,
                {
                  signal:
                    controller.signal,
                }
              );


            if (
              !response.ok
            ) {
              throw new Error(
                `Could not load ${scenario.timeseries}`
              );
            }


            return [
              scenario.id,
              await response.json(),
            ];
          }
        )
      )

        .then(
          (
            entries
          ) => {
            setScenarioData(
              Object.fromEntries(
                entries
              )
            );
          }
        )

        .catch(
          (
            err
          ) => {
            if (
              err.name !==
              "AbortError"
            ) {
              console.error(
                "Failed to load scenario timeseries:",
                err
              );


              setError(
                true
              );
            }
          }
        );


      return () => {
        controller.abort();
      };
    },
    []
  );


  /*
    Actual model rows for the
    currently selected year.
  */
  const actualSelectedRows =
    useMemo(
      () => {
        return Object.fromEntries(
          SCENARIOS.map(
            (
              scenario
            ) => [
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
      },
      [
        scenarioData,
        selectedYear,
      ]
    );


  /*
    Shared displayed 2026 baseline.

    Continuity provides the common
    starting values shown across
    all four scenarios.
  */
  const shared2026Row =
    useMemo(
      () => {
        const continuityRow =
          findYear(
            scenarioData.continuity,
            START_YEAR
          );


        if (
          continuityRow
        ) {
          return continuityRow;
        }


        /*
          Fallback if Continuity has
          not loaded for some reason.
        */
        for (
          const scenario
          of SCENARIOS
        ) {
          const row =
            findYear(
              scenarioData[
                scenario.id
              ],
              START_YEAR
            );


          if (
            row
          ) {
            return row;
          }
        }


        return null;
      },
      [
        scenarioData,
      ]
    );


  /*
    Values displayed under the maps.

    2026:
      all four scenarios show the
      same comparison baseline.

    2027–2049:
      use each scenario's actual
      modeled values.
  */
  const displayRows =
    useMemo(
      () => {
        if (
          selectedYear ===
            START_YEAR &&
          shared2026Row
        ) {
          return Object.fromEntries(
            SCENARIOS.map(
              (
                scenario
              ) => [
                scenario.id,
                shared2026Row,
              ]
            )
          );
        }


        return actualSelectedRows;
      },
      [
        actualSelectedRows,
        selectedYear,
        shared2026Row,
      ]
    );


  return (
    <>

      <div className="story-scenarios-intro">

        <p className="story-editorial-lede">
          {step.annotation}
        </p>


        <div className="story-scenarios-year-block">

          <span>
            Selected year
          </span>

          <strong>
            {selectedYear}
          </strong>

        </div>

      </div>


      {/* =====================================================
          1. SCENARIO HEADINGS + MAPS
          ===================================================== */}

      <div className="story-scenarios-grid story-scenarios-grid--maps">

        {SCENARIOS.map(
          (
            scenario,
            index
          ) => (
            <article
  key={
    scenario.id
  }
  className="story-scenario-column"
  style={{
    "--scenario-color":
      scenario.color,
  }}
>

              <header className="story-scenario-heading">

                


                <div>

                  <strong>
                    {
                      scenario.label
                    }
                  </strong>

                  <p>
                    {
                      scenario.subtitle
                    }
                  </p>

                </div>

              </header>


              <div className="story-map-card story-map-card--square story-scenario-map-card">

                <ScenarioGrowthMap
                  scenario={
                    scenario.id
                  }
                  selectedYear={
                    selectedYear
                  }
                />

              </div>

            </article>
          )
        )}

      </div>


      {/* =====================================================
          2. SHARED YEAR SLIDER + LEGEND
          ===================================================== */}

      <div className="story-scenarios-controls">

        <div className="story-scenarios-slider">

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
            min={
              START_YEAR
            }
            max={
              END_YEAR
            }
            step="1"
            value={
              selectedYear
            }
            onChange={
              (
                event
              ) =>
                setSelectedYear(
                  Number(
                    event.target.value
                  )
                )
            }
            aria-label="Scenario year"
          />

        </div>


        <div className="story-growth-legend">

          <div className="story-growth-legend-title">
            Population growth since 2026
          </div>


          <div className="story-growth-legend-row">

            <span>
              Lower growth
            </span>


            <div className="story-growth-gradient" />


            <span>
              Higher growth
            </span>

          </div>

        </div>

      </div>


      {/* =====================================================
          3. KPI STATS + NARRATIVES
          ===================================================== */}

      <div className="story-scenarios-grid story-scenarios-grid--details">

        {SCENARIOS.map(
  (
    scenario
  ) => (
            <div
  key={
    scenario.id
  }
  className="story-scenario-column"
  style={{
    "--scenario-color":
      scenario.color,
  }}
>

              <ScenarioKpis
                row={
                  displayRows[
                    scenario.id
                  ]
                }
              />


              <div className="story-scenario-narrative">

                <strong>
                  {
                    scenario.narrativeTitle
                  }
                </strong>


                <p>
                  {
                    scenario.narrative
                  }
                </p>

              </div>

            </div>
          )
        )}

      </div>


      {error && (
        <p className="story-scenario-data-error">
          Some scenario data could not be loaded.
        </p>
      )}

    </>
  );
}