import {
  PAIR_DIRECTION_LABELS,
  pairDirection,
  pairOrientationToNum,
  svSignalTier,
} from '@jbrowse/alignments-core'
import {
  CIGAR_HAS_SKIP,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import {
  STRAND_FIELD,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { MAPQ_BINS } from '@jbrowse/core/util/colorScale'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import {
  OVERFLOW_GROUP_KEY,
  capGroupKeys,
  overflowLabel,
} from '@jbrowse/core/util/groupKeys'

import { featureChainKey } from './chainGroupingKey.ts'
import { cigarCategoryBitsOf } from './extractCigarFeatures.ts'
import { extractFeatureTagValue } from './extractFeatureTagValue.ts'
import {
  FIRST_OF_PAIR_STRAND_LABELS,
  FACET_LABELS,
  facetTag,
} from './facetLabels.ts'
import { pairingOf } from './pairing.ts'
import {
  MAPQ_UNAVAILABLE_LEVEL,
  PAIRING_LEVELS,
  READ_LEVEL_LABELS,
  SPLICED_LEVELS,
  SPLIT_LEVELS,
  SV_SIGNAL_LEVELS,
  SV_SIGNAL_OF_TIER,
  levelOrder,
} from './readFieldLevels.ts'
import {
  chainIsSplit,
  isSplitAlignment,
  readCategoryBitsOf,
} from './splitAlignment.ts'
import {
  MAPQ_UNAVAILABLE,
  firstOfPairStrand,
  getFlags,
  getMappingQuality,
  getMateRefName,
  getOrCreate,
  getStrand,
} from './util.ts'

import type { AlignmentsUnit } from '../LinearAlignmentsDisplay/constants.ts'
import type { Pairing, SvSignal } from './readFieldLevels.ts'
import type { Facet, ReadDimension, WorkerFacet } from './types.ts'
import type { PairDirection } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export {
  MAX_GROUPS,
  OVERFLOW_GROUP_KEY,
  compareGroupKeys,
  overflowLabel,
} from '@jbrowse/core/util/groupKeys'

export interface FeatureGroup {
  // '' is the "untagged"/"unknown" sentinel, which `groupKeyRank` sorts
  // second-to-last, ahead of only the overflow bucket.
  key: string
  label: string
  features: Feature[]
  // The keys this group swallowed, on the overflow bucket alone. Present so the
  // main thread can UNION them across regions: the cap runs per worker call, so
  // no one region knows how many values the drawn lane ends up holding — see
  // `overflowLabel`.
  mergedKeys?: string[]
}

interface GroupKey {
  key: string
  label: string
}

// Interned, one per section, because a grouped fetch walks every read. Spelling
// each out also makes a dimension's sections countable here, which is the "keep
// every dimension a closed set" rule of ../RenderAlignmentDataRPC/CLAUDE.md —
// `mateAssembly`, a tag and a field are the ones that can't be listed, and
// MAX_GROUPS guards them. Strand keys are the `strand` vocabulary's, so one
// `facet.domain` names the same sections on the mark display beside this one.
const STRANDS = categoricalField(STRAND_FIELD)
const FWD_KEY = STRANDS.key(1)
const REV_KEY = STRANDS.key(-1)
const FWD_STRAND_GROUP: GroupKey = {
  key: FWD_KEY,
  label: STRANDS.sectionLabel(FWD_KEY),
}
const REV_STRAND_GROUP: GroupKey = {
  key: REV_KEY,
  label: STRANDS.sectionLabel(REV_KEY),
}
const FWD_FIRST_OF_PAIR_GROUP: GroupKey = {
  key: FWD_KEY,
  label: FIRST_OF_PAIR_STRAND_LABELS.forward,
}
const REV_FIRST_OF_PAIR_GROUP: GroupKey = {
  key: REV_KEY,
  label: FIRST_OF_PAIR_STRAND_LABELS.reverse,
}

const STRAND_VALUED: ReadonlySet<string> = new Set([
  'strand',
  'firstOfPairStrand',
] satisfies ReadDimension[])

export function sectionOrder(field: string, domain?: readonly string[]) {
  return categoricalField(STRAND_VALUED.has(field) ? STRAND_FIELD : field, {
    domain: levelOrder(field, domain),
  }).compare
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

// The IGV category (LR/RL/RR/LL) through `pairDirection`, never the raw
// `pair_orientation`: F1R2 and F2R1 are one normal LR pair differing only in
// which mate the record is, so the raw string opens up to eight sections, two of
// them "normal". Every other consumer — color scheme, tooltip, arc palette,
// concordant-pair filter — collapses them the same way. An unrecognized
// orientation is not a category, so it files with the reads that have none.
const NO_PAIR_ORIENTATION_GROUP: GroupKey = {
  key: '',
  label: 'No orientation',
}
function pairOrientationGroup(dir: PairDirection): GroupKey {
  return { key: dir, label: PAIR_DIRECTION_LABELS[dir] }
}
const PAIR_ORIENTATION_GROUPS: Record<PairDirection, GroupKey> = {
  LR: pairOrientationGroup('LR'),
  RL: pairOrientationGroup('RL'),
  RR: pairOrientationGroup('RR'),
  LL: pairOrientationGroup('LL'),
}

function pairOrientationKey(feature: Feature): GroupKey {
  const dir = pairDirection(
    feature.get('pair_orientation') as string | undefined,
  )
  return dir === undefined
    ? NO_PAIR_ORIENTATION_GROUP
    : PAIR_ORIENTATION_GROUPS[dir]
}

const [SPLIT_KEY, UNSPLIT_KEY] = SPLIT_LEVELS
const SPLIT_GROUP: GroupKey = {
  key: SPLIT_KEY,
  label: READ_LEVEL_LABELS.split[SPLIT_KEY],
}
const UNSPLIT_GROUP: GroupKey = {
  key: UNSPLIT_KEY,
  label: READ_LEVEL_LABELS.split[UNSPLIT_KEY],
}

// Reads that cross a breakpoint and reads that don't — at an SV locus, the
// evidence and the background. `isSplitAlignment` is the "Show only split
// alignments" filter's test and the sort's `READ_SPLIT`.
function splitKey(feature: Feature): GroupKey {
  return isSplitAlignment(feature) ? SPLIT_GROUP : UNSPLIT_GROUP
}

const [SPLICED_KEY, UNSPLICED_KEY] = SPLICED_LEVELS
const SPLICED_GROUP: GroupKey = {
  key: SPLICED_KEY,
  label: READ_LEVEL_LABELS.spliced[SPLICED_KEY],
}
const UNSPLICED_GROUP: GroupKey = {
  key: UNSPLICED_KEY,
  label: READ_LEVEL_LABELS.spliced[UNSPLICED_KEY],
}

// Over the whole record, as the spliced filter and sort ask it.
function isSpliced(feature: Feature) {
  return (cigarCategoryBitsOf(feature) & CIGAR_HAS_SKIP) !== 0
}

function splicedKey(feature: Feature): GroupKey {
  return isSpliced(feature) ? SPLICED_GROUP : UNSPLICED_GROUP
}

const PAIRING_GROUPS = Object.fromEntries(
  PAIRING_LEVELS.map(key => [
    key,
    { key, label: READ_LEVEL_LABELS.pairing[key] },
  ]),
) as Record<Pairing, GroupKey>

function pairingKey(feature: Feature): GroupKey {
  return PAIRING_GROUPS[
    pairingOf(
      getFlags(feature),
      pairOrientationToNum(
        feature.get('pair_orientation') as string | undefined,
      ),
    )
  ]
}

const SV_SIGNAL_GROUPS = Object.fromEntries(
  SV_SIGNAL_LEVELS.map(key => [
    key,
    { key, label: READ_LEVEL_LABELS.svSignal[key] },
  ]),
) as Record<SvSignal, GroupKey>

function svSignalTierOf(feature: Feature) {
  return svSignalTier(readCategoryBitsOf(feature))
}

// A chain is as strong evidence as its strongest record, the rule the
// `svSignal` filter keeps a chain by.
function chainSvSignalKey(chain: Feature[]) {
  let tier = 0
  for (const feature of chain) {
    tier = Math.max(tier, svSignalTierOf(feature))
  }
  return SV_SIGNAL_GROUPS[SV_SIGNAL_OF_TIER[tier]!]
}

// A read's mate reference, or a synteny block's query contig.
function mateRefNameKey(feature: Feature): GroupKey {
  const name = getMateRefName(feature)
  return name
    ? { key: name, label: name }
    : { key: '', label: 'No mate reference' }
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

const MAPQ_UNAVAILABLE_GROUP: GroupKey = {
  key: MAPQ_UNAVAILABLE_LEVEL,
  label: 'MAPQ unavailable',
}

function mapqKey(feature: Feature): GroupKey {
  const mapq = getMappingQuality(feature)
  if (mapq !== MAPQ_UNAVAILABLE) {
    for (const bin of MAPQ_BINS) {
      if (mapq >= bin.min) {
        return bin
      }
    }
  }
  return MAPQ_UNAVAILABLE_GROUP
}

// Every group runs the whole spine, and its coverage pipeline allocates
// region-width depth arrays before uploading a per-bp GPU buffer that alone
// approaches the device limit at chromosome scale, so `MAX_GROUPS` is what
// keeps a UMI-style `RX`/`MI` tag from paying that thousands of times over.
// Every dimension but `tag`, `mateRefName` and `mateAssembly` is a closed set
// of at most five keys, and GroupByDialog refuses `tag` up front with the
// distinct values in hand.

// The tail past `MAX_GROUPS` merges into one overflow section rather than
// dropping its reads, by the same `capGroupKeys` rule a display reading the
// sections applies, so which groups survive follows from the key set alone
// and not from per-region read counts. The cap is region-local, so a
// cross-region union can exceed MAX_GROUPS when regions expose wildly
// different value sets; it bounds the per-group region-width cost, which is
// what actually blows up.
function orderGroups(groups: FeatureGroup[], field: string) {
  const compare = sectionOrder(field)
  const ordered = groups.sort((a, b) => compare(a.key, b.key))
  const { sectionOf, mergedCount } = capGroupKeys(ordered.map(g => g.key))
  if (mergedCount === 0) {
    return ordered
  }
  const kept: FeatureGroup[] = []
  const overflow: FeatureGroup[] = []
  for (const g of ordered) {
    ;(sectionOf(g.key) === g.key ? kept : overflow).push(g)
  }
  kept.push({
    key: OVERFLOW_GROUP_KEY,
    label: overflowLabel(overflow.length),
    features: overflow.flatMap(g => g.features),
    mergedKeys: overflow.map(g => g.key),
  })
  return kept
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

// Partition the fetched reads into ordered sections. A read unit keys each read
// by itself; a chain unit keys each chain as a whole, so no chain splits across
// sections and breaks its connecting lines.
export function partitionFeatures(
  features: Feature[],
  facet: WorkerFacet | undefined,
  jexl?: JexlInstance,
): FeatureGroup[] {
  if (!facet) {
    return [{ key: '', label: '', features }]
  }
  const keyer = groupKeyer(facet.field, jexl)
  const groups = new Map<string, FeatureGroup>()
  if (facet.unit === 'chain') {
    const chains = new Map<string, Feature[]>()
    for (const feature of features) {
      getOrCreate(chains, featureChainKey(feature), () => []).push(feature)
    }
    for (const chain of chains.values()) {
      const groupKey =
        keyer.chainKey?.(chain) ?? keyer.key(chainRepresentative(chain))
      for (const feature of chain) {
        appendFeature(groups, feature, groupKey)
      }
    }
  } else {
    for (const feature of features) {
      appendFeature(groups, feature, keyer.key(feature))
    }
  }
  return orderGroups([...groups.values()], facet.field)
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

export interface FacetDimension<K extends ReadDimension = ReadDimension> {
  field: K
  // Whether the dimension describes the FRAGMENT rather than the record, so a
  // chain-unit partition can key a whole chain off its representative read.
  //
  // NOT "every read of the chain yields this key", which two of the dimensions
  // marked true fail: a supplementary segment carries its own strand and its own
  // @gmod/bam-derived `pair_orientation`, so an inverted split makes
  // `firstOfPairStrand` and `pairOrientation` disagree with their primary. The
  // primary read1 holds the fragment's answer either way — the same read
  // `attachChainFields` takes pair orientation off. `mapq` and `strand` are false
  // because a chain has no single answer: its two mates genuinely point opposite
  // ways and map with their own confidence.
  //
  // Whether chain mode HONORS the dimension is `isChainFacetable`.
  fragmentLevel: boolean
  // Not meaningful for ordinary alignment reads, so it is kept out of the general
  // "Group by..." radios and surfaced by the display that supports it —
  // LGVSyntenyDisplay's menus.ts owns mateAssembly.
  hidden?: boolean
  key: (feature: Feature) => GroupKey
  // Key for a whole chain, for a dimension the representative read cannot answer
  // for — it answers "is the primary read1 like this", not "is any read of this
  // fragment". Supplying one is also what makes a per-read dimension groupable in
  // chain mode (`isChainFacetable`).
  chainKey?: (chain: Feature[]) => GroupKey
}

// The one registry of read dimensions. Keyed by ReadDimension, so a new member
// is a compile error until it is classified here; each entry's `field` is
// pinned to its own key, because `pickFacetOptions` maps to that field and a
// plain Record would accept one naming a sibling. Insertion order is the menu
// order. Labels live in the React-free facetLabels.ts (see its header),
// joined to this registry by `pickFacetOptions` alone.
export const FACET_DIMENSIONS: {
  [K in ReadDimension]: FacetDimension<K>
} = {
  strand: {
    field: 'strand',
    fragmentLevel: false,
    key: strandKey,
  },
  firstOfPairStrand: {
    field: 'firstOfPairStrand',
    fragmentLevel: true,
    key: firstOfPairStrandKey,
  },
  pairOrientation: {
    field: 'pairOrientation',
    fragmentLevel: true,
    key: pairOrientationKey,
  },
  // A chain takes its representative's level, and one holding only its
  // supplementary falls back to that record, so `nonPrimary` can be a section
  // in chain mode too.
  pairing: {
    field: 'pairing',
    fragmentLevel: true,
    key: pairingKey,
  },
  // Chain mode is where this one earns its keep — long-read SV viewing is linked
  // reads plus split-read evidence — so it states the chain's key rather than
  // being dropped there. One mate can be split where the other is not, and the
  // fragment has split evidence if either does, which no single read answers.
  split: {
    field: 'split',
    fragmentLevel: false,
    key: splitKey,
    chainKey: chain => (chainIsSplit(chain) ? SPLIT_GROUP : UNSPLIT_GROUP),
  },
  spliced: {
    field: 'spliced',
    fragmentLevel: false,
    key: splicedKey,
    chainKey: chain =>
      chain.some(isSpliced) ? SPLICED_GROUP : UNSPLICED_GROUP,
  },
  svSignal: {
    field: 'svSignal',
    fragmentLevel: false,
    key: feature =>
      SV_SIGNAL_GROUPS[SV_SIGNAL_OF_TIER[svSignalTierOf(feature)]!],
    chainKey: chainSvSignalKey,
  },
  mapq: {
    field: 'mapq',
    fragmentLevel: false,
    key: mapqKey,
  },
  // As `mateAssembly`, the data decides how many sections there are, so it
  // stays out of the radios; a config or the agent API names it.
  mateRefName: {
    field: 'mateRefName',
    fragmentLevel: true,
    hidden: true,
    key: mateRefNameKey,
  },
  mateAssembly: {
    field: 'mateAssembly',
    fragmentLevel: true,
    hidden: true,
    key: mateAssemblyKey,
  },
}

export function isReadDimension(field: string): field is ReadDimension {
  return Object.hasOwn(FACET_DIMENSIONS, field)
}

function readDimension(field: string) {
  return isReadDimension(field) ? FACET_DIMENSIONS[field] : undefined
}

// A field no read dimension names keys by its value, labelled the way the
// feature displays label a section. A tag reads through the tag block's
// targeted decode (`extractFeatureTagValue`), since this runs per read and
// `get('tags')` decodes every tag on it to answer one.
function valueKeyer(
  field: string,
  jexl: JexlInstance | undefined,
): FacetDimension['key'] {
  const tag = facetTag(field)
  const { key, sectionLabel } = categoricalField(tag ?? field)
  const read =
    tag === undefined
      ? fieldReader(field, jexl)
      : (feature: Feature) => extractFeatureTagValue(feature, tag)
  return feature => {
    const value = key(read(feature))
    return { key: value, label: sectionLabel(value) }
  }
}

// What a facet's field partitions by: a read dimension's own keys, or the
// field's value. Built once per fetch, so the per-read call is the keyer alone.
function groupKeyer(
  field: string,
  jexl?: JexlInstance,
): Pick<FacetDimension, 'key' | 'chainKey'> {
  return readDimension(field) ?? { key: valueKeyer(field, jexl) }
}

/**
 * The value one read takes for a field, as a facet keys its section: a read
 * dimension's own key, a tag's value or a field's, a path or a `jexl:`
 * expression included. A field the color bake paints from a value per read
 * reads it here too, so the two channels name a read alike.
 */
export function fieldValueReader(field: string, jexl?: JexlInstance) {
  const { key } = groupKeyer(field, jexl)
  return (feature: Feature) => key(feature).key
}

// Whether chain mode can honor a facet: the chain has to resolve to one key,
// which holds when the representative read answers for the fragment or when the
// dimension states the chain's key itself. A tag or a field keys the chain off
// its representative read. Derived rather than asserted as a third field, so a `chainKey`
// written without a matching flag can't sit there unreachable while the
// dimension degrades to ungrouped.
export function isChainFacetable(field: string | undefined) {
  if (field === undefined) {
    return false
  }
  const dimension = readDimension(field)
  return (
    dimension === undefined ||
    dimension.fragmentLevel ||
    dimension.chainKey !== undefined
  )
}

// The grouping a fetch can actually honor. A per-read dimension in chain mode (an
// old session with strand + chain, say) degrades to ungrouped rather than
// splitting chains across sections and breaking their connecting lines.
export function facetForUnit(facet: Facet | undefined, unit: AlignmentsUnit) {
  return unit === 'chain' && !isChainFacetable(facet?.field) ? undefined : facet
}

/**
 * A facet over a field that no fetched read answers, for the corner notice:
 * the reads come back as one section keyed `''`. A read dimension and a tag
 * answer for every read, a tag's `''` being its own "untagged" section.
 */
export function facetValueNotices(
  facet: Facet | undefined,
  keys: readonly string[],
): string[] {
  return facet &&
    !isReadDimension(facet.field) &&
    facetTag(facet.field) === undefined &&
    keys.length === 1 &&
    keys[0] === ''
    ? [
        `facet: no read here carries a value for ${facet.field}, so every read is in one section`,
      ]
    : []
}

/** What `facet` says that `unit` cannot draw, for the corner notice. */
export function facetUnitNotices(
  facet: Facet | undefined,
  unit: AlignmentsUnit,
): string[] {
  return facet && facetForUnit(facet, unit) === undefined
    ? [
        `facet: ${facet.field} differs between a chain's reads, so unit: "chain" draws one ungrouped section`,
      ]
    : []
}

// Dimensions as menu radio options, in the given order: the one join between the
// registry above and the label table, so no call site re-spells a label. The
// alignments menu takes every non-hidden dimension, LGVSyntenyDisplay a curated
// three. Mirrors colorFieldOptions.
export function pickFacetOptions(...fields: ReadDimension[]) {
  return fields.map(field => ({ type: field, label: FACET_LABELS[field] }))
}

/**
 * What the worker partitions by: the field, and in chain mode the chain as the
 * unit a section keeps whole. The domain only orders the sections, which the
 * main thread does, so a reorder refetches nothing — and ungrouped sends no
 * facet at all, so toggling chain mode over ungrouped data refetches nothing
 * either.
 */
export function workerFacet(
  facet: Facet | undefined,
  unit: AlignmentsUnit,
): WorkerFacet | undefined {
  return facet === undefined
    ? undefined
    : unit === 'chain'
      ? { field: facet.field, unit }
      : { field: facet.field }
}
