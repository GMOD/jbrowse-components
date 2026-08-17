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
  // Stable identity for the group (used for ordering + cross-fetch matching).
  // Empty string is the "untagged"/"unknown" sentinel and sorts second-to-last,
  // ahead of only the overflow bucket.
  key: string
  // Human-readable label shown on the section divider.
  label: string
  features: Feature[]
}

interface GroupKey {
  key: string
  label: string
}

// Every closed-set dimension returns one of these interned GroupKeys rather than
// building one per read, the way SPLIT_GROUP below always has. Two things follow
// from that, and both are why they are spelled out one by one: a grouped fetch
// walks every read, so the per-read allocation is the only one this pass makes;
// and a dimension's sections are countable HERE, which is the "keep every
// dimension a closed set" rule ../RenderAlignmentDataRPC/CLAUDE.md states — the
// only two that can't be listed like this, `tag` and `mateAssembly`, are exactly
// the two whose cardinality the data decides and that MAX_GROUPS guards.
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

// The two buckets every strand-flavoured dimension splits into. `-1` is reverse
// and everything else (including the unstranded 0) is forward, so a feature with
// no strand lands in an existing section rather than opening a third.
function strandGroup(strand: number, fwd: GroupKey, rev: GroupKey): GroupKey {
  return strand === -1 ? rev : fwd
}

// Keyed off `strand`, not SAM_FLAG_REVERSE — see getStrand. BAM/CRAM features
// derive `strand` from that very flag, so reads group identically, while synteny
// (PAF) features carry a real `strand` and no flags at all; reading the flag
// collapsed every synteny block into one "Forward strand" section.
function strandKey(feature: Feature): GroupKey {
  return strandGroup(getStrand(feature), FWD_STRAND_GROUP, REV_STRAND_GROUP)
}

// Strand of the fragment as inferred from the first-of-pair read, via the shared
// `firstOfPairStrand` rule — the same call the `firstOfPairStrand` COLOR scheme
// makes, so the section a read groups into and the color it paints can't
// disagree. They did: this read SAM_FLAG_REVERSE while the color read `strand`,
// which agree on a BAM and not on a flagless synteny block.
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

// Keyed by the shared IGV category (LR/RL/RR/LL), never by the raw
// `pair_orientation` string. F1R2 and F2R1 are the same normal LR pair — they
// differ only in which mate the record is — so the raw string opened a section
// per permutation, up to eight of them, two of which were "normal". Every other
// consumer collapses them through `pairDirection` (the color scheme, the read
// tooltip, the arc palette, the concordant-pair filter), so those two sections
// carried cryptic labels the rest of the app never shows and were painted the
// identical LR grey.
//
// Digit keys, not the letters, purely for ordering — the same move mapqKey makes.
// Reusing `PAIR_DIRECTION_NUM` stacks the sections in the order the legend
// already lists its swatches, where the letters' own code-point order (LL, LR,
// RL, RR) would strand the normal lane between the aberrant ones. An orientation
// string the classifier doesn't recognize is not a category, so it files with the
// reads that have no orientation at all rather than opening a section named after
// a value nothing else in the app will name.
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

function hasSplitAlignment(feature: Feature) {
  return extractFeatureTagValue(feature, 'SA') !== ''
}

// Whether the read is part of a split alignment, which is what SA records: the
// aligner writes it on every segment of the split, the primary included. So the
// two sections are "reads that cross a breakpoint" and "reads that don't", which
// at an SV locus is the evidence and the background.
//
// This replaced a grouping on the SUPPLEMENTARY flag, which looks similar and
// isn't: the flag marks the pieces after the first, so a split read's own first
// piece filed with the reads that never split at all, and the sections cut
// through the evidence instead of around it.
function splitReadKey(feature: Feature): GroupKey {
  return hasSplitAlignment(feature) ? SPLIT_GROUP : UNSPLIT_GROUP
}

// Synteny features (PAF/all-vs-all) carry a `mate` referencing the other side's
// assembly. Its `assemblyName` is the loaded assembly if listed, else the bare
// PanSN sample prefix (sample/haplotype, not necessarily a species). Grouping by
// it puts each mate sample in its own section — the point of an all-vs-all track
// in a plain LGV, where one assembly draws against every other sample. A missing
// mate assembly collapses into the "" group.
function mateAssemblyKey(feature: Feature): GroupKey {
  const mate = feature.get('mate') as { assemblyName?: string } | undefined
  const assemblyName = mate?.assemblyName
  return assemblyName
    ? { key: assemblyName, label: assemblyName }
    : { key: '', label: 'No mate assembly' }
}

// MAPQ bucketed by confidence, not by arithmetic decade: real MAPQ is bimodal —
// a pile at the aligner's ceiling (60 for bwa/minimap2, 42 for bowtie2) and
// another at 0 — so decades spent up to 26 mostly-empty sections. These are the
// thresholds people already filter on (`samtools view -q 10` / `-q 30`), with 0
// ("no unique placement") and SAM's 255 ("unavailable") called out on their own.
// Digit keys, not the words, purely for ordering: keys sort by `compareGroupKeys`,
// so ordinals put the confident reads at the head of the stack where the labels
// would not. Five buckets by construction, so this dimension can't approach
// MAX_GROUPS.
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

// All-digit key: numeric tag values (a numeric RG, a count-based tag) and mapq's
// confidence bins. Compared by magnitude below so '2' precedes '10' instead of
// code-point '10' < '2'.
const ALL_DIGITS = /^\d+$/

// Hard ceiling on the sections one fetch may produce. Every group runs the whole
// spine, and its coverage pipeline allocates per-bp depth arrays sized to the
// region (then uploads a per-bp GPU coverage buffer, which alone approaches the
// device limit at chromosome scale). So an accidentally high-cardinality grouping
// — a UMI-style `RX`/`MI` tag, a per-read `NM` — would pay that region-width cost
// thousands of times over and exhaust worker memory or the GPU. Groups past the
// cap merge into one pinned-last overflow section instead.
//
// The backstop, not the first line of defence: every dimension except `tag` and
// `mateAssembly` is a closed set of at most five keys, and `tag` is refused up
// front by GroupByDialog, which has the distinct values in hand.
export const MAX_GROUPS = 40

// The overflow bucket's key. '\0' cannot collide with a real tag value / refName,
// and it is pinned dead last so the merged tail never displaces a named group.
export const OVERFLOW_GROUP_KEY = '\u0000overflow'

// Named groups first, then the "untagged"/"unknown" sentinel, then the overflow
// bucket. Both catch-all methods sort after every real value regardless of its key.
function groupKeyRank(key: string) {
  return key === '' ? 1 : key === OVERFLOW_GROUP_KEY ? 2 : 0
}

// Stable group-key ordering. Two all-digit keys compare by numeric magnitude so
// numeric tag values order 1,2,10 not 1,10,2 (code-point) — the `tag` dimension
// emits raw values, so it can't pad an arbitrary tag to fix this. Every other
// pair falls back to plain code-point comparison (not localeCompare), which stays
// deterministic and orders '+' before '-' for strand grouping. Exported so the
// main-thread cross-region merge (`orderedGroups`) applies the identical order —
// the worker's per-region sort alone doesn't fix merged order when a group is
// absent from an early region.
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

// Merge everything past MAX_GROUPS into one overflow section rather than dropping
// its reads. Runs on the already-ordered list, so which groups survive is a
// deterministic function of the key set (not of per-region read counts, which
// would keep different groups in different regions). A region-local cap can still
// leave the main thread's cross-region union above MAX_GROUPS when regions expose
// wildly different value sets, but it bounds the per-group region-width cost that
// actually blows up.
//
// The "untagged"/"unknown" group is held out of the merge and re-pinned ahead of
// the overflow bucket. `groupKeyRank` sorts it second-to-last precisely so it
// stays a named section — reads *lacking* the grouping tag are a distinct answer
// users look for, not one arbitrary value among the merged tail — and since it
// sorts into that tail, a plain splice would bury it under "N more values".
function capGroups(groups: FeatureGroup[]) {
  const untagged = groups.at(-1)?.key === '' ? groups.pop() : undefined
  const kept = untagged ? MAX_GROUPS - 2 : MAX_GROUPS - 1
  const overflow = groups.splice(kept)
  groups.push({
    key: OVERFLOW_GROUP_KEY,
    label: `${overflow.length} more values`,
    features: overflow.flatMap(g => g.features),
  })
  if (untagged) {
    // Before the overflow group that was just pushed, so it stays last.
    // Spelled `length - 1` rather than `-1`: `unicorn/no-confusing-array-splice`
    // is right that `splice(-1, 0, x)` reads like "remove the last one".
    // eslint-disable-next-line unicorn/prefer-negative-index -- the two rules disagree; clarity wins
    groups.splice(groups.length - 1, 0, untagged)
  }
  return groups
}

function orderGroups(groups: FeatureGroup[]) {
  const ordered = groups.sort((a, b) => compareGroupKeys(a.key, b.key))
  // > (not >=) so the cap only ever fires when it genuinely merges 2+ groups.
  return ordered.length > MAX_GROUPS ? capGroups(ordered) : ordered
}

// Append a single feature into its group, creating the group (seeded with the
// feature) on first sight — one push per read, and no per-read array or group
// object beyond the first sighting of a key.
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
  const { key } = GROUP_BY_DIMENSIONS[groupBy.type]
  const groups = new Map<string, FeatureGroup>()
  for (const feature of features) {
    appendFeature(groups, feature, key(feature, groupBy))
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
  // True iff chain mode can honor this dimension, which means one chain resolves
  // to one key — either because every read of the chain yields the same one, or
  // because the dimension supplies `chainKey` below. Dimensions that would split
  // a chain across sections (breaking its connecting lines) are false, and are
  // both dropped from the menu and degraded to ungrouped by the worker.
  chainConsistent: boolean
  // True for dimensions that don't apply to ordinary alignment reads and so are
  // not offered in the general "Group by..." radios; a display that supports them
  // surfaces them itself — mateAssembly is offered by LGVSyntenyDisplay's own
  // "Group by..." radios (see its menus.ts).
  hidden?: boolean
  // The group-key generator for this dimension. Co-located with the metadata so
  // each dimension is defined in exactly one place — `groupKeyFor` just looks it
  // up. `groupBy` is passed for tag grouping, which needs `groupBy.tag`.
  key: (feature: Feature, groupBy: GroupBy) => GroupKey
  // Key for a whole chain, for a dimension whose per-read key is a property of
  // the chain rather than of the read. Without it `partitionChains` keys off the
  // chain's representative read, which answers "is the primary read1 like this",
  // not "is any read of this fragment".
  chainKey?: (chain: Feature[], groupBy: GroupBy) => GroupKey
}

// The single registry of group-by dimensions. Typed as a Record keyed by
// GroupByType, so adding a member to the union is a compile error until it is
// classified here — a new dimension can't be silently half-wired (missing a
// chain-mode classification or a key generator). Insertion order is the menu
// order (Object.values preserves it). Labels live in the React-free
// groupByLabels.ts, keyed by the same union, so the website's figure recipes can
// name a menu path without importing this module (see its header) —
// `pickGroupByOptions` is the one place that joins the two.
export const GROUP_BY_DIMENSIONS: Record<GroupByType, GroupByDimension> = {
  strand: {
    type: 'strand',
    chainConsistent: false,
    key: strandKey,
  },
  firstOfPairStrand: {
    type: 'firstOfPairStrand',
    chainConsistent: true,
    key: firstOfPairStrandKey,
  },
  tag: {
    type: 'tag',
    chainConsistent: true,
    key: (feature, groupBy) => tagKey(feature, groupBy.tag ?? ''),
  },
  pairOrientation: {
    type: 'pairOrientation',
    chainConsistent: true,
    key: pairOrientationKey,
  },
  // Chain mode is where this dimension earns its keep — long-read SV viewing is
  // linked reads plus split-read evidence — so it defines the chain's key rather
  // than being dropped there. A chain is keyed by read name and so holds both
  // mates, and one mate can be split where the other is not; the fragment has
  // split evidence if either does, which the representative read cannot answer.
  splitRead: {
    type: 'splitRead',
    chainConsistent: true,
    key: splitReadKey,
    chainKey: chain =>
      chain.some(hasSplitAlignment) ? SPLIT_GROUP : UNSPLIT_GROUP,
  },
  mapq: {
    type: 'mapq',
    chainConsistent: false,
    key: mapqKey,
  },
  mateAssembly: {
    type: 'mateAssembly',
    chainConsistent: true,
    hidden: true,
    key: mateAssemblyKey,
  },
}

export function isChainGroupableType(type: GroupByType | undefined) {
  return type !== undefined && GROUP_BY_DIMENSIONS[type].chainConsistent
}

// The grouping a fetch can actually honor. Chain mode allows only chain-consistent
// dimensions, where every read of a chain yields one key so `partitionChains` keeps
// the chain whole; a per-read dimension (an old session with strand + chain, say)
// degrades to ungrouped rather than splitting chains across sections and breaking
// their connecting lines. Named so the worker reads as "the grouping for this mode"
// instead of an inline mode/registry ternary. See ../RenderAlignmentDataRPC/CLAUDE.md.
export function groupByForMode(
  groupBy: GroupBy | undefined,
  isChainMode: boolean,
) {
  return isChainMode && !isChainGroupableType(groupBy?.type)
    ? undefined
    : groupBy
}

// Dimensions as menu radio options, in the given order — the one place the
// behavior registry above is joined to the React-free label table, so no call
// site re-spells a label. Both the alignments menu (every non-hidden dimension)
// and LGVSyntenyDisplay (a curated three) go through it. Mirrors pickColorOptions.
export function pickGroupByOptions(...types: GroupByType[]) {
  return types.map(type => ({ type, label: GROUP_BY_LABELS[type] }))
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

// Resolve a persisted/configured `groupBy` into one the partitioners can actually
// run, or `undefined` (ungrouped) when it can't. The `groupBy` config slot is
// `frozen`, so its contents are unvalidated JSON from a hand-written config or an
// older session: an unrecognized `type` would index the registry to `undefined`
// and throw inside the worker (failing the whole track), and `tag` grouping with
// no tag name would silently collapse every read into one `"<tag>: none"` section.
// Both degrade to ungrouped instead. The display's `groupBy` getter runs this, so
// every consumer — the menu, the layout, `rpcProps` and hence the worker — sees
// only values the registry can key.
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
