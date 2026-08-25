import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import {
  LABEL_PADDING_PX,
  renderedTextWidth,
} from '../RenderFeatureDataRPC/constants.ts'
import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  STRAND_ARROW_WIDTH,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { mergeSpans } from '../shared/mergeSpans.ts'
import { MIN_RECT_WIDTH_PX } from './components/sharedRendererConstants.ts'
// Straight from the shader's JS twin, and safe from here even though this module
// is eager (layout ← baseModel ← the plugin entry): a `.js.generated.ts` holds
// the lifted scalar functions and nothing else — the WGSL/GLSL source is a
// different generated file. Same property that lets `sharedRendererConstants`
// read the `.consts.generated.ts` directly rather than through the pass barrel,
// and for the same reason; see the paragraph there.
import {
  applyIsoformTrim,
  moreIsoformsLabel,
  planIsoformTrims,
} from './isoformTrim.ts'
import { arrowDraws } from './passes/shaders/arrow.js.generated.ts'
import { OFFSCREEN_Y, isPlacedRow } from './rowPlacement.ts'
import { captureFeatureTops } from './yMorph.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  FeatureDataResult,
  FeatureLabelData,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Span } from '../shared/mergeSpans.ts'

// Tallest row bottom across a layout, i.e. its content height. Unplaced features
// are excluded — they don't render, so they contribute no height — which also
// means a layout that hit the row limit reports a SHORT height while silently
// holding fewer features than it was given. `countTruncatedFeatures` is how a
// caller finds out.
//
// `measureIds`, when given, restricts the measurement to those features. Fit
// mode passes the ones on screen: the fetch buffers half a viewport either side,
// and those off-screen features pack into rows of their own that add height
// while drawing nothing in view (see `fitMeasureFeatureIds`).
export function maxBottom(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let max = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (
        isPlacedRow(item.topPx) &&
        item.bottomPx > max &&
        (!measureIds || measureIds.has(item.featureId))
      ) {
        max = item.bottomPx
      }
    }
  }
  return max
}

// The shortest box the layout actually DRAWS — the one a uniform vertical
// squeeze takes below a visible size first, and so the basis for the squeeze
// floor (see `fitSmallestBoxPx`). 0 when nothing is drawn, which callers read as
// "nothing to size" and turn into a no-op bound.
//
// Measured over `rectHeights`, the emitted rect primitives, and NOT over
// `flatbushItems[].featureHeightPx`. That field is the feature's whole laid-out
// EXTENT — for a gene, `layout.height`, every stacked transcript plus its label
// rows — which is nothing anyone draws. Built on it, a floor of MIN_FIT_BOX_PX
// promised 2px boxes and delivered a fifth of that: a 5-transcript gene extends
// ~70px, so the floor allowed a 0.03 squeeze and each 10px transcript rect
// rendered at a third of a pixel. The promise is about boxes, so measure boxes.
//
// A rect's feature is `rectFeatureIndices[i]`, so the two filters below are the
// same ones `maxBottom` applies, asked of the rect's owner: unplaced features are
// excluded because they don't render, and `measureIds` narrows to the on-screen
// set exactly as it does there — fit mode passes the same set to both, so the
// squeeze is bounded by the stack it is chosen against rather than by the fetch
// buffer. It is the SHORTEST box that binds, so either filter left off can only
// raise the floor: one buffered 2px mark half a viewport away pinned it at 1 and
// stopped the visible stack squeezing at all.
//
// Non-positive heights are skipped rather than winning: a box already drawing
// nothing cannot be shrunk to invisibility, and letting a degenerate
// `featureHeight: 0` config answer 0 here would silently disable the squeeze for
// the whole track.
export function minDrawnBoxHeight(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let min = Number.POSITIVE_INFINITY
  for (const data of map.values()) {
    const { rectHeights, rectFeatureIndices, flatbushItems } = data
    for (let i = 0; i < rectHeights.length; i++) {
      const height = rectHeights[i]!
      // Cheap test first: most rects lose on height alone, and the owner lookup
      // is only worth doing for one that would win.
      if (height <= 0 || height >= min) {
        continue
      }
      const owner = flatbushItems[rectFeatureIndices[i]!]
      if (
        owner &&
        isPlacedRow(owner.topPx) &&
        (!measureIds || measureIds.has(owner.featureId))
      ) {
        min = height
      }
    }
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min
}

// Features the packer could not place because the stack passed
// GranularRectLayout's row limit, and so pushed to OFFSCREEN_Y where nothing
// draws or hit-tests them. Counted off the laid-out map (a feature appearing in
// several regions of one ref-group shares a row, so it is counted once per region
// it appears in — the same basis as maxBottom). Non-zero means the display is
// showing the user strictly less than the data it holds, which fit mode in
// particular must own up to rather than present as a complete picture.
//
// `measureIds` narrows it the way it narrows `maxBottom` and `minDrawnBoxHeight`,
// fit mode passes the same on-screen set to all three. The count is surfaced as
// "N not shown (past the layout row limit; filter or zoom in)", and counting the
// fetch buffer put features half a viewport away — which panning, not filtering,
// reveals — into that sentence. An unplaced feature still carries its bp span, so
// membership is answerable even though its row is not.
export function countTruncatedFeatures(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let n = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (
        !isPlacedRow(item.topPx) &&
        (!measureIds || measureIds.has(item.featureId))
      ) {
        n++
      }
    }
  }
  return n
}

// Do two half-open bp spans touch? Each must start strictly before the other
// ends, so a feature that merely abuts a block edge — ending exactly where the
// block starts, drawing nothing inside it — does not count as on screen.
function spansOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart
}

// What `featureIdsTouchingBlocks` needs from one fetched region: which ref-group
// it holds and each feature's absolute bp span. A structural subset of the
// model's `LoadedFeatureData`, kept local so this stays a pure function decoupled
// from the RPC-result shape (same idiom as featureHighlight.ts).
interface BlockMeasurableRegion {
  // `assemblyName:refName`, matched against a block's own pair
  regionKey: string
  flatbushItems: readonly {
    featureId: string
    startBp: number
    endBp: number
  }[]
}

// The features whose bp span touches one of `blocks` — the "on screen" set fit
// mode measures its candidate stacks over (see `fitMeasureFeatureIds`).
//
// The fetch deliberately buffers half a screen either side
// (`bufferedVisibleRegions`), and every one of those off-screen features claims a
// row — rows that add stack height but draw nothing in view. Measuring the whole
// packed stack therefore squeezed the boxes and stripped the labels to fit
// features the user cannot see: a viewport holding eight genes could land on the
// `bodies` rung at the minimum box size because twenty more sat just outside it.
//
// It narrows the MEASUREMENT only — the pack still places every buffered feature,
// so panning inside the buffer doesn't reshuffle rows.
//
// Regions are matched to blocks by `regionKey`, not by displayed-region index: a
// region can be covered by several blocks, and a block names its ref rather than
// the index. An off-by-one in the overlap test silently widens or narrows what fit
// mode measures itself against, which is why `spansOverlap` above has a test of
// its own.
export function featureIdsTouchingBlocks(
  regions: Iterable<BlockMeasurableRegion>,
  blocks: readonly {
    assemblyName: string
    refName: string
    start: number
    end: number
  }[],
): ReadonlySet<string> {
  const rangesByKey = new Map<string, [number, number][]>()
  for (const block of blocks) {
    const key = `${block.assemblyName}:${block.refName}`
    let ranges = rangesByKey.get(key)
    if (!ranges) {
      ranges = []
      rangesByKey.set(key, ranges)
    }
    ranges.push([block.start, block.end])
  }
  const ids = new Set<string>()
  for (const data of regions) {
    const ranges = rangesByKey.get(data.regionKey)
    if (!ranges) {
      continue
    }
    for (const item of data.flatbushItems) {
      if (
        ranges.some(([start, end]) =>
          spansOverlap(item.startBp, item.endBp, start, end),
        )
      ) {
        ids.add(item.featureId)
      }
    }
  }
  return ids
}

// How names are chosen when `showLabels` is on. `all` reserves + renders every
// feature's name (the default, used at the `full`/`labels` fit rungs and in all
// non-fit modes); `fitWidth` keeps a name only where the feature's box is wide
// enough to host it (plus pinned/highlighted features), dropping the rest — the
// `decimated` fit rung's genuine intermediate between "every name" and "no name".
type LabelDecimation = 'all' | 'fitWidth'

// One fetched region as layout sees it: the worker's result plus the region
// identity the model staples on at fetch time (`LoadedFeatureData` in
// baseModel.ts). Structural rather than an import of that type, so layout stays a
// pure function decoupled from the model — the same idiom as
// `BlockMeasurableRegion` above.
//
// `regionKey` rides on the region, not in a parallel `Map<number, string>` beside
// it, and that is load-bearing. Grouping is BY this key, so a region whose key
// went missing would land in one group with every other keyless region and
// mis-stack against it — precisely the failure the grouping exists to prevent
// (see baseModel's note on why the identity is stored with the data at all). The
// parallel map made that state expressible and forced a `?? ''` fallback to
// swallow it; measured over ~14k lookups the fallback never fired, because
// `regionKeys` was built by walking this very map. Reading the key off the region
// makes the missing case a type error instead of a silent mis-stack.
export type LayoutRegionData = FeatureDataResult & { regionKey: string }

export interface LayoutInputs {
  bpPerPx: number
  showLabels: boolean
  showDescriptions: boolean
  reversedRegions: ReadonlySet<number>
  displayMode: DisplayMode
  // Feature ids the user pinned to the top: inserted first into the greedy
  // packer so they claim the lowest rows in their bp range (see packRef). Also
  // the always-keep set for `fitWidth` label decimation (never hide a name the
  // user pinned or searched for).
  pinnedFeatureIds: ReadonlySet<string>
  // Name-decimation policy (default `all`). See LabelDecimation.
  labelDecimation?: LabelDecimation
  // Whitespace multiplier for `fitWidth` decimation (default 1). The fit ladder
  // binary-searches it over [0, FIT_MAX_ROOM_FACTOR] to land the packed stack on
  // the track height: 0 keeps every name, higher values keep progressively fewer.
  // See keepFeatureLabel.
  labelRoomFactor?: number
  // At most this many isoforms per gene, or undefined for every one the worker
  // sent. The fit ladder's `isoforms` rung solves it against the track height —
  // names before isoforms, which is why it sits above `decimated` (ADR-076).
  maxIsoformsPerGene?: number
  // Genes the user opened from their own badge. Never trimmed, whatever the
  // count says.
  expandedGeneIds?: ReadonlySet<string>
}

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
  return label && label.textWidth > 0
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
    // `moreIsoformsLabel`) but its text depends on the isoform count being
    // probed, so `decideLabelReservations` adds its width at that count rather
    // than baking one width in here.
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
  scaleYWithLabelRows(data.rectYs, data.rectLabelRows, multiplier, labelFontPx)
  scaleYWithLabelRows(data.lineYs, data.lineLabelRows, multiplier, labelFontPx)
  scaleYWithLabelRows(
    data.arrowYs,
    data.arrowLabelRows,
    multiplier,
    labelFontPx,
  )
  scaleFloat32(data.rectHeights, multiplier)
  scaleFloat32(data.lineHeights, multiplier)
  scaleFloat32(data.arrowHeights, multiplier)
  for (const item of data.flatbushItems) {
    // A gene's own extent has to cover every label row it contains. The packed
    // ROW height comes from `bodyHeightPx`, which applies the same term — this
    // keeps the hit box in step with it.
    item.featureHeightPx =
      item.featureHeightPx * multiplier + (item.labelRows ?? 0) * labelFontPx
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

// Everything the packer derives from the display mode. Bundled into one helper so
// the committed layout and the height probe cannot derive them differently — the
// probe is only trustworthy if it packs on byte-identical terms.
interface DisplayModeMetrics {
  // compact/superCompact body scale (1 in normal mode)
  heightMultiplier: number
  // reserved height of one rendered label line
  labelFontPx: number
  // vertical gap between stacked rows
  rowPadding: number
  // collapsed mode: one shared row, no greedy stacking
  singleRow: boolean
}

function displayModeMetrics(displayMode: DisplayMode): DisplayModeMetrics {
  return {
    heightMultiplier: HEIGHT_MULTIPLIERS[displayMode],
    labelFontPx: labelFontSize(displayMode),
    rowPadding: ROW_PADDING[displayMode],
    // Labels are already forced off upstream in collapsed mode (model
    // showLabels/showDescriptions), so no row height is reserved for them.
    singleRow: displayMode === 'collapsed',
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
  // so top features keep their rows across a re-pack (see packRef).
  prevYByFeatureId?: ReadonlyMap<string, number>,
): Map<number, FeatureDataResult> {
  return layoutRefGroups(rpcDataMap, inputs, prevYByFeatureId).out
}

// `computeLaidOutData` plus the ids the density collapse pinned to row 0, which
// the incremental wrapper needs and no other caller does — those marks must not
// seed the next re-pack's row priority (see `seedRowsFrom`). Kept as the shared
// body rather than widening `computeLaidOutData`'s return, so the pure entry
// point every test and probe uses still answers with just the layout.
function layoutRefGroups(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const metrics = displayModeMetrics(inputs.displayMode)
  const out = new Map<number, FeatureDataResult>()
  const collapsedIds = new Set<string>()
  for (const [, regions] of groupRawByRef(rpcDataMap)) {
    const { layoutMap, layoutHeights, droppedLabelIds, collapsed, trimPlan } =
      packPreparedRef(
        prepareRefPack(regions, inputs, metrics),
        inputs,
        metrics,
        prevYByFeatureId,
      )
    for (const mark of collapsed) {
      collapsedIds.add(mark.id)
    }
    const densityFadeIds = pileupFadeIds(collapsed)
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
    const bottom = top + (layoutHeights.get(id) ?? 0)
    if (isPlacedRow(top) && bottom > max) {
      max = bottom
    }
  }
  return max
}

// Layout inputs with the fit solve's knob deliberately absent. `prepareRefPack`
// takes this type so the compiler enforces what the solve depends on: the
// prepared half of a pack cannot read `labelRoomFactor`, therefore one prep is
// valid for every factor probed against it.
export type LabelRoomFactorFreeInputs = Omit<LayoutInputs, 'labelRoomFactor'>

// Measure the content height of many `labelRoomFactor` candidates against ONE
// preparation. Returns the probe; each call packs the prepared groups at that
// factor and reports the height `computeLaidOutData` would report for it.
//
// This is what makes the fit solve affordable. A probe skips `cloneMutableFields`
// and `applyLayoutToRegion` (~4/5 of a full layout), and hoisting the prep out of
// the loop removes roughly half of what remains — the per-kind label widths and
// the two neighbor-room sorts, none of which depend on the factor. Because every
// probe and the eventual commit run the identical pack over the identical raw
// values, the height measured here IS the height the committed layout reports, by
// construction rather than by two code paths agreeing.
function createPackProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
  prevYByFeatureId: ReadonlyMap<string, number> | undefined,
  // Features the height is measured over (see `maxBottom`). It narrows only the
  // measurement, never the pack: every feature still claims its row, so the
  // rows the solve's knob is chosen against are the rows that will render.
  measureIds: ReadonlySet<string> | undefined,
) {
  const metrics = displayModeMetrics(inputs.displayMode)
  const preps = [...groupRawByRef(rpcDataMap).values()].map(regions =>
    prepareRefPack(regions, inputs, metrics),
  )
  return (knob: Partial<LayoutInputs>) => {
    let max = 0
    for (const prep of preps) {
      const { layoutMap, layoutHeights } = packPreparedRef(
        prep,
        { ...inputs, ...knob },
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

export function createContentHeightProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
  measureIds?: ReadonlySet<string>,
) {
  const probe = createPackProbe(
    rpcDataMap,
    inputs,
    prevYByFeatureId,
    measureIds,
  )
  return (labelRoomFactor: number) => probe({ labelRoomFactor })
}

// Layout inputs with the isoform solve's knob deliberately absent, the twin of
// `LabelRoomFactorFreeInputs`: one preparation is valid for every count probed
// against it, because the trim happens per count in
// `decideLabelReservations` — the half of a pack that runs per probe.
export type IsoformCountFreeInputs = Omit<LayoutInputs, 'maxIsoformsPerGene'>

// Measure the content height of many isoform counts against ONE preparation.
// Same guarantee `createContentHeightProbe` gives: probe and commit run the
// identical pack over the identical raw values.
export function createIsoformCountProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: IsoformCountFreeInputs,
  measureIds?: ReadonlySet<string>,
) {
  const probe = createPackProbe(rpcDataMap, inputs, undefined, measureIds)
  return (maxIsoformsPerGene: number) => probe({ maxIsoformsPerGene })
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

// Group the non-empty raw regions by `assembly:refName`, the unit `packRef` lays
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

interface GroupCache {
  bpPerPx: number
  showLabels: boolean
  showDescriptions: boolean
  labelDecimation: LabelDecimation
  labelRoomFactor: number
  maxIsoformsPerGene: number | undefined
  expandedGeneIds: ReadonlySet<string> | undefined
  displayMode: DisplayMode
  // The MobX-computed pinned set; a stable reference until pins change, so a
  // reference compare in groupUnchanged detects a pin toggle.
  pinnedFeatureIds: ReadonlySet<string>
  // idx -> raw fetch object, by reference. A new fetch swaps the reference.
  members: Map<number, LayoutRegionData>
  // members currently rendered reversed (affects label-overhang packing)
  reversed: Set<number>
  // idx -> laid-out result, reused verbatim when the group is unchanged
  output: Map<number, FeatureDataResult>
  // ids the density collapse pinned to row 0 in `output`, excluded when this
  // layout seeds the next one's insertion order (see `seedRowsFrom`)
  collapsedIds: ReadonlySet<string>
}

function groupUnchanged(
  prev: GroupCache,
  members: Map<number, LayoutRegionData>,
  inputs: LayoutInputs,
) {
  const {
    bpPerPx,
    showLabels,
    showDescriptions,
    reversedRegions,
    displayMode,
    pinnedFeatureIds,
    labelDecimation = 'all',
    labelRoomFactor = 1,
    maxIsoformsPerGene,
    expandedGeneIds,
  } = inputs
  const paramsSame =
    prev.bpPerPx === bpPerPx &&
    prev.showLabels === showLabels &&
    prev.showDescriptions === showDescriptions &&
    prev.labelDecimation === labelDecimation &&
    prev.labelRoomFactor === labelRoomFactor &&
    prev.maxIsoformsPerGene === maxIsoformsPerGene &&
    prev.expandedGeneIds === expandedGeneIds &&
    prev.displayMode === displayMode &&
    prev.pinnedFeatureIds === pinnedFeatureIds &&
    prev.members.size === members.size
  return (
    paramsSame &&
    [...members].every(
      ([idx, raw]) =>
        prev.members.get(idx) === raw &&
        prev.reversed.has(idx) === reversedRegions.has(idx),
    )
  )
}

// The rows a cached group offers the next re-pack as its insertion priority.
//
// Every feature the packer placed, MINUS the sub-pixel marks the density
// collapse pinned to row 0. Those never competed for a row — they skip the
// stacker entirely — so carrying their y=0 into the sort would rank thousands of
// them alongside the features that genuinely won the top row, and ahead of every
// feature on a lower one. On the zoom step where they stop collapsing (the box
// crosses the min-width clamp and each one starts claiming a real row) they
// would then take the low rows across the whole span and shove the genes that
// held them downward — the exact churn the seeding exists to prevent. Dropped
// here they rank as new (PRIOR_ROW_NONE) and fill gaps instead.
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
  // feature near the top keeps that row across a zoom (see packRef's sort).
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
        // so top features keep their rows across a zoom (see packRef), unless
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
          bpPerPx: inputs.bpPerPx,
          showLabels: inputs.showLabels,
          showDescriptions: inputs.showDescriptions,
          labelDecimation: inputs.labelDecimation ?? 'all',
          labelRoomFactor: inputs.labelRoomFactor ?? 1,
          maxIsoformsPerGene: inputs.maxIsoformsPerGene,
          expandedGeneIds: inputs.expandedGeneIds,
          displayMode: inputs.displayMode,
          pinnedFeatureIds: inputs.pinnedFeatureIds,
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

// A density-fade box narrower than the renderer's min-width clamp renders into
// the shared density texture (rect.slang densityAlpha) as a faded ~pixel mark.
// Gates on the box's own rendered width (not the label-padded layout span) to
// match the shader's realWidthPx < MIN_RECT_WIDTH_PX test.
function isSubPixelFade(
  ext: { densityFade: boolean; startBp: number; endBp: number },
  bpPerPx: number,
) {
  return (
    ext.densityFade && (ext.endBp - ext.startBp) / bpPerPx < MIN_RECT_WIDTH_PX
  )
}

// The px span a feature's box actually paints, widening a sub-pixel box to the
// shader's min-draw clamp (anchored at the start, as rect.slang's
// extendToMinWidthX does). Both sides of the density-collapse overlap test go
// through this: comparing a candidate's clamped extent against a neighbor's RAW
// bp span made a sub-pixel neighbor ~0px wide, so nothing ever overlapped it.
//
// Exactly MIN_RECT_WIDTH_PX, not twice it. hpmath.slang's extendToMinWidthX
// works in clip space, where `minWidthPx * 2.0 / canvasWidth` is minWidthPx
// PIXELS (clip spans 2 units over canvasWidth px, so 1px = 2/canvasWidth) — the
// `* 2.0` there is the clip-space conversion, not a doubling. Canvas2D's
// `Math.max(MIN_RECT_WIDTH_PX, ...)` agrees. Doubling it here made every
// sub-pixel mark measure 2px wider than it paints, so marks that had room to
// collapse onto row 0 stacked instead and dense pileups packed taller than the
// fade regime intends.
//
// The anchor is the one thing that is NOT the same for every span: a degenerate
// (interbase) one is CENTERED on its coordinate rather than grown off its start
// edge, matching rect.slang's rectSpanPx `isPoint` branch, because a zero-length
// interval sits between two bases. Anchoring it at the start put the layout's
// idea of the mark a pixel right of where it paints, so a VCF insertion abutting
// a solid feature on its left read as clear of it, collapsed onto row 0, and
// painted into it.
//
// Deliberately NOT `rectSpanPx` itself, despite adr-051's one-source rule: that
// twin also snaps both edges to whole pixels, and it does so in SCREEN space,
// where the region offset has already been subtracted. Here the coordinates are
// absolute-genomic px, so snapping would quantize on a different phase — a
// different approximation, not a better one.
function renderedSpanPx(
  ext: { startBp: number; endBp: number },
  bpPerPx: number,
): [number, number] {
  const startPx = ext.startBp / bpPerPx
  if (ext.endBp === ext.startBp) {
    const halfPx = MIN_RECT_WIDTH_PX / 2
    return [startPx - halfPx, startPx + halfPx]
  }
  return [startPx, Math.max(ext.endBp / bpPerPx, startPx + MIN_RECT_WIDTH_PX)]
}

// True if [queryStart,queryEnd) overlaps any of the disjoint, sorted `merged`
// intervals. Finds the rightmost interval starting before queryEnd; because the
// set is disjoint, no earlier interval can reach queryStart if that one doesn't.
function intersectsMerged(
  queryStart: number,
  queryEnd: number,
  merged: readonly Span[],
) {
  let lo = 0
  let hi = merged.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (merged[mid]![0] < queryEnd) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return idx >= 0 && merged[idx]![1] > queryStart
}

// Smallest value strictly greater than `x` in ascending `sorted`, or undefined
// when none exists (x is at/after the last element).
function firstGreater(sorted: number[], x: number) {
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
  return sorted[lo]
}

// Largest value strictly less than `x` in ascending `sorted`, or undefined when
// none exists (x is at/before the first element).
function lastLess(sorted: number[], x: number) {
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
  return lo > 0 ? sorted[lo - 1] : undefined
}

// Per-feature horizontal whitespace (px) a label may overhang into, on each
// side: rightward room is the distance from the feature's left edge to the next
// feature's left edge (its box plus the gap after it, matching the rightward
// overhang the packer reserves via layoutEndBp); leftward room mirrors it from
// the right edge for reversed regions. A feature with no neighbor on a side has
// open space there (Infinity). Only computed for the `fitWidth` decimation rung;
// the default `all` policy keeps every name and never asks.
function labelOverhangRoomPx(
  features: Map<string, { startBp: number; endBp: number }>,
  bpPerPx: number,
) {
  const starts = [...features.values()]
    .map(f => f.startBp)
    .sort((a, b) => a - b)
  const ends = [...features.values()].map(f => f.endBp).sort((a, b) => a - b)
  const rightRoom = new Map<string, number>()
  const leftRoom = new Map<string, number>()
  for (const [id, f] of features) {
    const nextStart = firstGreater(starts, f.startBp)
    const prevEnd = lastLess(ends, f.endBp)
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
  // re-derives the height from the trim (see decideLabelReservations).
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
  // Box px-spans of every feature guaranteed to occupy a real row. A sub-pixel
  // fade box may collapse onto row 0 only where it doesn't overlap one of these,
  // else it must stack, or it renders on top of the other feature (a 1bp SNP
  // sitting inside a wide gene box is the canonical case).
  solidSpansPx: readonly Span[]
  // Features that draw at least one label under the current flags. Pre-decimation
  // on purpose: it gates the density-collapse path, which asks "does anything
  // render here", not "did the name survive".
  labeledFeatureIds: Set<string>
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

  // Per-feature label geometry: which kinds exist, and the reserved width of each.
  // The decimation measures the NAME alone (a long description or subfeature label
  // says nothing about whether the name fits its neighbor whitespace), while the
  // overhang reservation covers whichever labels survive — hence the per-kind
  // widths rather than one max across them.
  const labelInfoByFeatureId = new Map<string, LabelInfo>()
  for (const [, data] of regions) {
    for (const labelData of data.floatingLabelsData.values()) {
      const targetId = labelData.parentFeatureId ?? labelData.featureId
      const widths = renderedLabelWidths(
        labelData,
        showLabels,
        showDescriptions,
        metrics.labelFontPx,
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
          // plus the `below` label rows stacked inside this feature, spent at
          // the mode's label font size rather than scaled with the geometry (see
          // FeatureLayout.labelRowsAbove). Here rather than only in
          // applyHeightScale because this derivation is the one BOTH the fit
          // probe and the committed pack read — split across the two, a fitted
          // track would measure a labeled gene shorter than it draws.
          bodyHeightPx:
            item.featureHeightPx * metrics.heightMultiplier +
            (item.labelRows ?? 0) * metrics.labelFontPx,
          stack: item.isoformStack,
          strand: item.strand ?? 0,
          hasReversed: reversed,
          hasNonReversed: !reversed,
          densityFade: item.densityFade,
        })
      }
    }
  }

  const labeledFeatureIds = new Set<string>()
  for (const [id, info] of labelInfoByFeatureId) {
    if (anyLabelRenders(info.widths)) {
      labeledFeatureIds.add(id)
    }
  }

  // Whether the collapse can fire at all here. `solidSpansPx` below is queried by
  // nothing else, so without a candidate to test against it — every feature wide
  // enough to draw (any zoom past the min-width clamp), every feature labeled, or
  // collapsed mode, where there is no stacking to opt out of — building it is a
  // per-feature allocation and an O(n log n) sort thrown away on every re-pack.
  let anyCollapseCandidate = false
  if (!metrics.singleRow) {
    for (const [id, geom] of features) {
      if (isSubPixelFade(geom, bpPerPx) && !labeledFeatureIds.has(id)) {
        anyCollapseCandidate = true
        break
      }
    }
  }

  // Everything that will hold a real row, which is the collapse test below minus
  // its own overlap clause: a wide feature, OR a sub-pixel one held out of the
  // collapse because it carries a label. Counting the labeled sub-pixel features
  // here is what stops an unlabeled neighbor from pinning to row 0 on top of one
  // (a partially-rs-ID'd VCF at sub-pixel zoom: the named variant stacks, so the
  // unnamed one must see it).
  const solidSpansPx: Span[] = []
  if (anyCollapseCandidate) {
    for (const [id, geom] of features) {
      if (!isSubPixelFade(geom, bpPerPx) || labeledFeatureIds.has(id)) {
        solidSpansPx.push(renderedSpanPx(geom, bpPerPx))
      }
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
    // Merged so the per-feature overlap query below is a single binary search
    // (intersectsMerged); touching spans join, so two abutting solid features
    // read as one stretch.
    solidSpansPx: mergeSpans(solidSpansPx),
    labeledFeatureIds,
  }
}

// Decide each feature's kept label lines at this `labelRoomFactor`, reserving
// their row height and widening its layout span by the reserved label overhang.
// Pure in `prep`: it reads the shared geometry and returns fresh per-factor
// extents, so probing a second factor can't see the first one's decisions.
function decideLabelReservations(
  prep: PackPrep,
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
  const { labelFontPx, rowPadding, heightMultiplier } = metrics
  const { labelInfoByFeatureId, features, overhangRoom } = prep
  const trimPlan = planIsoformTrims(
    prep.stacks,
    inputs.maxIsoformsPerGene,
    inputs.expandedGeneIds,
  )
  const packed = new Map<string, PackedExtent>()
  // Features whose name was decimated away (`fitWidth`): no row height or overhang
  // is reserved for it here, and applyLayoutToRegion removes the name afterward so
  // no renderer/hit-test draws it. Empty under the default `all` policy.
  const droppedLabelIds = new Set<string>()

  for (const [id, geom] of features) {
    const labelInfo = labelInfoByFeatureId.get(id)
    const trim = trimPlan.trims.get(id)
    // A trimmed gene is shorter, narrower, and carries a badge after its name —
    // all three priced at the count being probed, so the stack the solve
    // measures is the stack the commit draws.
    const bodyHeightPx = trim
      ? trim.heightPx * heightMultiplier + trim.labelRows * labelFontPx
      : geom.bodyHeightPx
    const startBp = trim ? trim.startBp : geom.startBp
    const endBp = trim ? trim.endBp : geom.endBp
    const badgeHidden =
      trim && trim.hidden > 0
        ? { hidden: trim.hidden, expanded: false }
        : trimPlan.expandedHidden.has(id)
          ? { hidden: trimPlan.expandedHidden.get(id)!, expanded: true }
          : undefined
    const badgeWidthPx =
      badgeHidden && showLabels && labelInfo?.hasName
        ? paddedLabelWidthPx(
            moreIsoformsLabel(badgeHidden.hidden, badgeHidden.expanded),
            labelFontPx,
          )
        : 0
    // Whitespace the name overhang can use, on the side(s) this feature points:
    // the min across the sides it occupies so a feature spanning both directions
    // must clear on both. Infinity (no room measured) under the `all` policy.
    const availableRoomPx = overhangRoom
      ? Math.min(
          geom.hasNonReversed ? overhangRoom.rightRoom.get(id)! : Infinity,
          geom.hasReversed ? overhangRoom.leftRoom.get(id)! : Infinity,
        )
      : Infinity
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
    const ext: PackedExtent = {
      layoutStartBp: startBp,
      layoutEndBp: endBp,
      height: bodyHeightPx + rowPadding + labelLines * labelFontPx,
    }

    // Widen the layout span by the label overhang so the packer keeps a kept
    // label off its neighbor's row. A reversed region overhangs toward lower bp
    // (widen layoutStartBp); otherwise toward higher bp (widen layoutEndBp).
    //
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
    if (overhangPx > 0) {
      const labelBp = overhangPx * bpPerPx
      if (geom.hasNonReversed) {
        ext.layoutEndBp = Math.max(ext.layoutEndBp, startBp + labelBp)
      }
      if (geom.hasReversed) {
        ext.layoutStartBp = Math.min(ext.layoutStartBp, endBp - labelBp)
      }
    }
    packed.set(id, ext)
  }
  return { packed, droppedLabelIds, trimPlan }
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

// Pack a prepared ref-group into rows at one `labelRoomFactor`.
function packPreparedRef(
  prep: PackPrep,
  inputs: LayoutInputs,
  metrics: DisplayModeMetrics,
  // Each feature's y (px) in the previous layout, if any. Used only to order
  // insertion, not to force a row — see the sort below.
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const { bpPerPx, pinnedFeatureIds } = inputs
  const { heightMultiplier, singleRow } = metrics
  const { features, solidSpansPx, labeledFeatureIds } = prep
  const { packed, droppedLabelIds, trimPlan } = decideLabelReservations(
    prep,
    inputs,
    metrics,
  )
  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()

  // Collapsed mode: every feature shares row 0, by the mode rather than by the
  // sub-pixel test below. No greedy stacking and no row to contend for, so
  // nothing after this point has anything to decide. Taken as a whole-function
  // early-out rather than a branch inside the loop because everything it skips
  // is dead here and none of it is cheap: the row grid, the priority sort, and
  // the collapse tests, in the mode picked precisely because the track is too
  // big to stack.
  //
  // The pileup fade still applies, and for the reason it exists everywhere else:
  // row 0 is the only row, so marks piled on the same pixels are drawn over each
  // other and the ones underneath are gone. This mode is where that is
  // guaranteed rather than incidental — a collapsed dbSNP track drew as one
  // opaque bar conveying nothing about its depth. It is also the mode a lane
  // read for COVERAGE picks, which is why the fade waits for a real pile rather
  // than for a pair (see PILEUP_FADE_DEPTH).
  //
  // Candidacy is the same sub-pixel test, deliberately, so a wide feature stays
  // opaque. A ~2px mark IS its own overlap, which is what makes a per-instance
  // alpha read as the pileup's depth; a gene overlaps its neighbour over part of
  // its length, and one instance alpha would ghost it end to end to report a
  // collision at one end. The solid-overlap clause has no meaning here — nothing
  // is held out of a collapse that the mode already applied to everything.
  if (singleRow) {
    const collapsed: CollapsedMark[] = []
    for (const [id, ext] of packed) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
      const geom = features.get(id)!
      if (isSubPixelFade(geom, bpPerPx)) {
        const [startPx, endPx] = renderedSpanPx(geom, bpPerPx)
        collapsed.push({ id, startPx, endPx })
      }
    }
    return { layoutMap, layoutHeights, droppedLabelIds, collapsed, trimPlan }
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
  // Every feature pinned to row 0 by the density-collapse path below, with the
  // px span it paints — the input to `pileupFadeIds`, which decides which of
  // them fade.
  const collapsed: CollapsedMark[] = []

  // Insertion order = priority for the low rows in greedy first-fit. Features
  // that sat near the top of the previous layout are inserted first so they
  // keep those low rows across a zoom re-pack (when label overhang shifts the
  // x-sort and would otherwise reshuffle who wins a contested row); features
  // new to this layout are inserted last so they fill gaps without displacing
  // an existing top feature. This only reorders insertion — every feature still
  // lands on its compact first-fit row, so nothing is pushed below where it
  // would pack on its own. Ties fall back to layoutStartBp for determinism.
  // Pinned features sort ahead of all others (before the prior-y ordering) so
  // they claim the lowest rows in their bp range across every re-pack.
  //
  // Read the comparator as the three ranks it is: pinned, then prior row, then
  // bp. "New to this layout" is PRIOR_ROW_NONE rather than a special case, which
  // is what makes "new features sort after every returning one" fall out of the
  // ordering instead of needing branches of its own.
  const pinRank = (id: string) => (pinnedFeatureIds.has(id) ? 0 : 1)
  const priorRow = (id: string) => prevYByFeatureId?.get(id) ?? PRIOR_ROW_NONE
  const sorted = [...packed.entries()].sort(
    ([idA, a], [idB, b]) =>
      compareRank(pinRank(idA), pinRank(idB)) ||
      compareRank(priorRow(idA), priorRow(idB)) ||
      compareRank(a.layoutStartBp, b.layoutStartBp),
  )

  for (const [id, ext] of sorted) {
    const geom = features.get(id)!
    // A sub-pixel density-fade box collapses into the shared density texture
    // (rect.slang densityAlpha), so pin it to row 0 and skip the greedy stacker:
    // it reserves no vertical space and never overflows maxHeight. This keeps a
    // dense variant pileup (all ~1px boxes) on one row instead of stacking onto
    // extra rows under pixel-precise pitchX:1 packing. But only collapse where
    // the box doesn't overlap a visible feature — its clamped render would
    // otherwise land on top of that feature. Both extents come from
    // renderedSpanPx so a mark abutting another feature stacks rather than
    // overprinting it.
    const [boxStartPx, boxEndPx] = renderedSpanPx(geom, bpPerPx)
    // A collapsed box reserves no horizontal label space, so a labeled sub-pixel
    // feature (e.g. a miRNA gene at whole-arm zoom) must NOT collapse: its label
    // still renders at the feature's left edge, and piling several onto row 0
    // paints their names on top of each other. Send it through addRect so its
    // label width is reserved and it stacks like every other labeled feature.
    const collapses =
      isSubPixelFade(geom, bpPerPx) &&
      !labeledFeatureIds.has(id) &&
      !intersectsMerged(boxStartPx, boxEndPx, solidSpansPx)
    if (collapses) {
      layoutMap.set(id, 0)
      collapsed.push({ id, startPx: boxStartPx, endPx: boxEndPx })
    } else {
      const { left: arrowLeft, right: arrowRight } = strandArrowPadding(
        geom,
        bpPerPx,
      )
      const leftPx = ext.layoutStartBp / bpPerPx - arrowLeft
      const rightPx = ext.layoutEndBp / bpPerPx + arrowRight
      // A null top means the stack passed GranularRectLayout's own row limit —
      // its `maxHeight` option, which we leave at the 10000px default, NOT the
      // display's `maxHeight` config slot (that clamps the reported content
      // height, and is a tenth the size). Expected on a genuinely deep stack: the
      // feature gets OFFSCREEN_Y so it's filtered out, and `countTruncatedFeatures`
      // is how the display owns up to it.
      const top = layout.addRect(id, leftPx, rightPx, ext.height)
      layoutMap.set(id, top === null ? OFFSCREEN_Y : top)
    }
    layoutHeights.set(id, ext.height)
  }

  // `collapsed` rather than the fade set it implies: the fit solve's height
  // probes pack a ref-group ~10 times and read only the rows, so the sweep runs
  // once, in the committed layout, where its answer is actually rendered.
  return { layoutMap, layoutHeights, droppedLabelIds, collapsed, trimPlan }
}

// A sub-pixel mark drawn on row 0 — pinned there by the density collapse, or by
// collapsed display mode putting everything there — and the px span it paints.
interface CollapsedMark {
  id: string
  startPx: number
  endPx: number
}

// How many collapsed marks have to cover one point before they read as a pileup
// rather than as neighbours. Below it every mark draws opaque, so the lane
// answers "is this interval covered"; at or above it they draw at
// MIN_DENSITY_ALPHA and accumulate through the standard src-alpha blend, so a
// pixel's opacity tracks how many marks landed on it (see rect.slang) and the
// lane answers "how deep is the pile" instead.
//
// It has to be a threshold, and the threshold has to bite somewhere, because
// opacity cannot answer both questions at once. Depth needs headroom below
// opaque to be visible at all, so entering the fade regime always makes a region
// LIGHTER: one mark draws 1.0, and three sharing a pixel accumulate to
// 1-(1-0.3)^3 = 0.66. Adding a neighbour can only ever subtract, which inverts a
// coverage read. The question is therefore not whether to have a boundary but
// where to put it, and the answer is: past where the min-width clamp alone
// explains the overlap.
//
// 3, because 2 cannot tell "co-located" from "adjacent". `renderedSpanPx` widens
// every sub-pixel mark to MIN_RECT_WIDTH_PX, so two annotations that merely abut
// — disjoint in bp, one ending where the next begins — always overlap once
// clamped. A pair is the signature of ordinary tiled annotation, not of a pile.
// Three marks covering one point means three within ~2px however they are
// spread, which no clamp explains and no zoom can resolve.
//
// Measured on website/scripts/specs/graph-hprc.ts's repeatLane, which is read
// for how much of the interval is red and so needs the coverage answer: of the 171
// RepeatMasker elements on screen over its 180 kb, 89 are sub-pixel at a 900px
// pane, and a threshold of 2 faded 24 of them — the denser clusters rendering
// LIGHTER than their isolated neighbours, which is the inversion above, in the
// figure. At 3 nothing on screen fades, at any pane width the figure is captured
// at; the only three marks the sweep still flags anywhere sit in the fetch
// buffer, off screen, which is the decision staying local doing its job.
const PILEUP_FADE_DEPTH = 3

// Which collapsed marks sit under a pileup that deep. This is the whole reason
// the fade exists: on row 0 nothing stacks, so marks over the same pixels are
// drawn one on top of another, and at full opacity the ones underneath are not
// merely hard to read but *gone*, with no cue that they are there.
//
// This replaced a count: fade every collapsed mark once a ref-group held >= 1000
// of them, else none. Three things were wrong with measuring it that way, and
// they are all the same mistake — occlusion is *local* and the count was not.
// Marks piled on one pixel occlude each other whether or not 998 more exist
// elsewhere. The count was per ref-group, so one view could draw a track at two
// different opacities, chr1 faded and chr21 not. And it counted the fetched span
// — which buffers half a viewport either side — against a threshold justified as
// "~1 mark per pixel of a typical viewport", a ratio that also moves with the
// window width. Depth keeps all three properties: it is local, it is per mark,
// and it is measured in painted pixels rather than in features fetched.
//
// A lone mark with clear space around it still renders opaque, which is what the
// count was protecting and is preserved here exactly.
//
// An interval sweep, because "how many marks cover this point" is not answerable
// from a running max end. Ends sort before starts at equal px so half-open spans
// that merely touch don't count as sharing a point. `open` holds the marks that
// are covering the current point and not yet flagged: the moment `depth` reaches
// the threshold every one of them is under a pileup that deep, so they all fade
// and leave the set — `depth` goes on counting them, and any mark that opens
// while it stays at or above the threshold is flagged as it arrives.
function pileupFadeIds(collapsed: CollapsedMark[]): ReadonlySet<string> {
  const events = collapsed.flatMap(mark => [
    { px: mark.startPx, delta: 1, id: mark.id },
    { px: mark.endPx, delta: -1, id: mark.id },
  ])
  events.sort((a, b) => a.px - b.px || a.delta - b.delta)

  const fade = new Set<string>()
  const open = new Set<string>()
  let depth = 0
  for (const { delta, id } of events) {
    if (delta === -1) {
      depth--
      open.delete(id)
      continue
    }
    depth++
    open.add(id)
    if (depth >= PILEUP_FADE_DEPTH) {
      for (const openId of open) {
        fade.add(openId)
      }
      open.clear()
    }
  }
  return fade
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
  // Feature ids whose collapsed box sits under a pileup PILEUP_FADE_DEPTH marks
  // deep. Only these keep the fade flag; every other box — stacked, or a
  // collapsed mark with no more than a neighbour or two over it — is rewritten
  // to 0 and drawn opaque.
  densityFadeIds: ReadonlySet<string>,
) {
  const featureOffsets = new Float32Array(data.flatbushItems.length)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    featureOffsets[i] = layoutMap.get(data.flatbushItems[i]!.featureId) ?? 0
  }

  for (let i = 0; i < data.rectDensityFade.length; i++) {
    const featureId = data.flatbushItems[data.rectFeatureIndices[i]!]!.featureId
    data.rectDensityFade[i] = densityFadeIds.has(featureId) ? 1 : 0
  }

  for (let i = 0; i < data.rectYs.length; i++) {
    data.rectYs[i] =
      data.rectYs[i]! + featureOffsets[data.rectFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.lineYs.length; i++) {
    data.lineYs[i] =
      data.lineYs[i]! + featureOffsets[data.lineFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.arrowYs.length; i++) {
    data.arrowYs[i] =
      data.arrowYs[i]! + featureOffsets[data.arrowFeatureIndices[i]!]!
  }

  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    const offset = featureOffsets[i]!
    const height = layoutHeights.get(item.featureId) ?? item.featureHeightPx
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
