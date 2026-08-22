import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import {
  LABEL_EDGE_GUTTER_PX,
  LABEL_FONT_SIZE,
  LABEL_PADDING_PX,
  renderedTextWidth,
} from '../../RenderFeatureDataRPC/constants.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
  MoreIsoformsLabel,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// Gap (px) between a feature's bottom and its floating name/description row.
const LABEL_TOP_GAP_PX = 2

// Vertical virtualization for the floating labels: labels whose feature sits
// outside the visible viewport (± overscan) are never emitted. The band is
// quantized to LABEL_CULL_BUCKET_PX so the label build stays decoupled from
// per-frame scrolling — a scroll tick must NOT rebuild the label DOM (that
// decoupling is why the overlay reads a bucket index, not raw scrollTop).
// Labels only rebuild once the user scrolls a full bucket, and the one-bucket
// overscan on each side keeps the whole viewport covered for every scrollTop
// within a bucket.
//
// The SVG export passes this same band (renderSvg), computed from `scrollTop`
// rather than the bucket getter. It has no per-frame rebuild to avoid, but it
// clips to the same scrolled viewport, so without a band it writes every label
// in the whole content height into the file and then clips all but a screenful
// away. Sharing the band is also what keeps the export emitting exactly the
// labels on screen.
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

// Which of a feature's three labels render, and the ONE place that decides.
//
// The name is gated on `showLabels`. The description is gated on
// `showDescriptions` alone — deliberately not also on `showLabels`, because
// "descriptions without names" is a real state (the fit ladder's `labels` rung
// reaches it, and so does a session carrying the retired
// `showLabels: 'off'` + `showDescriptions: true` pair). A subfeature label is
// worker-baked, so neither of those two flags touches it — `collapsed` mode
// suppresses it back in `rpcProps`, and the only main-thread state that hides it
// is the fit squeeze scaling its reserved row out from under the text
// (`showSubfeatureLabels`, i.e. `model.renderedShowSubfeatureLabels`).
//
// Three callers, and they have to agree or the space reserved for a label
// disagrees with the label drawn in it: `maxRenderedLabelWidth` reserves
// horizontal room (which the packer spends on row placement, and the hit box,
// the highlight overlay and the SVG export's highlight boxes all re-derive),
// `forEachRenderedLabel` skips a feature this yields nothing for, and
// `resolveFeatureLabels` positions what it yields.
function renderedLabelSet(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
  showSubfeatureLabels: boolean,
) {
  const nameLabel = showLabels ? labelData.nameLabel : undefined
  return {
    nameLabel,
    descriptionLabel: showDescriptions ? labelData.descriptionLabel : undefined,
    // Gated on the RESOLVED name, not on `showLabels`: the badge is anchored to
    // the end of the name text, so a badge outliving its name would sit at the
    // feature's left edge claiming isoforms of whatever glyph it landed on. The
    // fit ladder's decimation deletes `nameLabel` outright
    // (applyLayoutToRegion), which is the case `showLabels` alone misses.
    moreIsoformsLabel: nameLabel ? labelData.moreIsoformsLabel : undefined,
    subfeatureLabel: showSubfeatureLabels
      ? labelData.subfeatureLabel
      : undefined,
  }
}

// The widest label row this feature actually draws, at the size it draws it —
// what every box covering the labels has to span.
//
// The subfeature label counts unconditionally here, and only here: the packer
// reserves its overhang whether or not it draws (see decideLabelReservations),
// and every consumer of this width is mirroring that reservation. Hiding it under
// a fit squeeze narrows the text, never the row it was packed into.
function maxRenderedLabelWidth(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
  fontSize: number,
) {
  const { nameLabel, descriptionLabel, subfeatureLabel, moreIsoformsLabel } =
    renderedLabelSet(labelData, showLabels, showDescriptions, true)
  const rendered = (label: { textWidth: number } | undefined) =>
    label ? renderedTextWidth(label.textWidth, fontSize) : 0
  // Rendered rather than baked, so the gap the badge sits after can be added
  // here: resolveFeatureLabels spends a LABEL_PADDING_PX between the name and
  // the badge, and that gap is added AFTER the scale (paddedLabelWidthPx), so a
  // sum of baked widths scaled as a whole comes out one padding short of the
  // row it is meant to cover.
  const nameRow =
    rendered(nameLabel) +
    (moreIsoformsLabel ? LABEL_PADDING_PX + rendered(moreIsoformsLabel) : 0)
  return Math.max(
    nameRow,
    rendered(descriptionLabel),
    rendered(subfeatureLabel),
  )
}

// How far a feature's widest visible label overhangs its glyph. The label is
// left-aligned to the glyph and spills rightward (see computeLabelLeftPx), so
// every consumer that has to cover the label as well as the glyph — the hit box
// (buildFeatureFlatbushIndex), the highlight/selection overlay, and the SVG
// export's highlight boxes, widens by exactly this. `fontSize` is the display
// mode's resolved label size: the baked widths are measured at the base size, so
// a compact mode must scale them down or every one of those boxes overhangs the
// text it is meant to cover.
//
// Every parameter is required. The three that carried defaults never took them
// — all three callers pass all five — and the defaults were the wrong answer
// anyway: `LABEL_FONT_SIZE` is the BASE size, so a caller in a compact mode that
// let it stand would silently reserve the 43% overhang `renderedTextWidth`
// exists to convert away.
export function computeLabelExtraWidth(
  labelData: FeatureLabelData,
  featureWidthPx: number,
  showLabels: boolean,
  showDescriptions: boolean,
  fontSize: number,
) {
  const widest = maxRenderedLabelWidth(
    labelData,
    showLabels,
    showDescriptions,
    fontSize,
  )
  return Math.max(0, widest - featureWidthPx)
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
//
// `visibleStart` clamps to a small gutter rather than to 0, so a gene running
// off the left edge carries its name a few px inside the drawing instead of
// against the border (LABEL_EDGE_GUTTER_PX). It stays under the right-edge
// limit, so it can never push a label past the feature it belongs to.
function computeLabelLeftPx(textWidth: number, bounds: FeatureBoundsPx) {
  const { featureLeftPx, featureRightPx, screenStartPx } = bounds
  const fitsInFeature = textWidth <= featureRightPx - featureLeftPx
  const visibleStart = Math.max(
    screenStartPx + LABEL_EDGE_GUTTER_PX,
    featureLeftPx,
    LABEL_EDGE_GUTTER_PX,
  )
  const rightEdgeLimit = featureRightPx - textWidth
  return fitsInFeature ? Math.min(visibleStart, rightEdgeLimit) : featureLeftPx
}

// Places a label under its feature. The vertical position stacks name over
// description over subfeature via each label's relativeY + padding. Same math
// drives the DOM overlay (overlayElements) and the SVG export (renderSvg),
// so any tweak here is reflected on both paths.
export function computeLabelPosition(
  label: LabelMetrics,
  padding: number,
  bounds: FeatureBoundsPx,
  // the display mode's resolved label size; the baked textWidth is measured at
  // the base size, and computeLabelLeftPx's fits-in-feature test and right-edge
  // clamp both need the width the text will actually occupy
  fontSize = LABEL_FONT_SIZE,
) {
  return {
    labelX: computeLabelLeftPx(
      renderedTextWidth(label.textWidth, fontSize),
      bounds,
    ),
    labelY: bounds.featureBottomPx + label.relativeY + padding,
  }
}

// A union on `kind` rather than one shape with the badge's fields bolted on as
// optionals: the badge and a name are different things sharing a position, and
// only the union lets a consumer that has checked `kind` read `hidden` without
// a fallback for a case the worker never emits.
export interface PlainResolvedLabel {
  label: LabelItem & { isOverlay?: boolean }
  labelX: number
  labelY: number
  kind: 'name' | 'desc' | 'sub'
}

export interface MoreResolvedLabel {
  label: MoreIsoformsLabel
  labelX: number
  labelY: number
  kind: 'more'
}

export type ResolvedLabel = PlainResolvedLabel | MoreResolvedLabel

// The label render context threaded through both label consumers (the DOM
// overlay in overlayElements and the SVG export in renderSvg): which labels
// show, plus the display mode's resolved font size. fontSize is the single knob
// that keeps the reserved row height, the name→description gap, and the drawn
// text in agreement as compact modes shrink the text.
interface LabelRenderContext {
  showLabels: boolean
  showDescriptions: boolean
  // `model.renderedShowSubfeatureLabels` — off only while a fit squeeze is
  // scaling the rows these labels were reserved in
  showSubfeatureLabels: boolean
  fontSize: number
}

function resolveFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  context: LabelRenderContext,
): ResolvedLabel[] {
  const { showLabels, showDescriptions, showSubfeatureLabels, fontSize } =
    context
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
  const { nameLabel, descriptionLabel, subfeatureLabel, moreIsoformsLabel } =
    renderedLabelSet(
      labelData,
      showLabels,
      showDescriptions,
      showSubfeatureLabels,
    )
  const out: ResolvedLabel[] = []
  const add = (
    label: PlainResolvedLabel['label'],
    padding: number,
    kind: PlainResolvedLabel['kind'],
  ) => {
    const resolved = {
      label,
      ...computeLabelPosition(label, padding, bounds, fontSize),
      kind,
    }
    out.push(resolved)
    return resolved
  }
  if (nameLabel) {
    const name = add(nameLabel, LABEL_TOP_GAP_PX, 'name')
    if (moreIsoformsLabel) {
      // Placed off the NAME's resolved x rather than through
      // computeLabelPosition, which clamps each label into the feature
      // independently — the badge reads as the tail of the name, so it has to
      // travel with it wherever those clamps put it. The packer reserved the
      // pair's combined width (renderedLabelWidths), so this cannot overhang
      // into a neighbour the name didn't already claim.
      out.push({
        label: moreIsoformsLabel,
        labelX:
          name.labelX +
          renderedTextWidth(nameLabel.textWidth, fontSize) +
          LABEL_PADDING_PX,
        labelY: name.labelY,
        kind: 'more',
      })
    }
  }
  if (descriptionLabel) {
    // The description sits one label-line (fontSize) below the name; when the
    // name is hidden it collapses up to fill the vacated row. Derived from the
    // mode's fontSize here (not the RPC-baked relativeY) so the gap tracks the
    // compact-shrunk text. `nameLabel` is already gated, so the row is vacated
    // whether the name was hidden or simply absent.
    const relativeY = nameLabel ? fontSize : 0
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
// list per in-bounds feature. Both the DOM overlay (FloatingLabelsLayer) and the
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
  const { showLabels, showDescriptions, showSubfeatureLabels } = context
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
    // The same decision `resolveFeatureLabels` makes below, asked early only so
    // the bp→px mapper stays lazy — not restated: both read `renderedLabelSet`.
    const want = renderedLabelSet(
      labelData,
      showLabels,
      showDescriptions,
      showSubfeatureLabels,
    )
    // The badge is not tested: it only exists alongside a name, so a set with
    // one already has `nameLabel`.
    if (!want.nameLabel && !want.descriptionLabel && !want.subfeatureLabel) {
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
// here (rather than in each caller) keeps the DOM overlay (FloatingLabelsLayer)
// and the SVG export (renderSvg) from drifting — the divergence that let the
// export double-paint a spanning feature's label.
//
// Whether a name/description shows is decided upstream by the caller's fit-aware
// visibility (model.renderedShowLabels / renderedShowDescriptions): the packer
// reserved row height and label-width overhang for exactly the labels these flags
// leave on, so emitted labels never overlap a feature or each other. At the fit
// `bodies` level both flags are off, so no name or description is emitted — but a
// worker-baked SUBFEATURE label still is, because `subfeatureLabels` is a config
// choice rather than a rung and the packer reserves its overhang unconditionally
// to match (see decideLabelReservations). Its own flag
// (model.renderedShowSubfeatureLabels) drops it in the one case the packer's
// reservation stops holding: a fit squeeze, which scales the row it was reserved
// in while the text keeps the mode's font size.
export function forEachDisplayLabel(
  regions: RegionWithData[],
  dataMap: ReadonlyMap<number, FeatureDataResult>,
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
