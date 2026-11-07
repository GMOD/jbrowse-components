import { compareGroupKeys } from '@jbrowse/core/util/groupKeys'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import {
  applyDrawnLabelSpans,
  applyHeightScale,
  applyLayoutToRegion,
  cloneMutableFields,
} from './applyLayout.ts'
import { pileupFadeIds } from './densityCollapse.ts'
import { drawnAxis } from './drawnAxis.ts'
import { facetField, sectionIdsOf } from './facet.ts'
import { applyIsoformGapFloor, planIsoformGapFloor } from './isoformGapFloor.ts'
import { applyIsoformTrim } from './isoformTrim.ts'
import { displayModeMetrics } from './layoutInputs.ts'
import { packedRowsHeight } from './layoutQueries.ts'
import { packPreparedRef, prepareRefPack, trimPreparedRef } from './packRef.ts'
import { OFFSCREEN_Y, isPlacedRow } from './rowPlacement.ts'
import { applySparseExonFlags } from './sparseExons.ts'
import { captureFeatureTops } from './yMorph.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { NamedPile } from './densityCollapse.ts'
import type { DrawnAxis } from './drawnAxis.ts'
import type { IsoformGapSpread } from './isoformGapFloor.ts'
import type { IsoformBadge, IsoformTrim } from './isoformTrim.ts'
import type {
  DisplayModeMetrics,
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
  PackKnobFreeInputs,
  PackKnobs,
  PrepMetrics,
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

// The row above each section's first row, spent only while there are
// sections; ungrouped is the one-section case at 0.
function sectionChipPx({
  facet,
  sectionHeadPx = GROUP_LABEL_HEIGHT,
}: Pick<LayoutInputs, 'facet' | 'sectionHeadPx'>) {
  return facet ? sectionHeadPx : 0
}

function sectionOrder({ facet }: Pick<LayoutInputs, 'facet'>) {
  return facet ? facetField(facet).compare : compareGroupKeys
}

function sectionAssignment({ facet }: Pick<LayoutInputs, 'facet'>) {
  return facet ? sectionIdsOf(facet) : undefined
}

interface SectionPrep {
  id: GroupId
  prep: PackPrep
}

interface RefSections {
  toDrawnBp: DrawnAxis
  sections: SectionPrep[]
  // The features of hidden sections, which leave the pack.
  hiddenIds: Set<string>
}

const UNGROUPED: GroupId = { key: '', label: '' }

// One preparation per section of a ref group, in stacking order. Ungrouped is
// the one-section case, so nothing downstream carries an ungrouped branch.
function prepareRefSections(
  { regions, toDrawnBp }: RefGroup,
  inputs: PackKnobFreeInputs,
  metrics: PrepMetrics,
  sectionOf: ((item: FlatbushItem) => GroupId) | undefined,
): RefSections {
  const hiddenIds = new Set<string>()
  if (!sectionOf) {
    return {
      toDrawnBp,
      sections: [
        {
          id: UNGROUPED,
          prep: prepareRefPack(regions, inputs, metrics, toDrawnBp),
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
    toDrawnBp,
    sections: [...members.values()]
      .sort((a, b) => compare(a.id.key, b.id.key))
      .map(({ id, ids }) => ({
        id,
        prep: prepareRefPack(regions, inputs, metrics, toDrawnBp, ids),
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
  inputs: Pick<LayoutInputs, 'facet' | 'sectionHeadPx'>,
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
  const droppedNameIds = new Set<string>()
  const droppedDescriptionIds = new Set<string>()
  const trims = new Map<string, IsoformTrim>()
  const badges = new Map<string, IsoformBadge>()
  const gapSpreads = new Map<string, IsoformGapSpread>()
  const features: PackPrep['features'] = new Map()
  const collapsedFeatureIds = new Set<string>()
  const pileByMemberId = new Map<string, NamedPile>()
  for (const { id, prep, pack } of sections) {
    for (const [fid, pile] of prep.pileByMemberId) {
      pileByMemberId.set(fid, pile)
    }
    for (const [fid, y] of offsetLayoutMap(pack.layoutMap, tops.get(id.key)!)) {
      layoutMap.set(fid, y)
    }
    for (const [fid, h] of pack.layoutHeights) {
      layoutHeights.set(fid, h)
    }
    for (const fid of pack.droppedNameIds) {
      droppedNameIds.add(fid)
    }
    for (const fid of pack.droppedDescriptionIds) {
      droppedDescriptionIds.add(fid)
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
    droppedNameIds,
    droppedDescriptionIds,
    trimPlan: { trims, badges },
    gapSpreads,
    features,
    collapsedFeatureIds,
    pileByMemberId,
  }
}

function packRefSections(
  { toDrawnBp, sections, hiddenIds }: RefSections,
  packInputs: LayoutInputs,
  metrics: DisplayModeMetrics,
  prevYByFeatureId?: ReadonlyMap<string, number>,
) {
  return {
    toDrawnBp,
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
  const sectionOf = sectionAssignment(inputs)
  const out = new Map<number, FeatureDataResult>()
  const collapsedIds = new Set<string>()
  const refs = groupRawByRef(rpcDataMap).map(group => ({
    regions: group.regions,
    ...packRefSections(
      prepareRefSections(group, inputs, metrics, sectionOf),
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
    // Cloned only once the packing is decided: the height probes skip the
    // clone and every rewrite below.
    for (const [n, raw] of ref.regions) {
      const cloned = cloneMutableFields(raw)
      // Before the height scale, so the trim's px and its whole label rows
      // are each spent in the unit the worker counted them in.
      applyIsoformTrim(cloned, merged.trimPlan)
      applyDrawnLabelSpans(cloned, raw.regionStart, ref.toDrawnBp)
      applyHeightScale(cloned, metrics.heightMultiplier, metrics.labelFontPx)
      // After the scale, because the pixel it promises is a drawn one; the
      // packer reserved the same spread through `isoformGapSpreadPx`.
      applyIsoformGapFloor(cloned, merged.gapSpreads)
      applyLayoutToRegion(
        cloned,
        merged.layoutMap,
        merged.layoutHeights,
        merged.droppedNameIds,
        merged.droppedDescriptionIds,
        densityFadeIds,
        merged.pileByMemberId,
      )
      applySparseExonFlags(cloned, inputs.bpPerPx, ref.toDrawnBp)
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

// The bottom of every placed row of one probe pack, so any on-screen set can
// be measured against it without packing again. Same `isPlacedRow` test and
// `measureIds` narrowing as `maxBottom`, so a probe and the committed layout
// answer the same question.
export interface PackedBottoms {
  ids: string[]
  bottoms: number[]
  // The last measurement, since a settle re-measures cached packs against an
  // on-screen set that keeps its identity while its membership holds.
  measured?: { measureIds: ReadonlySet<string> | undefined; height: number }
}

function packedBottoms(
  refs: readonly RefSections[],
  packInputs: LayoutInputs,
  metrics: DisplayModeMetrics,
): PackedBottoms {
  const packed = refs.map(
    ref => packRefSections(ref, packInputs, metrics).sections,
  )
  const tops = stackSections(packed, packInputs)
  const ids: string[] = []
  const bottoms: number[] = []
  for (const sections of packed) {
    for (const { id, pack } of sections) {
      for (const [fid, y] of offsetLayoutMap(
        pack.layoutMap,
        tops.get(id.key)!,
      )) {
        if (isPlacedRow(y)) {
          ids.push(fid)
          bottoms.push(y + pack.layoutHeights.get(fid)!)
        }
      }
    }
  }
  return { ids, bottoms }
}

function measuredHeight(
  packed: PackedBottoms,
  measureIds: ReadonlySet<string> | undefined,
) {
  const { measured } = packed
  if (measured && measured.measureIds === measureIds) {
    return measured.height
  }
  const { ids, bottoms } = packed
  let max = 0
  for (let i = 0; i < ids.length; i++) {
    if ((!measureIds || measureIds.has(ids[i]!)) && bottoms[i]! > max) {
      max = bottoms[i]!
    }
  }
  packed.measured = { measureIds, height: max }
  return max
}

// A probe skips `cloneMutableFields` and `applyLayoutToRegion`, and shares
// one prep, kept on the cache entry, across every knob it turns. Probe and
// commit run the identical pack over identical raw values, so the measured
// height is the committed height by construction.
export function createPackHeightProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: PackKnobFreeInputs,
  // Narrows only the measurement, never the pack.
  measureIds: ReadonlySet<string> | undefined,
  cache: PackHeightCache = createPackHeightCache(),
) {
  const entry = cache(rpcDataMap, inputs)
  const preparedRefs = () => {
    if (!entry.refs) {
      const metrics = displayModeMetrics(inputs)
      const sectionOf = sectionAssignment(inputs)
      entry.refs = groupRawByRef(rpcDataMap).map(group =>
        prepareRefSections(group, inputs, metrics, sectionOf),
      )
    }
    return entry.refs
  }
  const { packs } = entry
  return (knobs: PackKnobs) => {
    const key = `${knobs.bodyScale}:${knobs.maxIsoformsPerGene}:${knobs.labelRoomFactor}:${knobs.geneLabelRoomFactor}`
    let packed = packs.get(key)
    if (packed) {
      packs.delete(key)
    } else {
      const packInputs = { ...inputs, ...knobs }
      packed = packedBottoms(
        preparedRefs(),
        packInputs,
        displayModeMetrics(packInputs),
      )
    }
    packs.set(key, packed)
    if (packs.size > PROBE_PACK_LIMIT) {
      packs.delete(packs.keys().next().value!)
    }
    return measuredHeight(packed, measureIds)
  }
}

export function createContentHeightProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: LabelRoomFactorFreeInputs,
  measureIds?: ReadonlySet<string>,
  cache?: PackHeightCache,
) {
  const heightAt = createPackHeightProbe(rpcDataMap, inputs, measureIds, cache)
  return (labelRoomFactor: number | undefined, geneLabelRoomFactor?: number) =>
    heightAt({
      bodyScale: inputs.bodyScale,
      maxIsoformsPerGene: inputs.maxIsoformsPerGene,
      labelRoomFactor,
      geneLabelRoomFactor,
    })
}

export function createIsoformCountProbe(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
  inputs: IsoformCountFreeInputs,
  measureIds?: ReadonlySet<string>,
  cache?: PackHeightCache,
) {
  const heightAt = createPackHeightProbe(rpcDataMap, inputs, measureIds, cache)
  return (maxIsoformsPerGene: number) =>
    heightAt({
      bodyScale: inputs.bodyScale,
      maxIsoformsPerGene,
      labelRoomFactor: inputs.labelRoomFactor,
      geneLabelRoomFactor: inputs.geneLabelRoomFactor,
    })
}

interface RefGroup {
  regions: [number, LayoutRegionData][]
  toDrawnBp: DrawnAxis
}

// Shared by the committed layout and the probe so both pack the same groups
// from the same objects. A region with nothing in it packs nothing but still
// draws, so its bounds still shape the axis.
function groupRawByRef(
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
): RefGroup[] {
  const bounds = new Map<string, LayoutRegionData[]>()
  const refGroups = new Map<string, [number, LayoutRegionData][]>()
  for (const [n, raw] of rpcDataMap) {
    let refBounds = bounds.get(raw.regionKey)
    if (!refBounds) {
      refBounds = []
      bounds.set(raw.regionKey, refBounds)
    }
    refBounds.push(raw)
    if (raw.flatbushItems.length > 0) {
      let group = refGroups.get(raw.regionKey)
      if (!group) {
        group = []
        refGroups.set(raw.regionKey, group)
      }
      group.push([n, raw])
    }
  }
  return [...refGroups].map(([key, regions]) => ({
    regions,
    toDrawnBp: drawnAxis(bounds.get(key)!),
  }))
}

// Exhaustive by construction: a cache key compared in one place and forgotten
// in another serves a stale layout with nothing to catch it.
const LAYOUT_CACHE_KEYS_RECORD: Record<keyof LayoutInputs, true> = {
  bpPerPx: true,
  showLabels: true,
  showDescriptions: true,
  displayMode: true,
  pinnedFeatureIds: true,
  labelDecimation: true,
  labelRoomFactor: true,
  geneLabelRoomFactor: true,
  geneNamesOnly: true,
  maxIsoformsPerGene: true,
  expandedGeneIds: true,
  facet: true,
  sectionHeadPx: true,
  hiddenGroupKeys: true,
  dropBelowLabelRows: true,
  bodyScale: true,
}

const LAYOUT_CACHE_KEYS = Object.keys(
  LAYOUT_CACHE_KEYS_RECORD,
) as (keyof LayoutInputs)[]

const PACK_KNOBS: Record<keyof PackKnobs, true> = {
  bodyScale: true,
  maxIsoformsPerGene: true,
  labelRoomFactor: true,
  geneLabelRoomFactor: true,
}

const PROBE_CONFIG_KEYS = LAYOUT_CACHE_KEYS.filter(
  (key): key is keyof PackKnobFreeInputs => !(key in PACK_KNOBS),
)

// Two settles of the largest solve: two tiers of label-room factors at ~11
// packs each, then ~7 body scales.
const PROBE_PACK_LIMIT = 64

export interface PackHeightCacheEntry {
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>
  inputs: PackKnobFreeInputs
  packs: Map<string, PackedBottoms>
  // Built by the first probe that misses, since every knob shares it.
  refs?: RefSections[]
}

// Keeps a probe site's prep and packs across settles of the view, since a pan
// moves only the on-screen set and neither reads it. Like `createIncrementalLayout`,
// an instance holds one config, so each probe site takes its own.
export function createPackHeightCache() {
  let entry: PackHeightCacheEntry | undefined
  return Object.assign(
    (
      rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
      inputs: PackKnobFreeInputs,
    ) => {
      const prev = entry
      if (
        prev?.rpcDataMap === rpcDataMap &&
        PROBE_CONFIG_KEYS.every(key => prev.inputs[key] === inputs[key])
      ) {
        return prev
      }
      entry = { rpcDataMap, inputs, packs: new Map() }
      return entry
    },
    {
      clear: () => {
        entry = undefined
      },
      // An entry packed from any other map can no longer be hit, since a hit
      // needs the very same map.
      prune: (live: ReadonlyMap<number, LayoutRegionData>) => {
        if (entry?.rpcDataMap !== live) {
          entry = undefined
        }
      },
    },
  )
}

export type PackHeightCache = ReturnType<typeof createPackHeightCache>

interface GroupCache {
  inputs: LayoutInputs
  members: Map<number, LayoutRegionData>
  output: Map<number, FeatureDataResult>
  collapsedIds: ReadonlySet<string>
  // Its rows were packed beside a region since evicted, so only a seed now.
  seedOnly: boolean
}

function groupUnchanged(
  prev: GroupCache,
  members: Map<number, LayoutRegionData>,
  inputs: LayoutInputs,
) {
  return (
    !prev.seedOnly &&
    LAYOUT_CACHE_KEYS.every(key => prev.inputs[key] === inputs[key]) &&
    prev.members.size === members.size &&
    [...members].every(([idx, raw]) => prev.members.get(idx) === raw)
  )
}

// A mark pinned to row 0 never competed for it, so its y=0 would rank it ahead
// of every mark that did; a one-row pack pinned them all.
function seedRowsFrom(prev: GroupCache) {
  if (displayModeMetrics(prev.inputs).singleRow) {
    return undefined
  }
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

  function computeLaidOutDataIncremental(
    rpcDataMap: ReadonlyMap<number, LayoutRegionData>,
    inputs: LayoutInputs,
  ): Map<number, FeatureDataResult> {
    // Unlike `groupRawByRef`, an empty region still needs a cache entry, or
    // its group re-packs every time it is present.
    const groups = new Map<string, Map<number, LayoutRegionData>>()
    const cacheKey = inputs.facet
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
        for (const [idx, result] of output) {
          out.set(idx, result)
        }
        nextCache.set(key, {
          inputs,
          members: new Map(members),
          output,
          collapsedIds,
          seedOnly: false,
        })
      }
    }
    cache = nextCache
    return out
  }

  return Object.assign(computeLaidOutDataIncremental, {
    clear: () => {
      cache = new Map()
    },
    // Drops what a region the store evicted left behind while keeping every
    // live region's rows as the seed for the next layout.
    prune: (live: ReadonlyMap<number, LayoutRegionData>) => {
      const kept = new Map<string, GroupCache>()
      for (const [key, group] of cache) {
        const members = new Map(
          [...group.members].filter(([idx, raw]) => live.get(idx) === raw),
        )
        kept.set(
          key,
          members.size === group.members.size
            ? group
            : {
                ...group,
                seedOnly: true,
                members,
                output: new Map(
                  [...group.output].filter(([idx]) => members.has(idx)),
                ),
              },
        )
      }
      cache = new Map([...kept].filter(([, group]) => group.members.size > 0))
    },
  })
}
