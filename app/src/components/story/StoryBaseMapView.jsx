import { useCallback, useRef } from "react";
import { useLockedMapbox } from "../../hooks/useLockedMapbox";
import { DEFAULT_MAP_STYLE } from "../../utils/mapboxBase";
import { hideStoryFrameCorners } from "./StoryMapUtils";
import "mapbox-gl/dist/mapbox-gl.css";

export default function StoryBaseMapView({ mapStyle = DEFAULT_MAP_STYLE }) {
  const containerRef = useRef(null);

  const addOverlays = useCallback((map) => {
    hideStoryFrameCorners(map);
  }, []);

  useLockedMapbox(containerRef, mapStyle, addOverlays);

  return (
    <div className="story-base-map">
      <div ref={containerRef} className="story-base-map-canvas" />
      <div className="story-map-caption">BASE · ANDORRA</div>
    </div>
  );
}
