import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { createMoreIsoformsLabel } from '../RenderFeatureDataRPC/floatingLabels.ts'
import { STRAND_ARROW_WIDTH } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
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
// Straight from the shader's JS twin, and safe from here even though this module
// is eager (layout ← baseModel ← the plugin entry): a `.js.generated.ts` holds
// the lifted scalar functions and nothing else — the WGSL/GLSL source is a
// different generated file. Same property that lets `sharedRendererConstants`
// read the `.consts.generated.ts` directly rather than through the pass barrel,
// and for the same reason; see the paragraph there.
import { arrowDraws } from './passes/shaders/arrow.js.generated.ts'
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

// Packing one ref-group into rows, in the three stages the fit solve depends on:
// `prepareRefPack` gathers what is invariant to every knob the solve turns,
// `trimPreparedRef` prices one isoform count, and `packPreparedRef` places rows
// at one whitespace factor. The hoisting is the design — a solve probes ~10
// factors against one preparation — and the `LabelRoomFactorFreeInputs` and
// `IsoformCountFreeInputs` parameter types are what stop a stage from reading a
// knob it must be invariant to.
//
// Every caller runs all three in that order, which is what makes a probe's
// height the committed layout's height by construction rather than by two code
// paths agreeing (see createPackProbe and layoutRefGroups, both in layout.ts).

// Reserve strand-arrow space only on the side the arrow actually points,
// matching the per-direction padding the legacy renderer used. A forward
// feature points right (left in a reversed region) and vice versa, so the
// overhang lands on exactly one side; padding both sides made every gene
// STRAND_ARROW_WIDTH wider than needed and hurt packing density. A feature
// spanning both reversed and non-reversed regions points opposite ways in
// each, so it legitimately reserves on both sides.
//
// And only where the arrow DRAWS, by `arrowDraws` — arrow.slang's own gate, the
// one both renderers cull on, so a dense repeat run doesn't drown in overlapping
// arrowheads. Asking it here rather than restating the threshold is what keeps
// the reservation and the paint the same decision: the packer reserving 8px for
// an arrow nothing paints made every narrow stranded feature claim space nothing
// paints into. Worst where it costs most: sub-pixel stranded marks
// held out of the density collapse (by a wide feature overlapping them, say) got
// ~8px of layout width apiece instead of ~0, so 5000 of them packed 46 rows deep
// instead of 2.
function strandArrowPadding(
  ext: {
    strand: number
    hasReversed: boolean
    hasNonReversed: boolean
    startBp: number
    endBp: number
  },
  bpPerPx: number,
) {
  const drawsArrow =
    !!ext.strand && arrowDraws((ext.endBp - ext.startBp) / bpPerPx)
  const arrow = drawsArrow ? STRAND_ARROW_WIDTH : 0
  const pointsLeft =
    (ext.hasNonReversed && ext.strand === -1) ||
    (ext.hasReversed && ext.strand === 1)
  const pointsRight =
    (ext.hasNonReversed && ext.strand === 1) ||
    (ext.hasReversed && ext.strand === -1)
  return {
    left: pointsLeft ? arrow : 0,
    right: pointsRight ? arrow : 0,
  }
}

interface FeatureGeometry {
  readonly startBp: number
  readonly endBp: number
  // Compact-scaled feature-body height (px), pre-label — the raw worker height
  // times `heightMultiplier`, computed here rather than read off an
  // already-scaled clone so packing works straight from the raw data.
  readonly bodyHeightPx: number
  // The gene's children as the trim sees them, absent on anything that stacks
  // nothing. `bodyHeightPx` above is this stack UNTRIMMED; a count that bites
  // re-derives the height from the trim (see trimPreparedRef).
  readonly stack: IsoformStack | undefined
  readonly strand: number
  readonly densityFade: boolean
  hasReversed: boolean
  hasNonReversed: boolean
}

// A feature's packing geometry that DOES vary with `labelRoomFactor`: the
// label-widened span the packer collides on, and the row height including
// whichever label lines survived the keep decision.
interface PackedExtent {
  layoutStartBp: number
  layoutEndBp: number
  height: number
}

interface LabelInfo {
  hasName: boolean
  hasDescription: boolean
  widths: LabelWidths
}

// Everything about packing one ref-group that is invariant to `labelRoomFactor`.
// The fit solve probes ~10 factors, so computing this once instead of per probe
// removes roughly half the work from each one (label widths and the two
// neighbor-room sorts are the bulk of it).
export interface PackPrep {
  labelInfoByFeatureId: Map<string, LabelInfo>
  features: Map<string, FeatureGeometry>
  // Every gene in the group that stacks children, so one preparation serves
  // every isoform count the fit ladder probes — the trim is per count and the
  // stacks are not.
  stacks: [string, IsoformStack][]
  // Per-side whitespace a label may overhang into. Only measured for the
  // `fitWidth` decimation; the default `all` policy keeps every name and never asks.
  overhangRoom: ReturnType<typeof labelOverhangRoomPx> | undefined
  // Features the density collapse pins to row 0 rather than letting them stack.
  // Decided here because every input to it — geometry, labels, pile depth — is
  // invariant to `labelRoomFactor`, so the fit solve's ~10 height probes share one
  // decision and each measures the rows the commit will draw.
  collapsedFeatureIds: ReadonlySet<string>
  // The px those marks paint, merged. The packer books this out of row 0 before
  // it stacks anything, so a feature overlapping a pile is stacked above it
  // rather than handed the row the pile is sitting in unreserved.
  collapsedSpansPx: readonly Span[]
}

// Per-feature label geometry: which kinds exist, and the reserved width of each.
// The decimation measures the NAME alone (a long description or subfeature label
// says nothing about whether the name fits its neighbor whitespace), while the
// overhang reservation covers whichever labels survive — hence the per-kind
// widths rather than one max across them.
function gatherLabelInfo(
  regions: [number, FeatureDataResult][],
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontPx: number,
) {
  const labelInfoByFeatureId = new Map<string, LabelInfo>()
  for (const [, data] of regions) {
    for (const labelData of data.floatingLabelsData.values()) {
      const targetId = labelData.parentFeatureId ?? labelData.featureId
      const widths = renderedLabelWidths(
        labelData,
        showLabels,
        showDescriptions,
        labelFontPx,
      )
      const existing = labelInfoByFeatureId.get(targetId)
      if (existing) {
        existing.hasName ||= !!labelData.nameLabel
        existing.hasDescription ||= !!labelData.descriptionLabel
        existing.widths = widerLabelWidths(existing.widths, widths)
      } else {
        labelInfoByFeatureId.set(targetId, {
          hasName: !!labelData.nameLabel,
          hasDescription: !!labelData.descriptionLabel,
          widths,
        })
      }
    }
  }
  return labelInfoByFeatureId
}

// One entry per feature id across the group's regions, carrying the sides it is
// drawn on: a feature spanning a reversed and a non-reversed region packs once
// and reserves label overhang on both.
function gatherFeatureGeometry(
  regions: [number, FeatureDataResult][],
  reversedRegions: ReadonlySet<number>,
  metrics: DisplayModeMetrics,
) {
  const features = new Map<string, FeatureGeometry>()
  for (const [displayedRegionIndex, data] of regions) {
    const reversed = reversedRegions.has(displayedRegionIndex)
    for (const item of data.flatbushItems) {
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
        })
      }
    }
  }
  return features
}

// Gather the factor-invariant half of a pack. Reads the RAW (un-cloned,
// un-height-scaled) region data and applies `heightMultiplier` itself, so packing
// never depends on the clone `computeLaidOutData` makes afterward — that is what
// lets the height probes skip cloning, and what makes probe and commit identical
// by construction.
export function prepareRefPack(
  // Raw regions sharing one `assembly:refName` key.
  regions: [number, FeatureDataResult][],
  inputs: LabelRoomFactorFreeInputs,
  metrics: DisplayModeMetrics,
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
  )
  const features = gatherFeatureGeometry(regions, reversedRegions, metrics)

  const labeledFeatureIds = new Set<string>()
  for (const [id, info] of labelInfoByFeatureId) {
    if (anyLabelRenders(info.widths)) {
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
      inputs.collapseDepth,
      metrics.singleRow,
    ),
  }
}

// A stacked gene's body at one isoform count: shorter, narrower, and carrying a
// badge after its name — all three priced at the count being probed, so the
// stack the solve measures is the stack the commit draws.
interface TrimmedBody {
  readonly bodyHeightPx: number
  readonly startBp: number
  readonly endBp: number
  readonly badgeWidthPx: number
}

// The half of a pack that varies with the isoform count and not with
// `labelRoomFactor`. Only stacked genes have an entry in `bodies`; every other
// feature packs its `FeatureGeometry` as prepared.
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

// Whitespace the name overhang can use, on the side(s) this feature points: the
// min across the sides it occupies, so a feature spanning both directions must
// clear on both. Infinity (no room measured) under the `all` policy.
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

// The feature's span widened by its label overhang, so the packer keeps a kept
// label off its neighbor's row. A reversed region overhangs toward lower bp
// (widening the start); otherwise toward higher bp (widening the end).
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

// Decide each feature's kept label lines at this `labelRoomFactor`, reserving
// their row height and widening its layout span by the reserved label overhang.
// Pure in `prep` and `trims`: it reads the shared geometry and returns fresh
// per-factor extents, so probing a second factor can't see the first one's
// decisions.
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
  } = inputs
  const { labelFontPx, rowPadding } = metrics
  const { labelInfoByFeatureId, features, overhangRoom } = prep
  const packed = new Map<string, PackedExtent>()
  // Features whose name was decimated away (`fitWidth`): no row height or overhang
  // is reserved for it here, and applyLayoutToRegion removes the name afterward so
  // no renderer/hit-test draws it. Empty under the default `all` policy.
  const droppedLabelIds = new Set<string>()

  for (const [id, geom] of features) {
    const labelInfo = labelInfoByFeatureId.get(id)
    const body = trims.bodies.get(id)
    const { bodyHeightPx, startBp, endBp } = body ?? geom
    const badgeWidthPx = body ? body.badgeWidthPx : 0
    const availableRoomPx = availableOverhangRoomPx(overhangRoom, geom, id)
    // Does this feature have a name that the current flags would draw at all?
    // Both the keep decision and the dropped-name record hang off this one term,
    // so "dropped" can only ever mean "had a name and lost it" — spelling the
    // condition out twice let the two disagree about which features were even
    // candidates.
    const hasDrawableName = showLabels && !!labelInfo?.hasName
    // Keep this feature's name unless decimation drops it (no room to host it,
    // and not pinned/highlighted). Measured against the NAME's own width, not the
    // feature's widest label — a description or subfeature label being long says
    // nothing about whether the name fits. A dropped name is recorded so it is
    // removed after layout.
    const nameWidthPx = (labelInfo?.widths.name ?? 0) + badgeWidthPx
    const keepName =
      hasDrawableName &&
      keepFeatureLabel(
        labelDecimation,
        availableRoomPx,
        nameWidthPx,
        pinnedFeatureIds.has(id),
        labelRoomFactor,
      )
    if (hasDrawableName && !keepName) {
      droppedLabelIds.add(id)
    }
    // A dropped name removes only the name (applyLayoutToRegion), so a
    // description still draws and still needs its row reserved.
    const keepDescription = showDescriptions && !!labelInfo?.hasDescription

    // bodyHeightPx is the raw worker height times the compact multiplier; add the
    // mode's inter-row gap (rowPadding) so rows pack tightly. Each kept label
    // line reserves the mode's resolved font size (labelFontPx) so compact rows
    // shrink with the smaller text the renderers draw.
    const labelLines = (keepName ? 1 : 0) + (keepDescription ? 1 : 0)

    // Deliberately NOT gated on the feature keeping a name or description line:
    // a subfeature label (a transcript name under its gene) is un-gated at draw
    // time — showLabels/showDescriptions govern only the feature's OWN name and
    // description (see resolveFeatureLabels) — so its width has to be reserved
    // whenever it exists. Gating on the name/description lines left it
    // unreserved for a gene carrying no name of its own, and for every gene once
    // names were off (config `none`, or the fit ladder's `bodies` rung), where
    // the transcript label then painted over whatever the packer put beside it.
    // keptOverhangWidthPx already maxes the subfeature width in unconditionally
    // and returns 0 when there is no label of any kind, so it is the whole
    // decision.
    const overhangPx = labelInfo
      ? keptOverhangWidthPx(
          { ...labelInfo.widths, name: nameWidthPx },
          keepName,
          keepDescription,
        )
      : 0
    packed.set(id, {
      ...overhangWidenedSpan(startBp, endBp, overhangPx * bpPerPx, geom),
      height: bodyHeightPx + rowPadding + labelLines * labelFontPx,
    })
  }
  return { packed, droppedLabelIds }
}

// The prior row of a feature that wasn't in the previous layout. Sorts after
// every real row by construction, so a newly-arrived feature fills gaps rather
// than displacing one that already held a top row.
const PRIOR_ROW_NONE = Number.POSITIVE_INFINITY

// One rank of a lexicographic sort: 0 when equal, so the caller's `||` chain
// falls through to the next rank. Subtraction would do the same for finite
// values but yields NaN for PRIOR_ROW_NONE - PRIOR_ROW_NONE, silently
// randomizing the relative order of every feature new to the layout.
function compareRank(a: number, b: number) {
  return a === b ? 0 : a < b ? -1 : 1
}

// Insertion order = priority for the low rows in greedy first-fit. Features that
// sat near the top of the previous layout are inserted first so they keep those
// low rows across a zoom re-pack (when label overhang shifts the x-sort and would
// otherwise reshuffle who wins a contested row); features new to this layout are
// inserted last so they fill gaps without displacing an existing top feature.
// This only reorders insertion — every feature still lands on its compact
// first-fit row, so nothing is pushed below where it would pack on its own. Ties
// fall back to layoutStartBp for determinism. Pinned features sort ahead of all
// others (before the prior-y ordering) so they claim the lowest rows in their bp
// range across every re-pack.
//
// Read the comparator as the three ranks it is: pinned, then prior row, then bp.
// "New to this layout" is PRIOR_ROW_NONE rather than a special case, which is
// what makes "new features sort after every returning one" fall out of the
// ordering instead of needing branches of its own.
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

// Book the pile out of row 0 before anything stacks. A collapsed mark is pinned
// there without an `addRect` of its own — that is what makes it free of the row
// limit and of the track height — so without this the greedy stacker reads row 0
// as clear and hands it to the next feature overlapping the pile, which then
// paints into it. One rect per merged span, tall enough to cover the marks
// sitting in it, and never entered in `layoutMap`: it reserves, it does not
// render. The height is the tallest collapsed mark anywhere, so it is one answer
// for every span — and the fit solve re-runs the pack about ten times, which is
// what made re-deriving it per span worth hoisting.
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

// Pack a prepared, trimmed ref-group into rows at one `labelRoomFactor`.
export function packPreparedRef(
  prep: PackPrep,
  trims: PackTrims,
  inputs: LayoutInputs,
  metrics: DisplayModeMetrics,
  // Each feature's y (px) in the previous layout, if any. Used only to order
  // insertion, not to force a row — see byPackPriority.
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const { bpPerPx, pinnedFeatureIds } = inputs
  const { heightMultiplier } = metrics
  const singleRow = metrics.singleRow || !!inputs.flattenRows
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

  // Collapsed mode: every feature shares row 0 by the mode. No greedy stacking
  // and no row to contend for, so nothing after this point has anything to
  // decide — a whole-function early-out rather than a branch inside the loop
  // because the row grid and the priority sort are both dead here and neither is
  // cheap. The pileup fade is unaffected: it reads the rows this assigns, and row
  // 0 being the only row is exactly where marks occlude each other.
  if (singleRow) {
    for (const [id, ext] of packed) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
    }
    return { layoutMap, layoutHeights, droppedLabelIds, trimPlan }
  }

  // GranularRectLayout quantizes rows to pitchY (default 10px), so tops snap to
  // a 10px grid and compact/superCompact features can't pack below one grid
  // cell. Shrink the grid with the mode so the row spacing tightens too — else
  // the scaled feature height alone leaves 10px rows.
  //
  // pitchX=1 (default 10): pixel-precise X packing. At pitchX=10, two features
  // whose reserved label spans overlap by <10px truncate into the same X bucket,
  // the collision test misses it, and their labels pile onto one row. pitchX
  // does not affect memory here — rows hold per-feature intervals (no per-pixel
  // bitmap) and row count is capped by maxHeight, both independent of zoom width.
  const layout = new GranularRectLayout({
    pitchX: 1,
    pitchY: Math.max(1, Math.round(10 * heightMultiplier)),
  })
  bookPileReservations(layout, packed, collapsedFeatureIds, collapsedSpansPx)
  const sorted = byPackPriority(packed, pinnedFeatureIds, prevYByFeatureId)

  for (const [id, ext] of sorted) {
    const geom = features.get(id)!
    // A pile the collapse claimed skips the greedy stacker and shares row 0: it
    // reserves no vertical space, so a pileup deeper than a track will ever show
    // costs one row rather than DENSITY_COLLAPSE_DEPTH-plus of them.
    if (collapsedFeatureIds.has(id)) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
      continue
    }
    const { left: arrowLeft, right: arrowRight } = strandArrowPadding(
      geom,
      bpPerPx,
    )
    // Through `renderedSpanPx`, the same widening the density collapse measures
    // with, so the two agree about where a sub-pixel mark sits. A zero-length
    // span is centered on its coordinate there; grown off its start edge here it
    // sat a pixel right of where it paints, read as clear of the feature on its
    // left, and packed into it.
    const [spanLeftPx, spanRightPx] = renderedSpanPx(
      { startBp: ext.layoutStartBp, endBp: ext.layoutEndBp },
      bpPerPx,
    )
    const leftPx = spanLeftPx - arrowLeft
    const rightPx = spanRightPx + arrowRight
    // A null top means the stack passed GranularRectLayout's own row limit — its
    // `maxHeight` option, which we leave at the 10000px default, NOT the
    // display's `maxHeight` config slot (that clamps the reported content height,
    // and is a tenth the size). Expected on a genuinely deep stack: the feature
    // gets OFFSCREEN_Y so it's filtered out, and `countTruncatedFeatures` is how
    // the display owns up to it.
    const top = layout.addRect(id, leftPx, rightPx, ext.height)
    layoutMap.set(id, top === null ? OFFSCREEN_Y : top)
    layoutHeights.set(id, ext.height)
  }

  return { layoutMap, layoutHeights, droppedLabelIds, trimPlan }
}
