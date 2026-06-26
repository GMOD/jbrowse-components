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

// Walks a region's floatingLabelsData and emits one position-resolved label
// list per in-bounds feature. Both the DOM overlay (useFloatingLabels) and the
// SVG export (renderSvg.renderLabels) call this so the "collapse description
// when name is hidden" rule and the bounds math don't drift between paths.
export function forEachRenderedLabel(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  visibility: LabelVisibility,
  emit: (featureId: string, labels: ResolvedLabel[]) => void,
  skip?: Set<string>,
) {
  const { showLabels, showDescriptions } = visibility
  let toScreen: ((bp: number) => number) | undefined

  for (const featureId in data.floatingLabelsData) {
    // Features already emitted by an earlier region (collapsed introns) are
    // dropped so they don't double-paint in a later region.
    if (skip?.has(featureId)) {
      continue
    }
    const labelData = data.floatingLabelsData[featureId]!
    if (labelData.maxX < vr.start || labelData.minX > vr.end) {
      continue
    }
    const wantName = showLabels && !!labelData.nameLabel
    const wantDesc = showDescriptions && !!labelData.descriptionLabel
    const wantSub = !!labelData.subfeatureLabel
    if (!wantName && !wantDesc && !wantSub) {
      continue
    }
    // Lazy: only build the bp→px mapper once we know we'll emit something.
    toScreen ??= makeBpMapper(vr)
    emit(
      featureId,
      resolveFeatureLabels(labelData, toScreen, vr, wantName, wantDesc, wantSub),
    )
  }
}

export type RegionWithData = BpRegionBounds & { displayedRegionIndex: number }

// Walks every visible region and emits each feature's resolved labels exactly
// once, even when a feature spans back-to-back regions (collapsed introns) and
// thus appears in several regions' laidOutData. Owning the cross-region dedup
// here (rather than in each caller) keeps the DOM overlay (useFloatingLabels)
// and the SVG export (renderSvg) from drifting — the divergence that let the
// export double-paint a spanning feature's label.
export function forEachDisplayLabel(
  regions: RegionWithData[],
  dataMap: Map<number, FeatureDataResult>,
  visibility: LabelVisibility,
  emit: (
    featureId: string,
    labels: ResolvedLabel[],
    region: RegionWithData,
  ) => void,
) {
  const rendered = new Set<string>()
  for (const region of regions) {
    const data = dataMap.get(region.displayedRegionIndex)
    if (!data?.floatingLabelsData) {
      continue
    }
    forEachRenderedLabel(
      data,
      region,
      visibility,
      (featureId, labels) => {
        rendered.add(featureId)
        emit(featureId, labels, region)
      },
      rendered,
    )
  }
}
