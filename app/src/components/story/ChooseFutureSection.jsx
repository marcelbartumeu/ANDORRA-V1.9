import {
  useEffect,
  useMemo,
  useState,
} from "react";


const END_YEAR = 2049;


// ─────────────────────────────────────────────────────────────
// SCENARIOS
// ─────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: "Degrowth",
    label: "Degrowth",
    color: "#89928a",
    url: "/model/Degrowth_timeseries.json",
  },
  {
    id: "Continuity",
    label: "Continuity",
    color: "#6f7785",
    url: "/model/Continuity_timeseries.json",
  },
  {
    id: "Density",
    label: "Density",
    color: "#8f2634",
    url: "/model/Density_timeseries.json",
  },
  {
    id: "Overgrowth",
    label: "Overgrowth",
    color: "#c58a4a",
    url: "/model/Overgrowth_timeseries.json",
  },
];


// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────

function formatInteger(value) {
  return Math.round(value).toLocaleString();
}


function formatCompact(value) {
  return new Intl.NumberFormat(
    "en-US",
    {
      notation: "compact",
      maximumFractionDigits: 1,
    }
  ).format(value);
}


function formatEuro(value) {
  return `€${Math.round(
    value
  ).toLocaleString()}`;
}


function formatBillionsEuro(value) {
  return `€${(
    value /
    1_000_000_000
  ).toFixed(1)}B`;
}


function formatPercent(value) {
  const percent =
    Math.abs(value) <= 1.5
      ? value * 100
      : value;

  return `${percent.toFixed(1)}%`;
}


function formatPercentagePoints(value) {
  return `${(
    Math.abs(value) * 100
  ).toFixed(1)} percentage points`;
}


function formatYears(value) {
  return `${value.toFixed(1)} yrs`;
}


function formatYearDifference(value) {
  return `${Math.abs(value).toFixed(1)} years`;
}


function formatRoad(value) {
  return `${value.toFixed(2)} m/person`;
}


function formatRoadDifference(value) {
  return `${Math.abs(value).toFixed(2)} m/person`;
}


function formatElectricity(value) {
  return `${(
    value /
    1_000_000
  ).toFixed(0)}M kWh/yr`;
}


function formatElectricityDifference(value) {
  return `${(
    Math.abs(value) /
    1_000_000
  ).toFixed(0)}M kWh/yr`;
}


function formatWater(value) {
  return `${(
    value /
    1_000_000
  ).toFixed(1)}M m³/yr`;
}


function formatWaterDifference(value) {
  return `${(
    Math.abs(value) /
    1_000_000
  ).toFixed(1)}M m³/yr`;
}


function formatOneDecimal(value) {
  return value.toFixed(1);
}


function formatOneDecimalDifference(value) {
  return Math.abs(value).toFixed(1);
}


// ─────────────────────────────────────────────────────────────
// PRIORITY → KPI AXES
//
// Each metric has its own fixed scale.
// The 4 scenarios DO NOT define the min/max of the spider.
// ─────────────────────────────────────────────────────────────

const PRIORITIES = {
  economy: {
    label: "Economy",

    metrics: [
      {
        key: "GDPpc",

        label: "GDP / capita",

        axisLines: [
          "GDP /",
          "CAPITA",
        ],

        min: 0,
        max: 200_000,

        format: formatEuro,

        formatDifference:
          formatEuro,
      },

      {
        key: "GDP",

        label: "Total GDP",

        axisLines: [
          "TOTAL GDP",
        ],

        min: 0,
        max: 35_000_000_000,

        format:
          formatBillionsEuro,

        formatDifference:
          formatBillionsEuro,
      },

      {
        key: "Tour",

        label: "Tourism",

        axisLines: [
          "TOURISM",
        ],

        min: 0,
        max: 20_000_000,

        format: formatCompact,

        formatDifference:
          formatCompact,
      },

      {
        key: "Income",

        label: "Income",

        axisLines: [
          "INCOME",
        ],

        min: 0,
        max: 300_000,

        format: formatEuro,

        formatDifference:
          formatEuro,
      },
    ],
  },


  social: {
    label: "Social Systems",

    metrics: [
      {
        key: "LE",

        label:
          "Life expectancy",

        axisLines: [
          "LIFE",
          "EXPECTANCY",
        ],

        min: 80,
        max: 95,

        format:
          formatYears,

        formatDifference:
          formatYearDifference,
      },

      {
        key:
          "sForeignBorn",

        label:
          "Foreign-born share",

        axisLines: [
          "FOREIGN-BORN",
          "SHARE",
        ],

        min: 0.35,
        max: 0.85,

        format:
          formatPercent,

        formatDifference:
          formatPercentagePoints,

        getValue(row) {
          if (
            Number.isFinite(
              Number(
                row?.sForeignBorn
              )
            )
          ) {
            return Number(
              row.sForeignBorn
            );
          }


          const foreignBorn =
            Number(
              row?.ForeignBorn
            );


          const population =
            Number(
              row?.Pop
            );


          if (
            Number.isFinite(
              foreignBorn
            ) &&
            Number.isFinite(
              population
            ) &&
            population !== 0
          ) {
            return (
              foreignBorn /
              population
            );
          }


          return null;
        },
      },

      {
        key:
          "SchoolStudents",

        label:
          "School students",

        axisLines: [
          "SCHOOL",
          "STUDENTS",
        ],

        min: 0,
        max: 25_000,

        format:
          formatInteger,

        formatDifference:
          formatInteger,
      },

      {
        key:
          "HospitalRequiredBeds",

        label:
          "Hospital beds",

        axisLines: [
          "HOSPITAL",
          "BEDS",
        ],

        min: 0,
        max: 500,

        format:
          formatInteger,

        formatDifference:
          formatInteger,
      },
    ],
  },


  infrastructure: {
    label:
      "Infrastructure",

    metrics: [
      {
        key: "Access",

        label:
          "Accessibility",

        axisLines: [
          "ACCESSIBILITY",
        ],

        min: 0.85,
        max: 1,

        format:
          formatPercent,

        formatDifference:
          formatPercentagePoints,
      },

      {
        key:
          "ElectricityDemand_kWh_year",

        label:
          "Electricity demand",

        axisLines: [
          "ELECTRICITY",
          "DEMAND",
        ],

        min: 0,
        max: 600_000_000,

        format:
          formatElectricity,

        formatDifference:
          formatElectricityDifference,
      },

      {
        key:
          "WaterTotal_m3_year",

        label:
          "Water demand",

        axisLines: [
          "WATER",
          "DEMAND",
        ],

        min: 0,
        max: 100_000_000,

        format:
          formatWater,

        formatDifference:
          formatWaterDifference,
      },

      {
        key:
          "RoadPerCapita_m",

        label:
          "Road / person",

        axisLines: [
          "ROAD /",
          "PERSON",
        ],

        min: 0,
        max: 4,

        format:
          formatRoad,

        formatDifference:
          formatRoadDifference,
      },
    ],
  },


  environment: {
    label: "Environment",

    metrics: [
      {
        key: "Ren",

        label:
          "Renewables",

        axisLines: [
          "RENEWABLES",
        ],

        min: 0,
        max: 1,

        format:
          formatPercent,

        formatDifference:
          formatPercentagePoints,
      },

      {
        key:
          "CO2_total",

        label:
          "Total CO₂",

        axisLines: [
          "TOTAL CO₂",
        ],

        min: 0,
        max: 3_500_000,

        format:
          formatCompact,

        formatDifference:
          formatCompact,
      },

      {
        key:
          "CO2pc",

        label:
          "CO₂ / person",

        axisLines: [
          "CO₂ /",
          "PERSON",
        ],

        min: 0,
        max: 20,

        format:
          formatOneDecimal,

        formatDifference:
          formatOneDecimalDifference,
      },

      {
        key: "AQI",

        label: "AQI",

        axisLines: [
          "AQI",
        ],

        min: 0,
        max: 50,

        format:
          formatOneDecimal,

        formatDifference:
          formatOneDecimalDifference,
      },
    ],
  },
};


// ─────────────────────────────────────────────────────────────
// BASIC DATA HELPERS
// ─────────────────────────────────────────────────────────────

function getMetricValue(
  row,
  metric
) {
  if (!row) {
    return null;
  }


  const rawValue =
    typeof metric.getValue ===
    "function"
      ? metric.getValue(row)
      : row[metric.key];


  const value =
    Number(rawValue);


  return Number.isFinite(
    value
  )
    ? value
    : null;
}


function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}


function getAxisRatio(
  metric,
  value
) {
  if (
    value === null ||
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }


  const spread =
    metric.max -
    metric.min;


  if (
    spread <= 0
  ) {
    return 0;
  }


  return clamp(
    (
      value -
      metric.min
    ) /
      spread,
    0,
    1
  );
}


// ─────────────────────────────────────────────────────────────
// RANKING / COMPARISON HELPERS
// ─────────────────────────────────────────────────────────────

function getMetricComparison(
  metric,
  rows2049,
  selectedScenario
) {
  const entries =
    SCENARIOS.map(
      (
        scenario
      ) => {
        const value =
          getMetricValue(
            rows2049[
              scenario.id
            ],
            metric
          );


        return {
          id:
            scenario.id,

          label:
            scenario.label,

          value,
        };
      }
    ).filter(
      (
        entry
      ) =>
        entry.value !==
        null
    );


  const selected =
    entries.find(
      (
        entry
      ) =>
        entry.id ===
        selectedScenario
    );


  if (
    !selected ||
    entries.length === 0
  ) {
    return null;
  }


  const sorted =
    [...entries].sort(
      (
        a,
        b
      ) =>
        a.value -
        b.value
    );


  const minEntry =
    sorted[0];


  const maxEntry =
    sorted[
      sorted.length - 1
    ];


  const epsilon =
    Math.max(
      0.000000001,
      Math.abs(
        selected.value
      ) *
        0.000000001
    );


  const sameValueEntries =
    sorted.filter(
      (
        entry
      ) =>
        Math.abs(
          entry.value -
          selected.value
        ) <=
        epsilon
    );


  let rankPhrase =
    "";


  if (
    sameValueEntries.length >
    1
  ) {
    if (
      Math.abs(
        selected.value -
        minEntry.value
      ) <=
      epsilon
    ) {
      rankPhrase =
        "tied for the lowest";
    } else if (
      Math.abs(
        selected.value -
        maxEntry.value
      ) <=
      epsilon
    ) {
      rankPhrase =
        "tied for the highest";
    } else {
      rankPhrase =
        "tied near the middle";
    }
  } else {
    const rankIndex =
      sorted.findIndex(
        (
          entry
        ) =>
          entry.id ===
          selectedScenario
      );


    const rankPhrases = [
      "the lowest",
      "the second-lowest",
      "the second-highest",
      "the highest",
    ];


    rankPhrase =
      rankPhrases[
        rankIndex
      ] ??
      "in the middle";
  }


  let comparisonTarget;


  const isLowest =
    Math.abs(
      selected.value -
      minEntry.value
    ) <=
    epsilon;


  const isHighest =
    Math.abs(
      selected.value -
      maxEntry.value
    ) <=
    epsilon;


  if (
    isLowest &&
    !isHighest
  ) {
    comparisonTarget =
      maxEntry;
  } else if (
    isHighest &&
    !isLowest
  ) {
    comparisonTarget =
      minEntry;
  } else {
    const distanceToMin =
      Math.abs(
        selected.value -
        minEntry.value
      );


    const distanceToMax =
      Math.abs(
        selected.value -
        maxEntry.value
      );


    comparisonTarget =
      distanceToMax >=
      distanceToMin
        ? maxEntry
        : minEntry;
  }


  // If every scenario has
  // exactly the same value,
  // comparisonTarget may be
  // the selected scenario.
  if (
    comparisonTarget.id ===
    selectedScenario
  ) {
    comparisonTarget =
      entries.find(
        (
          entry
        ) =>
          entry.id !==
          selectedScenario
      ) ??
      comparisonTarget;
  }


  const difference =
    selected.value -
    comparisonTarget.value;


  let direction =
    "the same as";


  if (
    difference > epsilon
  ) {
    direction =
      "higher than";
  }


  if (
    difference < -epsilon
  ) {
    direction =
      "lower than";
  }


  return {
    selectedValue:
      selected.value,

    rankPhrase,

    comparisonTarget,

    difference,

    direction,

    entries,
  };
}


// ─────────────────────────────────────────────────────────────
// SAFE, PLAIN-ENGLISH MEANING
//
// These describe what the output means.
//
// They DO NOT claim that one KPI
// caused another KPI.
// ─────────────────────────────────────────────────────────────

function getMeaningClause(
  metric,
  comparison,
  rows2049,
  selectedScenario
) {
  const value =
    comparison.selectedValue;


  const rankPhrase =
    comparison.rankPhrase;


  const selectedRow =
    rows2049[
      selectedScenario
    ];


  const isLow =
    rankPhrase.includes(
      "lowest"
    );


  const isHigh =
    rankPhrase.includes(
      "highest"
    );


  switch (
    metric.key
  ) {
    case "LE": {
      const population =
        Number(
          selectedRow?.Pop
        );


      const income =
        Number(
          selectedRow?.Income
        );


      if (
        Number.isFinite(
          population
        ) &&
        Number.isFinite(
          income
        )
      ) {
        return (
          `This future also models a population of ${formatInteger(
            population
          )} and income of ${formatEuro(
            income
          )} in 2049.`
        );
      }


      return (
        "This is the model's 2049 life-expectancy outcome for this future."
      );
    }


    case "sForeignBorn": {
      const outOfTen =
        Math.round(
          value * 10
        );


      return (
        `That means roughly ${outOfTen} in every 10 residents are modeled as foreign-born.`
      );
    }


    case "SchoolStudents": {
      if (
        isLow
      ) {
        return (
          "This represents the lowest modeled demand on school capacity among the four futures."
        );
      }


      if (
        isHigh
      ) {
        return (
          "This represents the highest modeled demand on school capacity among the four futures."
        );
      }


      return (
        "School-capacity demand sits between the two modeled extremes."
      );
    }


    case "HospitalRequiredBeds": {
      if (
        isLow
      ) {
        return (
          "This represents the lowest modeled healthcare-capacity requirement among the four futures."
        );
      }


      if (
        isHigh
      ) {
        return (
          "This represents the highest modeled healthcare-capacity requirement among the four futures."
        );
      }


      return (
        "Healthcare-capacity requirements sit between the two modeled extremes."
      );
    }


    case "GDPpc": {
      const totalGDP =
        Number(
          selectedRow?.GDP
        );


      if (
        Number.isFinite(
          totalGDP
        )
      ) {
        return (
          `This future also reaches ${formatBillionsEuro(
            totalGDP
          )} in total modeled GDP.`
        );
      }


      return (
        "This is the model's per-person economic output for this future."
      );
    }


    case "GDP": {
      const gdpPerCapita =
        Number(
          selectedRow?.GDPpc
        );


      if (
        Number.isFinite(
          gdpPerCapita
        )
      ) {
        return (
          `GDP per person reaches ${formatEuro(
            gdpPerCapita
          )} in the same future.`
        );
      }


      return (
        "This is the model's total economic output for this future."
      );
    }


    case "Tour": {
      return (
        "This represents the model's total tourism volume in 2049."
      );
    }


    case "Income": {
      const gdpPerCapita =
        Number(
          selectedRow?.GDPpc
        );


      if (
        Number.isFinite(
          gdpPerCapita
        )
      ) {
        return (
          `The same future models GDP per person at ${formatEuro(
            gdpPerCapita
          )}.`
        );
      }


      return (
        "This is the model's income outcome for this future."
      );
    }


    case "Access": {
      return (
        "This is the model's 2049 accessibility score for this future."
      );
    }


    case "ElectricityDemand_kWh_year": {
      if (
        isHigh
      ) {
        return (
          "This future therefore requires the most electricity supply among the four modeled futures."
        );
      }


      if (
        isLow
      ) {
        return (
          "This future requires the least electricity supply among the four modeled futures."
        );
      }


      return (
        "Its electricity requirement sits between the highest- and lowest-demand futures."
      );
    }


    case "WaterTotal_m3_year": {
      if (
        isHigh
      ) {
        return (
          "This represents the greatest total modeled water requirement among the four futures."
        );
      }


      if (
        isLow
      ) {
        return (
          "This represents the smallest total modeled water requirement among the four futures."
        );
      }


      return (
        "Its total water requirement sits between the modeled extremes."
      );
    }


    case "RoadPerCapita_m": {
      return (
        "This shows how much modeled road length exists per resident, not whether mobility itself is better or worse."
      );
    }


    case "Ren": {
      return (
        "This is the share of the modeled energy system supplied by renewables."
      );
    }


    case "CO2_total": {
      if (
        isHigh
      ) {
        return (
          "This is the greatest total modeled CO₂ output among the four futures."
        );
      }


      if (
        isLow
      ) {
        return (
          "This is the smallest total modeled CO₂ output among the four futures."
        );
      }


      return (
        "Total modeled CO₂ output sits between the two scenario extremes."
      );
    }


    case "CO2pc": {
      if (
        isHigh
      ) {
        return (
          "This is the highest modeled CO₂ output per resident among the four futures."
        );
      }


      if (
        isLow
      ) {
        return (
          "This is the lowest modeled CO₂ output per resident among the four futures."
        );
      }


      return (
        "Per-person CO₂ output sits between the two modeled extremes."
      );
    }


    case "AQI": {
      return (
        "This is the model's AQI output; the spider does not treat a larger value as automatically better."
      );
    }


    default:
      return (
        "This is the model's 2049 output for this indicator."
      );
  }
}


// ─────────────────────────────────────────────────────────────
// BUILD ONE SENTENCE FOR THE
// "WHAT THIS MEANS" PANEL
// ─────────────────────────────────────────────────────────────

function buildMetricExplanation(
  metric,
  rows2049,
  selectedScenario
) {
  const comparison =
    getMetricComparison(
      metric,
      rows2049,
      selectedScenario
    );


  if (
    !comparison
  ) {
    return (
      "No 2049 comparison is available for this indicator."
    );
  }


  const actual =
    metric.format(
      comparison.selectedValue
    );


  const formattedDifference =
    metric.formatDifference
      ? metric.formatDifference(
          Math.abs(
            comparison.difference
          )
        )
      : metric.format(
          Math.abs(
            comparison.difference
          )
        );


  let comparisonPhrase =
    "";


  if (
    Math.abs(
      comparison.difference
    ) <
    0.000000001
  ) {
    comparisonPhrase =
      `the same modeled value as ${comparison.comparisonTarget.label}`;
  } else {
    comparisonPhrase =
      `${formattedDifference} ${comparison.direction} ${comparison.comparisonTarget.label}`;
  }


  const meaning =
    getMeaningClause(
      metric,
      comparison,
      rows2049,
      selectedScenario
    );


  return (
    `${actual} — ${comparison.rankPhrase} ${metric.label.toLowerCase()} among the four modeled futures and ${comparisonPhrase}; ${meaning.charAt(
      0
    ).toLowerCase()}${meaning.slice(
      1
    )}`
  );
}


// ─────────────────────────────────────────────────────────────
// RADAR GEOMETRY
// ─────────────────────────────────────────────────────────────

const RADAR_CENTER =
  210;


const RADAR_RADIUS =
  132;


function radarPoint(
  index,
  radiusFactor
) {
  const angle =
    -Math.PI / 2 +
    index *
      (
        Math.PI *
        2 /
        4
      );


  return {
    x:
      RADAR_CENTER +
      Math.cos(
        angle
      ) *
        RADAR_RADIUS *
        radiusFactor,

    y:
      RADAR_CENTER +
      Math.sin(
        angle
      ) *
        RADAR_RADIUS *
        radiusFactor,
  };
}


function pointsToString(
  points
) {
  return points
    .map(
      (
        point
      ) =>
        `${point.x},${point.y}`
    )
    .join(" ");
}


// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ChooseFutureSection({
  step,
}) {
  const [
    selectedPriority,
    setSelectedPriority,
  ] = useState(
    "infrastructure"
  );


  const [
    selectedScenario,
    setSelectedScenario,
  ] = useState(
    "Density"
  );


  const [
    scenarioData,
    setScenarioData,
  ] = useState({});


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    error,
    setError,
  ] = useState(
    ""
  );


  // ───────────────────────────────────────────────────────────
  // LOAD ALL 4 SCENARIO FILES
  // ───────────────────────────────────────────────────────────

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadScenarioData() {
        try {
          setLoading(
            true
          );


          setError(
            ""
          );


          const results =
            await Promise.all(
              SCENARIOS.map(
                async (
                  scenario
                ) => {
                  const response =
                    await fetch(
                      scenario.url
                    );


                  if (
                    !response.ok
                  ) {
                    throw new Error(
                      `Could not load ${scenario.url}: ${response.status}`
                    );
                  }


                  const data =
                    await response.json();


                  return [
                    scenario.id,
                    data,
                  ];
                }
              )
            );


          if (
            cancelled
          ) {
            return;
          }


          setScenarioData(
            Object.fromEntries(
              results
            )
          );
        } catch (
          loadError
        ) {
          console.error(
            "Failed to load final scenario data:",
            loadError
          );


          if (
            !cancelled
          ) {
            setError(
              "The 2049 scenario data could not be loaded."
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      }


      loadScenarioData();


      return () => {
        cancelled =
          true;
      };
    },
    []
  );


  // ───────────────────────────────────────────────────────────
  // GET 2049 ROW FROM EACH FUTURE
  // ───────────────────────────────────────────────────────────

  const rows2049 =
    useMemo(
      () => {
        const rows =
          {};


        SCENARIOS.forEach(
          (
            scenario
          ) => {
            const data =
              scenarioData[
                scenario.id
              ];


            rows[
              scenario.id
            ] =
              Array.isArray(
                data
              )
                ? data.find(
                    (
                      row
                    ) =>
                      Number(
                        row.Year
                      ) ===
                      END_YEAR
                  ) ??
                  null
                : null;
          }
        );


        return rows;
      },
      [
        scenarioData,
      ]
    );


  const priority =
    PRIORITIES[
      selectedPriority
    ];


  // ───────────────────────────────────────────────────────────
  // GET ACTUAL KPI VALUES +
  // FIXED-SCALE RATIOS
  // ───────────────────────────────────────────────────────────

  const metricComparisons =
    useMemo(
      () => {
        return priority.metrics.map(
          (
            metric
          ) => {
            const byScenario =
              {};


            SCENARIOS.forEach(
              (
                scenario
              ) => {
                const value =
                  getMetricValue(
                    rows2049[
                      scenario.id
                    ],
                    metric
                  );


                byScenario[
                  scenario.id
                ] = {
                  value,

                  ratio:
                    getAxisRatio(
                      metric,
                      value
                    ),
                };
              }
            );


            return {
              metric,
              byScenario,
            };
          }
        );
      },
      [
        priority,
        rows2049,
      ]
    );


  // ───────────────────────────────────────────────────────────
  // SVG POINTS
  // ───────────────────────────────────────────────────────────

  const radarPoints =
    useMemo(
      () => {
        const points =
          {};


        SCENARIOS.forEach(
          (
            scenario
          ) => {
            points[
              scenario.id
            ] =
              metricComparisons.map(
                (
                  comparison,
                  index
                ) => {
                  const ratio =
                    comparison
                      .byScenario[
                        scenario.id
                      ].ratio;


                  return radarPoint(
                    index,
                    ratio
                  );
                }
              );
          }
        );


        return points;
      },
      [
        metricComparisons,
      ]
    );


  const selectedScenarioInfo =
    SCENARIOS.find(
      (
        scenario
      ) =>
        scenario.id ===
        selectedScenario
    );


  // ───────────────────────────────────────────────────────────
  // BUILD 4 HUMAN-READABLE
  // EXPLANATIONS
  // ───────────────────────────────────────────────────────────

  const explanations =
    useMemo(
      () => {
        return priority.metrics.map(
          (
            metric
          ) => ({
            key:
              metric.key,

            label:
              metric.label,

            text:
              buildMetricExplanation(
                metric,
                rows2049,
                selectedScenario
              ),
          })
        );
      },
      [
        priority,
        rows2049,
        selectedScenario,
      ]
    );


  // ───────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────

  return (
    <div className="story-choice-explorer">

      {step?.annotation && (
        <p className="story-choice-intro">
          {step.annotation}
        </p>
      )}


      {/* PRIORITY SELECTOR */}

      <div className="story-choice-control-group">

        <span className="story-choice-control-label">
          What do you prioritize?
        </span>


        <div className="story-choice-buttons">

          {Object.entries(
            PRIORITIES
          ).map(
            ([
              priorityId,
              priorityOption,
            ]) => (
              <button
                key={
                  priorityId
                }

                type="button"

                aria-pressed={
                  selectedPriority ===
                  priorityId
                }

                className={
                  `story-choice-button ${
                    selectedPriority ===
                    priorityId
                      ? "is-active"
                      : ""
                  }`
                }

                onClick={() =>
                  setSelectedPriority(
                    priorityId
                  )
                }
              >
                {
                  priorityOption.label
                }
              </button>
            )
          )}

        </div>
      </div>


      {/* SCENARIO SELECTOR */}

      <div className="story-choice-control-group">

        <span className="story-choice-control-label">
          Which future do you want to explore?
        </span>


        <div className="story-choice-buttons story-choice-scenario-buttons">

          {SCENARIOS.map(
            (
              scenario
            ) => (
              <button
                key={
                  scenario.id
                }

                type="button"

                aria-pressed={
                  selectedScenario ===
                  scenario.id
                }

                className={
                  `story-choice-button story-choice-scenario-button ${
                    selectedScenario ===
                    scenario.id
                      ? "is-active"
                      : ""
                  }`
                }

                style={{
                  "--scenario-color":
                    scenario.color,
                }}

                onClick={() =>
                  setSelectedScenario(
                    scenario.id
                  )
                }
              >
                {
                  scenario.label
                }
              </button>
            )
          )}

        </div>
      </div>


      {/* LOADING */}

      {loading && (
        <div className="story-choice-status">
          Loading 2049 futures…
        </div>
      )}


      {/* ERROR */}

      {error && (
        <div className="story-choice-status story-choice-status--error">
          {error}
        </div>
      )}


      {!loading &&
        !error && (
          <>

            <div
              className="story-radar-card"

              style={{
                width:
                  "min(1180px, 100%)",
              }}
            >

              {/* CARD HEADING */}

              <div className="story-radar-heading">

                <span>
                  {
                    priority.label
                  }
                  {" · "}
                  {
                    selectedScenario
                  }
                </span>


                <strong>
                  2049
                </strong>

              </div>


              {/* ─────────────────────────────────────────────
                  GRAPH LEFT + EXPLANATIONS RIGHT

                  flex-wrap means:
                  desktop → side-by-side
                  narrow screens → text automatically drops below
                  ───────────────────────────────────────────── */}

              <div
                style={{
                  display: "flex",

                  flexWrap:
                    "wrap",

                  alignItems:
                    "center",

                  gap:
                    "clamp(2rem, 5vw, 4.5rem)",

                  marginTop:
                    "1rem",
                }}
              >

                {/* ═══════════════════════════════════════════
                    LEFT — SPIDER
                    ═══════════════════════════════════════════ */}

                <div
                  style={{
                    flex:
                      "1 1 520px",

                    minWidth:
                      0,
                  }}
                >

                  <div className="story-radar-chart">

                    <svg
                      key={
                        selectedPriority
                      }

                      className="story-radar-svg"

                      viewBox="0 0 420 420"

                      role="img"

                      aria-label={
                        `${priority.label} comparison for ${selectedScenario} in 2049`
                      }
                    >

                      {/* GRID RINGS */}

                      {[
                        0.25,
                        0.5,
                        0.75,
                        1,
                      ].map(
                        (
                          factor
                        ) => {
                          const points =
                            priority.metrics.map(
                              (
                                metric,
                                index
                              ) =>
                                radarPoint(
                                  index,
                                  factor
                                )
                            );


                          return (
                            <polygon
                              key={
                                factor
                              }

                              className="story-radar-grid-ring"

                              points={
                                pointsToString(
                                  points
                                )
                              }
                            />
                          );
                        }
                      )}


                      {/* AXIS LINES */}

                      {priority.metrics.map(
                        (
                          metric,
                          index
                        ) => {
                          const endpoint =
                            radarPoint(
                              index,
                              1
                            );


                          return (
                            <line
                              key={
                                metric.key
                              }

                              className="story-radar-axis-line"

                              x1={
                                RADAR_CENTER
                              }

                              y1={
                                RADAR_CENTER
                              }

                              x2={
                                endpoint.x
                              }

                              y2={
                                endpoint.y
                              }
                            />
                          );
                        }
                      )}


                      {/* OTHER 3 FUTURES */}

                      {SCENARIOS
                        .filter(
                          (
                            scenario
                          ) =>
                            scenario.id !==
                            selectedScenario
                        )
                        .map(
                          (
                            scenario
                          ) => (
                            <polygon
                              key={
                                scenario.id
                              }

                              className="story-radar-scenario story-radar-scenario--ghost"

                              points={
                                pointsToString(
                                  radarPoints[
                                    scenario.id
                                  ]
                                )
                              }

                              fill="none"

                              stroke={
                                scenario.color
                              }
                            >
                              <title>
                                {
                                  scenario.label
                                }
                              </title>
                            </polygon>
                          )
                        )}


                      {/* SELECTED FUTURE */}

                      <polygon
                        className="story-radar-scenario story-radar-scenario--selected"

                        points={
                          pointsToString(
                            radarPoints[
                              selectedScenario
                            ]
                          )
                        }

                        fill={
                          selectedScenarioInfo.color
                        }

                        stroke={
                          selectedScenarioInfo.color
                        }
                      >
                        <title>
                          {
                            selectedScenario
                          }
                          {" — selected future"}
                        </title>
                      </polygon>


                      {/* SELECTED POINTS */}

                      {radarPoints[
                        selectedScenario
                      ].map(
                        (
                          point,
                          index
                        ) => {
                          const comparison =
                            metricComparisons[
                              index
                            ];


                          const value =
                            comparison
                              .byScenario[
                                selectedScenario
                              ].value;


                          return (
                            <circle
                              key={
                                comparison
                                  .metric
                                  .key
                              }

                              className="story-radar-selected-point"

                              cx={
                                point.x
                              }

                              cy={
                                point.y
                              }

                              r="5"

                              fill={
                                selectedScenarioInfo.color
                              }
                            >
                              <title>
                                {
                                  comparison
                                    .metric
                                    .label
                                }
                                {": "}
                                {
                                  value ===
                                  null
                                    ? "No data"
                                    :
                                      comparison
                                        .metric
                                        .format(
                                          value
                                        )
                                }
                              </title>
                            </circle>
                          );
                        }
                      )}


                      {/* AXIS LABELS + REAL VALUES */}

                      {priority.metrics.map(
                        (
                          metric,
                          index
                        ) => {
                          const labelPoint =
                            radarPoint(
                              index,
                              1.28
                            );


                          const value =
                            metricComparisons[
                              index
                            ]
                              .byScenario[
                                selectedScenario
                              ]
                              .value;


                          let textAnchor =
                            "middle";


                          if (
                            index === 1
                          ) {
                            textAnchor =
                              "start";
                          }


                          if (
                            index === 3
                          ) {
                            textAnchor =
                              "end";
                          }


                          return (
                            <text
                              key={
                                `${metric.key}-label`
                              }

                              className="story-radar-axis-label"

                              x={
                                labelPoint.x
                              }

                              y={
                                labelPoint.y
                              }

                              textAnchor={
                                textAnchor
                              }
                            >

                              {/* KPI NAME */}

                              {metric.axisLines.map(
                                (
                                  line,
                                  lineIndex
                                ) => (
                                  <tspan
                                    key={
                                      `${metric.key}-${lineIndex}`
                                    }

                                    x={
                                      labelPoint.x
                                    }

                                    dy={
                                      lineIndex ===
                                      0
                                        ? 0
                                        : 13
                                    }
                                  >
                                    {
                                      line
                                    }
                                  </tspan>
                                )
                              )}


                              {/* REAL 2049 VALUE */}

                              <tspan
                                x={
                                  labelPoint.x
                                }

                                dy="18"

                                style={{
                                  fill:
                                    selectedScenarioInfo.color,

                                  fontSize:
                                    "11.5px",

                                  fontWeight:
                                    700,

                                  letterSpacing:
                                    "0.01em",
                                }}
                              >
                                {
                                  value ===
                                  null
                                    ? "—"
                                    :
                                      metric.format(
                                        value
                                      )
                                }
                              </tspan>

                            </text>
                          );
                        }
                      )}

                    </svg>

                  </div>


                  {/* LEGEND */}

                  <div className="story-radar-legend">

                    {SCENARIOS.map(
                      (
                        scenario
                      ) => (
                        <div
                          key={
                            scenario.id
                          }

                          className={
                            `story-radar-legend-item ${
                              scenario.id ===
                              selectedScenario
                                ? "is-selected"
                                : ""
                            }`
                          }
                        >

                          <span
                            className="story-radar-legend-line"

                            style={{
                              background:
                                scenario.color,
                            }}
                          />


                          <span>
                            {
                              scenario.label
                            }
                          </span>

                        </div>
                      )
                    )}

                  </div>


                  {/* FIXED-SCALE NOTE */}

                  <p className="story-radar-note">
                    Each axis uses a fixed scale shared by all four modeled
                    futures. The value printed beside each axis is the actual
                    2049 model output. Farther outward means a higher value on
                    that metric — not necessarily a better outcome.
                  </p>

                </div>


                {/* ═══════════════════════════════════════════
                    RIGHT — WHAT THIS MEANS
                    ═══════════════════════════════════════════ */}

                <div
                  style={{
                    flex:
                      "1 1 340px",

                    minWidth:
                      0,

                    padding:
                      "clamp(1.25rem, 2.5vw, 2rem)",

                    border:
                      "1px solid rgba(255, 255, 255, 0.08)",

                    borderRadius:
                      "20px",

                    background:
                      "rgba(255, 255, 255, 0.025)",
                  }}
                  aria-live="polite"
                >

                  <div
                    style={{
                      marginBottom:
                        "1.25rem",

                      fontSize:
                        "0.67rem",

                      fontWeight:
                        600,

                      letterSpacing:
                        "0.13em",

                      textTransform:
                        "uppercase",

                      color:
                        "rgba(255, 255, 255, 0.38)",
                    }}
                  >
                    What this means
                  </div>


                  {explanations.map(
                    (
                      explanation,
                      index
                    ) => (
                      <div
                        key={
                          explanation.key
                        }

                        style={{
                          padding:
                            index === 0
                              ? "0 0 1.25rem"
                              : "1.25rem 0",

                          borderBottom:
                            index <
                            explanations.length -
                              1
                              ? "1px solid rgba(255, 255, 255, 0.07)"
                              : "none",
                        }}
                      >

                        <div
                          style={{
                            display:
                              "flex",

                            alignItems:
                              "center",

                            gap:
                              "0.5rem",

                            marginBottom:
                              "0.55rem",
                          }}
                        >

                          <span
                            style={{
                              width:
                                "7px",

                              height:
                                "7px",

                              flexShrink:
                                0,

                              borderRadius:
                                "999px",

                              background:
                                selectedScenarioInfo.color,
                            }}
                          />


                          <span
                            style={{
                              fontSize:
                                "0.69rem",

                              fontWeight:
                                600,

                              letterSpacing:
                                "0.08em",

                              textTransform:
                                "uppercase",

                              color:
                                "rgba(255, 255, 255, 0.78)",
                            }}
                          >
                            {
                              explanation.label
                            }
                          </span>

                        </div>


                        <p
                          style={{
                            margin:
                              0,

                            fontSize:
                              "0.84rem",

                            lineHeight:
                              1.7,

                            color:
                              "rgba(255, 255, 255, 0.56)",
                          }}
                        >
                          {
                            explanation.text
                          }
                        </p>

                      </div>
                    )
                  )}

                </div>

              </div>

            </div>

          </>
        )}

    </div>
  );
}