import { PAIR_DIRECTION_LABELS, pairDirection } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { PAIR_DIRECTION_NUM } from './buildBaseFeatureData.ts'
import { featureChainKey } from './chainGroupingKey.ts'
import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import { GROUP_BY_LABELS } from './groupByLabels.ts'
import { chainIsSplit, isSplitAlignment } from './splitAlignment.ts'
import {
  MAPQ_UNAVAILABLE,
  firstOfPairStrand,
  getFlags,
  getMappingQuality,
  getOrCreate,
  getStrand,
} from './util.ts'

import type { GroupBy, GroupByType } from './types.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

export interface FeatureGroup {
  // '' is the "untagged"/"unknown" sentinel, which `groupKeyRank` sorts
  // second-to-last, ahead of only the overflow bucket.
  key: string
  label: string
  features: Feature[]
}

interface GroupKey {
  key: string
  label: string
}

// Interned, one per section, because a grouped fetch walks every read. Spelling
// each out also makes a dimension's sections countable here, which is the "keep
// every dimension a closed set" rule of ../RenderAlignmentDataRPC/CLAUDE.md —
// `tag` and `mateAssembly` are the two that can't be listed, and MAX_GROUPS
// guards them.
const FWD_STRAND_GROUP: GroupKey = { key: '+', label: 'Forward strand' }
const REV_STRAND_GROUP: GroupKey = { key: '-', label: 'Reverse strand' }
const FWD_FIRST_OF_PAIR_GROUP: GroupKey = {
  key: '+',
  label: 'First-of-pair forward',
}
const REV_FIRST_OF_PAIR_GROUP: GroupKey = {
  key: '-',
  label: 'First-of-pair reverse',
}

// Everything but `-1` is forward, so an unstranded feature lands in an existing
// section rather than opening a third.
function strandGroup(strand: number, fwd: GroupKey, rev: GroupKey): GroupKey {
  return strand === -1 ? rev : fwd
}

// `getStrand`, never SAM_FLAG_REVERSE: a flagless synteny block reads forward
// under the flag. getStrand carries the rule.
function strandKey(feature: Feature): GroupKey {
  return strandGroup(getStrand(feature), FWD_STRAND_GROUP, REV_STRAND_GROUP)
}

// The fragment's strand, through the same `firstOfPairStrand` the color scheme
// of that name calls, so a read's section and its color can't disagree.
function firstOfPairStrandKey(feature: Feature): GroupKey {
  return strandGroup(
    firstOfPairStrand(getStrand(feature), getFlags(feature)),
    FWD_FIRST_OF_PAIR_GROUP,
    REV_FIRST_OF_PAIR_GROUP,
  )
}

function tagKey(feature: Feature, tag: string): GroupKey {
  const value = extractFeatureTagValue(feature, tag)
  return value === ''
    ? { key: '', label: `${tag}: none` }
    : { key: value, label: `${tag}: ${value}` }
}

// The IGV category (LR/RL/RR/LL) through `pairDirection`, never the raw
// `pair_orientation`: F1R2 and F2R1 are one normal LR pair differing only in
// which mate the record is, so the raw string opens up to eight sections, two of
// them "normal". Every other consumer — color scheme, tooltip, arc palette,
// concordant-pair filter — collapses them the same way.
//
// `PAIR_DIRECTION_NUM` digits as keys, so the sections stack in the order the
// legend lists its swatches; the letters' own code-point order (LL, LR, RL, RR)
// would strand the normal lane between the aberrant ones. An unrecognized
// orientation is not a category, so it files with the reads that have none.
const NO_PAIR_ORIENTATION_GROUP: GroupKey = {
  key: '',
  label: 'No orientation',
}
const PAIR_ORIENTATION_GROUPS: Record<PairDirection, GroupKey> = {
  LR: { key: `${PAIR_DIRECTION_NUM.LR}`, label: PAIR_DIRECTION_LABELS.LR },
  RL: { key: `${PAIR_DIRECTION_NUM.RL}`, label: PAIR_DIRECTION_LABELS.RL },
  RR: { key: `${PAIR_DIRECTION_NUM.RR}`, label: PAIR_DIRECTION_LABELS.RR },
  LL: { key: `${PAIR_DIRECTION_NUM.LL}`, label: PAIR_DIRECTION_LABELS.LL },
}

function pairOrientationKey(feature: Feature): GroupKey {
  const dir = pairDirection(
    feature.get('pair_orientation') as string | undefined,
  )
  return dir === undefined
    ? NO_PAIR_ORIENTATION_GROUP
    : PAIR_ORIENTATION_GROUPS[dir]
}

const SPLIT_GROUP: GroupKey = { key: 'split', label: 'Split (SA)' }
const UNSPLIT_GROUP: GroupKey = { key: 'unsplit', label: 'Not split' }

// Reads that cross a breakpoint and reads that don't — at an SV locus, the
// evidence and the background. `isSplitAlignment` carries why that is an SA
// question rather than a supplementary-flag one, and the "Show only split
// alignments" filter shares it.
function splitReadKey(feature: Feature): GroupKey {
  return isSplitAlignment(feature) ? SPLIT_GROUP : UNSPLIT_GROUP
}

// One section per mate sample of an all-vs-all synteny track. `mate.assemblyName`
// is the loaded assembly when it is listed, else the bare PanSN sample prefix
// (a sample/haplotype, not necessarily a species).
function mateAssemblyKey(feature: Feature): GroupKey {
  const mate = feature.get('mate') as { assemblyName?: string } | undefined
  const assemblyName = mate?.assemblyName
  return assemblyName
    ? { key: assemblyName, label: assemblyName }
    : { key: '', label: 'No mate assembly' }
}

// Bucketed by confidence rather than by decade: real MAPQ is bimodal, piling at
// the aligner's ceiling (60 for bwa/minimap2, 42 for bowtie2) and at 0, so
// decades spend up to 26 mostly-empty sections. These are the thresholds people
// already filter on (`samtools view -q 10` / `-q 30`), with 0 ("no unique
// placement") and SAM's 255 ("unavailable") called out. Digit keys, like
// pairOrientation's, so `compareGroupKeys` puts the confident reads at the head
// of the stack where the labels would not.
const MAPQ_HIGH_GROUP: GroupKey = {
  key: '0',
  label: 'MAPQ 30+ (high confidence)',
}
const MAPQ_MID_GROUP: GroupKey = { key: '1', label: 'MAPQ 10-29' }
const MAPQ_LOW_GROUP: GroupKey = { key: '2', label: 'MAPQ 1-9 (low)' }
const MAPQ_ZERO_GROUP: GroupKey = { key: '3', label: 'MAPQ 0 (multi-mapping)' }
const MAPQ_UNAVAILABLE_GROUP: GroupKey = { key: '4', label: 'MAPQ unavailable' }

function mapqKey(feature: Feature): GroupKey {
  const mapq = getMappingQuality(feature)
  return mapq === MAPQ_UNAVAILABLE
    ? MAPQ_UNAVAILABLE_GROUP
    : mapq >= 30
      ? MAPQ_HIGH_GROUP
      : mapq >= 10
        ? MAPQ_MID_GROUP
        : mapq >= 1
          ? MAPQ_LOW_GROUP
          : MAPQ_ZERO_GROUP
}

// Numeric tag values and the two dimensions with ordinal keys, compared by
// magnitude below so '2' precedes '10'.
const ALL_DIGITS = /^\d+$/

// Hard ceiling on the sections one fetch may produce; the rest merge into one
// pinned-last overflow section. Every group runs the whole spine, and its
// coverage pipeline allocates per-bp depth arrays sized to the region before
// uploading a per-bp GPU buffer that alone approaches the device limit at
// chromosome scale — so a UMI-style `RX`/`MI` tag would pay that region-width
// cost thousands of times over and exhaust worker memory or the GPU.
//
// A backstop: every dimension but `tag` and `mateAssembly` is a closed set of at
// most five keys, and GroupByDialog refuses `tag` up front with the distinct
// values in hand.
export const MAX_GROUPS = 40

// The overflow bucket's key. '\0' cannot collide with a real tag value / refName,
// and it is pinned dead last so the merged tail never displaces a named group.
export const OVERFLOW_GROUP_KEY = '\u0000overflow'

// Named groups, then the "untagged"/"unknown" sentinel, then the overflow bucket:
// both catch-alls sort after every real value whatever its key.
function groupKeyRank(key: string) {
  return key === '' ? 1 : key === OVERFLOW_GROUP_KEY ? 2 : 0
}

// Two all-digit keys compare by magnitude, so numeric tag values order 1,2,10 —
// `tag` emits raw values and can't pad an arbitrary tag to fix this. Everything
// else is code-point (not localeCompare), which stays deterministic and puts '+'
// before '-'. Exported because the main-thread cross-region merge
// (`orderedGroups`) has to apply the identical order: the worker's per-region
// sort alone can't fix a group absent from an early region.
export function compareGroupKeys(a: string, b: string) {
  const rankDiff = groupKeyRank(a) - groupKeyRank(b)
  if (rankDiff !== 0) {
    return rankDiff
  }
  if (ALL_DIGITS.test(a) && ALL_DIGITS.test(b)) {
    const na = Number(a)
    const nb = Number(b)
    if (na !== nb) {
      return na < nb ? -1 : 1
    }
  }
  return a === b ? 0 : a < b ? -1 : 1
}

// Merge the tail past MAX_GROUPS into one overflow section rather than dropping
// its reads. Runs on the already-ordered list, so which groups survive follows
// from the key set alone and not from per-region read counts. The cap is still
// region-local, so a cross-region union can exceed MAX_GROUPS when regions expose
// wildly different value sets; it bounds the per-group region-width cost, which
// is what actually blows up.
//
// The untagged group is held out and re-pinned ahead of the overflow bucket:
// reads *lacking* the grouping tag are a distinct answer users look for, and it
// sorts into the very tail this merges.
function capGroups(groups: FeatureGroup[]) {
  const untagged = groups.at(-1)?.key === '' ? groups.pop() : undefined
  const overflow = groups.splice(MAX_GROUPS - (untagged ? 2 : 1))
  const merged = {
    key: OVERFLOW_GROUP_KEY,
    label: `${overflow.length} more values`,
    features: overflow.flatMap(g => g.features),
  }
  return untagged ? [...groups, untagged, merged] : [...groups, merged]
}

function orderGroups(groups: FeatureGroup[]) {
  const ordered = groups.sort((a, b) => compareGroupKeys(a.key, b.key))
  // > (not >=) so the cap only ever fires when it genuinely merges 2+ groups.
  return ordered.length > MAX_GROUPS ? capGroups(ordered) : ordered
}

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

// The ungrouped result, returned by both partitioners so grouped and ungrouped
// fetches share one downstream shape.
function singleSection(features: Feature[]): FeatureGroup[] {
  return [{ key: '', label: '', features }]
}

// Partition the fetched reads into ordered groups, one group key per read.
export function partitionFeatures(
  features: Feature[],
  groupBy: GroupBy | undefined,
): FeatureGroup[] {
  if (!groupBy) {
    return singleSection(features)
  }
  const { key } = GROUP_BY_DIMENSIONS[groupBy.type]
  const groups = new Map<string, FeatureGroup>()
  for (const feature of features) {
    appendFeature(groups, feature, key(feature, groupBy))
  }
  return orderGroups([...groups.values()])
}

// The read a chain's group key comes from: a primary, preferring read1 so the
// key doesn't depend on fetch order. A chain holding only supplementary/secondary
// records has no fragment-level answer, so it falls back to its first read.
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
  // Whether the dimension describes the FRAGMENT rather than the record, so
  // `partitionChains` can key a whole chain off its representative read.
  //
  // NOT "every read of the chain yields this key", which two of the dimensions
  // marked true fail: a supplementary segment carries its own strand and its own
  // @gmod/bam-derived `pair_orientation`, so an inverted split makes
  // `firstOfPairStrand` and `pairOrientation` disagree with their primary. The
  // primary read1 holds the fragment's answer either way — the same read
  // buildChainMetadata takes pair orientation off. `mapq` and `strand` are false
  // because a chain has no single answer: its two mates genuinely point opposite
  // ways and map with their own confidence.
  //
  // Whether chain mode HONORS the dimension is `isChainGroupableType`.
  fragmentLevel: boolean
  // Not meaningful for ordinary alignment reads, so it is kept out of the general
  // "Group by..." radios and surfaced by the display that supports it —
  // LGVSyntenyDisplay's menus.ts owns mateAssembly.
  hidden?: boolean
  // `groupBy` is passed for tag grouping, which needs `groupBy.tag`.
  key: (feature: Feature, groupBy: GroupBy) => GroupKey
  // Key for a whole chain, for a dimension the representative read cannot answer
  // for — it answers "is the primary read1 like this", not "is any read of this
  // fragment". Supplying one is also what makes a per-read dimension groupable in
  // chain mode (`isChainGroupableType`).
  chainKey?: (chain: Feature[], groupBy: GroupBy) => GroupKey
}

// The one registry of group-by dimensions. Keyed by GroupByType, so a new member
// of the union is a compile error until it is classified here; each entry's
// `type` is pinned to its own key, because `offeredGroupByTypes` maps to that
// field and a plain Record would accept one naming a sibling. Insertion order is
// the menu order. Labels live in the React-free groupByLabels.ts (see its
// header), joined to this registry by `pickGroupByOptions` alone.
export const GROUP_BY_DIMENSIONS: {
  [K in GroupByType]: GroupByDimension & { type: K }
} = {
  strand: {
    type: 'strand',
    fragmentLevel: false,
    key: strandKey,
  },
  firstOfPairStrand: {
    type: 'firstOfPairStrand',
    fragmentLevel: true,
    key: firstOfPairStrandKey,
  },
  tag: {
    type: 'tag',
    fragmentLevel: true,
    key: (feature, groupBy) => tagKey(feature, groupBy.tag ?? ''),
  },
  pairOrientation: {
    type: 'pairOrientation',
    fragmentLevel: true,
    key: pairOrientationKey,
  },
  // Chain mode is where this one earns its keep — long-read SV viewing is linked
  // reads plus split-read evidence — so it states the chain's key rather than
  // being dropped there. One mate can be split where the other is not, and the
  // fragment has split evidence if either does, which no single read answers.
  splitRead: {
    type: 'splitRead',
    fragmentLevel: false,
    key: splitReadKey,
    chainKey: chain => (chainIsSplit(chain) ? SPLIT_GROUP : UNSPLIT_GROUP),
  },
  mapq: {
    type: 'mapq',
    fragmentLevel: false,
    key: mapqKey,
  },
  mateAssembly: {
    type: 'mateAssembly',
    fragmentLevel: true,
    hidden: true,
    key: mateAssemblyKey,
  },
}

// Whether chain mode can honor a dimension: the chain has to resolve to one key,
// which holds when the representative read answers for the fragment or when the
// dimension states the chain's key itself. Derived rather than asserted as a
// third field, so a `chainKey` written without a matching flag can't sit there
// unreachable while the dimension degrades to ungrouped.
export function isChainGroupableType(type: GroupByType | undefined) {
  if (type === undefined) {
    return false
  }
  const { fragmentLevel, chainKey } = GROUP_BY_DIMENSIONS[type]
  return fragmentLevel || chainKey !== undefined
}

// The grouping a fetch can actually honor. A per-read dimension in chain mode (an
// old session with strand + chain, say) degrades to ungrouped rather than
// splitting chains across sections and breaking their connecting lines.
// See ../RenderAlignmentDataRPC/CLAUDE.md.
export function groupByForMode(
  groupBy: GroupBy | undefined,
  isChainMode: boolean,
) {
  return isChainMode && !isChainGroupableType(groupBy?.type)
    ? undefined
    : groupBy
}

// Dimensions as menu radio options, in the given order: the one join between the
// registry above and the label table, so no call site re-spells a label. The
// alignments menu takes every non-hidden dimension, LGVSyntenyDisplay a curated
// three. Mirrors pickColorOptions.
export function pickGroupByOptions(...types: GroupByType[]) {
  return types.map(type => ({ type, label: GROUP_BY_LABELS[type] }))
}

// Partition for chain (linked-reads) mode: reads sharing a QNAME form one chain
// and land in one group as a unit, so a chain never splits across sections —
// which would break its connecting lines and desync its mate rows.
export function partitionChains(
  features: Feature[],
  groupBy: GroupBy | undefined,
): FeatureGroup[] {
  if (!groupBy) {
    return singleSection(features)
  }
  const chains = new Map<string, Feature[]>()
  for (const feature of features) {
    getOrCreate(chains, featureChainKey(feature), () => []).push(feature)
  }
  const { key, chainKey } = GROUP_BY_DIMENSIONS[groupBy.type]
  const groups = new Map<string, FeatureGroup>()
  for (const chain of chains.values()) {
    const groupKey = chainKey
      ? chainKey(chain, groupBy)
      : key(chainRepresentative(chain), groupBy)
    for (const feature of chain) {
      appendFeature(groups, feature, groupKey)
    }
  }
  return orderGroups([...groups.values()])
}

// Resolve a persisted `groupBy` into one the partitioners can run, or `undefined`
// when they can't. The slot is `frozen` — unvalidated JSON from a hand-written
// config or an older session — and an unrecognized `type` indexes the registry to
// `undefined` and throws inside the worker, failing the whole track, while `tag`
// with no tag name collapses every read into one `"<tag>: none"` section. The
// display's `groupBy` getter runs this, so the menu, the layout and `rpcProps`
// all see only values the registry can key.
export function normalizeGroupBy(groupBy: unknown): GroupBy | undefined {
  const obj =
    typeof groupBy === 'object' && groupBy !== null ? groupBy : undefined
  const type = readStringField(obj, 'type')
  const tag = readStringField(obj, 'tag')
  return type !== undefined && isGroupByType(type) && (type !== 'tag' || !!tag)
    ? { type, tag }
    : undefined
}

function readStringField(obj: object | undefined, field: string) {
  const value = obj === undefined ? undefined : Reflect.get(obj, field)
  return typeof value === 'string' ? value : undefined
}

function isGroupByType(type: string): type is GroupByType {
  return Object.hasOwn(GROUP_BY_DIMENSIONS, type)
}
