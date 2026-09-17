import {
  OVERFLOW_GROUP_KEY,
  capGroupKeys,
  groupKeyComparator,
  overflowLabel,
} from '@jbrowse/core/util/groupKeys'
import { STRAND_FIELD } from '@jbrowse/core/util/strandScale'

import { isPlacedRow } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

export type FeatureGroupByType = 'strand' | 'attribute'

// `attribute` is the one dimension that takes a parameter, so it is the one
// with a dialog behind it and the one the worker stamps a key for. `domain`
// is the section order, the keys it lists first; the rest follow sorted.
export type FeatureGroupBy =
  | { type: 'strand'; attribute?: undefined; domain?: string[] }
  | { type: 'attribute'; attribute: string; domain?: string[] }

type FeatureGroupByOf<K extends FeatureGroupByType> = Extract<
  FeatureGroupBy,
  { type: K }
>

interface FeatureGroupByDimension<K extends FeatureGroupByType> {
  type: K
  label: string
  // Read off the hit item rather than the feature: the worker already stamps
  // what a section needs, so a partition costs no refetch beyond the stamp.
  key: (item: SectionStamp, groupBy: FeatureGroupByOf<K>) => GroupId
  // The `colorField` that paints each section in its own color.
  colorField: (groupBy: FeatureGroupByOf<K>) => string
}

const FORWARD_GROUP: GroupId = { key: '+', label: 'Forward strand' }
const REVERSE_GROUP: GroupId = { key: '-', label: 'Reverse strand' }
const UNSTRANDED_GROUP: GroupId = { key: '', label: 'No strand' }

// Keyed by type, so a new member of the union is a compile error until it is
// classified here. The multi-row display's `partitionField` is the same
// partition with one fixed row per value; a section here packs its own rows.
export const FEATURE_GROUP_BY_DIMENSIONS: {
  [K in FeatureGroupByType]: FeatureGroupByDimension<K>
} = {
  strand: {
    type: 'strand',
    label: 'Strand',
    key: item =>
      item.strand === 1
        ? FORWARD_GROUP
        : item.strand === -1
          ? REVERSE_GROUP
          : UNSTRANDED_GROUP,
    colorField: () => STRAND_FIELD,
  },
  attribute: {
    type: 'attribute',
    label: 'Attribute',
    key: (item, { attribute }) =>
      item.groupKey
        ? { key: item.groupKey, label: `${attribute}: ${item.groupKey}` }
        : { key: '', label: `${attribute}: none` },
    colorField: ({ attribute }) => attribute,
  },
}

export function groupColorField(groupBy: FeatureGroupBy | undefined) {
  return groupBy === undefined
    ? undefined
    : groupBy.type === 'attribute'
      ? FEATURE_GROUP_BY_DIMENSIONS.attribute.colorField(groupBy)
      : FEATURE_GROUP_BY_DIMENSIONS.strand.colorField(groupBy)
}

export function isGroupColor(
  colorField: string,
  groupBy: FeatureGroupBy | undefined,
) {
  return colorField !== '' && colorField === groupColorField(groupBy)
}

export function featureGroupId(
  item: SectionStamp,
  groupBy: FeatureGroupBy,
): GroupId {
  return groupBy.type === 'attribute'
    ? FEATURE_GROUP_BY_DIMENSIONS.attribute.key(item, groupBy)
    : FEATURE_GROUP_BY_DIMENSIONS.strand.key(item, groupBy)
}

// The slot is `frozen`, so an unrecognized type from a hand-written config
// lands here rather than indexing the registry to `undefined` in the packer,
// and an attribute grouping with no attribute name reads as ungrouped.
export function normalizeFeatureGroupBy(
  value: unknown,
): FeatureGroupBy | undefined {
  const obj = typeof value === 'object' && value !== null ? value : undefined
  const type = obj === undefined ? undefined : Reflect.get(obj, 'type')
  const rawDomain = obj === undefined ? undefined : Reflect.get(obj, 'domain')
  const domain =
    Array.isArray(rawDomain) && rawDomain.length > 0
      ? { domain: rawDomain.map(String) }
      : {}
  if (type === 'strand') {
    return { type, ...domain }
  }
  if (type === 'attribute') {
    const attribute = Reflect.get(obj!, 'attribute')
    return typeof attribute === 'string' && attribute.trim()
      ? { type, attribute: attribute.trim(), ...domain }
      : undefined
  }
  return undefined
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
  groupBy: FeatureGroupBy,
) {
  const ids = new Map<string, GroupId>()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      const id = featureGroupId(item, groupBy)
      if (!ids.has(id.key)) {
        ids.set(id.key, id)
      }
    }
  }
  const { sectionOf, mergedCount } = capGroupKeys(ids.keys(), groupBy.domain)
  const merged: GroupId = {
    key: OVERFLOW_GROUP_KEY,
    label: overflowLabel(mergedCount),
  }
  return (item: SectionStamp): GroupId => {
    const id = featureGroupId(item, groupBy)
    return sectionOf(id.key) === id.key ? id : merged
  }
}

// Derived from the laid-out items rather than carried beside them: every y in
// the layout already holds the section offset the packer stacked it at, so
// the chip row reads the same rows the glyphs paint. `chipPx` is the
// reservation above each section's first row.
export function featureGroupSections(
  map: ReadonlyMap<number, FeatureDataResult>,
  groupBy: FeatureGroupBy,
  chipPx: number,
): FeatureGroupSection[] {
  const sectionOf = sectionIdsOf(map, groupBy)
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
  const compare = groupKeyComparator(groupBy.domain)
  const ordered = [...bounds].sort(([a], [b]) => compare(a, b))
  return ordered.map(([key, b], i) => {
    const top = b.top - chipPx
    const next = ordered[i + 1]?.[1]
    const bottom = next ? next.top - chipPx : b.bottom
    return { key, label: b.label, top, height: bottom - top }
  })
}
