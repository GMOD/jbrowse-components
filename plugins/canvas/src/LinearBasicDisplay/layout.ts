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

// Regions sharing an `assembly:refName` key share one layout, so a spanning
// feature gets the same Y in every region it appears in.
export function computeLaidOutData(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
): Map<number, FeatureDataResult> {
  return layoutRefGroups(rpcDataMap, inputs, prevYByFeatureId).out
}

// The pileup fade runs here and not in the pack: the fit solve's probes pack
// a ref-group ~10 times and read only the rows.
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
    // Cloned only once the packing is decided: `cloneMutableFields` is ~4/5
    // of this function's cost, and the probes skip it.
    for (const [n, raw] of regions) {
      const cloned = cloneMutableFields(raw)
      // Before the height scale, so the trim's px and its whole label rows
      // are each spent in the unit the worker counted them in.
      applyIsoformTrim(cloned, trimPlan)
      applyHeightScale(cloned, metrics.heightMultiplier, metrics.labelFontPx)
      // After the scale, because the pixel it promises is a drawn one; the
      // packer reserved the same spread through `isoformGapSpreadPx`.
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
      // Shares the raw object so an empty region keeps its reference.
      out.set(n, raw)
    }
  }

  return { out, collapsedIds }
}

// A probe skips `cloneMutableFields` and `applyLayoutToRegion`, and the prep
// is hoisted out of the loop because nothing in it depends on the factor.
// Probe and commit run the identical pack over identical raw values, so the
// measured height is the committed height by construction.
function createPackProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
  // Narrows only the measurement, never the pack.
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
  measureIds?: ReadonlySet<string>,
) {
  return createPackProbe(
    rpcDataMap,
    inputs,
    measureIds,
  )(inputs.maxIsoformsPerGene)
}

export function createIsoformCountProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: IsoformCountFreeInputs,
  measureIds?: ReadonlySet<string>,
) {
  const trimAt = createPackProbe(rpcDataMap, inputs, measureIds)
  return (maxIsoformsPerGene: number) =>
    trimAt(maxIsoformsPerGene)(inputs.labelRoomFactor)
}

// Shared by the committed layout and the probe so both pack the same groups
// from the same objects.
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

// Exhaustive by construction: a cache key compared in one place and forgotten
// in another serves a stale layout with nothing to catch it.
// `reversedRegions` is excluded because it spans every region, so comparing
// it would re-pack every group whenever any region flips; `groupUnchanged`
// compares the per-group set.
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
  inputs: LayoutInputs
  members: Map<number, LayoutRegionData>
  reversed: Set<number>
  output: Map<number, FeatureDataResult>
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

// Minus the marks the collapse pinned to row 0: they never competed for a
// row, and carrying their y=0 into the sort would rank a whole pile ahead of
// every feature below the top row.
function seedRowsFrom(prev: GroupCache) {
  const tops = captureFeatureTops(prev.output)
  for (const id of prev.collapsedIds) {
    tops.delete(id)
  }
  return tops
}

// A per-ref-group memo reusing unchanged output by reference, so N
// chromosomes arriving sequentially cost O(N) GPU uploads rather than O(N²);
// hold one instance per display.
export type IncrementalLayout = ReturnType<typeof createIncrementalLayout>

export function createIncrementalLayout({
  // Off for the `decimated` rung, whose factor is chosen by measuring
  // unseeded candidate packs: a self-seeded commit stops matching the probe,
  // overflows, and every name vanishes on the tallest tracks. Seeding it from
  // the `labels` rung instead was tried and moved no rows.
  seedPriorRows = true,
}: { seedPriorRows?: boolean } = {}) {
  let cache = new Map<string, GroupCache>()

  return function computeLaidOutDataIncremental(
    rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
    inputs: LayoutInputs,
  ): Map<number, FeatureDataResult> {
    const { reversedRegions } = inputs

    // Unlike `groupRawByRef`, an empty region still needs a cache entry, or
    // its group re-packs every time it is present.
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
    cache = nextCache
    return out
  }
}
