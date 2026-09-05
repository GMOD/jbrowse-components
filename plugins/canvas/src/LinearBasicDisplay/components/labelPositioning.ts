import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import {
  LABEL_EDGE_GUTTER_PX,
  LABEL_PADDING_PX,
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

const LABEL_TOP_GAP_PX = 2

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
  relativeY: number
  textWidth: number
}

// A label wider than its feature pins to the feature's left edge and overhangs
// rightward, the overhang the packer reserved. One that fits sits between two
// clamps: `visibleStart` keeps it from starting off-screen, `rightEdgeLimit`
// stops its end passing the feature's right edge, and the right-edge limit wins.
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
    labelY: bounds.featureBottomPx + label.relativeY + padding,
  }
}

// A union on `kind` rather than one shape with optional badge fields, so a
// consumer that has checked `kind` reads `hidden` without a fallback for a case
// the worker never emits.
export interface PlainResolvedLabel {
  label: LabelItem & { isOverlay?: boolean }
  labelX: number
  labelY: number
  color: string
  kind: 'name' | 'desc' | 'sub'
}

export interface MoreResolvedLabel {
  label: MoreIsoformsLabel
  labelX: number
  labelY: number
  color: string
  kind: 'more'
}

export type ResolvedLabel = PlainResolvedLabel | MoreResolvedLabel

// `fontSize` is the single knob keeping the reserved row height, the
// name-to-description gap and the drawn text in agreement as compact modes shrink
// the text.
export interface LabelRenderContext {
  showLabels: boolean
  showDescriptions: boolean
  showSubfeatureLabels: boolean
  fontSize: number
  colors: LabelColors
}

function resolveFeatureLabels(
  labelData: FeatureLabelData,
  toScreen: (bp: number) => number,
  vr: BpRegionBounds,
  context: LabelRenderContext,
): ResolvedLabel[] {
  const { showLabels, showDescriptions, showSubfeatureLabels, fontSize } =
    context
  const { colors } = context
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
      color:
        kind === 'sub'
          ? label.isOverlay
            ? colors.subfeatureOverlay
            : colors.subfeature
          : kind === 'desc'
            ? colors.description
            : colors.name,
      kind,
    }
    out.push(resolved)
    return resolved
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
        color: colors.more,
        kind: 'more',
      })
    }
  }
  if (descriptionLabel) {
    // Taken from the mode's fontSize rather than the baked relativeY, so the gap
    // tracks compact-shrunk text and the description collapses into the row a
    // hidden or absent name vacated.
    const relativeY = nameLabel ? fontSize : 0
    add({ ...descriptionLabel, relativeY }, LABEL_TOP_GAP_PX, 'desc')
  }
  if (subfeatureLabel) {
    // An overlay subfeature label sits on the feature body, which its relativeY
    // already lifts it to, so it takes no top gap.
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
    if (labelData.maxX < vr.start || labelData.minX > vr.end) {
      continue
    }
    // Every label of a feature sits within a couple of line-heights of
    // featureBottomPx, inside the band's one-bucket margin, so this single Y is
    // enough. topY is region-independent, so the cull answers the same for a
    // span-crossing feature in every region and cannot undo the dedup above.
    if (cullBand) {
      const featureBottomPx = labelData.topY + labelData.featureHeight
      if (featureBottomPx < cullBand.top || featureBottomPx > cullBand.bottom) {
        continue
      }
    }
    // Asked early only so the bp→px mapper below stays lazy; both this and
    // `resolveFeatureLabels` read `renderedLabelSet`.
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
    emit(featureId, resolveFeatureLabels(labelData, toScreen, vr, context))
  }
}

export type RegionWithData = BpRegionBounds & { displayedRegionIndex: number }

// Owns the cross-region dedup, so a feature spanning back-to-back regions emits
// its labels once. A worker-baked subfeature label survives with names and
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
