import { maxLabelTextWidth } from '../../RenderFeatureDataRPC/rpcTypes.ts'

import type { FeatureLabelData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

export function computeLabelExtraWidth(
  labelData: FeatureLabelData,
  featureWidthPx: number,
  showLabels = true,
  showDescriptions = true,
) {
  return Math.max(
    0,
    maxLabelTextWidth(labelData, showLabels, showDescriptions) - featureWidthPx,
  )
}

// Position an overlay box outset by (xPadding, yPadding) around a feature rect.
// The top is clamped into the content edge (y >= 0) because ScrollLockedOverlay
// clips at content y=0: without this, a box outset above a top-row feature
// (topPx ≈ 0) has its top border painted at y < 0 and dropped by the clip.
// Height shrinks by the clamped amount so the bottom edge stays put.
export function computeOverlayRect(
  rect: { leftPx: number; topPx: number; width: number; heightPx: number },
  extraWidth: number,
  xPadding: number,
  yPadding: number,
) {
  const outsetTop = rect.topPx - yPadding
  const top = Math.max(0, outsetTop)
  return {
    left: rect.leftPx - xPadding,
    top,
    width: rect.width + extraWidth + xPadding * 2,
    height: rect.heightPx + yPadding * 2 - (top - outsetTop),
  }
}
