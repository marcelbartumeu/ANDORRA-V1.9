export function hideStoryFrameCorners(map) {
  if (!map?.getStyle) return;

  const layers = map.getStyle()?.layers ?? [];

  layers.forEach((layer) => {
    if (layer.type !== "circle") return;

    const id = String(layer.id ?? "").toLowerCase();
    const source = String(layer.source ?? "").toLowerCase();
    const circleColor = layer.paint?.["circle-color"];
    const color = typeof circleColor === "string" ? circleColor.toLowerCase() : "";

    const isFrameLayer =
      id.includes("corner") ||
      id.includes("frame") ||
      source.includes("corner") ||
      source.includes("frame");

    const isRedMarker = [
      "red",
      "#f00",
      "#ff0000",
      "#ef4444",
      "#ff453a",
    ].includes(color);

    if ((isFrameLayer || isRedMarker) && map.getLayer(layer.id)) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch (_) {
        // Story maps are decorative/locked. If a provider layer cannot be
        // hidden, leave it untouched instead of breaking map rendering.
      }
    }
  });
}