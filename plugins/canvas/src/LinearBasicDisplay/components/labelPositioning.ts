import { makeBpMapper } from '@jbrowse/core/gpu/canvas2dUtils'

import type {
  FeatureDataResult,
  LabelItem,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/core/gpu/canvas2dUtils'

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

export interface ResolvedLabel {
  label: LabelItem & { isOverlay?: boolean }
  labelX: number
  labelY: number
  kind: 'name' | 'desc' | 'sub'
}

export interface LabelVisibility {
  showLabels: boolean
  showDescriptions: boolean
}

// Walks a region's floatingLabelsData and emits one position-resolved label
// list per in-bounds feature. Both the DOM overlay (useFloatingLabels) and the
// SVG export (renderSvg.renderLabels) call this so the "collapse description
// when name is hidden" rule and the bounds math don't drift between paths.
export function forEachRenderedLabel(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  visibility: LabelVisibility,
  emit: (featureId: string, labels: ResolvedLabel[]) => void,
) {
  const toScreen = makeBpMapper(vr)
  for (const [featureId, labelData] of Object.entries(data.floatingLabelsData)) {
    if (labelData.maxX < vr.start || labelData.minX > vr.end) {
      continue
    }
    const px1 = toScreen(labelData.minX)
    const px2 = toScreen(labelData.maxX)
    const featureLeftPx = Math.min(px1, px2)
    const featureRightPx = Math.max(px1, px2)
    const bounds: FeatureBoundsPx = {
      featureLeftPx,
      featureRightPx,
      featureWidth: featureRightPx - featureLeftPx,
      featureBottomPx: labelData.topY + labelData.featureHeight,
      screenStartPx: vr.screenStartPx,
    }
    const out: ResolvedLabel[] = []
    if (labelData.nameLabel && visibility.showLabels) {
      out.push({
        label: labelData.nameLabel,
        ...computeLabelPosition(labelData.nameLabel, 2, bounds),
        kind: 'name',
      })
    }
    if (labelData.descriptionLabel && visibility.showDescriptions) {
      // descriptionLabel.relativeY is baked at RPC time assuming the name
      // label is rendered; when showLabels is off, collapse description up to
      // fill the vacated name row.
      const nameRendered = !!labelData.nameLabel && visibility.showLabels
      const desc = nameRendered
        ? labelData.descriptionLabel
        : { ...labelData.descriptionLabel, relativeY: 0 }
      out.push({
        label: desc,
        ...computeLabelPosition(desc, 2, bounds),
        kind: 'desc',
      })
    }
    if (labelData.subfeatureLabel) {
      out.push({
        label: labelData.subfeatureLabel,
        ...computeLabelPosition(labelData.subfeatureLabel, 0, bounds),
        kind: 'sub',
      })
    }
    if (out.length > 0) {
      emit(featureId, out)
    }
  }
}
