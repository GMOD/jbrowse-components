import {
  OVERFLOW_GROUP_KEY,
  capGroupKeys,
  facetSectionLabel,
  groupKeyComparator,
  overflowLabel,
} from '@jbrowse/core/util/groupKeys'
import { STRAND_DOMAIN, STRAND_FIELD } from '@jbrowse/core/util/strandScale'

import { isPlacedRow } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

/**
 * The `facetField` and `facetDomain` slots as written. The multi-row display's
 * `partitionField` is the same partition with one fixed row per value; a
 * section here packs its own rows.
 */
export interface FeatureFacet {
  field: string
  domain: readonly string[]
}

/**
 * The order sections stack in: the domain, or forward, reverse and unstranded
 * for a strand facet that names none.
 */
export function facetOrder({ field, domain }: FeatureFacet) {
  return domain.length === 0 && field === STRAND_FIELD ? STRAND_DOMAIN : domain
}

// Read off the hit item rather than the feature: the worker stamps what a
// section needs, and strand is already on every item, so a strand facet
// never refetches.
export function featureGroupId(
  item: SectionStamp,
  { field }: FeatureFacet,
): GroupId {
  const key =
    field === STRAND_FIELD ? String(item.strand ?? 0) : (item.groupKey ?? '')
  return { key, label: facetSectionLabel(field, key) }
}

export interface FeatureGroupSection extends GroupId {
  top: number
  height: number
}

// Every item's section, capped the same way the layout capped them: the key
// set is read off ALL items, placed or not, so a hidden section still counts
// toward the cap it counted toward in the pack.
export function sectionIdsOf(
  map: ReadonlyMap<number, FeatureDataResult>,
  facet: FeatureFacet,
) {
  const ids = new Map<string, GroupId>()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      const id = featureGroupId(item, facet)
      if (!ids.has(id.key)) {
        ids.set(id.key, id)
      }
    }
  }
  const { sectionOf, mergedCount } = capGroupKeys(ids.keys(), facetOrder(facet))
  const merged: GroupId = {
    key: OVERFLOW_GROUP_KEY,
    label: overflowLabel(mergedCount),
  }
  return (item: SectionStamp): GroupId => {
    const id = featureGroupId(item, facet)
    return sectionOf(id.key) === id.key ? id : merged
  }
}

// Derived from the laid-out items rather than carried beside them: every y in
// the layout already holds the section offset the packer stacked it at, so
// the chip row reads the same rows the glyphs paint. `chipPx` is the
// reservation above each section's first row.
export function featureGroupSections(
  map: ReadonlyMap<number, FeatureDataResult>,
  facet: FeatureFacet,
  chipPx: number,
): FeatureGroupSection[] {
  const sectionOf = sectionIdsOf(map, facet)
  const bounds = new Map<
    string,
    { label: string; top: number; bottom: number }
  >()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (!isPlacedRow(item.topPx)) {
        continue
      }
      const { key, label } = sectionOf(item)
      const b = bounds.get(key)
      if (b) {
        b.top = Math.min(b.top, item.topPx)
        b.bottom = Math.max(b.bottom, item.bottomPx)
      } else {
        bounds.set(key, { label, top: item.topPx, bottom: item.bottomPx })
      }
    }
  }
  const compare = groupKeyComparator(facetOrder(facet))
  const ordered = [...bounds].sort(([a], [b]) => compare(a, b))
  return ordered.map(([key, b], i) => {
    const top = b.top - chipPx
    const next = ordered[i + 1]?.[1]
    const bottom = next ? next.top - chipPx : b.bottom
    return { key, label: b.label, top, height: bottom - top }
  })
}
