import {
  READ_SPLICED,
  READ_SPLIT,
  readKeyOf,
  svSignalTier,
} from '@jbrowse/alignments-core'
import { SAM_FLAG_SECONDARY } from '@jbrowse/cigar-utils'
import { compilePredicates } from '@jbrowse/core/util/fieldPredicate'

import {
  compileMapqFilter,
  drawnPredicatesOf,
} from '../shared/alignmentsFilter.ts'
import { featureChainKey } from '../shared/chainGroupingKey.ts'
import { CHAIN_FIELDS, DRAWN_RECORD_FIELDS } from '../shared/filterFields.ts'
import { readCategoryBitsOf } from '../shared/splitAlignment.ts'
import { getFlags, getMappingQuality } from '../shared/util.ts'

import type { ReadKey } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'
import type {
  FieldPredicate,
  PredicateLane,
} from '@jbrowse/core/util/fieldPredicate'

// Guard against the same physical record being emitted twice — a dup would
// double-count coverage depth and double-draw.
//
// Nothing has been observed to produce one for some time: `@gmod/bam`'s
// `blocksForRange` runs `optimizeChunks`, which absorbs a chunk already covered
// by its neighbour, and a sweep of ~4800 index queries over the 20x/200x/1000x
// fixtures found no overlapping chunk pair and no duplicate record. The
// motivation that is genuinely gone is the older one: block rendering fetched
// adjacent overlapping regions, so a feature spanning a boundary arrived twice,
// and there are no blocks now.
//
// It stays because it is now nearly free and because the failure it prevents is
// silent — a wrong depth, not a crash — and because the class is not
// hypothetical: `@gmod/bam` hit it in its own mate path ("their records came
// back twice") and still keeps a `readIds` set there. In the common no-dup case
// this returns the input array untouched, so it costs one Set build rather than
// a full-length copy.
function dedupeById(features: Feature[]) {
  const seen = new Set<ReadKey>()
  let dupIndex = -1
  for (let i = 0; i < features.length; i++) {
    const id = readKeyOf(features[i]!)
    if (seen.has(id)) {
      dupIndex = i
      break
    }
    seen.add(id)
  }
  if (dupIndex === -1) {
    return features
  }
  // A dup exists: keep the unique prefix, then continue skipping repeats.
  const out = features.slice(0, dupIndex)
  for (let i = dupIndex; i < features.length; i++) {
    const f = features[i]!
    const id = readKeyOf(f)
    if (!seen.has(id)) {
      seen.add(id)
      out.push(f)
    }
  }
  return out
}

// The key a record shares with its mate for "reads without a mate". A secondary
// alignment keys a chain of its own (`chainGroupingKey`), but aligners emit a
// paired read's secondary alignments as pairs whose two records name each
// other's position, and a secondary pair on screen is not two reads alone.
export function mateKey(f: Feature) {
  const name = f.get('name')
  const nextPos = f.get('next_pos') as number | undefined
  if (!name || !(getFlags(f) & SAM_FLAG_SECONDARY) || nextPos === undefined) {
    return featureChainKey(f)
  }
  const start = f.get('start')
  return `${name}\0${Math.min(start, nextPos)}\0${Math.max(start, nextPos)}`
}

// Applied here, not in the adapters, so a synteny block answers `mapq` too.
// MAPQ 255 means none reported, and passes a floor as in `samtools view -q`.
function passingMapq(
  features: Feature[],
  filter: readonly FieldPredicate[] | undefined,
) {
  const keeps = compileMapqFilter(filter, getMappingQuality)
  return keeps ? features.filter(keeps) : features
}

// Both read-filter steps: the reads drawn, for a caller with no use for the
// sample, which coverage counts, between them.
export function filterChainFeatures(
  features: Feature[],
  filter?: readonly FieldPredicate[],
) {
  return selectChains(sampleFeatures(features, filter), filter)
}

// The reads the sample filters keep: one per record, passing `mapq`.
// These define what the track measures, so the insert-size band and the
// coverage read them (executeRenderAlignmentData), and `drawnReadMask` picks
// which of them are drawn.
export function sampleFeatures(
  features: Feature[],
  filter?: readonly FieldPredicate[],
) {
  return passingMapq(dedupeById(features), filter)
}

/**
 * A fetch's reads as the drawn-read fields test them, by index: the render
 * hands over what its extract already holds for every read, and any other
 * caller reads them off the records (`featureSource`).
 */
export interface DrawnReadSource {
  length: number
  // the read's `readCategoryBits`
  categoryBits: (i: number) => number
  name: (i: number) => string | undefined
  chainKey: (i: number) => string
  mateKey: (i: number) => string
}

export function featureSource(features: Feature[]): DrawnReadSource {
  return {
    length: features.length,
    categoryBits: i => readCategoryBitsOf(features[i]!),
    name: i => features[i]!.get('name'),
    chainKey: i => featureChainKey(features[i]!),
    mateKey: i => mateKey(features[i]!),
  }
}

// A record's answer to `svSignal` (ADR-229), `split` and `spliced`. `split`
// reads the SA tag: the filter runs per region, so in a view of chr1 beside
// chr4 the chr1 call never sees a split read's chr4 supplementary.
function categoryAnswer(field: string) {
  return field === 'svSignal'
    ? (bits: number) => svSignalTier(bits) > 0
    : field === 'split'
      ? (bits: number) => (bits & READ_SPLIT) !== 0
      : (bits: number) => (bits & READ_SPLICED) !== 0
}

function recordLane(source: DrawnReadSource) {
  return (field: string): PredicateLane | undefined => {
    if (field === 'name') {
      return { kind: 'get', get: source.name }
    } else if (field === 'spliced') {
      const answer = categoryAnswer(field)
      return { kind: 'get', get: i => answer(source.categoryBits(i)) }
    } else {
      return undefined
    }
  }
}

function tally(keys: readonly string[]) {
  const counts = new Map<string, number>()
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

// A chain field's answer for the read at an index, as its whole chain gives
// it: `svSignal` and `split` when any of its records answers yes, so the
// concordant mate of a split read stays with it, and `alone` by its mates'
// count over the fetch.
function chainLane(source: DrawnReadSource) {
  const chainKeys = Array.from({ length: source.length }, (_, i) =>
    source.chainKey(i),
  )
  return (field: string): PredicateLane | undefined => {
    if (field === 'svSignal' || field === 'split') {
      const answer = categoryAnswer(field)
      const yes = new Set<string>()
      for (let i = 0; i < source.length; i++) {
        if (answer(source.categoryBits(i))) {
          yes.add(chainKeys[i]!)
        }
      }
      return { kind: 'get', get: i => yes.has(chainKeys[i]!) }
    } else if (field === 'alone') {
      const chainSizes = tally(chainKeys)
      const mateKeys = Array.from({ length: source.length }, (_, i) =>
        source.mateKey(i),
      )
      const mateCounts = tally(mateKeys)
      return {
        kind: 'get',
        get: i =>
          chainSizes.get(chainKeys[i]!) === 1 &&
          mateCounts.get(mateKeys[i]!) === 1,
      }
    } else {
      return undefined
    }
  }
}

// The drawn-read test over the whole fetch, before any facet partitions it,
// so a strand facet cannot split a chain's verdict.
//
// PER WORKER CALL, i.e. per displayed region — the RPC takes `regions[0]`. So
// "chain of one" means "one alignment in THIS window", and in a multi-region
// view a read whose two alignments land in different windows is alone in both.
// `alone` is absent by default, so this only bites a user who sets
// it; the menu's help text names the scope for that reason. `split` is the one
// that routes around it, by reading the SA tag rather than counting what this
// call happened to fetch — the same move is not available for `alone`, which
// is about what is on screen.
function maskPassing(source: DrawnReadSource, predicates: FieldPredicate[]) {
  const chainPredicates = predicates.filter(p => CHAIN_FIELDS.has(p.field))
  const keepsRecord = compilePredicates(
    predicates.filter(p => DRAWN_RECORD_FIELDS.has(p.field)),
    recordLane(source),
  )
  const keepsChain =
    chainPredicates.length === 0
      ? undefined
      : compilePredicates(chainPredicates, chainLane(source))
  const drawn = new Uint8Array(source.length)
  let count = 0
  for (let i = 0; i < source.length; i++) {
    if ((!keepsChain || keepsChain(i)) && (!keepsRecord || keepsRecord(i))) {
      drawn[i] = 1
      count++
    }
  }
  return count === source.length ? undefined : drawn
}

/**
 * Which reads of a fetch the filter draws, 1 each, or undefined while it
 * draws every one: `name` and `spliced` per record, `svSignal`, `split` and
 * `alone` per chain grouped by name. Coverage still counts the reads it
 * leaves out.
 */
export function drawnReadMask(
  source: DrawnReadSource,
  filter?: readonly FieldPredicate[],
) {
  const predicates = drawnPredicatesOf(filter)
  return predicates.length === 0 ? undefined : maskPassing(source, predicates)
}

/** The sample's reads the filter draws. */
export function selectChains(
  sample: Feature[],
  filter?: readonly FieldPredicate[],
) {
  const drawn = drawnReadMask(featureSource(sample), filter)
  return drawn ? sample.filter((_, i) => drawn[i] === 1) : sample
}
