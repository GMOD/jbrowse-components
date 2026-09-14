import { compareGroupKeys } from '@jbrowse/display-kit/groupKeys'

import { isPlacedRow } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { GroupId } from '@jbrowse/display-kit/groupKeys'

export type FeatureGroupByType = 'strand'

export interface FeatureGroupBy {
  type: FeatureGroupByType
}

interface FeatureGroupByDimension<K extends FeatureGroupByType> {
  type: K
  label: string
  // Read off the hit item rather than the feature: the worker already stamps
  // what a section needs, so a partition costs no refetch.
  key: (item: FlatbushItem) => GroupId
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
  },
}

export const FEATURE_GROUP_BY_OPTIONS = Object.values(
  FEATURE_GROUP_BY_DIMENSIONS,
).map(({ type, label }) => ({ type, label }))

export function featureGroupId(
  item: FlatbushItem,
  groupBy: FeatureGroupBy,
): GroupId {
  return FEATURE_GROUP_BY_DIMENSIONS[groupBy.type].key(item)
}

// The slot is `frozen`, so an unrecognized type from a hand-written config
// lands here rather than indexing the registry to `undefined` in the packer.
export function normalizeFeatureGroupBy(
  value: unknown,
): FeatureGroupBy | undefined {
  const type =
    typeof value === 'object' && value !== null
      ? Reflect.get(value, 'type')
      : undefined
  return typeof type === 'string' &&
    Object.hasOwn(FEATURE_GROUP_BY_DIMENSIONS, type)
    ? { type: type as FeatureGroupByType }
    : undefined
}

export interface FeatureGroupSection extends GroupId {
  top: number
  height: number
}

// Derived from the laid-out items rather than carried beside them: every y in
// the layout already holds the section offset the packer stacked it at, fit
// scale included, so the chip row reads the same rows the glyphs paint.
// `chipPx` is the reservation above each section's first row, at the scale
// the layout was drawn at.
export function featureGroupSections(
  map: ReadonlyMap<number, FeatureDataResult>,
  groupBy: FeatureGroupBy,
  chipPx: number,
): FeatureGroupSection[] {
  const bounds = new Map<
    string,
    { label: string; top: number; bottom: number }
  >()
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (!isPlacedRow(item.topPx)) {
        continue
      }
      const { key, label } = featureGroupId(item, groupBy)
      const b = bounds.get(key)
      if (b) {
        b.top = Math.min(b.top, item.topPx)
        b.bottom = Math.max(b.bottom, item.bottomPx)
      } else {
        bounds.set(key, { label, top: item.topPx, bottom: item.bottomPx })
      }
    }
  }
  const ordered = [...bounds].sort(([a], [b]) => compareGroupKeys(a, b))
  return ordered.map(([key, b], i) => {
    const top = b.top - chipPx
    const next = ordered[i + 1]?.[1]
    const bottom = next ? next.top - chipPx : b.bottom
    return { key, label: b.label, top, height: bottom - top }
  })
}
