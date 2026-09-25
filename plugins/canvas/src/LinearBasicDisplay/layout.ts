import { compareGroupKeys } from '@jbrowse/core/util/groupKeys'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import {
  applyHeightScale,
  applyLayoutToRegion,
  cloneMutableFields,
} from './applyLayout.ts'
import { pileupFadeIds } from './densityCollapse.ts'
import { facetField, sectionIdsOf } from './facet.ts'
import { applyIsoformGapFloor, planIsoformGapFloor } from './isoformGapFloor.ts'
import { applyIsoformTrim } from './isoformTrim.ts'
import { displayModeMetrics } from './layoutInputs.ts'
import { packedRowsHeight } from './layoutQueries.ts'
import { packPreparedRef, prepareRefPack, trimPreparedRef } from './packRef.ts'
import { OFFSCREEN_Y, isPlacedRow } from './rowPlacement.ts'
import { captureFeatureTops } from './yMorph.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureFacet } from './facet.ts'
import type { IsoformGapSpread } from './isoformGapFloor.ts'
import type { IsoformBadge, IsoformTrim } from './isoformTrim.ts'
import type {
  DisplayModeMetrics,
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './layoutInputs.ts'
import type { PackPrep, PackTrims } from './packRef.ts'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

// Regions sharing an `assembly:refName` key share one layout, so a spanning
// feature gets the same Y in every region it appears in.
export function computeLaidOutData(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
): Map<number, FeatureDataResult> {
  return layoutRefGroups(rpcDataMap, inputs, prevYByFeatureId).out
}

// The density band flattens every record onto row 0 to share pixels, and a
// section split there would stack two bands nobody reserved.
function effectiveFacet(
  inputs: Pick<LayoutInputs, 'facet' | 'flattenRows'>,
): FeatureFacet | undefined {
  return inputs.flattenRows ? undefined : inputs.facet
}

// The row above each section's first row, spent only while the sections draw
// chips; ungrouped is the one-section case at 0.
function sectionChipPx(inputs: Pick<LayoutInputs, 'facet' | 'flattenRows'>) {
  return effectiveFacet(inputs) ? GROUP_LABEL_HEIGHT : 0
}

function sectionOrder(inputs: Pick<LayoutInputs, 'facet' | 'flattenRows'>) {
  const facet = effectiveFacet(inputs)
  return facet ? facetField(facet).compare : compareGroupKeys
}

// Which section every item stacks into, capped over the whole display, or
// undefined while ungrouped.
function sectionAssignment(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
) {
  const facet = effectiveFacet(inputs)
  return facet ? sectionIdsOf(rpcDataMap, facet) : undefined
}

interface SectionPrep {
  id: GroupId
  prep: PackPrep
}

interface RefSections {
  sections: SectionPrep[]
  // The features of hidden sections, which leave the pack.
  hiddenIds: Set<string>
}

const UNGROUPED: GroupId = { key: '', label: '' }

// One preparation per section of a ref group, in stacking order. Ungrouped is
// the one-section case, so nothing downstream carries an ungrouped branch.
function prepareRefSections(
  regions: [number, LayoutRegionData][],
  inputs: LabelRoomFactorFreeInputs,
  metrics: DisplayModeMetrics,
  sectionOf: ((item: FlatbushItem) => GroupId) | undefined,
): RefSections {
  const hiddenIds = new Set<string>()
  if (!sectionOf) {
    return {
      sections: [
        {
          id: UNGROUPED,
          prep: prepareRefPack(regions, inputs, metrics),
        },
      ],
      hiddenIds,
    }
  }
  const members = new Map<string, { id: GroupId; ids: Set<string> }>()
  for (const [, data] of regions) {
    for (const item of data.flatbushItems) {
      const id = sectionOf(item)
      if (inputs.hiddenGroupKeys?.has(id.key)) {
        hiddenIds.add(item.featureId)
        continue
      }
      let member = members.get(id.key)
      if (!member) {
        member = { id, ids: new Set() }
        members.set(id.key, member)
      }
      member.ids.add(item.featureId)
    }
  }
  const compare = sectionOrder(inputs)
  return {
    sections: [...members.values()]
      .sort((a, b) => compare(a.id.key, b.id.key))
      .map(({ id, ids }) => ({
        id,
        prep: prepareRefPack(regions, inputs, metrics, ids),
      })),
    hiddenIds,
  }
}

interface PackedSection extends SectionPrep {
  trims: PackTrims
  pack: ReturnType<typeof packPreparedRef>
}

// Section tops are display-wide: two refs side by side put a strand's section
// at one y, or the chip row could name neither. Each section is as tall as
// its tallest ref group, and the chip row sits above its first row.
function stackSections(
  refs: readonly PackedSection[][],
  inputs: Pick<LayoutInputs, 'facet' | 'flattenRows'>,
) {
  const chipPx = sectionChipPx(inputs)
  const heights = new Map<string, number>()
  for (const sections of refs) {
    for (const { id, pack } of sections) {
      heights.set(
        id.key,
        Math.max(
          heights.get(id.key) ?? 0,
          packedRowsHeight(pack.layoutMap, pack.layoutHeights),
        ),
      )
    }
  }
  const tops = new Map<string, number>()
  let y = 0
  for (const key of [...heights.keys()].sort(sectionOrder(inputs))) {
    tops.set(key, y + chipPx)
    y += chipPx + heights.get(key)!
  }
  return tops
}

// A fresh map, so a second probe cannot see the first one's offsets; the
// offscreen sentinel is kept exact rather than shifted.
function offsetLayoutMap(layoutMap: ReadonlyMap<string, number>, top: number) {
  const out = new Map<string, number>()
  for (const [id, y] of layoutMap) {
    out.set(id, isPlacedRow(y) ? y + top : y)
  }
  return out
}

// The sections of one ref group folded back into the single per-ref layout
// every consumer reads. Feature ids are disjoint across sections, so the maps
// merge without collision; a hidden feature lands offscreen at no height.
function mergeSections(
  { sections, hiddenIds }: RefSections & { sections: PackedSection[] },
  tops: ReadonlyMap<string, number>,
  heightMultiplier: number,
) {
  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()
  const droppedLabelIds = new Set<string>()
  const trims = new Map<string, IsoformTrim>()
  const badges = new Map<string, IsoformBadge>()
  const gapSpreads = new Map<string, IsoformGapSpread>()
  const features: PackPrep['features'] = new Map()
  const collapsedFeatureIds = new Set<string>()
  for (const { id, prep, pack } of sections) {
    for (const [fid, y] of offsetLayoutMap(pack.layoutMap, tops.get(id.key)!)) {
      layoutMap.set(fid, y)
    }
    for (const [fid, h] of pack.layoutHeights) {
      layoutHeights.set(fid, h)
    }
    for (const fid of pack.droppedLabelIds) {
      droppedLabelIds.add(fid)
    }
    for (const [fid, trim] of pack.trimPlan.trims) {
      trims.set(fid, trim)
    }
    for (const [fid, badge] of pack.trimPlan.badges) {
      badges.set(fid, badge)
    }
    for (const [fid, spread] of planIsoformGapFloor(
      prep.stacks,
      pack.trimPlan.trims,
      heightMultiplier,
    )) {
      gapSpreads.set(fid, spread)
    }
    for (const [fid, geom] of prep.features) {
      features.set(fid, geom)
    }
    for (const fid of prep.collapsedFeatureIds) {
      collapsedFeatureIds.add(fid)
    }
  }
  for (const fid of hiddenIds) {
    layoutMap.set(fid, OFFSCREEN_Y)
    layoutHeights.set(fid, 0)
  }
  return {
    layoutMap,
    layoutHeights,
    droppedLabelIds,
    trimPlan: { trims, badges },
    gapSpreads,
    features,
    collapsedFeatureIds,
  }
}

function packRefSections(
  { sections, hiddenIds }: RefSections,
  packInputs: LayoutInputs,
  metrics: DisplayModeMetrics,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  return {
    hiddenIds,
    sections: sections.map(section => {
      const trims = trimPreparedRef(section.prep, packInputs, metrics)
      return {
        ...section,
        trims,
        pack: packPreparedRef(
          section.prep,
          trims,
          packInputs,
          metrics,
          prevYByFeatureId,
        ),
      }
    }),
  }
}

// The pileup fade runs here and not in the pack: the fit solve's probes pack
// a ref-group ~10 times and read only the rows.
function layoutRefGroups(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LayoutInputs,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  const metrics = displayModeMetrics(inputs)
  const sectionOf = sectionAssignment(rpcDataMap, inputs)
  const out = new Map<number, FeatureDataResult>()
  const collapsedIds = new Set<string>()
  const refs = [...groupRawByRef(rpcDataMap).values()].map(regions => ({
    regions,
    ...packRefSections(
      prepareRefSections(regions, inputs, metrics, sectionOf),
      inputs,
      metrics,
      prevYByFeatureId,
    ),
  }))
  const tops = stackSections(
    refs.map(r => r.sections),
    inputs,
  )
  for (const ref of refs) {
    const merged = mergeSections(ref, tops, metrics.heightMultiplier)
    for (const id of merged.collapsedFeatureIds) {
      collapsedIds.add(id)
    }
    const densityFadeIds = pileupFadeIds(
      merged.features,
      merged.layoutMap,
      inputs.bpPerPx,
    )
    // Cloned only once the packing is decided: `cloneMutableFields` is ~4/5
    // of this function's cost, and the probes skip it.
    for (const [n, raw] of ref.regions) {
      const cloned = cloneMutableFields(raw)
      // Before the height scale, so the trim's px and its whole label rows
      // are each spent in the unit the worker counted them in.
      applyIsoformTrim(cloned, merged.trimPlan)
      applyHeightScale(cloned, metrics.heightMultiplier, metrics.labelFontPx)
      // After the scale, because the pixel it promises is a drawn one; the
      // packer reserved the same spread through `isoformGapSpreadPx`.
      applyIsoformGapFloor(cloned, merged.gapSpreads)
      applyLayoutToRegion(
        cloned,
        merged.layoutMap,
        merged.layoutHeights,
        merged.droppedLabelIds,
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
  const sectionOf = sectionAssignment(rpcDataMap, inputs)
  const preps = [...groupRawByRef(rpcDataMap).values()].map(regions =>
    prepareRefSections(regions, inputs, metrics, sectionOf),
  )
  return (maxIsoformsPerGene: number | undefined) => {
    const trimmedInputs = { ...inputs, maxIsoformsPerGene }
    return (labelRoomFactor: number | undefined) => {
      const packInputs = { ...trimmedInputs, labelRoomFactor }
      const refs = preps.map(
        ref => packRefSections(ref, packInputs, metrics).sections,
      )
      const tops = stackSections(refs, inputs)
      let max = 0
      for (const sections of refs) {
        for (const { id, pack } of sections) {
          max = Math.max(
            max,
            packedRowsHeight(
              offsetLayoutMap(pack.layoutMap, tops.get(id.key)!),
              pack.layoutHeights,
              measureIds,
            ),
          )
        }
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
  facet: true,
  hiddenGroupKeys: true,
  flattenRows: true,
  dropBelowLabelRows: true,
  bodyScale: true,
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
// hold one instance per display. Grouped, the memo is over the whole map: a
// section's top depends on every ref group's height, so one ref group cannot
// be reused while another repacks.
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
    const cacheKey = effectiveFacet(inputs)
      ? () => 'grouped'
      : (raw: LayoutRegionData) => raw.regionKey
    for (const [idx, raw] of rpcDataMap) {
      const key = cacheKey(raw)
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
