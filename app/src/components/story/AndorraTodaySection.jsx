import { useEffect, useState } from "react";

import BaseMapView from "../BaseMapView";

import {
  NarrativeCard,
  PhotoPanel,
} from "./StoryShared";

function normalizeMetricName(value = "") {
  return value
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findMetric(data, label) {
  const normalizedLabel = normalizeMetricName(label);

  return data.find((item) => {
    const metricName = normalizeMetricName(
      item["Unnamed: 0"]
    );

    return metricName === normalizedLabel;
  });
}

function CurrentStat({ label, value, unit = "" }) {
  return (
    <div className="story-current-stat">
      <span className="story-current-stat-label">
        {label}
      </span>

      <strong className="story-current-stat-value">
        {value}
        {unit}
      </strong>

      <span className="story-current-stat-year">
        2024 actual
      </span>
    </div>
  );
}

export default function AndorraTodaySection({
  step,
  photoPaths,
}) {
  const [currentData, setCurrentData] = useState([]);
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    async function loadCurrentData() {
      try {
        const response = await fetch("/model/Current.json");

        if (!response.ok) {
          throw new Error(
            `Could not load Current.json: ${response.status}`
          );
        }

        const data = await response.json();
        setCurrentData(data);
      } catch (error) {
        console.error(
          "Failed to load current Andorra data:",
          error
        );

        setDataError(true);
      }
    }

    loadCurrentData();
  }, []);

  const population =
    findMetric(currentData, "Population Growth")?.["2024"];

  const lifeExpectancy =
    findMetric(currentData, "Life expectency")?.["2024"] ??
    findMetric(currentData, "Life expectency ")?.["2024"];

  const foreignBornPercent =
    findMetric(currentData, "% Foreign-born")?.["2024"];

  return (
    <>
      <div className="story-split-grid">
        <div className="story-map-column">

          <div className="story-map-card">
            <BaseMapView mapStyle="satellite" />
          </div>

          {!dataError && (
            <div className="story-current-stats">

              <CurrentStat
                label="Population"
                value={
                  population
                    ? population.toLocaleString()
                    : "—"
                }
              />

              <CurrentStat
                label="Life expectancy"
                value={
                  lifeExpectancy
                    ? lifeExpectancy.toFixed(1)
                    : "—"
                }
                unit=" years"
              />

              <CurrentStat
                label="Foreign-born population"
                value={
                  foreignBornPercent
                    ? foreignBornPercent.toFixed(1)
                    : "—"
                }
                unit="%"
              />

            </div>
          )}

        </div>

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