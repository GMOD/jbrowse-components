import {
  applyHeightScale,
  applyLayoutToRegion,
  cloneMutableFields,
} from './applyLayout.ts'
import { pileupFadeIds } from './densityCollapse.ts'
import { applyIsoformGapFloor, planIsoformGapFloor } from './isoformGapFloor.ts'
import { applyIsoformTrim } from './isoformTrim.ts'
import { displayModeMetrics } from './layoutInputs.ts'
import { packedRowsHeight } from './layoutQueries.ts'
import { packPreparedRef, prepareRefPack, trimPreparedRef } from './packRef.ts'
import { captureFeatureTops } from './yMorph.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './layoutInputs.ts'

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
