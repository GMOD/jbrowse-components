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
import { MIN_RECT_WIDTH_PX } from './components/sharedRendererConstants.ts'
import { OFFSCREEN_Y, isPlacedRow } from './rowPlacement.ts'
import { captureFeatureTops } from './yMorph.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

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

// Shortest feature body in a layout, i.e. the one a uniform vertical squeeze
// shrinks below a minimum first. `featureHeightPx` is the packed body height —
// the raw worker height with the display mode's multiplier already applied (see
// applyHeightScale) — so this is the number the squeeze floor has to be built on
// (see `fitBodyPx`). Unplaced features are excluded for the same reason
// `maxBottom` excludes them: they don't render, so nothing about them is visible
// to squeeze. 0 when there is no placed body, which callers read as "no body to
// size" and turn into a no-op bound.
//
// Deliberately measured off the layout rather than read off the `featureHeight`
// config slot: that slot is a per-feature jexl callback slot, so it has no single
// value to read here, and even as a plain number it describes the plain-rect
// glyph rather than whatever height the worker actually gave each feature.
export function minBodyHeight(map: ReadonlyMap<number, FeatureDataResult>) {
  let min = Number.POSITIVE_INFINITY
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (isPlacedRow(item.topPx) && item.featureHeightPx < min) {
        min = item.featureHeightPx
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
export function countTruncatedFeatures(
  map: ReadonlyMap<number, FeatureDataResult>,
) {
  let n = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (!isPlacedRow(item.topPx)) {
        n++
      }
    }
  }
  return n
}

// How names are chosen when `showLabels` is on. `all` reserves + renders every
// feature's name (the default, used at the `full`/`labels` fit rungs and in all
// non-fit modes); `fitWidth` keeps a name only where the feature's box is wide
// enough to host it (plus pinned/highlighted features), dropping the rest — the
// `decimated` fit rung's genuine intermediate between "every name" and "no name".
export type LabelDecimation = 'all' | 'fitWidth'

export interface LayoutInputs {
  bpPerPx: number
  regionKeys: Map<number, string>
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
function strandArrowPadding(ext: {
  strand: number
  hasReversed: boolean
  hasNonReversed: boolean
}) {
  const arrow = ext.strand ? STRAND_ARROW_WIDTH : 0
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

// Scales all height/y fields in a cloned FeatureDataResult by the compact
// multiplier. Worker geometry is always in normal-mode units (multiplier=1);
// this makes compact/superCompact a pure main-thread operation.
function applyHeightScale(data: FeatureDataResult, multiplier: number) {
  if (multiplier === 1) {
    return
  }
  scaleFloat32(data.rectYs, multiplier)
  scaleFloat32(data.rectHeights, multiplier)
  scaleFloat32(data.lineYs, multiplier)
  scaleFloat32(data.lineHeights, multiplier)
  scaleFloat32(data.arrowYs, multiplier)
  scaleFloat32(data.arrowHeights, multiplier)
  for (const item of data.flatbushItems) {
    item.featureHeightPx *= multiplier
  }
  for (const info of data.subfeatureInfos) {
    info.topPx *= multiplier
    info.bottomPx *= multiplier
  }
  for (const labelData of Object.values(data.floatingLabelsData)) {
    labelData.topY *= multiplier
    labelData.featureHeight *= multiplier
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx *= multiplier
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
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
  // Feature id -> y (px) from the previous layout, used only to order insertion
  // so top features keep their rows across a re-pack (see packRef).
  prevYByFeatureId?: ReadonlyMap<string, number>,
): Map<number, FeatureDataResult> {
  const metrics = displayModeMetrics(inputs.displayMode)
  const out = new Map<number, FeatureDataResult>()
  for (const [, regions] of groupRawByRef(rpcDataMap, inputs.regionKeys)) {
    const { layoutMap, layoutHeights, droppedLabelIds, densityFadeIds } =
      packPreparedRef(
        prepareRefPack(regions, inputs, metrics),
        inputs,
        metrics,
        prevYByFeatureId,
      )
    // Clone only now that the packing is decided: cloneMutableFields dominates
    // this function's cost (~4/5 of it at 4k features), so the height probes the
    // fit solve runs skip it entirely (see packedContentHeight) and only the
    // committed layout pays it.
    for (const [n, raw] of regions) {
      const cloned = cloneMutableFields(raw)
      applyHeightScale(cloned, metrics.heightMultiplier)
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

  return out
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
type LabelRoomFactorFreeInputs = Omit<LayoutInputs, 'labelRoomFactor'>

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
export function createContentHeightProbe(
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LabelRoomFactorFreeInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
  // Features the height is measured over (see `maxBottom`). It narrows only the
  // measurement, never the pack: every feature still claims its row, so the
  // rows the solve's factors are chosen against are the rows that will render.
  measureIds?: ReadonlySet<string>,
) {
  const metrics = displayModeMetrics(inputs.displayMode)
  const preps = [...groupRawByRef(rpcDataMap, inputs.regionKeys).values()].map(
    regions => prepareRefPack(regions, inputs, metrics),
  )
  return (labelRoomFactor: number) => {
    let max = 0
    for (const prep of preps) {
      const { layoutMap, layoutHeights } = packPreparedRef(
        prep,
        { ...inputs, labelRoomFactor },
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

// One-shot height for fully-formed inputs — `createContentHeightProbe` for a
// single factor. Same pack, so the same guarantee.
export function packedContentHeight(
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
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
function groupRawByRef(
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  regionKeys: Map<number, string>,
) {
  const refGroups = new Map<string, [number, FeatureDataResult][]>()
  for (const [n, raw] of rpcDataMap) {
    if (raw.flatbushItems.length > 0) {
      const key = regionKeys.get(n) ?? ''
      let group = refGroups.get(key)
      if (!group) {
        group = []
        refGroups.set(key, group)
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
  displayMode: DisplayMode
  // The MobX-computed pinned set; a stable reference until pins change, so a
  // reference compare in groupUnchanged detects a pin toggle.
  pinnedFeatureIds: ReadonlySet<string>
  // idx -> raw fetch object, by reference. A new fetch swaps the reference.
  members: Map<number, FeatureDataResult>
  // members currently rendered reversed (affects label-overhang packing)
  reversed: Set<number>
  // idx -> laid-out result, reused verbatim when the group is unchanged
  output: Map<number, FeatureDataResult>
}

function groupUnchanged(
  prev: GroupCache,
  members: Map<number, FeatureDataResult>,
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
  } = inputs
  const paramsSame =
    prev.bpPerPx === bpPerPx &&
    prev.showLabels === showLabels &&
    prev.showDescriptions === showDescriptions &&
    prev.labelDecimation === labelDecimation &&
    prev.labelRoomFactor === labelRoomFactor &&
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
    rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
    inputs: LayoutInputs,
  ): Map<number, FeatureDataResult> {
    const { regionKeys, reversedRegions } = inputs

    const groups = new Map<string, Map<number, FeatureDataResult>>()
    for (const [idx, raw] of rpcDataMap) {
      const key = regionKeys.get(idx) ?? ''
      let group = groups.get(key)
      if (!group) {
        group = new Map()
        groups.set(key, group)
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
        // group; passing the full `regionKeys`/`reversedRegions` is fine since
        // it only reads the keys of regions present in `members`.
        // Order this group's re-pack by each feature's row in the prior output
        // so top features keep their rows across a zoom (see packRef), unless
        // this instance packs measured candidates (see seedPriorRows).
        const output = computeLaidOutData(
          members,
          inputs,
          seedPriorRows && prev ? captureFeatureTops(prev.output) : undefined,
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
          displayMode: inputs.displayMode,
          pinnedFeatureIds: inputs.pinnedFeatureIds,
          members: new Map(members),
          reversed,
          output,
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
      applyHeightScale(cloned, scale)
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
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (const [k, v] of Object.entries(raw.floatingLabelsData)) {
    floatingLabelsData[k] = { ...v }
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
function renderedSpanPx(
  ext: { startBp: number; endBp: number },
  bpPerPx: number,
): [number, number] {
  const startPx = ext.startBp / bpPerPx
  return [startPx, Math.max(ext.endBp / bpPerPx, startPx + MIN_RECT_WIDTH_PX)]
}

// Merge sorted [start,end] px intervals into a disjoint, sorted set so an
// overlap query is a single binary search.
function mergeIntervals(intervals: [number, number][]) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [start, end] of sorted) {
    const last = merged.at(-1)
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

// True if [queryStart,queryEnd) overlaps any of the disjoint, sorted `merged`
// intervals. Finds the rightmost interval starting before queryEnd; because the
// set is disjoint, no earlier interval can reach queryStart if that one doesn't.
function intersectsMerged(
  queryStart: number,
  queryEnd: number,
  merged: [number, number][],
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
  // Per-side whitespace a label may overhang into. Only measured for the
  // `fitWidth` decimation; the default `all` policy keeps every name and never asks.
  overhangRoom: ReturnType<typeof labelOverhangRoomPx> | undefined
  // Box px-spans of every feature guaranteed to occupy a real row. A sub-pixel
  // fade box may collapse onto row 0 only where it doesn't overlap one of these,
  // else it must stack, or it renders on top of the other feature (a 1bp SNP
  // sitting inside a wide gene box is the canonical case).
  solidSpansPx: [number, number][]
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
    for (const labelData of Object.values(data.floatingLabelsData)) {
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
          bodyHeightPx: item.featureHeightPx * metrics.heightMultiplier,
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

  // Everything that will hold a real row, which is the collapse test below minus
  // its own overlap clause: a wide feature, OR a sub-pixel one held out of the
  // collapse because it carries a label. Counting the labeled sub-pixel features
  // here is what stops an unlabeled neighbor from pinning to row 0 on top of one
  // (a partially-rs-ID'd VCF at sub-pixel zoom: the named variant stacks, so the
  // unnamed one must see it).
  const solidSpansPx: [number, number][] = []
  for (const [id, geom] of features) {
    if (!isSubPixelFade(geom, bpPerPx) || labeledFeatureIds.has(id)) {
      solidSpansPx.push(renderedSpanPx(geom, bpPerPx))
    }
  }

  return {
    labelInfoByFeatureId,
    features,
    overhangRoom:
      labelDecimation === 'fitWidth'
        ? labelOverhangRoomPx(features, bpPerPx)
        : undefined,
    solidSpansPx: mergeIntervals(solidSpansPx),
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
  const { labelFontPx, rowPadding } = metrics
  const { labelInfoByFeatureId, features, overhangRoom } = prep
  const packed = new Map<string, PackedExtent>()
  // Features whose name was decimated away (`fitWidth`): no row height or overhang
  // is reserved for it here, and applyLayoutToRegion removes the name afterward so
  // no renderer/hit-test draws it. Empty under the default `all` policy.
  const droppedLabelIds = new Set<string>()

  for (const [id, geom] of features) {
    const labelInfo = labelInfoByFeatureId.get(id)
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
    const keepName =
      hasDrawableName &&
      keepFeatureLabel(
        labelDecimation,
        availableRoomPx,
        labelInfo.widths.name,
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
      layoutStartBp: geom.startBp,
      layoutEndBp: geom.endBp,
      height: geom.bodyHeightPx + rowPadding + labelLines * labelFontPx,
    }

    // Widen the layout span by the label overhang so the packer keeps a kept
    // name off its neighbor's row. A reversed region overhangs toward lower bp
    // (widen layoutStartBp); otherwise toward higher bp (widen layoutEndBp).
    // Gated on the feature reserving a name or description line, so one carrying
    // nothing but a subfeature label reserves no overhang.
    const reservesLabel = keepName || keepDescription
    const overhangPx =
      labelInfo && reservesLabel
        ? keptOverhangWidthPx(labelInfo.widths, keepName, keepDescription)
        : 0
    if (overhangPx > 0) {
      const labelBp = overhangPx * bpPerPx
      if (geom.hasNonReversed) {
        ext.layoutEndBp = Math.max(ext.layoutEndBp, geom.startBp + labelBp)
      }
      if (geom.hasReversed) {
        ext.layoutStartBp = Math.min(ext.layoutStartBp, geom.endBp - labelBp)
      }
    }
    packed.set(id, ext)
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
  const { packed, droppedLabelIds } = decideLabelReservations(
    prep,
    inputs,
    metrics,
  )
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
  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()
  // Features pinned to row 0 by the density-collapse path below. They fade only
  // when there are enough of them to be a genuine pileup (see DENSITY_FADE_MIN
  // and the return): a handful of collapsed marks render opaque, thousands fade
  // to convey density.
  const collapsedFeatureIds = new Set<string>()

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
    // Collapsed mode: every feature shares row 0. No greedy stacking, no
    // sub-pixel density collapse — just one overlapping row.
    if (singleRow) {
      layoutMap.set(id, 0)
      layoutHeights.set(id, ext.height)
      continue
    }
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
      collapsedFeatureIds.add(id)
    } else {
      const { left: arrowLeft, right: arrowRight } = strandArrowPadding(geom)
      const leftPx = ext.layoutStartBp / bpPerPx - arrowLeft
      const rightPx = ext.layoutEndBp / bpPerPx + arrowRight
      // A null top means the feature overflowed maxHeight. This is expected
      // (fit mode's `bodies` rung, or a dense fixed-height track): the feature
      // gets OFFSCREEN_Y so it's filtered out and the surplus scrolls.
      const top = layout.addRect(id, leftPx, rightPx, ext.height)
      layoutMap.set(id, top === null ? OFFSCREEN_Y : top)
    }
    layoutHeights.set(id, ext.height)
  }

  // Fade only in the dense-pileup regime: thousands of collapsed sub-pixel marks
  // that stack onto row 0 read as density when drawn semi-transparent, but a
  // sparse handful should stay solid so individual features are visible. Below
  // the threshold nothing fades (empty set); at or above it every collapsed mark
  // fades. One count, no per-mark decision.
  return {
    layoutMap,
    layoutHeights,
    droppedLabelIds,
    densityFadeIds:
      collapsedFeatureIds.size >= DENSITY_FADE_MIN
        ? collapsedFeatureIds
        : EMPTY_ID_SET,
  }
}

// Collapsed-mark count at/above which a region enters the density-fade regime.
// ~1 mark per pixel of a typical viewport — enough overlap that the pileup reads
// as density rather than resolvable individual features.
const DENSITY_FADE_MIN = 1000
const EMPTY_ID_SET: ReadonlySet<string> = new Set()

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
  // Feature ids whose collapsed box piles into shared pixels with another (a
  // genuine density pileup). Only these keep the fade flag; every other box —
  // stacked, or a lone collapsed mark — is rewritten to 0 and drawn opaque.
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

  // Drop the whole entry for a feature that overflowed maxHeight: the feature
  // itself doesn't render, and we don't want to pay the React reconciliation cost
  // of emitting thousands of off-screen <div> labels in FloatingLabelsLayer.
  //
  // A decimated feature keeps its entry and loses only `nameLabel` — that is the
  // one label the decimation ruled on, and it's the one whose row height went
  // unreserved, so drawing it would overlap the boxes. Its description and
  // subfeature label still have reserved space and still draw.
  for (const [key, labelData] of Object.entries(data.floatingLabelsData)) {
    const layoutKey = labelData.parentFeatureId ?? labelData.featureId
    const offset = layoutMap.get(layoutKey)
    if (offset === undefined || !isPlacedRow(offset)) {
      delete data.floatingLabelsData[key]
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
