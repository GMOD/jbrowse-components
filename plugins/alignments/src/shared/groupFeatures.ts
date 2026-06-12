import {
  SAM_FLAG_DUPLICATE,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import { extractFeatureTagValue } from './extractFeatureTagValue.ts'

import type { GroupBy } from './types.ts'
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
  switch (groupBy.type) {
    case 'strand':
      return strandKey(feature)
    case 'firstOfPairStrand':
      return firstOfPairStrandKey(feature)
    case 'tag':
      return tagKey(feature, groupBy.tag ?? '')
    case 'pairOrientation':
      return pairOrientationKey(feature)
    case 'supplementary':
      return supplementaryKey(feature)
    case 'duplicate':
      return duplicateKey(feature)
    case 'mapq':
      return mapqKey(feature)
  }
}

// Stable key sort with the empty-key ("untagged"/"unknown") group pinned last.
// Plain code-point comparison (not localeCompare) keeps it deterministic and
// orders '+' before '-' for strand grouping; zero-padded numeric keys (mapq)
// already sort correctly under it.
function orderGroups(groups: FeatureGroup[]) {
  return groups.sort((a, b) => {
    if (a.key === b.key) {
      return 0
    }
    if (a.key === '') {
      return 1
    }
    if (b.key === '') {
      return -1
    }
    return a.key < b.key ? -1 : 1
  })
}

// Partition the fetched reads into ordered groups. Without groupBy this is a
// single group with `key: ''` holding every feature, giving one uniform code
// path for grouped and ungrouped fetches.
export function partitionFeatures(
  features: Feature[],
  groupBy: GroupBy | undefined,
): FeatureGroup[] {
  if (!groupBy) {
    return [{ key: '', label: '', features }]
  }
  const groups = new Map<string, FeatureGroup>()
  for (const feature of features) {
    const { key, label } = groupKeyFor(feature, groupBy)
    const group = groups.get(key)
    if (group) {
      group.features.push(feature)
    } else {
      groups.set(key, { key, label, features: [feature] })
    }
  }
  return orderGroups([...groups.values()])
}
