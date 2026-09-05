import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import {
  LABEL_PADDING_PX,
  renderedTextWidth,
} from '../RenderFeatureDataRPC/constants.ts'
import { createMoreIsoformsLabel } from '../RenderFeatureDataRPC/floatingLabels.ts'
import { STRAND_ARROW_WIDTH } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  PILE_RESERVATION_ID,
  pileHeightPx,
  pileupFadeIds,
  planDensityCollapse,
  renderedSpanPx,
} from './densityCollapse.ts'
// Straight from the shader's JS twin, and safe from here even though this module
// is eager (layout ← baseModel ← the plugin entry): a `.js.generated.ts` holds
// the lifted scalar functions and nothing else — the WGSL/GLSL source is a
// different generated file. Same property that lets `sharedRendererConstants`
// read the `.consts.generated.ts` directly rather than through the pass barrel,
// and for the same reason; see the paragraph there.
import {
  applyIsoformGapFloor,
  isoformGapSpreadPx,
  planIsoformGapFloor,
} from './isoformGapFloor.ts'
import { applyIsoformTrim, planIsoformTrims } from './isoformTrim.ts'
import { bodyHeightPx, displayModeMetrics } from './layoutInputs.ts'
import { arrowDraws } from './passes/shaders/arrow.js.generated.ts'
import { OFFSCREEN_Y, isPlacedRow } from './rowPlacement.ts'
import { captureFeatureTops } from './yMorph.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Span } from '../shared/mergeSpans.ts'
import type { IsoformTrimPlan } from './isoformTrim.ts'
import type {
  DisplayModeMetrics,
  IsoformCountFreeInputs,
  LabelDecimation,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './layoutInputs.ts'

// Whether a feature keeps its name under the active decimation policy. `all`
// keeps every name; `fitWidth` keeps pinned/highlighted names always, plus any
// name whose width (times `roomFactor`) fits the whitespace its overhang can use
// — the feature box PLUS the gap to the neighbor on the overhang side. A name
// renders left-aligned to the box and overhangs rightward (leftward in a reversed
// region) into free space (see computeLabelPosition), and the packer reserves
// exactly that overhang, so keying on box width alone dropped names that plainly
// had room; keying on the available room drops a name only where it would
// genuinely collide. So an isolated feature keeps its name however narrow its box,
// while a name crammed against its neighbor still sheds — thinning names (and
// their reserved row height) precisely in the dense stretches that overflow.
//
// `roomFactor` is the fit solve's continuous knob, searched over
// [0, FIT_MAX_ROOM_FACTOR]. Note it is NOT bounded below by 1: a factor under 1
// keeps a name even where the neighbor gap is narrower than the name, which is
// safe because the overhang the packer reserves is always the FULL name width, so
// a kept-but-crowded name is pushed to a lower row rather than overlapped. That is
// what lets the solve spend leftover vertical space on labels instead of
// whitespace. Higher factors demand proportionally more room, so the set of kept
// names shrinks monotonically as the factor rises.
function keepFeatureLabel(
  labelDecimation: LabelDecimation,
  availableRoomPx: number,
  nameWidthPx: number,
  pinned: boolean,
  roomFactor: number,
) {
  return (
    labelDecimation === 'all' ||
    pinned ||
    availableRoomPx >= nameWidthPx * roomFactor
  )
}

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

// The label's width as DRAWN at this mode's font size (baked widths are measured
// at the base size, see renderedTextWidth), plus LABEL_PADDING_PX so adjacent
// labels packed onto one row keep a small gap and small measureText
// underestimates don't cause visual overlap. The padding is a fixed gap, so it is
// added after the scale rather than scaled with the text. Keep 0 when there's no
// label so the collapse-to-row-0 path (anyLabelRenders) and empty-feature packing
// stay unaffected.
function paddedLabelWidthPx(
  label: { textWidth: number } | undefined,
  labelFontPx: number,
) {
  // Font 0 is the `bare` rung's "spend nothing" sentinel (dropBelowLabelRows):
  // no text draws there, so no width — including the fixed padding — may be
  // reserved for it.
  return label && label.textWidth > 0 && labelFontPx > 0
    ? renderedTextWidth(label.textWidth, labelFontPx) + LABEL_PADDING_PX
    : 0
}

// One reserved width per label KIND, kept separate rather than collapsed to a
// single max because the packer asks three different questions of them (see
// keptOverhangWidthPx, anyLabelRenders, and the decimation's name-only test).
// Each is 0 when its kind is switched off or absent, so the numbers alone encode
// what renders.
interface LabelWidths {
  name: number
  description: number
  subfeature: number
}

// The widths one floatingLabelsData entry contributes under the current label
// flags. Subfeature labels are deliberately un-gated: unlike names and
// descriptions they always draw when present (see resolveFeatureLabels), so their
// width is always reserved.
function renderedLabelWidths(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontPx: number,
): LabelWidths {
  return {
    // The name alone. The isoform badge shares this row (see
    // `createMoreIsoformsLabel`) but its text depends on the isoform count being
    // probed, so `trimPreparedRef` adds its width at that count rather than
    // baking one width in here.
    name: showLabels ? paddedLabelWidthPx(labelData.nameLabel, labelFontPx) : 0,
    description: showDescriptions
      ? paddedLabelWidthPx(labelData.descriptionLabel, labelFontPx)
      : 0,
    subfeature: paddedLabelWidthPx(labelData.subfeatureLabel, labelFontPx),
  }
}

// A feature can own several floatingLabelsData entries (its own plus its
// subfeatures', via parentFeatureId); it must reserve enough for the widest of
// each kind.
//
// Widest across every isoform, including the ones a trim then drops: this runs
// in the preparation, which is one per pack, while the trim is per probed
// count. So a trimmed gene holds room for a transcript name it no longer draws
// — conservative, and identically so in the probe and the commit.
function widerLabelWidths(a: LabelWidths, b: LabelWidths): LabelWidths {
  return {
    name: Math.max(a.name, b.name),
    description: Math.max(a.description, b.description),
    subfeature: Math.max(a.subfeature, b.subfeature),
  }
}

// Whether anything at all draws for this feature. Gates the sub-pixel
// density-collapse path: a collapsed box reserves no horizontal room, so a
// labeled feature must stack instead of piling its label onto row 0.
function anyLabelRenders(widths: LabelWidths) {
  return widths.name > 0 || widths.description > 0 || widths.subfeature > 0
}

// Horizontal room a feature's labels need beyond its box, given which of them
// survived the keep decision. A decimated name contributes nothing, so the packer
// stops holding space for a name that will not draw.
function keptOverhangWidthPx(
  widths: LabelWidths,
  keepName: boolean,
  keepDescription: boolean,
) {
  return Math.max(
    keepName ? widths.name : 0,
    keepDescription ? widths.description : 0,
    widths.subfeature,
  )
}

function scaleFloat32(arr: Float32Array, multiplier: number) {
  for (let i = 0; i < arr.length; i++) {
    arr[i]! *= multiplier
  }
}

// Scales a Y array by the compact multiplier and then spends each element's
// `below` label rows at the mode's own label font size. Two units, because the
// worker emits geometry in normal-mode px (scaled by `multiplier`) but counts
// label rows (see FeatureLayout.labelRowsAbove) — their height is `labelFontPx`,
// which shrinks on the gentler LABEL_FONT_MULTIPLIERS and so cannot ride the
// geometry scale. `rows` is length-zero whenever the region has no below-labels,
// which is the ordinary case and costs nothing here.
function scaleYWithLabelRows(
  ys: Float32Array,
  rows: Uint8Array,
  multiplier: number,
  labelFontPx: number,
) {
  const hasRows = rows.length > 0
  for (let i = 0; i < ys.length; i++) {
    ys[i] = ys[i]! * multiplier + (hasRows ? rows[i]! * labelFontPx : 0)
  }
}

// Scales all height/y fields in a cloned FeatureDataResult by the compact
// multiplier, and spends the worker's counted `below` label rows at the mode's
// label font size. Worker geometry is always in normal-mode units; this makes
// compact/superCompact a pure main-thread operation.
//
// No `multiplier === 1` early return: normal mode still has label rows to spend
// (the worker leaves the Y gap-free in EVERY mode), so the pass is uniform
// across modes rather than special-cased for one.
function applyHeightScale(
  data: FeatureDataResult,
  multiplier: number,
  labelFontPx: number,
) {
  for (const kind of ['rect', 'line', 'arrow'] as const) {
    scaleYWithLabelRows(
      data[`${kind}Ys`],
      data[`${kind}LabelRows`],
      multiplier,
      labelFontPx,
    )
    scaleFloat32(data[`${kind}Heights`], multiplier)
  }
  for (const item of data.flatbushItems) {
    // a gene's own extent has to cover every label row it contains, which is
    // what keeps the hit box in step with the row the packer gave it
    item.featureHeightPx = bodyHeightPx(
      item.featureHeightPx,
      item.labelRows,
      multiplier,
      labelFontPx,
    )
  }
  for (const info of data.subfeatureInfos) {
    const above = (info.labelRowsAbove ?? 0) * labelFontPx
    info.topPx = info.topPx * multiplier + above
    // a transcript's own label row sits under its body, so its hit box covers it
    info.bottomPx =
      info.bottomPx * multiplier + above + (info.ownsLabelRow ? labelFontPx : 0)
  }
  for (const labelData of data.floatingLabelsData.values()) {
    labelData.topY =
      labelData.topY * multiplier +
      (labelData.labelRowsAbove ?? 0) * labelFontPx
    // same term the flatbush loop above applies, and for the same reason: the
    // name label hangs off this height
    labelData.featureHeight =
      labelData.featureHeight * multiplier +
      (labelData.labelRows ?? 0) * labelFontPx
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx = aa.topPx * multiplier + (aa.labelRowsAbove ?? 0) * labelFontPx
      // heightPx drives the peptide letter font size and vertical centering
      // (peptidePositioning.ts) and the codon hit box (hitTesting.ts); scale it
      // with topPx so letters stay sized to and centered on the shrunken codon
      // rect (whose height is scaled via rectHeights) in compact mode.
      aa.heightPx *= multiplier
    }
  }
}

// Pure layout. Raw data from the worker has Y coordinates relative to feature
// top (topPx = 0). This returns a new map where each region's Y values have
// been shifted by the per-feature top computed by GranularRectLayout.
// Regions sharing the same `assembly:refName` key share one layout so spanning
// features get the same Y in every region they appear in.
export function computeLaidOutData(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  // Feature id -> y (px) from the previous layout, used only to order insertion
  // so top features keep their rows across a re-pack (see packPreparedRef).
  prevYByFeatureId?: ReadonlyMap<string, number>,
): Map<number, FeatureDataResult> {
  return layoutRefGroups(rpcDataMap, inputs, prevYByFeatureId).out
}

// `computeLaidOutData` plus the ids the collapse pinned to row 0, which the
// incremental wrapper needs and no other caller does (see `seedRowsFrom`). Kept
// as the shared body rather than widening `computeLaidOutData`'s return, so the
// pure entry point every test and probe uses still answers with just the layout.
//
// The pileup fade runs here and not in the pack: the fit solve's height probes
// pack a ref-group ~10 times and read nothing but the rows, so the sweep belongs
// in the committed layout, where its answer is the one that renders.
function layoutRefGroups(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const metrics = displayModeMetrics(inputs)
  const out = new Map<number, FeatureDataResult>()
  const collapsedIds = new Set<string>()
  for (const [, regions] of groupRawByRef(rpcDataMap)) {
    const prep = prepareRefPack(regions, inputs, metrics)
    for (const id of prep.collapsedFeatureIds) {
      collapsedIds.add(id)
    }
    const trims = trimPreparedRef(prep, inputs, metrics)
    const { layoutMap, layoutHeights, droppedLabelIds, trimPlan } =
      packPreparedRef(prep, trims, inputs, metrics, prevYByFeatureId)
    const gapSpreads = planIsoformGapFloor(
      prep.stacks,
      trimPlan.trims,
      metrics.heightMultiplier,
    )
    const densityFadeIds = pileupFadeIds(
      prep.features,
      layoutMap,
      inputs.bpPerPx,
    )
    // Clone only now that the packing is decided: cloneMutableFields dominates
    // this function's cost (~4/5 of it at 4k features), so the height probes the
    // fit solve runs skip it entirely (see packedContentHeight) and only the
    // committed layout pays it.
    for (const [n, raw] of regions) {
      const cloned = cloneMutableFields(raw)
      // Before the height scale, so the trim's px and its whole label rows are
      // each spent in the unit the worker counted them in (see
      // `applyIsoformTrim`).
      applyIsoformTrim(cloned, trimPlan)
      applyHeightScale(cloned, metrics.heightMultiplier, metrics.labelFontPx)
      // After the scale, because the pixel it promises is a DRAWN one, and the
      // packer has already reserved the same spread through
      // `isoformGapSpreadPx` — the two read one formula so the row a gene is
      // given is the row it fills.
      applyIsoformGapFloor(cloned, gapSpreads)
      applyLayoutToRegion(
        cloned,
        layoutMap,
        layoutHeights,
        droppedLabelIds,
        densityFadeIds,
      )
      out.set(n, cloned)
    }
  }
  for (const [n, raw] of rpcDataMap) {
    if (raw.flatbushItems.length === 0) {
      // Empty regions need no layout mutations — share the raw object rather
      // than allocating clone arrays that will never be written. groupRawByRef
      // skips them, so nothing above has set them.
      out.set(n, raw)
    }
  }

  return { out, collapsedIds }
}

// Content height of a set of packed rows, matching `maxBottom` of the layout the
// same pack would produce. Unplaced rows are excluded through the same
// `isPlacedRow` test `maxBottom` uses, and `measureIds` restricts the measurement
// the same way it does there, so a probe and the committed layout answer the same
// question.
function packedRowsHeight(
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
  measureIds?: ReadonlySet<string>,
) {
  let max = 0
  for (const [id, top] of layoutMap) {
    if (measureIds && !measureIds.has(id)) {
      continue
    }
    const bottom = top + layoutHeights.get(id)!
    if (isPlacedRow(top) && bottom > max) {
      max = bottom
    }
  }
  return max
}

// Measure the content height of many `labelRoomFactor` candidates against ONE
// preparation, trimmed at one isoform count. Returns the trim step; it returns
// the probe, and each probe call packs the trimmed groups at that factor and
// reports the height `computeLaidOutData` would report for it.
//
// This is what makes the fit solve affordable. A probe skips `cloneMutableFields`
// and `applyLayoutToRegion` (~4/5 of a full layout), and hoisting the prep out of
// the loop removes roughly half of what remains — the per-kind label widths and
// the two neighbor-room sorts, none of which depend on the factor. The trim is
// hoisted one level below that, because it depends on the count and not on the
// factor: the label solve trims once and packs ~10 times, the count solve trims
// and packs once per count. Because every probe and the eventual commit run the
// identical pack over the identical raw values, the height measured here IS the
// height the committed layout reports, by construction rather than by two code
// paths agreeing.
function createPackProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
  prevYByFeatureId: ReadonlyMap<string, number> | undefined,
  // Features the height is measured over (see `maxBottom`). It narrows only the
  // measurement, never the pack: every feature still claims its row, so the
  // rows the solve's knob is chosen against are the rows that will render.
  measureIds: ReadonlySet<string> | undefined,
) {
  const metrics = displayModeMetrics(inputs)
  const preps = [...groupRawByRef(rpcDataMap).values()].map(regions =>
    prepareRefPack(regions, inputs, metrics),
  )
  return (maxIsoformsPerGene: number | undefined) => {
    const trimmedInputs = { ...inputs, maxIsoformsPerGene }
    const trimmed = preps.map(prep => ({
      prep,
      trims: trimPreparedRef(prep, trimmedInputs, metrics),
    }))
    return (labelRoomFactor: number | undefined) => {
      let max = 0
      for (const { prep, trims } of trimmed) {
        const { layoutMap, layoutHeights } = packPreparedRef(
          prep,
          trims,
          { ...trimmedInputs, labelRoomFactor },
          metrics,
          prevYByFeatureId,
        )
        max = Math.max(
          max,
          packedRowsHeight(layoutMap, layoutHeights, measureIds),
        )
      }
      return max
    }
  }
}

export function createContentHeightProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
  measureIds?: ReadonlySet<string>,
) {
  return createPackProbe(
    rpcDataMap,
    inputs,
    prevYByFeatureId,
    measureIds,
  )(inputs.maxIsoformsPerGene)
}

// Measure the content height of many isoform counts against ONE preparation.
// Same guarantee `createContentHeightProbe` gives: probe and commit run the
// identical pack over the identical raw values.
export function createIsoformCountProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: IsoformCountFreeInputs,
  measureIds?: ReadonlySet<string>,
) {
  const trimAt = createPackProbe(rpcDataMap, inputs, undefined, measureIds)
  return (maxIsoformsPerGene: number) =>
    trimAt(maxIsoformsPerGene)(inputs.labelRoomFactor)
}

// One-shot height for fully-formed inputs — `createContentHeightProbe` for a
// single factor. Same pack, so the same guarantee.
//
// The test oracle, not a production path: the fit solve holds one probe across
// its ~9 candidate factors and nothing else asks for a single height. Its value
// is exactly that it goes through the same `packPreparedRef`, so a test can
// assert the committed layout's height without a second implementation to
// disagree with.
export function packedContentHeight(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  return createContentHeightProbe(
    rpcDataMap,
    inputs,
    prevYByFeatureId,
  )(inputs.labelRoomFactor ?? 1)
}

// Group the non-empty raw regions by `assembly:refName`, the unit `packPreparedRef` lays
// out (regions on different chromosomes never affect each other's rows). Shared
// by the committed layout and the height probe so both pack exactly the same
// groups from exactly the same objects.
function groupRawByRef(rpcDataMap: ReadonlyMap<number, LayoutRegionData>) {
  const refGroups = new Map<string, [number, LayoutRegionData][]>()
  for (const [n, raw] of rpcDataMap) {
    if (raw.flatbushItems.length > 0) {
      let group = refGroups.get(raw.regionKey)
      if (!group) {
        group = []
        refGroups.set(raw.regionKey, group)
      }
      group.push([n, raw])
    }
  }
  return refGroups
}

// The memo's cache key: every `LayoutInputs` field a group's output depends on,
// compared by `===`. Exhaustive by construction, which is the point — the three
// hand-kept lists this replaced (the cached fields, the compare, the cache
// write) let a new input be compared in one place and forgotten in another, and
// a forgotten one serves a stale layout from the memo with nothing to catch it.
// `pinnedFeatureIds` and `expandedGeneIds` are MobX-computed sets, stable by
// reference until they change, so `===` catches a toggle.
//
// `reversedRegions` is the one exclusion: it spans every region on screen, so
// comparing it re-packs every group whenever any region flips. `groupUnchanged`
// compares the per-group `reversed` set instead.
const LAYOUT_CACHE_KEYS_RECORD: Record<
  Exclude<keyof LayoutInputs, 'reversedRegions'>,
  true
> = {
  bpPerPx: true,
  showLabels: true,
  showDescriptions: true,
  displayMode: true,
  pinnedFeatureIds: true,
  labelDecimation: true,
  labelRoomFactor: true,
  maxIsoformsPerGene: true,
  expandedGeneIds: true,
  collapseDepth: true,
  flattenRows: true,
  dropBelowLabelRows: true,
}

const LAYOUT_CACHE_KEYS = Object.keys(LAYOUT_CACHE_KEYS_RECORD) as Exclude<
  keyof LayoutInputs,
  'reversedRegions'
>[]

interface GroupCache {
  // the inputs this group was laid out with, compared over LAYOUT_CACHE_KEYS
  inputs: LayoutInputs
  // idx -> raw fetch object, by reference. A new fetch swaps the reference.
  members: Map<number, LayoutRegionData>
  // members currently rendered reversed (affects label-overhang packing)
  reversed: Set<number>
  // idx -> laid-out result, reused verbatim when the group is unchanged
  output: Map<number, FeatureDataResult>
  // ids the collapse pinned to row 0 in `output`, excluded when this layout seeds
  // the next one's insertion order (see `seedRowsFrom`)
  collapsedIds: ReadonlySet<string>
}

function groupUnchanged(
  prev: GroupCache,
  members: Map<number, LayoutRegionData>,
  inputs: LayoutInputs,
) {
  const { reversedRegions } = inputs
  return (
    LAYOUT_CACHE_KEYS.every(key => prev.inputs[key] === inputs[key]) &&
    prev.members.size === members.size &&
    [...members].every(
      ([idx, raw]) =>
        prev.members.get(idx) === raw &&
        prev.reversed.has(idx) === reversedRegions.has(idx),
    )
  )
}

// The rows a cached group offers the next re-pack as its insertion priority:
// every feature the packer placed, MINUS the marks the collapse pinned to row 0.
// Those never competed for a row, so carrying their y=0 into the sort would rank
// a whole pile alongside the features that genuinely won the top row and ahead of
// every feature below it — and on the zoom step where the pile thins out and each
// mark starts claiming a real row, they would take the low rows across the span
// and shove the genes down.
//
// The morph reads `captureFeatureTops` unfiltered, and should: a mark that WAS
// drawn at y=0 animates from y=0. This is only about who gets first pick.
function seedRowsFrom(prev: GroupCache) {
  const tops = captureFeatureTops(prev.output)
  for (const id of prev.collapsedIds) {
    tops.delete(id)
  }
  return tops
}

// Incremental wrapper over `computeLaidOutData`. Layout is independent per
// ref-group (`assembly:refName`) — regions on different chromosomes never
// affect each other's Y rows — so when one chromosome's data arrives only its
// group needs relaying out. This memoizes per group: a group whose member
// references and layout params are all unchanged reuses its previous output
// objects *by reference*, so the GPU upload autorun can skip re-uploading it.
//
// Without this, the single `laidOutDataMap` computed reclones every region on
// any change, so N chromosomes arriving sequentially cost O(N²) GPU uploads;
// per-group reuse makes it O(N). Hold one instance per display (the cache is
// stateful) and call it from the `laidOutDataMap` getter.
// The memoizing layout function `createIncrementalLayout` returns. Named so the
// display can pass one around (it holds four — one per fit reservation config).
export type IncrementalLayout = ReturnType<typeof createIncrementalLayout>

export function createIncrementalLayout({
  // Whether a re-packed group is seeded with its previous layout's rows, so a
  // feature near the top keeps that row across a zoom (see packPreparedRef's sort).
  //
  // Off for the fit ladder's `decimated` rung, whose whitespace factor is chosen
  // by MEASURING candidate packs: a self-seeded pack makes the committed height a
  // function of what this memo last returned, so it stops matching the unseeded
  // probe that chose the factor — the committed stack overflows the height the
  // solve fit, the ladder falls through to `bodies`, and every name vanishes on
  // exactly the tallest tracks. Any "measure a candidate, then commit it" caller
  // must pack the commit the same way it packed the probe; the memo still spares
  // that rung the re-pack entirely when nothing changed, which is what it is here
  // for. (Seeding that rung from a factor-independent stack instead — the
  // `labels` rung — keeps probe and commit agreeing and was tried: it moved no
  // rows at all, because the seed's order and the layoutStartBp tiebreak it
  // replaces already coincide.)
  seedPriorRows = true,
}: { seedPriorRows?: boolean } = {}) {
  let cache = new Map<string, GroupCache>()

  return function computeLaidOutDataIncremental(
    rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
    inputs: LayoutInputs,
  ): Map<number, FeatureDataResult> {
    const { reversedRegions } = inputs

    // Grouped as `groupRawByRef` groups, minus its empty-region skip: a region
    // that fetched no features still needs a cache entry, or its group re-packs
    // every time it is present.
    const groups = new Map<string, Map<number, LayoutRegionData>>()
    for (const [idx, raw] of rpcDataMap) {
      let group = groups.get(raw.regionKey)
      if (!group) {
        group = new Map()
        groups.set(raw.regionKey, group)
      }
      group.set(idx, raw)
    }

    const out = new Map<number, FeatureDataResult>()
    const nextCache = new Map<string, GroupCache>()
    for (const [key, members] of groups) {
      const prev = cache.get(key)
      if (prev && groupUnchanged(prev, members, inputs)) {
        for (const [idx, result] of prev.output) {
          out.set(idx, result)
        }
        nextCache.set(key, prev)
      } else {
        // `members` all share one key, so the pure pass lays out exactly this
        // group; passing the full `reversedRegions` is fine since it only reads
        // the entries for regions present in `members`.
        // Order this group's re-pack by each feature's row in the prior output
        // so top features keep their rows across a zoom (see packPreparedRef), unless
        // this instance packs measured candidates (see seedPriorRows).
        const { out: output, collapsedIds } = layoutRefGroups(
          members,
          inputs,
          seedPriorRows && prev ? seedRowsFrom(prev) : undefined,
        )
        const reversed = new Set<number>()
        for (const idx of members.keys()) {
          if (reversedRegions.has(idx)) {
            reversed.add(idx)
          }
        }
        for (const [idx, result] of output) {
          out.set(idx, result)
        }
        nextCache.set(key, {
          inputs,
          members: new Map(members),
          reversed,
          output,
          collapsedIds,
        })
      }
    }
    // Dropping `cache` for `nextCache` evicts groups no longer present.
    cache = nextCache
    return out
  }
}

// Fit-to-display-height: uniformly scale an already-laid-out region so the whole
// stack fits the track height without scrolling. Unlike applyHeightScale (a
// pre-pack body shrink that feeds the packer), this runs AFTER packing, so it
// also scales the packed `topPx`/`bottomPx` and the row-offset Ys — every Y and
// height by the same factor, so content height × scale lands exactly on the track
// height. Row assignment is untouched (it's fixed by X-overlap), so it's a pure
// vertical shrink that keeps the stack top-anchored at y=0.
export function scaleLaidOutData(
  map: ReadonlyMap<number, FeatureDataResult>,
  scale: number,
): Map<number, FeatureDataResult> {
  const out = new Map<number, FeatureDataResult>()
  for (const [n, data] of map) {
    if (data.flatbushItems.length === 0) {
      // Nothing to scale — share the raw object (as computeLaidOutData does for
      // empty regions) rather than allocating clone arrays that stay untouched,
      // keeping the reference stable so idle empty regions don't re-upload.
      out.set(n, data)
    } else {
      const cloned = cloneMutableFields(data)
      // Reuse applyHeightScale for the fields it already covers (rect/line/arrow
      // Ys+heights, subfeature/label/amino-acid tops, featureHeightPx), then add
      // the packed flatbush box tops/bottoms it doesn't touch (those are 0 at the
      // pre-pack stage applyHeightScale was written for).
      // labelFontPx 0: the label rows were already spent when this layout was
      // committed (layoutRefGroups), so they are part of the Y values being
      // scaled here and must not be added a second time. Scaling them with
      // everything else is right in both directions — above 1 it only
      // over-reserves, and below 1 nothing is left drawing in them (the `bodies`
      // rung is the only one that squeezes, and it hides names, descriptions and
      // — via `renderedShowSubfeatureLabels` — subfeature labels too).
      applyHeightScale(cloned, scale, 0)
      for (const item of cloned.flatbushItems) {
        item.topPx *= scale
        item.bottomPx *= scale
      }
      out.set(n, cloned)
    }
  }
  return out
}

function cloneMutableFields(raw: FeatureDataResult) {
  const floatingLabelsData = new Map<string, FeatureLabelData>()
  for (const [k, v] of raw.floatingLabelsData) {
    floatingLabelsData.set(k, { ...v })
  }
  return {
    ...raw,
    rectYs: new Float32Array(raw.rectYs),
    rectHeights: new Float32Array(raw.rectHeights),
    // Cloned because applyLayoutToRegion narrows it from the worker's
    // fade-eligibility flag to the actual density-collapse decision.
    rectDensityFade: new Uint32Array(raw.rectDensityFade),
    lineYs: new Float32Array(raw.lineYs),
    lineHeights: new Float32Array(raw.lineHeights),
    arrowYs: new Float32Array(raw.arrowYs),
    arrowHeights: new Float32Array(raw.arrowHeights),
    flatbushItems: raw.flatbushItems.map(item => ({ ...item })),
    subfeatureInfos: raw.subfeatureInfos.map(info => ({ ...info })),
    floatingLabelsData,
    aminoAcidOverlay: raw.aminoAcidOverlay?.map(aa => ({ ...aa })),
  }
}

// Index of the first element >= `x` in ascending `sorted`.
function lowerBound(sorted: number[], x: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < x) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// Index of the first element > `x` in ascending `sorted`.
function upperBound(sorted: number[], x: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! > x) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return lo
}

// The value following one occurrence of `x` in ascending `sorted` (x itself when
// another element shares it), or undefined at the top end.
function valueAfter(sorted: number[], x: number) {
  return sorted[lowerBound(sorted, x) + 1]
}

// The value preceding one occurrence of `x` in ascending `sorted` (x itself when
// another element shares it), or undefined at the bottom end.
function valueBefore(sorted: number[], x: number) {
  const idx = upperBound(sorted, x) - 2
  return idx >= 0 ? sorted[idx] : undefined
}

// Per-feature horizontal whitespace (px) a label may overhang into, on each
// side: rightward room is the distance from the feature's left edge to the next
// feature's left edge (its box plus the gap after it, matching the rightward
// overhang the packer reserves via layoutEndBp); leftward room mirrors it from
// the right edge for reversed regions. A feature with no neighbor on a side has
// open space there (Infinity); one sharing its edge with another feature has
// none (a pile on one bp thins under decimation rather than every member
// reading the gap to the far neighbor as its own). Only computed for the
// `fitWidth` decimation rung; the default `all` policy keeps every name and
// never asks.
function labelOverhangRoomPx(
  features: Map<string, { startBp: number; endBp: number }>,
  bpPerPx: number,
) {
  const spans = [...features.values()]
  const starts = spans.map(f => f.startBp).sort((a, b) => a - b)
  const ends = spans.map(f => f.endBp).sort((a, b) => a - b)
  const rightRoom = new Map<string, number>()
  const leftRoom = new Map<string, number>()
  for (const [id, f] of features) {
    const nextStart = valueAfter(starts, f.startBp)
    const prevEnd = valueBefore(ends, f.endBp)
    rightRoom.set(
      id,
      nextStart === undefined ? Infinity : (nextStart - f.startBp) / bpPerPx,
    )
    leftRoom.set(
      id,
      prevEnd === undefined ? Infinity : (f.endBp - prevEnd) / bpPerPx,
    )
  }
  return { rightRoom, leftRoom }
}

// A feature's packing geometry that does NOT vary with `labelRoomFactor`: its bp
// extent, its body height, and which reversed/non-reversed sides it occupies (a
// reversed region's label extends toward lower bp, so the overhang must widen the
// start rather than the end). Read-only, because the whole point of separating it
// from PackedExtent is that the per-factor pass cannot write here — a mutation
// would silently leak one probe's label decisions into the next.
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
interface PackPrep {
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
function prepareRefPack(
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
interface PackTrims {
  trimPlan: IsoformTrimPlan
  bodies: Map<string, TrimmedBody>
}

function trimPreparedRef(
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
function packPreparedRef(
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

// Mutates the cloned region in place. Raw data has topPx=0 everywhere, so we
// simply add the per-feature offset rather than computing a delta from the
// previous layout. Callers must pass the clone produced by cloneMutableFields.
function applyLayoutToRegion(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
  // Feature ids whose name was decimated away: their floatingLabelsData entry is
  // deleted below so no renderer/hit-test draws a name the packer didn't reserve.
  droppedLabelIds: ReadonlySet<string>,
  // Feature ids drawn over by PILEUP_FADE_DEPTH marks sharing their row. Only
  // these keep the fade flag the worker set; every other box is rewritten to 0
  // and drawn opaque.
  densityFadeIds: ReadonlySet<string>,
) {
  const featureOffsets = new Float32Array(data.flatbushItems.length)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    featureOffsets[i] = layoutMap.get(data.flatbushItems[i]!.featureId)!
  }

  for (let i = 0; i < data.rectDensityFade.length; i++) {
    const featureId = data.flatbushItems[data.rectFeatureIndices[i]!]!.featureId
    data.rectDensityFade[i] = densityFadeIds.has(featureId) ? 1 : 0
  }

  for (const kind of ['rect', 'line', 'arrow'] as const) {
    const ys = data[`${kind}Ys`]
    const featureIndices = data[`${kind}FeatureIndices`]
    for (let i = 0; i < ys.length; i++) {
      ys[i] = ys[i]! + featureOffsets[featureIndices[i]!]!
    }
  }

  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    const offset = featureOffsets[i]!
    const height = layoutHeights.get(item.featureId)!
    item.topPx = offset
    item.bottomPx = offset + height
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    info.topPx += offset
    info.bottomPx += offset
  }

  // Drop the whole entry for a feature the packer could not place (see the row
  // limit at `addRect`): the feature itself doesn't render, and we don't want to
  // pay the React reconciliation cost of emitting thousands of off-screen <div>
  // labels in FloatingLabelsLayer.
  //
  // A decimated feature keeps its entry and loses only `nameLabel` — that is the
  // one label the decimation ruled on, and it's the one whose row height went
  // unreserved, so drawing it would overlap the boxes. Its description and
  // subfeature label still have reserved space and still draw.
  for (const [key, labelData] of data.floatingLabelsData) {
    const layoutKey = labelData.parentFeatureId ?? labelData.featureId
    const offset = layoutMap.get(layoutKey)
    if (offset === undefined || !isPlacedRow(offset)) {
      data.floatingLabelsData.delete(key)
      continue
    }
    if (droppedLabelIds.has(layoutKey)) {
      delete labelData.nameLabel
    }
    labelData.topY += offset
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += featureOffsets[aa.flatbushIdx]!
    }
  }
}
