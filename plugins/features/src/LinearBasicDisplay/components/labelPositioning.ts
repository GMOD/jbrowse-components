import { originTailId } from '@jbrowse/core/util/originCut'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import {
  LABEL_EDGE_GUTTER_PX,
  LABEL_PADDING_PX,
  LABEL_TOP_GAP_PX,
  OVERLAY_LABEL_MIN_FONT_PX,
  renderedTextWidth,
} from '../../RenderFeatureDataRPC/constants.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
  LabelKinds,
  MoreIsoformsLabel,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LabelColors } from './labelColors.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// Quantizing the cull band decouples the label build from per-frame scrolling:
// the overlay observes a bucket index rather than raw scrollTop, so a scroll tick
// rebuilds no label DOM, and the one-bucket overscan covers every scrollTop
// inside a bucket.
export const LABEL_CULL_BUCKET_PX = 400

export interface LabelCullBand {
  top: number
  bottom: number
}

export function labelScrollBucket(scrollTop: number) {
  return Math.floor(scrollTop / LABEL_CULL_BUCKET_PX)
}

// Every scrollTop inside the bucket has its visible range within this band, with
// a full bucket of margin on each side.
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

export function viewportBand(scrollY: number, viewportHeight: number) {
  return { top: scrollY, bottom: scrollY + viewportHeight }
}

// The name line and the description line under a feature, which is as far below
// `featureBottomPx` as any label reaches.
export function labelStackHeightPx(fontSize: number) {
  return LABEL_TOP_GAP_PX + 2 * fontSize
}

// For painters that redraw every frame anyway, where the bucketed band's margin
// only writes labels nothing shows. Padded above by the label stack, since a
// feature scrolled just off the top can still have a label line in view.
export function exactCullBand(
  scrollY: number,
  viewportHeight: number,
  fontSize: number,
): LabelCullBand {
  const { top, bottom } = viewportBand(scrollY, viewportHeight)
  return { top: top - labelStackHeightPx(fontSize), bottom }
}

// The one place that decides which of a feature's labels render — three callers
// read it, and they have to agree or the space reserved for a label disagrees
// with the label drawn in it. The description is gated on `showDescriptions`
// alone, never also on `showLabels`, because "descriptions without names" is a
// state the fit ladder reaches.
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
    // Gated on the resolved name, not on `showLabels`: the badge anchors to the
    // end of the name text, and the fit ladder's decimation deletes `nameLabel`
    // outright, which `showLabels` alone misses.
    moreIsoformsLabel: nameLabel ? labelData.moreIsoformsLabel : undefined,
    subfeatureLabel: showSubfeatureLabels
      ? labelData.subfeatureLabel
      : undefined,
  }
}

// `renderedLabelSet`'s conjunction hoisted out of the loop, and it has to stay
// that exact disjunction: a kind this says no to must be one that leaves
// undefined. Absent `labelKinds` means a fixture predating the field, which has
// to walk.
function anyLabelKindRenders(
  labelKinds: LabelKinds | undefined,
  { showLabels, showDescriptions, showSubfeatureLabels }: LabelRenderContext,
) {
  return (
    !labelKinds ||
    (showLabels && labelKinds.name) ||
    (showDescriptions && labelKinds.description) ||
    (showSubfeatureLabels && labelKinds.subfeature)
  )
}

// The subfeature label counts unconditionally here, and only here: the packer
// reserves its overhang whether or not it draws, and a fit squeeze narrows the
// text without narrowing the row it was packed into.
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
  // Rendered rather than baked, because the badge's padding is added after the
  // scale: a sum of baked widths scaled whole comes out one padding short.
  const nameRow =
    rendered(nameLabel) +
    (moreIsoformsLabel ? LABEL_PADDING_PX + rendered(moreIsoformsLabel) : 0)
  return Math.max(
    nameRow,
    rendered(descriptionLabel),
    rendered(subfeatureLabel),
  )
}

/**
 * Whether a feature's labels can reach `vr`: its own span, and the bp its
 * widest label spills over past the edge it pins to — the low end, or the
 * high end in a flipped region. A label wider than its feature stays on screen
 * after the feature has left it.
 */
export function labelsReachRegion(
  labelData: FeatureLabelData,
  vr: BpRegionBounds,
  showLabels: boolean,
  showDescriptions: boolean,
  fontSize: number,
) {
  const { minX, maxX } = labelData
  const reachBp =
    (maxRenderedLabelWidth(labelData, showLabels, showDescriptions, fontSize) *
      (vr.end - vr.start)) /
    (vr.screenEndPx - vr.screenStartPx)
  const low = vr.reversed ? Math.min(minX, maxX - reachBp) : minX
  const high = vr.reversed ? maxX : Math.max(maxX, minX + reachBp)
  return high >= vr.start && low <= vr.end
}

// A label is left-aligned to its glyph and spills rightward, so every consumer
// that covers both widens by exactly this. `fontSize` must be the display mode's
// resolved size: the baked widths are measured at the base size, and a compact
// mode that let the base stand reserves an overhang 43% too wide.
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
  textWidth: number
}

// A label wider than its feature pins to the feature's left edge and overhangs
// rightward, the overhang the packer reserved. One that fits sits between two
// clamps: `visibleStart` keeps it from starting off-screen, `rightEdgeLimit`
// stops its end passing the feature's right edge, and the right-edge limit wins.
export function computeLabelLeftPx(
  textWidth: number,
  bounds: Omit<FeatureBoundsPx, 'featureBottomPx'>,
) {
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

export function computeLabelPosition(
  label: LabelMetrics,
  padding: number,
  bounds: FeatureBoundsPx,
  fontSize: number,
) {
  return {
    labelX: computeLabelLeftPx(
      renderedTextWidth(label.textWidth, fontSize),
      bounds,
    ),
    labelY: bounds.featureBottomPx + padding,
  }
}

// A union on `kind` rather than one shape with optional badge fields, so a
// consumer that has checked `kind` reads `hidden` without a fallback for a case
// the worker never emits.
export interface PlainPlacedLabel {
  label: LabelItem & { isOverlay?: boolean }
  labelX: number
  labelY: number
  fontSize: number
  kind: 'name' | 'desc' | 'sub'
}

export interface MorePlacedLabel {
  label: MoreIsoformsLabel
  labelX: number
  labelY: number
  kind: 'more'
}

export type PlacedLabel = PlainPlacedLabel | MorePlacedLabel

export type PlainResolvedLabel = PlainPlacedLabel & { color: string }
export type MoreResolvedLabel = MorePlacedLabel & { color: string }
export type ResolvedLabel = PlainResolvedLabel | MoreResolvedLabel

// `fontSize` is the single knob keeping the reserved row height, the
// name-to-description gap and the drawn text in agreement as compact modes shrink
// the text.
export interface LabelPlacementContext {
  showLabels: boolean
  showDescriptions: boolean
  showSubfeatureLabels: boolean
  fontSize: number
}

export interface LabelRenderContext extends LabelPlacementContext {
  colors: LabelColors
}

function plainLabelColor(
  label: PlainPlacedLabel['label'],
  kind: PlainPlacedLabel['kind'],
  colors: LabelColors,
) {
  return kind === 'sub'
    ? label.isOverlay
      ? colors.subfeatureOverlay
      : colors.subfeature
    : kind === 'desc'
      ? colors.description
      : colors.name
}

/**
 * Where each of one feature's rendered labels sits, colored when the caller
 * supplies a palette: the overlay and the painter want the color, a highlight
 * box wants the geometry alone, and one walk serves both — the color is folded
 * into the placement rather than mapped over it, since this runs per label per
 * frame.
 */
export function placeFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  context: LabelRenderContext,
): ResolvedLabel[]
export function placeFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  context: LabelPlacementContext,
): PlacedLabel[]
export function placeFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  context: LabelPlacementContext & { colors?: LabelColors },
): PlacedLabel[] {
  const {
    showLabels,
    showDescriptions,
    showSubfeatureLabels,
    fontSize,
    colors,
  } = context
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
  const out: (PlacedLabel & { color?: string })[] = []
  const add = (
    label: PlainPlacedLabel['label'],
    padding: number,
    kind: PlainPlacedLabel['kind'],
    size = fontSize,
    offsetY = 0,
  ) => {
    const placed = {
      label,
      ...computeLabelPosition(label, offsetY + padding, bounds, size),
      fontSize: size,
      kind,
      color: colors && plainLabelColor(label, kind, colors),
    }
    out.push(placed)
    return placed
  }
  if (nameLabel) {
    const name = add(nameLabel, LABEL_TOP_GAP_PX, 'name')
    if (moreIsoformsLabel) {
      // Placed off the name's resolved x rather than through
      // `computeLabelPosition`, which clamps each label independently: the badge
      // reads as the tail of the name and has to travel with it.
      out.push({
        label: moreIsoformsLabel,
        labelX:
          name.labelX +
          renderedTextWidth(nameLabel.textWidth, fontSize) +
          LABEL_PADDING_PX,
        labelY: name.labelY,
        kind: 'more',
        color: colors?.more,
      })
    }
  }
  if (descriptionLabel) {
    // Offset by the mode's fontSize so the gap tracks compact-shrunk text and
    // the description collapses into the row a hidden or absent name vacated.
    add(
      descriptionLabel,
      LABEL_TOP_GAP_PX,
      'desc',
      fontSize,
      nameLabel ? fontSize : 0,
    )
  }
  if (subfeatureLabel?.isOverlay) {
    // Sized to the body it sits on, so its backing never reaches the next row
    const { featureHeight } = labelData
    const size = Math.min(fontSize, featureHeight + 1)
    if (size >= OVERLAY_LABEL_MIN_FONT_PX) {
      add(subfeatureLabel, 0, 'sub', size, -featureHeight)
    }
  } else if (subfeatureLabel) {
    add(subfeatureLabel, 0, 'sub')
  }
  return out
}

export function forEachRenderedLabel(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  context: LabelRenderContext,
  emit: (featureId: string, labels: ResolvedLabel[]) => void,
  skip?: Set<string>,
  cullBand?: LabelCullBand,
) {
  if (!anyLabelKindRenders(data.labelKinds, context)) {
    return
  }
  const { showLabels, showDescriptions, showSubfeatureLabels } = context
  let toScreen: ((bp: number) => number) | undefined

  for (const [featureId, labelData] of data.floatingLabelsData) {
    // A feature an earlier region already emitted must not paint twice.
    if (skip?.has(featureId)) {
      continue
    }
    if (
      !labelsReachRegion(
        labelData,
        vr,
        showLabels,
        showDescriptions,
        context.fontSize,
      )
    ) {
      continue
    }
    // Labels hang below featureBottomPx, except an overlay label, which sits
    // inside the feature from topY. topY is region-independent, so the cull
    // answers the same for a span-crossing feature in every region and cannot
    // undo the dedup above.
    if (cullBand) {
      const featureBottomPx = labelData.topY + labelData.featureHeight
      if (featureBottomPx < cullBand.top || labelData.topY > cullBand.bottom) {
        continue
      }
    }
    // Asked early only so the bp→px mapper below stays lazy; both this and
    // `placeFeatureLabels` read `renderedLabelSet`.
    const want = renderedLabelSet(
      labelData,
      showLabels,
      showDescriptions,
      showSubfeatureLabels,
    )
    // The badge goes untested: it exists only alongside a name.
    if (!want.nameLabel && !want.descriptionLabel && !want.subfeatureLabel) {
      continue
    }
    toScreen ??= makeBpMapper(vr)
    emit(featureId, placeFeatureLabels(labelData, toScreen, vr, context))
  }
}

export type RegionWithData = BpRegionBounds & { displayedRegionIndex: number }

// Owns the cross-region dedup, so a feature spanning back-to-back regions emits
// its labels once, as does one spanning the exons of a collapsed-intron view.
// A region that goes back over sequence (a contig listed twice) labels afresh,
// except that one starting at the origin leaves unlabelled each piece past it
// whose piece before it the previous region labelled: the two meet at the seam
// as one feature. A worker-baked subfeature label survives with names and
// descriptions off, because `subfeatureLabels` is a config choice rather than a
// fit rung and the packer reserves its overhang unconditionally.
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
  let rendered = new Set<string>()
  let previous: { region: RegionWithData; emitted: string[] } | undefined
  for (const region of regions) {
    if (previous && revisits(previous.region, region)) {
      rendered = new Set(
        region.start === 0 && !region.reversed
          ? previous.emitted.map(originTailId)
          : [],
      )
    }
    const emitted: string[] = []
    const data = dataMap.get(region.displayedRegionIndex)
    if (data?.floatingLabelsData) {
      forEachRenderedLabel(
        data,
        region,
        context,
        (featureId, labels) => {
          rendered.add(featureId)
          emitted.push(featureId)
          emit(featureId, labels, region)
        },
        rendered,
        cullBand,
      )
    }
    previous = { region, emitted }
  }
}

function revisits(previous: BpRegionBounds, next: BpRegionBounds) {
  return (
    !!previous.reversed !== !!next.reversed ||
    (next.reversed ? next.end > previous.start : next.start < previous.end)
  )
}
