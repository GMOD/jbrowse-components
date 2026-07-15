import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// Gap (px) between a feature's bottom and its floating name/description row.
const LABEL_TOP_GAP_PX = 2

// Vertical virtualization for the DOM floating-label overlay: labels whose
// feature sits outside the visible viewport (± overscan) are never emitted as
// DOM nodes. The band is quantized to LABEL_CULL_BUCKET_PX so the label build
// stays decoupled from per-frame scrolling — a scroll tick must NOT rebuild the
// label DOM (that decoupling is why the overlay reads a bucket index, not raw
// scrollTop). Labels only rebuild once the user scrolls a full bucket, and the
// one-bucket overscan on each side keeps the whole viewport covered for every
// scrollTop within a bucket. The SVG export renders the full track and passes no
// band, so it's unaffected.
export const LABEL_CULL_BUCKET_PX = 400

export interface LabelCullBand {
  top: number
  bottom: number
}

// The content-coordinate band to keep, given a quantized scroll bucket
// (Math.floor(scrollTop / LABEL_CULL_BUCKET_PX)) and the viewport height. For
// any scrollTop in [bucket·B, (bucket+1)·B) the visible range is
// [scrollTop, scrollTop + viewportHeight] ⊆ [bucket·B, bucket·B + B + vh], which
// this band covers with a full bucket of margin on each side.
export function labelCullBand(
  scrollBucket: number,
  viewportHeight: number,
): LabelCullBand {
  const bucketTop = scrollBucket * LABEL_CULL_BUCKET_PX
  return {
    top: bucketTop - LABEL_CULL_BUCKET_PX,
    bottom: bucketTop + viewportHeight + 2 * LABEL_CULL_BUCKET_PX,
  }
}

export interface FeatureBoundsPx {
  featureLeftPx: number
  featureRightPx: number
  featureBottomPx: number
  screenStartPx: number
}

export interface LabelMetrics {
  relativeY: number
  textWidth: number
}

// The screen x of a label's left edge.
//
// A label wider than its feature can't fit inside the box, so it pins to the
// feature's left edge and overhangs rightward (the packer reserved that
// overhang). A label that fits starts at the feature's left edge, but two
// clamps bracket that: `visibleStart` pushes it right so it doesn't begin
// off-screen when the feature runs off the left, while `rightEdgeLimit` stops
// it sliding so far right that its end passes the feature's right edge. The
// right-edge limit wins the `Math.min`, so a feature whose right edge sits
// within textWidth of the screen left keeps the label anchored to that right
// edge even though its start then falls left of screen.
function computeLabelLeftPx(textWidth: number, bounds: FeatureBoundsPx) {
  const { featureLeftPx, featureRightPx, screenStartPx } = bounds
  const fitsInFeature = textWidth <= featureRightPx - featureLeftPx
  const visibleStart = Math.max(screenStartPx, featureLeftPx, 0)
  const rightEdgeLimit = featureRightPx - textWidth
  return fitsInFeature ? Math.min(visibleStart, rightEdgeLimit) : featureLeftPx
}

// Places a label under its feature. The vertical position stacks name over
// description over subfeature via each label's relativeY + padding. Same math
// drives the DOM overlay (useOverlayElements) and the SVG export (renderSvg),
// so any tweak here is reflected on both paths.
export function computeLabelPosition(
  label: LabelMetrics,
  padding: number,
  bounds: FeatureBoundsPx,
) {
  return {
    labelX: computeLabelLeftPx(label.textWidth, bounds),
    labelY: bounds.featureBottomPx + label.relativeY + padding,
  }
}

export interface ResolvedLabel {
  label: LabelItem & { isOverlay?: boolean }
  labelX: number
  labelY: number
  kind: 'name' | 'desc' | 'sub'
}

// The label render context threaded through both label consumers (the DOM
// overlay in useOverlayElements and the SVG export in renderSvg): which labels
// show, plus the display mode's resolved font size. fontSize is the single knob
// that keeps the reserved row height, the name→description gap, and the drawn
// text in agreement as compact modes shrink the text.
export interface LabelRenderContext {
  showLabels: boolean
  showDescriptions: boolean
  fontSize: number
}

function resolveFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  context: LabelRenderContext,
): ResolvedLabel[] {
  const { showLabels, showDescriptions, fontSize } = context
  const px1 = toScreen(labelData.minX)
  const px2 = toScreen(labelData.maxX)
  const featureLeftPx = Math.min(px1, px2)
  const featureRightPx = Math.max(px1, px2)
  const bounds: FeatureBoundsPx = {
    featureLeftPx,
    featureRightPx,
    featureBottomPx: labelData.topY + labelData.featureHeight,
    screenStartPx: vr.screenStartPx,
  }
  const { nameLabel, descriptionLabel, subfeatureLabel } = labelData
  const out: ResolvedLabel[] = []
  const add = (
    label: ResolvedLabel['label'],
    padding: number,
    kind: ResolvedLabel['kind'],
  ) => {
    out.push({ label, ...computeLabelPosition(label, padding, bounds), kind })
  }
  if (showLabels && nameLabel) {
    add(nameLabel, LABEL_TOP_GAP_PX, 'name')
  }
  if (showDescriptions && descriptionLabel) {
    // The description sits one label-line (fontSize) below the name; when the
    // name is hidden it collapses up to fill the vacated row. Derived from the
    // mode's fontSize here (not the RPC-baked relativeY) so the gap tracks the
    // compact-shrunk text.
    const relativeY = showLabels && nameLabel ? fontSize : 0
    add({ ...descriptionLabel, relativeY }, LABEL_TOP_GAP_PX, 'desc')
  }
  if (subfeatureLabel) {
    // Overlay subfeature labels sit directly on the feature body (relativeY
    // already lifts them), so they take no extra top gap.
    add(subfeatureLabel, 0, 'sub')
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
  context: LabelRenderContext,
  emit: (featureId: string, labels: ResolvedLabel[]) => void,
  skip?: Set<string>,
  cullBand?: LabelCullBand,
) {
  const { showLabels, showDescriptions } = context
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
    // Vertical virtualization (DOM overlay only): skip features whose label row
    // is outside the visible band. Every label of a feature sits within a couple
    // line-heights of featureBottomPx, well inside the band's one-bucket margin,
    // so testing that single Y is enough. The cull is consistent across regions
    // for a span-crossing feature (topY/featureHeight are region-independent), so
    // it can't reintroduce the double-paint the cross-region dedup prevents.
    if (cullBand) {
      const featureBottomPx = labelData.topY + labelData.featureHeight
      if (featureBottomPx < cullBand.top || featureBottomPx > cullBand.bottom) {
        continue
      }
    }
    const wantName = showLabels && !!labelData.nameLabel
    const wantDesc = showDescriptions && !!labelData.descriptionLabel
    const wantSub = !!labelData.subfeatureLabel
    if (!wantName && !wantDesc && !wantSub) {
      continue
    }
    // Lazy: only build the bp→px mapper once we know we'll emit something.
    toScreen ??= makeBpMapper(vr)
    emit(featureId, resolveFeatureLabels(labelData, toScreen, vr, context))
  }
}

export type RegionWithData = BpRegionBounds & { displayedRegionIndex: number }

// Walks every visible region and emits each feature's resolved labels exactly
// once, even when a feature spans back-to-back regions (collapsed introns) and
// thus appears in several regions' laidOutData. Owning the cross-region dedup
// here (rather than in each caller) keeps the DOM overlay (useFloatingLabels)
// and the SVG export (renderSvg) from drifting — the divergence that let the
// export double-paint a spanning feature's label.
//
// Whether a label shows at all is decided upstream by the caller's fit-aware
// visibility (model.renderedShowLabels / renderedShowDescriptions): the packer
// reserved row height and label-width overhang for exactly the labels these flags
// leave on, so emitted labels never overlap a feature or each other. At the fit
// `bodies` level both flags are off, so nothing is emitted.
export function forEachDisplayLabel(
  regions: RegionWithData[],
  dataMap: Map<number, FeatureDataResult>,
  context: LabelRenderContext,
  emit: (
    featureId: string,
    labels: ResolvedLabel[],
    region: RegionWithData,
  ) => void,
  cullBand?: LabelCullBand,
) {
  const rendered = new Set<string>()
  for (const region of regions) {
    const data = dataMap.get(region.displayedRegionIndex)
    if (data?.floatingLabelsData) {
      forEachRenderedLabel(
        data,
        region,
        context,
        (featureId, labels) => {
          rendered.add(featureId)
          emit(featureId, labels, region)
        },
        rendered,
        cullBand,
      )
    }
  }
}
