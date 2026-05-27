export interface FeatureBoundsPx {
  featureLeftPx: number
  featureRightPx: number
  featureWidth: number
  featureBottomPx: number
  screenStartPx: number
}

export interface LabelMetrics {
  relativeY: number
  textWidth: number
}

// Centers the label over its feature, falling back to left-align when the
// label is wider than the feature. Clamps the left edge to keep the label
// from spilling off the left side of the screen or past the feature's right
// edge. Same math drives the DOM overlay (useOverlayElements) and the SVG
// export (renderSvg), so any tweak here is reflected on both paths.
export function computeLabelPosition(
  label: LabelMetrics,
  padding: number,
  bounds: FeatureBoundsPx,
) {
  const { featureLeftPx, featureRightPx, featureWidth, featureBottomPx } =
    bounds
  const labelY = featureBottomPx + label.relativeY + padding
  const labelX =
    label.textWidth > featureWidth
      ? featureLeftPx
      : Math.min(
          Math.max(bounds.screenStartPx, featureLeftPx, 0),
          featureRightPx - label.textWidth,
        )
  return { labelX, labelY }
}
