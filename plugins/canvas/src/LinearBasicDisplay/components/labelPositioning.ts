import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

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

const LABEL_DECIMATION_GAP_PX = 4

export interface LabelVisibility {
  showLabels: boolean
  showDescriptions: boolean
}

function resolveFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  wantName: boolean,
  wantDesc: boolean,
  wantSub: boolean,
): ResolvedLabel[] {
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
  if (wantName) {
    out.push({
      label: labelData.nameLabel!,
      ...computeLabelPosition(labelData.nameLabel!, 2, bounds),
      kind: 'name',
    })
  }
  if (wantDesc) {
    // descriptionLabel.relativeY is baked at RPC time assuming the name
    // label is rendered; when showLabels is off, collapse description up to
    // fill the vacated name row.
    const desc = wantName
      ? labelData.descriptionLabel!
      : { ...labelData.descriptionLabel!, relativeY: 0 }
    out.push({
      label: desc,
      ...computeLabelPosition(desc, 2, bounds),
      kind: 'desc',
    })
  }
  if (wantSub) {
    out.push({
      label: labelData.subfeatureLabel!,
      ...computeLabelPosition(labelData.subfeatureLabel!, 0, bounds),
      kind: 'sub',
    })
  }
  return out
}

function labelGroupBounds(labels: ResolvedLabel[]) {
  return {
    minX: Math.min(...labels.map(l => l.labelX)),
    maxX: Math.max(...labels.map(l => l.labelX + l.label.textWidth)),
  }
}

// Walks a region's floatingLabelsData and emits one position-resolved label
// list per in-bounds feature. Both the DOM overlay (useFloatingLabels) and the
// SVG export (renderSvg.renderLabels) call this so the "collapse description
// when name is hidden" rule and the bounds math don't drift between paths.
//
// When decimateLabels is true (collapse display mode), all visible labels are
// collected, sorted by pixel position, then greedily filtered so only
// horizontally non-overlapping labels are emitted.
export function forEachRenderedLabel(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  visibility: LabelVisibility,
  emit: (featureId: string, labels: ResolvedLabel[]) => void,
  decimateLabels = false,
) {
  const { showLabels, showDescriptions } = visibility
  let toScreen: ((bp: number) => number) | undefined
  const collected: { featureId: string; labels: ResolvedLabel[] }[] = []

  for (const featureId in data.floatingLabelsData) {
    const labelData = data.floatingLabelsData[featureId]!
    if (labelData.maxX < vr.start || labelData.minX > vr.end) {
      continue
    }
    const wantName = showLabels && !!labelData.nameLabel
    const wantDesc = showDescriptions && !!labelData.descriptionLabel
    const wantSub = !decimateLabels && !!labelData.subfeatureLabel
    if (!wantName && !wantDesc && !wantSub) {
      continue
    }
    // Lazy: only build the bp→px mapper once we know we'll emit something.
    toScreen ??= makeBpMapper(vr)
    const labels = resolveFeatureLabels(
      labelData,
      toScreen,
      vr,
      wantName,
      wantDesc,
      wantSub,
    )
    collected.push({ featureId, labels })
  }

  if (decimateLabels) {
    const withBounds = collected.map(item => ({
      ...item,
      ...labelGroupBounds(item.labels),
    }))
    withBounds.sort((a, b) => a.minX - b.minX)
    let nextX = -Infinity
    for (const { featureId, labels, minX, maxX } of withBounds) {
      if (minX >= nextX) {
        emit(featureId, labels)
        nextX = maxX + LABEL_DECIMATION_GAP_PX
      }
    }
  } else {
    for (const { featureId, labels } of collected) {
      emit(featureId, labels)
    }
  }
}
