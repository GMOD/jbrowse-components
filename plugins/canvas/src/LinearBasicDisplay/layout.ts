import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { LABEL_PADDING_PX } from '../RenderFeatureDataRPC/constants.ts'
import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  STRAND_ARROW_WIDTH,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { maxLabelTextWidth } from '../RenderFeatureDataRPC/rpcTypes.ts'
import { MIN_RECT_WIDTH_PX } from './components/sharedRendererConstants.ts'
import { captureFeatureTops } from './yMorph.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

// Y offset applied to features that overflow GranularRectLayout's maxHeight.
// Pushes them far above the visible area so the renderer/hit-test drops them
// instead of stacking them at y=0. Float32 handles this magnitude losslessly.
const OFFSCREEN_Y = -1e6

// Tallest row bottom across a layout, i.e. its content height.
export function maxBottom(map: ReadonlyMap<number, FeatureDataResult>) {
  let max = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (item.bottomPx > max) {
        max = item.bottomPx
      }
    }
  }
  return max
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
  // raises it (2, 4) to keep fewer names on tighter rungs. See keepFeatureLabel.
  labelRoomFactor?: number
}

// Whether a feature keeps its name under the active decimation policy. `all`
// keeps every name; `fitWidth` keeps pinned/highlighted names always, plus any
// name whose reserved width (times `roomFactor`) fits the whitespace its
// overhang can use — the feature box PLUS the gap to the neighbor on the
// overhang side. A name renders left-aligned to the box and overhangs rightward
// (leftward in a reversed region) into free space (see computeLabelPosition),
// and the packer reserves exactly that overhang, so keying on box width alone
// dropped names that plainly had room; keying on the available room drops a name
// only where it would genuinely collide. So an isolated feature keeps its name
// however narrow its box, while a name crammed against its neighbor still sheds
// — thinning names (and their reserved row height) precisely in the dense
// stretches that overflow. `roomFactor` (>= 1) is the fit ladder's gradual knob:
// it demands that much more whitespace before a name is kept, so the tighter
// decimated rungs (2x, 4x) shed the crowded names first instead of dropping
// straight to no names at all.
function keepFeatureLabel(
  labelDecimation: LabelDecimation,
  availableRoomPx: number,
  labelWidthPx: number,
  pinned: boolean,
  roomFactor: number,
) {
  return (
    labelDecimation === 'all' ||
    pinned ||
    availableRoomPx >= labelWidthPx * roomFactor
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

function reservedLabelWidthPx(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
) {
  // Add LABEL_PADDING_PX so adjacent labels packed onto one row keep a small
  // gap and small measureText underestimates don't cause visual overlap. Keep 0
  // when there's no label so the collapse-to-row-0 path (hasRenderedLabel) and
  // empty-feature packing stay unaffected.
  const width = maxLabelTextWidth(labelData, showLabels, showDescriptions)
  return width > 0 ? width + LABEL_PADDING_PX : 0
}

function scaleFloat32(arr: Float32Array, multiplier: number) {
  for (let i = 0; i < arr.length; i++) {
    arr[i]! *= multiplier
  }
}

function offsetFloat32(arr: Float32Array, offset: number) {
  for (let i = 0; i < arr.length; i++) {
    arr[i]! += offset
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
  const {
    bpPerPx,
    regionKeys,
    showLabels,
    showDescriptions,
    reversedRegions,
    displayMode,
    pinnedFeatureIds,
    labelDecimation = 'all',
    labelRoomFactor = 1,
  } = inputs
  const heightMultiplier = HEIGHT_MULTIPLIERS[displayMode]
  const labelFontPx = labelFontSize(displayMode)
  const rowPadding = ROW_PADDING[displayMode]
  // Collapsed packs every feature onto row 0 (see packRef). Labels are already
  // forced off upstream (model showLabels/showDescriptions), so no row height is
  // reserved for them.
  const singleRow = displayMode === 'collapsed'

  const out = new Map<number, FeatureDataResult>()
  const refGroups = new Map<string, [number, FeatureDataResult][]>()
  for (const [n, raw] of rpcDataMap) {
    if (raw.flatbushItems.length === 0) {
      // Empty regions need no layout mutations — share the raw object rather
      // than allocating clone arrays that will never be written, and skip the
      // ref-group (nothing to pack).
      out.set(n, raw)
    } else {
      const cloned = cloneMutableFields(raw)
      applyHeightScale(cloned, heightMultiplier)
      out.set(n, cloned)
      const key = regionKeys.get(n) ?? ''
      let group = refGroups.get(key)
      if (!group) {
        group = []
        refGroups.set(key, group)
      }
      group.push([n, cloned])
    }
  }

  for (const [, regions] of refGroups) {
    const { layoutMap, layoutHeights, droppedLabelIds, densityFadeIds } =
      packRef(
        regions,
        bpPerPx,
        showLabels,
        showDescriptions,
        reversedRegions,
        pinnedFeatureIds,
        labelDecimation,
        labelRoomFactor,
        heightMultiplier,
        labelFontPx,
        rowPadding,
        singleRow,
        prevYByFeatureId,
      )
    for (const [, data] of regions) {
      applyLayoutToRegion(
        data,
        layoutMap,
        layoutHeights,
        droppedLabelIds,
        densityFadeIds,
      )
    }
  }

  return out
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
// display can pass one around (it holds three — one per fit reservation config).
export type IncrementalLayout = ReturnType<typeof createIncrementalLayout>

export function createIncrementalLayout() {
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
        // so top features keep their rows across a zoom (see packRef).
        const output = computeLaidOutData(
          members,
          inputs,
          prev && captureFeatureTops(prev.output),
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

// Fit-to-display-height: uniformly scale an already-laid-out region so the
// whole stack fits the track height without scrolling, then shift it down by
// `offsetY`. Unlike applyHeightScale (a pre-pack body shrink that feeds the
// packer), this runs AFTER packing on the offset geometry, so it also scales the
// packed `topPx`/`bottomPx` and the row-offset Ys — every Y and height by the
// same factor, so content height × scale lands exactly on the track height. Row
// assignment is untouched (it's fixed by X-overlap), so it's a pure vertical
// shrink. `offsetY` (>= 0) then translates every Y *position* — not the heights —
// so a fit stack shorter than the track is vertically centered in it rather than
// hugging the top (see `fitContentOffsetY`); 0 leaves it top-anchored.
export function scaleLaidOutData(
  map: ReadonlyMap<number, FeatureDataResult>,
  scale: number,
  offsetY = 0,
): Map<number, FeatureDataResult> {
  const out = new Map<number, FeatureDataResult>()
  for (const [n, data] of map) {
    if (data.flatbushItems.length === 0) {
      // Nothing to scale or shift — share the raw object (as computeLaidOutData
      // does for empty regions) rather than allocating clone arrays that stay
      // untouched, keeping the reference stable so idle empty regions don't
      // re-upload.
      out.set(n, data)
    } else {
      const cloned = cloneMutableFields(data)
      // Reuse applyHeightScale for the fields it already covers (rect/line/arrow
      // Ys+heights, subfeature/label/amino-acid tops, featureHeightPx), then add
      // the packed flatbush box tops/bottoms it doesn't touch (those are 0 at the
      // pre-pack stage applyHeightScale was written for).
      applyHeightScale(cloned, scale)
      for (const item of cloned.flatbushItems) {
        item.topPx = item.topPx * scale + offsetY
        item.bottomPx = item.bottomPx * scale + offsetY
      }
      if (offsetY !== 0) {
        // Shift every Y *position* (not height) so the whole scaled stack slides
        // down uniformly. Mirrors the field set applyHeightScale scales.
        offsetFloat32(cloned.rectYs, offsetY)
        offsetFloat32(cloned.lineYs, offsetY)
        offsetFloat32(cloned.arrowYs, offsetY)
        for (const info of cloned.subfeatureInfos) {
          info.topPx += offsetY
          info.bottomPx += offsetY
        }
        for (const labelData of Object.values(cloned.floatingLabelsData)) {
          labelData.topY += offsetY
        }
        if (cloned.aminoAcidOverlay) {
          for (const aa of cloned.aminoAcidOverlay) {
            aa.topPx += offsetY
          }
        }
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

function packRef(
  regions: [number, FeatureDataResult][],
  bpPerPx: number,
  showLabels: boolean,
  showDescriptions: boolean,
  reversedRegions: ReadonlySet<number>,
  // Feature ids pinned to the top: sorted ahead of everything so they win the
  // lowest rows in their bp range. Also the always-keep set for `fitWidth` name
  // decimation.
  pinnedFeatureIds: ReadonlySet<string>,
  // Name-decimation policy (see keepFeatureLabel). `all` at every rung except the
  // `decimated` fit rungs, which pass `fitWidth`.
  labelDecimation: LabelDecimation,
  // Whitespace multiplier for `fitWidth` decimation (see keepFeatureLabel). 1 at
  // the first decimated rung; the tighter rungs raise it to shed more names.
  labelRoomFactor: number,
  // compact/superCompact scale factor (1 in normal mode), used to shrink the
  // row-quantization grid (pitchY) with the feature body.
  heightMultiplier: number,
  // Resolved label font size (px) for the current display mode — reserved per
  // rendered label line so the row height matches the (compact-shrunk) text.
  labelFontPx: number,
  // Vertical gap between stacked rows for the current display mode (compact
  // modes tighten it more than the body shrink; see ROW_PADDING).
  rowPadding: number,
  // Collapsed mode: pin every feature to row 0 for a single-row overview,
  // bypassing the greedy stacker (and the sub-pixel density-collapse path).
  singleRow: boolean,
  // Each feature's y (px) in the previous layout, if any. Used only to order
  // insertion, not to force a row — see the sort below.
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
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

  const labelInfoByFeatureId = new Map<
    string,
    { hasName: boolean; hasDescription: boolean; maxLabelWidthPx: number }
  >()
  for (const [, data] of regions) {
    for (const labelData of Object.values(data.floatingLabelsData)) {
      const targetId = labelData.parentFeatureId ?? labelData.featureId
      const widthPx = reservedLabelWidthPx(
        labelData,
        showLabels,
        showDescriptions,
      )
      const existing = labelInfoByFeatureId.get(targetId)
      if (existing) {
        if (labelData.nameLabel) {
          existing.hasName = true
        }
        if (labelData.descriptionLabel) {
          existing.hasDescription = true
        }
        if (widthPx > existing.maxLabelWidthPx) {
          existing.maxLabelWidthPx = widthPx
        }
      } else {
        labelInfoByFeatureId.set(targetId, {
          hasName: !!labelData.nameLabel,
          hasDescription: !!labelData.descriptionLabel,
          maxLabelWidthPx: widthPx,
        })
      }
    }
  }

  // Track per-feature whether it appears in any reversed/non-reversed region
  // so label-overhang space can be reserved on the correct side(s). In a
  // reversed region the label visually extends toward lower bp, so the
  // overhang must widen layoutStartBp; otherwise it widens layoutEndBp.
  interface FeatureExtent {
    startBp: number
    endBp: number
    layoutStartBp: number
    layoutEndBp: number
    // Compact-scaled feature-body height (px), pre-label. `height` below adds the
    // reserved label line(s) once the keep decision is made.
    bodyHeightPx: number
    height: number
    strand: number
    hasReversed: boolean
    hasNonReversed: boolean
    densityFade: boolean
    // Whether this feature reserves any label line (name kept and/or description
    // shown). Gates the horizontal label-overhang reservation below so a
    // decimated (name-dropped) feature reserves no overhang.
    reservesLabel: boolean
  }
  // Features whose name was decimated away (`fitWidth`): their reserved row
  // height and overhang are skipped here, and their floatingLabelsData entry is
  // deleted in applyLayoutToRegion so no renderer/hit-test draws the dropped
  // name. Empty under the default `all` policy.
  const droppedLabelIds = new Set<string>()

  // Pass 1: gather each feature's extent and reversed/non-reversed sides. The
  // keep-name decision is deferred to pass 2 because `fitWidth` decimation needs
  // every feature's extent first, to measure the overhang whitespace between
  // neighbors.
  const allFeatures = new Map<string, FeatureExtent>()
  for (const [displayedRegionIndex, data] of regions) {
    const reversed = reversedRegions.has(displayedRegionIndex)
    for (const item of data.flatbushItems) {
      const existing = allFeatures.get(item.featureId)
      if (existing) {
        if (reversed) {
          existing.hasReversed = true
        } else {
          existing.hasNonReversed = true
        }
      } else {
        allFeatures.set(item.featureId, {
          startBp: item.startBp,
          endBp: item.endBp,
          layoutStartBp: item.startBp,
          layoutEndBp: item.endBp,
          bodyHeightPx: item.featureHeightPx,
          height: 0,
          strand: item.strand ?? 0,
          hasReversed: reversed,
          hasNonReversed: !reversed,
          densityFade: item.densityFade,
          reservesLabel: false,
        })
      }
    }
  }

  // `fitWidth` keeps a name where the box plus its overhang whitespace can host
  // it; measure that per-side room once all extents are known. The default `all`
  // policy keeps every name, so it never needs this.
  const overhangRoom =
    labelDecimation === 'fitWidth'
      ? labelOverhangRoomPx(allFeatures, bpPerPx)
      : undefined

  // Pass 2: decide each feature's kept label lines, reserve their row height,
  // and widen its layout span by the reserved label overhang.
  for (const [id, ext] of allFeatures) {
    const labelInfo = labelInfoByFeatureId.get(id)
    // Whitespace the name overhang can use, on the side(s) this feature points:
    // the min across the sides it occupies so a feature spanning both directions
    // must clear on both. Infinity (no room measured) under the `all` policy.
    const availableRoomPx = overhangRoom
      ? Math.min(
          ext.hasNonReversed ? overhangRoom.rightRoom.get(id)! : Infinity,
          ext.hasReversed ? overhangRoom.leftRoom.get(id)! : Infinity,
        )
      : Infinity
    // Keep this feature's name unless decimation drops it (no room to host it,
    // and not pinned/highlighted). A dropped name is recorded so its label entry
    // is deleted after layout.
    const keepName =
      showLabels &&
      !!labelInfo?.hasName &&
      keepFeatureLabel(
        labelDecimation,
        availableRoomPx,
        labelInfo.maxLabelWidthPx,
        pinnedFeatureIds.has(id),
        labelRoomFactor,
      )
    // A feature that had a name but didn't keep it is decimated away, and
    // applyLayoutToRegion deletes its WHOLE floatingLabelsData entry (the
    // description with it). So don't reserve a description row that would then
    // never draw — keep the reserved height in step with what actually renders.
    // (On live paths this is moot: fitWidth decimation always runs with
    // showDescriptions=false; the guard just removes the latent contradiction.)
    const nameDropped = showLabels && !!labelInfo?.hasName && !keepName
    if (nameDropped) {
      droppedLabelIds.add(id)
    }
    const keepDescription =
      showDescriptions && !!labelInfo?.hasDescription && !nameDropped

    // bodyHeightPx is already compact-scaled (see applyHeightScale); add the
    // mode's inter-row gap (rowPadding) so rows pack tightly. Each kept label
    // line reserves the mode's resolved font size (labelFontPx) so compact rows
    // shrink with the smaller text the renderers draw.
    let height = ext.bodyHeightPx + rowPadding
    if (keepName) {
      height += labelFontPx
    }
    if (keepDescription) {
      height += labelFontPx
    }
    ext.height = height
    ext.reservesLabel = keepName || keepDescription

    // Widen the layout span by the label overhang so the packer keeps a kept
    // name off its neighbor's row. A reversed region overhangs toward lower bp
    // (widen layoutStartBp); otherwise toward higher bp (widen layoutEndBp).
    if (labelInfo && ext.reservesLabel) {
      const labelBp = labelInfo.maxLabelWidthPx * bpPerPx
      if (ext.hasNonReversed) {
        ext.layoutEndBp = Math.max(ext.layoutEndBp, ext.startBp + labelBp)
      }
      if (ext.hasReversed) {
        ext.layoutStartBp = Math.min(ext.layoutStartBp, ext.endBp - labelBp)
      }
    }
  }

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
  const sorted = [...allFeatures.entries()].sort(([idA, a], [idB, b]) => {
    const pinA = pinnedFeatureIds.has(idA)
    const pinB = pinnedFeatureIds.has(idB)
    if (pinA !== pinB) {
      return pinA ? -1 : 1
    }
    const ya = prevYByFeatureId?.get(idA)
    const yb = prevYByFeatureId?.get(idB)
    if (ya !== undefined && yb !== undefined && ya !== yb) {
      return ya - yb
    }
    if (ya !== undefined && yb === undefined) {
      return -1
    }
    if (ya === undefined && yb !== undefined) {
      return 1
    }
    return a.layoutStartBp - b.layoutStartBp
  })
  // Box px-spans of the visible (non-collapsing) features. A sub-pixel fade box
  // may collapse onto row 0 only where it doesn't overlap one of these — else it
  // must stack, or it renders on top of the visible feature (a 1bp SNP sitting
  // inside a wide gene box is the canonical case).
  const solidSpansPx = mergeIntervals(
    [...allFeatures.values()]
      .filter(ext => !isSubPixelFade(ext, bpPerPx))
      .map(ext => [ext.startBp / bpPerPx, ext.endBp / bpPerPx]),
  )

  for (const [id, ext] of sorted) {
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
    // otherwise land on top of that feature. Match the render extent to the
    // shader's min-draw clamp (MIN_RECT_WIDTH_PX * 2, anchored at the start) so a
    // mark abutting a visible feature stacks rather than overprinting it.
    const boxStartPx = ext.startBp / bpPerPx
    const boxEndPx = Math.max(
      ext.endBp / bpPerPx,
      boxStartPx + MIN_RECT_WIDTH_PX * 2,
    )
    // A collapsed box reserves no horizontal label space, so a labeled sub-pixel
    // feature (e.g. a miRNA gene at whole-arm zoom) must NOT collapse: its label
    // still renders at the feature's left edge, and piling several onto row 0
    // paints their names on top of each other. Send it through addRect so its
    // label width is reserved and it stacks like every other labeled feature.
    const hasRenderedLabel =
      (labelInfoByFeatureId.get(id)?.maxLabelWidthPx ?? 0) > 0
    const collapses =
      isSubPixelFade(ext, bpPerPx) &&
      !hasRenderedLabel &&
      !intersectsMerged(boxStartPx, boxEndPx, solidSpansPx)
    if (collapses) {
      layoutMap.set(id, 0)
      collapsedFeatureIds.add(id)
    } else {
      const { left: arrowLeft, right: arrowRight } = strandArrowPadding(ext)
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

  // Drop labels whose feature overflowed maxHeight (the feature itself doesn't
  // render, and we don't want to pay the React reconciliation cost of emitting
  // thousands of off-screen <div> labels in useFloatingLabels) or whose name was
  // decimated away (no row height was reserved for it, so drawing it would
  // overlap the boxes).
  for (const [key, labelData] of Object.entries(data.floatingLabelsData)) {
    const layoutKey = labelData.parentFeatureId ?? labelData.featureId
    const offset = layoutMap.get(layoutKey)
    if (
      offset === undefined ||
      offset === OFFSCREEN_Y ||
      droppedLabelIds.has(layoutKey)
    ) {
      delete data.floatingLabelsData[key]
      continue
    }
    labelData.topY += offset
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += featureOffsets[aa.flatbushIdx]!
    }
  }
}
