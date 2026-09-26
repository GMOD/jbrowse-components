import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { createMoreIsoformsLabel } from '../RenderFeatureDataRPC/floatingLabels.ts'
import {
  PILE_RESERVATION_ID,
  pileHeightPx,
  planDensityCollapse,
  renderedSpanPx,
} from './densityCollapse.ts'
import { isoformGapSpreadPx } from './isoformGapFloor.ts'
import { planIsoformTrims } from './isoformTrim.ts'
import {
  anyLabelRenders,
  keepFeatureLabel,
  keptOverhangWidthPx,
  labelOverhangRoomPx,
  paddedLabelWidthPx,
  renderedLabelWidths,
  widerLabelWidths,
} from './labelReservation.ts'
import { bodyHeightPx } from './layoutInputs.ts'
import { strandArrowReachPx } from './marks/strandArrow.ts'
// Safe from this eager module: a `.js.generated.ts` holds the lifted scalar
// functions only, never the shader source.
import { OFFSCREEN_Y } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Span } from '../shared/mergeSpans.ts'
import type { IsoformTrimPlan } from './isoformTrim.ts'
import type { LabelWidths } from './labelReservation.ts'
import type {
  DisplayModeMetrics,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
} from './layoutInputs.ts'

// Three stages so a solve probes ~10 factors against one preparation; the
// `*FreeInputs` parameter types stop a stage reading a knob it must be
// invariant to.

interface FeatureGeometry {
  readonly startBp: number
  readonly endBp: number
  readonly bodyHeightPx: number
  // `bodyHeightPx` is this stack untrimmed; a count that bites re-derives the
  // height in `trimPreparedRef`.
  readonly stack: IsoformStack | undefined
  readonly strand: number
  readonly densityFade: boolean
  readonly gene: boolean
  hasReversed: boolean
  hasNonReversed: boolean
}

interface PackedExtent {
  layoutStartBp: number
  layoutEndBp: number
  height: number
}

interface LabelInfo {
  hasName: boolean
  hasDescription: boolean
  widths: LabelWidths
  // The bp a part's label reaches from the part's own edge, as the label is
  // drawn there rather than at the feature's: `high` past its end, `low`
  // before its start in a flipped region.
  partLabelReach?: { high: number; low: number }
}

export interface PackPrep {
  labelInfoByFeatureId: Map<string, LabelInfo>
  features: Map<string, FeatureGeometry>
  stacks: [string, IsoformStack][]
  overhangRoom: ReturnType<typeof labelOverhangRoomPx> | undefined
  // Decided here because every input to it is invariant to `labelRoomFactor`,
  // so the ~10 probes share one decision.
  collapsedFeatureIds: ReadonlySet<string>
  // Booked out of row 0 before anything stacks, so a feature overlapping a
  // pile stacks above it rather than being handed the pile's row.
  collapsedSpansPx: readonly Span[]
}

// Per kind, because the decimation measures the name alone while the overhang
// covers whichever labels survive.
function gatherLabelInfo(
  regions: [number, FeatureDataResult][],
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontPx: number,
  featureIds: ReadonlySet<string> | undefined,
  bpPerPx: number,
) {
  const labelInfoByFeatureId = new Map<string, LabelInfo>()
  for (const [, data] of regions) {
    for (const labelData of data.floatingLabelsData.values()) {
      const targetId = labelData.parentFeatureId ?? labelData.featureId
      if (featureIds && !featureIds.has(targetId)) {
        continue
      }
      const rendered = renderedLabelWidths(
        labelData,
        showLabels,
        showDescriptions,
        labelFontPx,
      )
      const isPart = labelData.parentFeatureId !== undefined
      const widths = isPart ? { ...rendered, subfeature: 0 } : rendered
      const info = labelInfoByFeatureId.get(targetId) ?? {
        hasName: false,
        hasDescription: false,
        widths,
      }
      info.hasName ||= !!labelData.nameLabel
      info.hasDescription ||= !!labelData.descriptionLabel
      info.widths = widerLabelWidths(info.widths, widths)
      if (isPart && rendered.subfeature > 0) {
        const reachBp = rendered.subfeature * bpPerPx
        const { minX, maxX } = labelData
        info.partLabelReach = {
          high: Math.max(
            info.partLabelReach?.high ?? -Infinity,
            maxX,
            minX + reachBp,
          ),
          low: Math.min(
            info.partLabelReach?.low ?? Infinity,
            minX,
            maxX - reachBp,
          ),
        }
      }
      labelInfoByFeatureId.set(targetId, info)
    }
  }
  return labelInfoByFeatureId
}

// A feature spanning a reversed and a non-reversed region packs once and
// reserves overhang on both sides.
function gatherFeatureGeometry(
  regions: [number, FeatureDataResult][],
  reversedRegions: ReadonlySet<number>,
  metrics: DisplayModeMetrics,
  featureIds: ReadonlySet<string> | undefined,
) {
  const features = new Map<string, FeatureGeometry>()
  for (const [displayedRegionIndex, data] of regions) {
    const reversed = reversedRegions.has(displayedRegionIndex)
    for (const item of data.flatbushItems) {
      if (featureIds && !featureIds.has(item.featureId)) {
        continue
      }
      const existing = features.get(item.featureId)
      if (existing) {
        if (reversed) {
          existing.hasReversed = true
        } else {
          existing.hasNonReversed = true
        }
      } else {
        features.set(item.featureId, {
          startBp: item.startBp,
          endBp: item.endBp,
          bodyHeightPx: bodyHeightPx(
            item.featureHeightPx,
            item.labelRows,
            metrics.heightMultiplier,
            metrics.labelFontPx,
          ),
          stack: item.isoformStack,
          strand: item.strand ?? 0,
          hasReversed: reversed,
          hasNonReversed: !reversed,
          densityFade: item.densityFade,
          gene: !!item.gene,
        })
      }
    }
  }
  return features
}

// Reads the raw region data and applies `heightMultiplier` itself, so the
// probes skip the clone and probe and commit are identical by construction.
// `featureIds` narrows the pack to one group's section; the density collapse
// and the label overhang are then decided among that section's own features.
export function prepareRefPack(
  regions: [number, FeatureDataResult][],
  inputs: LabelRoomFactorFreeInputs,
  metrics: DisplayModeMetrics,
  featureIds?: ReadonlySet<string>,
): PackPrep {
  const {
    bpPerPx,
    showLabels,
    showDescriptions,
    reversedRegions,
    labelDecimation = 'all',
  } = inputs

  const labelInfoByFeatureId = gatherLabelInfo(
    regions,
    showLabels,
    showDescriptions,
    metrics.labelFontPx,
    featureIds,
    bpPerPx,
  )
  const features = gatherFeatureGeometry(
    regions,
    reversedRegions,
    metrics,
    featureIds,
  )

  const labeledFeatureIds = new Set<string>()
  for (const [id, info] of labelInfoByFeatureId) {
    if (anyLabelRenders(info.widths) || info.partLabelReach) {
      labeledFeatureIds.add(id)
    }
  }

  const stacks: [string, IsoformStack][] = []
  for (const [id, geom] of features) {
    if (geom.stack) {
      stacks.push([id, geom.stack])
    }
  }

  return {
    labelInfoByFeatureId,
    features,
    stacks,
    overhangRoom:
      labelDecimation === 'fitWidth'
        ? labelOverhangRoomPx(features, bpPerPx)
        : undefined,
    ...planDensityCollapse(
      features,
      labeledFeatureIds,
      bpPerPx,
      metrics.singleRow,
    ),
  }
}

interface TrimmedBody {
  readonly bodyHeightPx: number
  readonly startBp: number
  readonly endBp: number
  readonly badgeWidthPx: number
}

export interface PackTrims {
  trimPlan: IsoformTrimPlan
  bodies: Map<string, TrimmedBody>
}

export function trimPreparedRef(
  prep: PackPrep,
  inputs: LabelRoomFactorFreeInputs,
  metrics: DisplayModeMetrics,
): PackTrims {
  const { bpPerPx, showLabels } = inputs
  const { labelFontPx, heightMultiplier } = metrics
  const trimPlan = planIsoformTrims(
    prep.stacks,
    inputs.maxIsoformsPerGene,
    inputs.expandedGeneIds,
    bpPerPx,
  )
  const bodies = new Map<string, TrimmedBody>()
  for (const [id, stack] of prep.stacks) {
    const geom = prep.features.get(id)!
    const trim = trimPlan.trims.get(id)
    const badge = trimPlan.badges.get(id)
    bodies.set(id, {
      bodyHeightPx:
        (trim
          ? bodyHeightPx(
              trim.heightPx,
              trim.labelRows,
              heightMultiplier,
              labelFontPx,
            )
          : geom.bodyHeightPx) +
        isoformGapSpreadPx(stack, heightMultiplier, trim),
      startBp: trim ? trim.startBp : geom.startBp,
      endBp: trim ? trim.endBp : geom.endBp,
      badgeWidthPx:
        badge && showLabels && prep.labelInfoByFeatureId.get(id)?.hasName
          ? paddedLabelWidthPx(
              createMoreIsoformsLabel(badge.hidden, badge.expanded),
              labelFontPx,
            )
          : 0,
    })
  }
  return { trimPlan, bodies }
}

// The min across the sides it occupies, so a feature spanning both directions
// must clear on both.
function availableOverhangRoomPx(
  overhangRoom: PackPrep['overhangRoom'],
  geom: FeatureGeometry,
  id: string,
) {
  return overhangRoom
    ? Math.min(
        geom.hasNonReversed ? overhangRoom.rightRoom.get(id)! : Infinity,
        geom.hasReversed ? overhangRoom.leftRoom.get(id)! : Infinity,
      )
    : Infinity
}

function overhangWidenedSpan(
  startBp: number,
  endBp: number,
  overhangBp: number,
  geom: FeatureGeometry,
) {
  return {
    layoutStartBp: geom.hasReversed
      ? Math.min(startBp, endBp - overhangBp)
      : startBp,
    layoutEndBp: geom.hasNonReversed
      ? Math.max(endBp, startBp + overhangBp)
      : endBp,
  }
}

// Pure in `prep` and `trims`, returning fresh per-factor extents so a second
// probe cannot see the first one's decisions.
function decideLabelReservations(
  prep: PackPrep,
  trims: PackTrims,
  inputs: LayoutInputs,
  metrics: DisplayModeMetrics,
) {
  const {
    bpPerPx,
    showLabels,
    showDescriptions,
    pinnedFeatureIds,
    labelDecimation = 'all',
    labelRoomFactor = 1,
    geneLabelRoomFactor = labelRoomFactor,
    geneNamesOnly = false,
  } = inputs
  const { labelFontPx, rowPadding } = metrics
  const { labelInfoByFeatureId, features, overhangRoom } = prep
  const packed = new Map<string, PackedExtent>()
  const droppedLabelIds = new Set<string>()

  for (const [id, geom] of features) {
    const labelInfo = labelInfoByFeatureId.get(id)
    const body = trims.bodies.get(id)
    const { bodyHeightPx, startBp, endBp } = body ?? geom
    const badgeWidthPx = body ? body.badgeWidthPx : 0
    const availableRoomPx = availableOverhangRoomPx(overhangRoom, geom, id)
    // Both the keep decision and the dropped-name record hang off this term,
    // so dropped can only mean had a name and lost it.
    const hasDrawableName = showLabels && !!labelInfo?.hasName
    // Measured against the name's own width: a long description says nothing
    // about whether the name fits.
    const nameWidthPx = (labelInfo?.widths.name ?? 0) + badgeWidthPx
    const keepName =
      hasDrawableName &&
      (geom.gene || !geneNamesOnly || pinnedFeatureIds.has(id)) &&
      keepFeatureLabel(
        labelDecimation,
        availableRoomPx,
        nameWidthPx,
        pinnedFeatureIds.has(id),
        geom.gene ? geneLabelRoomFactor : labelRoomFactor,
      )
    if (hasDrawableName && !keepName) {
      droppedLabelIds.add(id)
    }
    // A dropped name removes only the name, so a description still needs its
    // row.
    const keepDescription = showDescriptions && !!labelInfo?.hasDescription

    const labelLines = (keepName ? 1 : 0) + (keepDescription ? 1 : 0)

    // Not gated on the name or description line: a subfeature label draws
    // whenever it exists, and gating left it unreserved for a gene with no
    // name of its own, where it painted over the neighbour.
    const overhangPx = labelInfo
      ? keptOverhangWidthPx(
          { ...labelInfo.widths, name: nameWidthPx },
          keepName,
          keepDescription,
        )
      : 0
    const span = overhangWidenedSpan(startBp, endBp, overhangPx * bpPerPx, geom)
    const reach = labelInfo?.partLabelReach
    packed.set(id, {
      layoutStartBp:
        reach && geom.hasReversed
          ? Math.min(span.layoutStartBp, reach.low)
          : span.layoutStartBp,
      layoutEndBp:
        reach && geom.hasNonReversed
          ? Math.max(span.layoutEndBp, reach.high)
          : span.layoutEndBp,
      height: bodyHeightPx + rowPadding + labelLines * labelFontPx,
    })
  }
  return { packed, droppedLabelIds }
}

// Sorts after every real row, so a new feature fills gaps rather than
// displacing one holding a top row.
const PRIOR_ROW_NONE = Number.POSITIVE_INFINITY

// Subtraction yields NaN for PRIOR_ROW_NONE - PRIOR_ROW_NONE, silently
// randomizing the order of every new feature.
function compareRank(a: number, b: number) {
  return a === b ? 0 : a < b ? -1 : 1
}

// Three ranks: pinned, then prior row, then bp; this only reorders insertion,
// and every feature still lands on its first-fit row.
function byPackPriority(
  packed: ReadonlyMap<string, PackedExtent>,
  pinnedFeatureIds: ReadonlySet<string>,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const pinRank = (id: string) => (pinnedFeatureIds.has(id) ? 0 : 1)
  const priorRow = (id: string) => prevYByFeatureId?.get(id) ?? PRIOR_ROW_NONE
  return [...packed.entries()].sort(
    ([idA, a], [idB, b]) =>
      compareRank(pinRank(idA), pinRank(idB)) ||
      compareRank(priorRow(idA), priorRow(idB)) ||
      compareRank(a.layoutStartBp, b.layoutStartBp),
  )
}

// A collapsed mark is pinned to row 0 without an `addRect`, so without this
// the stacker reads row 0 as clear and hands it to the next feature
// overlapping the pile.
function bookPileReservations(
  layout: GranularRectLayout,
  packed: ReadonlyMap<string, PackedExtent>,
  collapsedFeatureIds: ReadonlySet<string>,
  collapsedSpansPx: readonly Span[],
) {
  const reservedPileHeightPx = pileHeightPx(packed, collapsedFeatureIds)
  for (const [startPx, endPx] of collapsedSpansPx) {
    layout.addRect(
      `${PILE_RESERVATION_ID}${startPx}`,
      startPx,
      endPx,
      reservedPileHeightPx,
    )
  }
}

export function packPreparedRef(
  prep: PackPrep,
  trims: PackTrims,
  inputs: LayoutInputs,
  metrics: DisplayModeMetrics,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const { bpPerPx, pinnedFeatureIds } = inputs
  const { heightMultiplier, singleRow } = metrics
  const { features, collapsedFeatureIds, collapsedSpansPx } = prep
  const { trimPlan } = trims
  const { packed, droppedLabelIds } = decideLabelReservations(
    prep,
    trims,
    inputs,
    metrics,
  )
  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()

  // A whole-function early-out: the row grid and the priority sort are both
  // dead in collapsed mode and neither is cheap.
  if (singleRow) {
    for (const [id, ext] of packed) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
    }
    return { layoutMap, layoutHeights, droppedLabelIds, trimPlan }
  }

  // pitchY shrinks with the mode or compact features cannot pack below one
  // 10px grid cell. pitchX 1: at 10, two label spans overlapping by under
  // 10px fall into one bucket and their labels pile onto one row.
  const layout = new GranularRectLayout({
    pitchX: 1,
    pitchY: Math.max(1, Math.round(10 * heightMultiplier)),
  })
  bookPileReservations(layout, packed, collapsedFeatureIds, collapsedSpansPx)
  const sorted = byPackPriority(packed, pinnedFeatureIds, prevYByFeatureId)

  for (const [id, ext] of sorted) {
    const geom = features.get(id)!
    if (collapsedFeatureIds.has(id)) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
      continue
    }
    // Only where the arrow paints: reserving one for every stranded mark
    // packed 5000 sub-pixel marks 46 rows deep instead of 2.
    const { left: arrowLeft, right: arrowRight } = strandArrowReachPx(
      geom.strand,
      (geom.endBp - geom.startBp) / bpPerPx,
    )
    // Through `renderedSpanPx`, so the packer and the density collapse agree
    // where a sub-pixel mark sits.
    const [spanLeftPx, spanRightPx] = renderedSpanPx(
      { startBp: ext.layoutStartBp, endBp: ext.layoutEndBp },
      bpPerPx,
    )
    const leftPx = spanLeftPx - arrowLeft
    const rightPx = spanRightPx + arrowRight
    // A null top means the stack passed GranularRectLayout's own 10000px
    // `maxHeight`, not the display's slot; `countTruncatedFeatures` owns up
    // to it.
    const top = layout.addRect(id, leftPx, rightPx, ext.height)
    layoutMap.set(id, top === null ? OFFSCREEN_Y : top)
    layoutHeights.set(id, ext.height)
  }

  return { layoutMap, layoutHeights, droppedLabelIds, trimPlan }
}
