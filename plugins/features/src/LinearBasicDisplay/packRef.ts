import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { originHeadId } from '@jbrowse/core/util/originCut'

import {
  LABEL_LEAD_PX,
  LABEL_TOP_GAP_PX,
} from '../RenderFeatureDataRPC/constants.ts'
import { createMoreIsoformsLabel } from '../RenderFeatureDataRPC/floatingLabels.ts'
import {
  PILE_RESERVATION_ID,
  pileHeightPx,
  planDensityCollapse,
  renderedSpanPx,
} from './densityCollapse.ts'
import { seamAtOrAfter, seamAtOrBefore } from './drawnAxis.ts'
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
import { OFFSCREEN_Y } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Span } from '../shared/mergeSpans.ts'
import type { NamedPile } from './densityCollapse.ts'
import type { DrawnAxis } from './drawnAxis.ts'
import type { IsoformTrimPlan } from './isoformTrim.ts'
import type { LabelWidths } from './labelReservation.ts'
import type {
  DisplayModeMetrics,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
  PackKnobFreeInputs,
  PrepMetrics,
} from './layoutInputs.ts'

// Three stages so a solve probes ~10 factors against one preparation; the
// parameter types stop a stage reading a knob it must be invariant to.

interface FeatureGeometry {
  readonly startBp: number
  readonly endBp: number
  // Unscaled, so one prep serves every body scale; `geometryBodyHeightPx`
  // scales it. A count that bites re-derives a stack's in `trimPreparedRef`.
  readonly heightPx: number
  readonly labelRows: number | undefined
  readonly stack: IsoformStack | undefined
  readonly strand: number
  readonly densityFade: boolean
  readonly gene: boolean
  // A hidden stretch between regions cuts it, so less of it draws than it spans.
  readonly cut: boolean
  // The nearest seams outside its drawn span, past which its name's rows never
  // reach: the seam bar keeps them clear of what runs into it.
  readonly seamBeforeBp: number
  readonly seamAfterBp: number
  hasReversed: boolean
  hasNonReversed: boolean
}

interface PackedExtent {
  startBp: number
  endBp: number
  layoutStartBp: number
  layoutEndBp: number
  height: number
  labelTopPx?: number
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
  // Every bp in the prep is on this axis; trims arrive genomic and go through it.
  toDrawnBp: (bp: number) => number
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
  // Each member of a pile holding a name that renders, to its pile, placed as
  // one box before anything else.
  pileByMemberId: ReadonlyMap<string, NamedPile>
  // Each piece of a feature cut at a circular origin to the other, both ways.
  // The two meet there on a ring, so they share a row.
  originPartners: ReadonlyMap<string, string>
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
  toDrawnBp: (bp: number) => number,
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
        const minX = toDrawnBp(labelData.minX)
        const maxX = toDrawnBp(labelData.maxX)
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
  regions: [number, LayoutRegionData][],
  featureIds: ReadonlySet<string> | undefined,
  toDrawnBp: DrawnAxis,
) {
  const features = new Map<string, FeatureGeometry>()
  for (const [, data] of regions) {
    const { reversed } = data
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
        const startBp = toDrawnBp(item.startBp)
        const endBp = toDrawnBp(item.endBp)
        features.set(item.featureId, {
          startBp,
          endBp,
          cut: endBp - startBp < item.endBp - item.startBp,
          seamBeforeBp: seamAtOrBefore(toDrawnBp, startBp),
          seamAfterBp: seamAtOrAfter(toDrawnBp, endBp),
          heightPx: item.featureHeightPx,
          labelRows: item.labelRows,
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

function geometryBodyHeightPx(
  geom: FeatureGeometry,
  { heightMultiplier, labelFontPx }: DisplayModeMetrics,
) {
  return bodyHeightPx(
    geom.heightPx,
    geom.labelRows,
    heightMultiplier,
    labelFontPx,
  )
}

// Reads the raw region data, and the pack applies `heightMultiplier` itself,
// so the probes skip the clone and probe and commit are identical by
// construction.
// `featureIds` narrows the pack to one group's section; the density collapse
// and the label overhang are then decided among that section's own features.
export function prepareRefPack(
  regions: [number, LayoutRegionData][],
  inputs: PackKnobFreeInputs,
  metrics: PrepMetrics,
  toDrawnBp: DrawnAxis,
  featureIds?: ReadonlySet<string>,
): PackPrep {
  const {
    bpPerPx,
    showLabels,
    showDescriptions,
    pinnedFeatureIds,
    labelDecimation = 'all',
  } = inputs

  const labelInfoByFeatureId = gatherLabelInfo(
    regions,
    showLabels,
    showDescriptions,
    metrics.labelFontPx,
    featureIds,
    bpPerPx,
    toDrawnBp,
  )
  const features = gatherFeatureGeometry(regions, featureIds, toDrawnBp)

  const namedFeatureIds = new Set<string>()
  // A subfeature label draws whatever the fit drops, so a mark carrying one
  // keeps its row; a pinned mark keeps its row and its name.
  const stackingLabeledIds = new Set<string>()
  for (const [id, info] of labelInfoByFeatureId) {
    if (
      (anyLabelRenders(info.widths) || info.partLabelReach) &&
      (labelDecimation !== 'fitWidth' ||
        info.widths.subfeature > 0 ||
        info.partLabelReach ||
        pinnedFeatureIds.has(id))
    ) {
      stackingLabeledIds.add(id)
    }
    if (info.widths.name > 0) {
      namedFeatureIds.add(id)
    }
  }

  const stacks: [string, IsoformStack][] = []
  const originPartners = new Map<string, string>()
  for (const [id, geom] of features) {
    if (geom.stack) {
      stacks.push([id, geom.stack])
    }
    const head = originHeadId(id)
    if (head !== undefined && features.has(head)) {
      originPartners.set(id, head)
      originPartners.set(head, id)
    }
  }

  const fold = planDensityCollapse({
    features,
    stackingLabeledIds,
    namedFeatureIds,
    bpPerPx,
    singleRow: metrics.singleRow,
  })

  return {
    toDrawnBp,
    labelInfoByFeatureId,
    features,
    stacks,
    originPartners,
    overhangRoom:
      labelDecimation === 'fitWidth'
        ? labelOverhangRoomPx(
            foldedView(features, fold.pileByMemberId),
            bpPerPx,
            id => {
              const info = labelInfoByFeatureId.get(id)
              return info?.hasName ? info.widths.name : 0
            },
          )
        : undefined,
    ...fold,
  }
}

// Each named pile as the one feature its leader names, spanning the pile, so
// the leader's room is measured from the pile's edge and not from the member
// beside it.
function foldedView(
  features: ReadonlyMap<string, FeatureGeometry>,
  pileByMemberId: ReadonlyMap<string, NamedPile>,
) {
  const view = new Map(features)
  for (const [id, { leaderId, startBp, endBp }] of pileByMemberId) {
    if (id === leaderId) {
      const leader = features.get(id)
      if (leader) {
        view.set(id, { ...leader, startBp, endBp })
      }
    } else {
      view.delete(id)
    }
  }
  return view
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
    prep.toDrawnBp,
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
          : geometryBodyHeightPx(geom, metrics)) +
        isoformGapSpreadPx(stack, heightMultiplier, trim),
      startBp: trim ? prep.toDrawnBp(trim.startBp) : geom.startBp,
      endBp: trim ? prep.toDrawnBp(trim.endBp) : geom.endBp,
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

// A feature a hidden stretch cuts is named only once this much of it draws;
// below it the name would label a sliver at a seam. Zooming in brings it back.
const MIN_CUT_FEATURE_LABEL_PX = 5

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
  const {
    labelInfoByFeatureId,
    features,
    overhangRoom,
    collapsedFeatureIds,
    pileByMemberId,
  } = prep
  const packed = new Map<string, PackedExtent>()
  const droppedNameIds = new Set<string>()
  const droppedDescriptionIds = new Set<string>()

  for (const [id, geom] of features) {
    const labelInfo = labelInfoByFeatureId.get(id)
    const body = trims.bodies.get(id)
    const { startBp, endBp } = body ?? geom
    const bodyPx = body
      ? body.bodyHeightPx
      : geometryBodyHeightPx(geom, metrics)
    // A member of a named pile its leader names for it.
    const folded =
      collapsedFeatureIds.has(id) && pileByMemberId.get(id)?.leaderId !== id
    const badgeWidthPx = body ? body.badgeWidthPx : 0
    const availableRoomPx = availableOverhangRoomPx(overhangRoom, geom, id)
    // Both the keep decision and the dropped-name record hang off this term,
    // so dropped can only mean had a name and lost it.
    const hasDrawableName = showLabels && !!labelInfo?.hasName
    // Measured against the name's own width: a long description says nothing
    // about whether the name fits.
    const nameWidthPx = (labelInfo?.widths.name ?? 0) + badgeWidthPx
    const sliver =
      geom.cut &&
      !pinnedFeatureIds.has(id) &&
      (endBp - startBp) / bpPerPx < MIN_CUT_FEATURE_LABEL_PX
    const keepName =
      hasDrawableName &&
      !sliver &&
      !folded &&
      (geom.gene || !geneNamesOnly || pinnedFeatureIds.has(id)) &&
      keepFeatureLabel(
        labelDecimation,
        availableRoomPx,
        nameWidthPx,
        pinnedFeatureIds.has(id),
        geom.gene ? geneLabelRoomFactor : labelRoomFactor,
      )
    if (hasDrawableName && !keepName) {
      droppedNameIds.add(id)
    }
    // A dropped name removes only the name, so a description still needs its
    // row; a sliver loses both.
    const hasDrawableDescription =
      showDescriptions && !!labelInfo?.hasDescription
    const keepDescription = hasDrawableDescription && !sliver && !folded
    if (hasDrawableDescription && !keepDescription) {
      droppedDescriptionIds.add(id)
    }

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
      startBp,
      endBp,
      layoutStartBp:
        reach && geom.hasReversed
          ? Math.min(span.layoutStartBp, reach.low)
          : span.layoutStartBp,
      layoutEndBp:
        reach && geom.hasNonReversed
          ? Math.max(span.layoutEndBp, reach.high)
          : span.layoutEndBp,
      height: bodyPx + rowPadding + labelLines * labelFontPx,
      labelTopPx: labelLines * labelFontPx > 0 ? bodyPx : undefined,
    })
  }
  return { packed, droppedNameIds, droppedDescriptionIds }
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

// The box a feature claims, and the strip below its body its labels claim:
// the whole row span under the text, since a label that fits inside its
// feature slides along it with the viewport.
function reservedBoxPx(
  ext: PackedExtent,
  geom: FeatureGeometry,
  bpPerPx: number,
) {
  // Through `renderedSpanPx`, so the packer and the density collapse agree
  // where a sub-pixel mark sits.
  const [spanLeftPx, spanRightPx] = renderedSpanPx(
    { startBp: ext.layoutStartBp, endBp: ext.layoutEndBp },
    bpPerPx,
  )
  const [bodyLeftPx, bodyRightPx] = renderedSpanPx(ext, bpPerPx)
  // Only where the arrow paints, past the body's end: reserving one for
  // every stranded mark packed 5000 sub-pixel marks 46 rows deep instead
  // of 2, and a name reaching past it already covers it.
  const { left: arrowLeft, right: arrowRight } = strandArrowReachPx(
    geom.strand,
    bodyRightPx - bodyLeftPx,
    geom.gene,
  )
  const leftPx = Math.min(spanLeftPx, bodyLeftPx - arrowLeft)
  const rightPx = Math.max(spanRightPx, bodyRightPx + arrowRight)
  // A name never starts before its body's edge, the right one in a flipped
  // region, and its rows keep LABEL_LEAD_PX clear there. They start at the
  // first grid row wholly below the text, so what sits beside the body can
  // overlap the text box by at most ROW_PADDING - LABEL_TOP_GAP_PX. The rows
  // never reach back past a seam: the seam bar is that clearance, and
  // reaching it would collide with whatever runs into the seam from the other
  // side.
  const labelRows =
    ext.labelTopPx === undefined
      ? undefined
      : {
          top: ext.labelTopPx + LABEL_TOP_GAP_PX,
          left: geom.hasNonReversed
            ? Math.max(
                Math.min(leftPx, bodyLeftPx - LABEL_LEAD_PX),
                geom.seamBeforeBp / bpPerPx + 1,
              )
            : leftPx,
          right: geom.hasReversed
            ? Math.min(
                Math.max(rightPx, bodyRightPx + LABEL_LEAD_PX),
                geom.seamAfterBp / bpPerPx - 1,
              )
            : rightPx,
        }
  return { leftPx, rightPx, labelRows }
}

// Collapsed mode reserves no labels, so every feature takes row 0 at its own
// height.
function packSingleRow(packed: ReadonlyMap<string, PackedExtent>) {
  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()
  for (const [id, ext] of packed) {
    layoutMap.set(id, 0)
    layoutHeights.set(id, ext.height)
  }
  return { layoutMap, layoutHeights }
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
  const { features, collapsedFeatureIds, collapsedSpansPx, originPartners } =
    prep
  const { trimPlan } = trims
  const { packed, droppedNameIds, droppedDescriptionIds } =
    decideLabelReservations(prep, trims, inputs, metrics)

  if (singleRow) {
    return {
      ...packSingleRow(packed),
      droppedDescriptionIds,
      droppedNameIds,
      trimPlan,
    }
  }

  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()
  // pitchY shrinks with the mode or compact features cannot pack below one
  // 10px grid cell. pitchX 1: at 10, two label spans overlapping by under
  // 10px fall into one bucket and their labels pile onto one row.
  const layout = new GranularRectLayout({
    pitchX: 1,
    pitchY: Math.max(1, Math.round(10 * heightMultiplier)),
  })
  const boxOf = (id: string) => {
    const ext = packed.get(id)!
    const box = reservedBoxPx(ext, features.get(id)!, bpPerPx)
    return {
      id,
      left: box.leftPx,
      right: box.rightPx,
      height: ext.height,
      lower: box.labelRows,
    }
  }
  const { pileByMemberId } = prep
  bookPileReservations(
    layout,
    packed,
    new Set([...collapsedFeatureIds].filter(id => !pileByMemberId.has(id))),
    collapsedSpansPx,
  )
  // Before the stacking pass, as the unnamed piles are booked, so a hotspot
  // keeps the top rows whatever wide feature starts left of it.
  for (const { leaderId, memberIds, startBp } of new Set(
    pileByMemberId.values(),
  )) {
    const boxes = memberIds.map(boxOf)
    const top = layout.addRect(
      `${PILE_RESERVATION_ID}named:${startBp}`,
      Math.min(...boxes.map(box => box.left)),
      Math.max(...boxes.map(box => box.right)),
      Math.max(...boxes.map(box => box.height)),
      boxOf(leaderId).lower,
    )
    for (const box of boxes) {
      layoutMap.set(box.id, top === null ? OFFSCREEN_Y : top)
      layoutHeights.set(box.id, box.height)
    }
  }
  const sorted = byPackPriority(packed, pinnedFeatureIds, prevYByFeatureId)

  for (const [id, ext] of sorted) {
    if (layoutMap.has(id)) {
      continue
    }
    if (collapsedFeatureIds.has(id)) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
      continue
    }
    const partner = originPartners.get(id)
    const pair =
      partner !== undefined && !collapsedFeatureIds.has(partner)
        ? partner
        : undefined
    const box = boxOf(id)
    // A null top means the stack passed GranularRectLayout's own 10000px
    // `maxHeight`, not the display's slot; `countTruncatedFeatures` owns up
    // to it.
    const top =
      pair === undefined
        ? layout.addRect(id, box.left, box.right, box.height, box.lower)
        : layout.addRectsAtOneTop([box, boxOf(pair)])
    const y = top === null ? OFFSCREEN_Y : top
    layoutMap.set(id, y)
    layoutHeights.set(id, ext.height)
    if (pair !== undefined) {
      layoutMap.set(pair, y)
      layoutHeights.set(pair, packed.get(pair)!.height)
    }
  }

  return {
    layoutMap,
    layoutHeights,
    droppedNameIds,
    droppedDescriptionIds,
    trimPlan,
  }
}
