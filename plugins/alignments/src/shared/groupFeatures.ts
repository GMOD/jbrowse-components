import {
  SAM_FLAG_DUPLICATE,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { chainGroupingKey } from './chainGroupingKey.ts'
import { extractFeatureTagValue } from './extractFeatureTagValue.ts'

import type { GroupBy, GroupByType } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

export interface FeatureGroup {
  // Stable identity for the group (used for ordering + cross-fetch matching).
  // Empty string is the "untagged"/"unknown" sentinel and always sorts last.
  key: string
  // Human-readable label shown on the section divider.
  label: string
  features: Feature[]
}

function getFlags(feature: Feature) {
  return (feature.get('flags') as number | undefined) ?? 0
}

// QNAME used as the chain key. A missing name falls back to '', so any reads
// lacking a QNAME collapse into one shared chain — acceptable since QNAME is
// mandatory in SAM and linked-read data always carries it.
function getName(feature: Feature) {
  return feature.get('name') ?? ''
}

interface GroupKey {
  key: string
  label: string
}

function strandKey(feature: Feature): GroupKey {
  return getFlags(feature) & SAM_FLAG_REVERSE
    ? { key: '-', label: 'Reverse strand' }
    : { key: '+', label: 'Forward strand' }
}

// Strand of the fragment as inferred from the first-of-pair read. Read2 maps to
// the opposite of its own strand so both mates land in the same group; read1 and
// unpaired/single-end reads represent the fragment strand directly (only read2
// is inverted, so a single-end read groups by its own strand rather than being
// mis-flipped as if it were a second mate).
function firstOfPairStrandKey(feature: Feature): GroupKey {
  const flags = getFlags(feature)
  const reverse = !!(flags & SAM_FLAG_REVERSE)
  const isRead2 = !!(flags & SAM_FLAG_SECOND_IN_PAIR)
  const fwd = isRead2 ? reverse : !reverse
  return fwd
    ? { key: '+', label: 'First-of-pair forward' }
    : { key: '-', label: 'First-of-pair reverse' }
}

function tagKey(feature: Feature, tag: string): GroupKey {
  const value = extractFeatureTagValue(feature, tag)
  return value === ''
    ? { key: '', label: `${tag}: none` }
    : { key: value, label: `${tag}: ${value}` }
}

function pairOrientationKey(feature: Feature): GroupKey {
  const value = feature.get('pair_orientation') as string | undefined
  return value
    ? { key: value, label: value }
    : { key: '', label: 'No orientation' }
}

function supplementaryKey(feature: Feature): GroupKey {
  return getFlags(feature) & SAM_FLAG_SUPPLEMENTARY
    ? { key: 'supplementary', label: 'Supplementary' }
    : { key: 'primary', label: 'Primary' }
}

function duplicateKey(feature: Feature): GroupKey {
  return getFlags(feature) & SAM_FLAG_DUPLICATE
    ? { key: 'duplicate', label: 'Duplicate' }
    : { key: 'nonduplicate', label: 'Non-duplicate' }
}

// MAPQ bucketed into decades. SAM uses 255 for "unavailable", bucketed on its
// own so it never blends with a real high-confidence bin.
function mapqKey(feature: Feature): GroupKey {
  const mapq = feature.get('score') ?? 255
  if (mapq === 255) {
    return { key: '255', label: 'MAPQ unavailable' }
  }
  const bin = Math.floor(mapq / 10) * 10
  // Zero-pad to 3 digits so string sort matches numeric order across every bin
  // (0-250) and the '255' unavailable bucket lands last.
  return {
    key: String(bin).padStart(3, '0'),
    label: `MAPQ ${bin}-${bin + 9}`,
  }
}

function groupKeyFor(feature: Feature, groupBy: GroupBy): GroupKey {
  return GROUP_BY_DIMENSIONS[groupBy.type].key(feature, groupBy)
}

// Stable group-key ordering with the empty-key ("untagged"/"unknown") group
// pinned last. Plain code-point comparison (not localeCompare) keeps it
// deterministic and orders '+' before '-' for strand grouping; zero-padded
// numeric keys (mapq) already sort correctly under it. Exported so the
// main-thread cross-region merge (`orderedGroups`) applies the identical order
// — the worker's per-region sort alone doesn't fix merged order when a group is
// absent from an early region.
export function compareGroupKeys(a: string, b: string) {
  if (a === b) {
    return 0
  }
  if (a === '') {
    return 1
  }
  if (b === '') {
    return -1
  }
  return a < b ? -1 : 1
}

function orderGroups(groups: FeatureGroup[]) {
  return groups.sort((a, b) => compareGroupKeys(a.key, b.key))
}

// Append a single feature into its group, creating the group on first sight.
// Single-feature push (no array spread) keeps the per-read pileup path
// allocation-free over thousands of reads.
function appendFeature(
  groups: Map<string, FeatureGroup>,
  feature: Feature,
  { key, label }: GroupKey,
) {
  const group = groups.get(key)
  if (group) {
    group.features.push(feature)
  } else {
    groups.set(key, { key, label, features: [feature] })
  }
}

// The ungrouped result: one section keyed '' holding every feature. Both
// partitioners return this when no groupBy is set, so grouped and ungrouped
// fetches share one downstream shape.
function singleSection(features: Feature[]): FeatureGroup[] {
  return [{ key: '', label: '', features }]
}

// Partition the fetched reads into ordered groups. Without groupBy this is a
// single group with `key: ''` holding every feature, giving one uniform code
// path for grouped and ungrouped fetches.
export function partitionFeatures(
  features: Feature[],
  groupBy: GroupBy | undefined,
): FeatureGroup[] {
  if (!groupBy) {
    return singleSection(features)
  }
  const groups = new Map<string, FeatureGroup>()
  for (const feature of features) {
    appendFeature(groups, feature, groupKeyFor(feature, groupBy))
  }
  return orderGroups([...groups.values()])
}

// The chain's representative read for group-key selection: a primary
// (non-supplementary, non-secondary) read, preferring read1 so the key is
// deterministic regardless of fetch order. Falls back to the first read when a
// chain holds only supplementary/secondary records.
function chainRepresentative(chain: Feature[]): Feature {
  let primary: Feature | undefined
  for (const f of chain) {
    const flags = getFlags(f)
    if (!(flags & (SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_SECONDARY))) {
      if (!(flags & SAM_FLAG_SECOND_IN_PAIR)) {
        return f
      }
      primary ??= f
    }
  }
  return primary ?? chain[0]!
}

export interface GroupByDimension {
  type: GroupByType
  // Menu label shown in the group-by dialog.
  label: string
  // True iff every read of a chain yields the same key for this dimension, so
  // chain-aware partitioning keeps a chain whole — including across separate
  // per-region worker calls. Per-read dimensions split chains and are excluded
  // from chain (linked-reads) mode.
  chainConsistent: boolean
  // The group-key generator for this dimension. Co-located with the metadata so
  // each dimension is defined in exactly one place — `groupKeyFor` just looks it
  // up. `groupBy` is passed for tag grouping, which needs `groupBy.tag`.
  key: (feature: Feature, groupBy: GroupBy) => GroupKey
}

// The single registry of group-by dimensions. Typed as a Record keyed by
// GroupByType, so adding a member to the union is a compile error until it is
// classified here — a new dimension can't be silently half-wired (missing a
// label, a chain-mode classification, or a key generator). Insertion order is
// the menu order (Object.values preserves it).
export const GROUP_BY_DIMENSIONS: Record<GroupByType, GroupByDimension> = {
  strand: {
    type: 'strand',
    label: 'Strand',
    chainConsistent: false,
    key: strandKey,
  },
  firstOfPairStrand: {
    type: 'firstOfPairStrand',
    label: 'First-of-pair strand',
    chainConsistent: true,
    key: firstOfPairStrandKey,
  },
  tag: {
    type: 'tag',
    label: 'Tag (HP, RG, ...)',
    chainConsistent: true,
    key: (feature, groupBy) => tagKey(feature, groupBy.tag ?? ''),
  },
  pairOrientation: {
    type: 'pairOrientation',
    label: 'Pair orientation',
    chainConsistent: true,
    key: pairOrientationKey,
  },
  supplementary: {
    type: 'supplementary',
    label: 'Supplementary',
    chainConsistent: false,
    key: supplementaryKey,
  },
  duplicate: {
    type: 'duplicate',
    label: 'Duplicate',
    chainConsistent: false,
    key: duplicateKey,
  },
  mapq: {
    type: 'mapq',
    label: 'MAPQ (binned)',
    chainConsistent: false,
    key: mapqKey,
  },
}

export function isChainGroupableType(type: GroupByType | undefined) {
  return type !== undefined && GROUP_BY_DIMENSIONS[type].chainConsistent
}

// Chain-aware partition for linked-reads/chain mode: reads sharing a QNAME form
// one chain and are assigned, as a unit, to the group of the chain's
// representative read — so a chain never splits across sections (which would
// break connecting lines and desync mate rows). Same shape + ordering as
// partitionFeatures; the ungrouped fallback is one group holding every read.
export function partitionChains(
  features: Feature[],
  groupBy: GroupBy | undefined,
): FeatureGroup[] {
  if (!groupBy) {
    return singleSection(features)
  }
  const chains = new Map<string, Feature[]>()
  for (const feature of features) {
    const key = chainGroupingKey(
      getName(feature),
      feature.id(),
      getFlags(feature),
    )
    const chain = chains.get(key)
    if (chain) {
      chain.push(feature)
    } else {
      chains.set(key, [feature])
    }
  }
  const groups = new Map<string, FeatureGroup>()
  for (const chain of chains.values()) {
    const groupKey = groupKeyFor(chainRepresentative(chain), groupBy)
    for (const feature of chain) {
      appendFeature(groups, feature, groupKey)
    }
  }
  return orderGroups([...groups.values()])
}
