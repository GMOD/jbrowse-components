import { READ_SV_SIGNAL, readKeyOf } from '@jbrowse/alignments-core'
import { SAM_FLAG_SECONDARY } from '@jbrowse/cigar-utils'
import { groupBy } from '@jbrowse/core/util'

import { featureChainKey } from '../shared/chainGroupingKey.ts'
import { chainIsSplit, readCategoryBitsOf } from '../shared/splitAlignment.ts'
import {
  MAPQ_UNAVAILABLE,
  getFlags,
  getMappingQuality,
} from '../shared/util.ts'

import type { CategoryFilter, ReadFilter } from '../shared/types.ts'
import type { ReadKey } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

// A chain is SV evidence when any of its records is (`READ_SV_SIGNAL`, ADR-229),
// so the concordant mate of a split read stays with it. The split test reads
// the SA tag: the filter runs per region, so in a view of chr1 beside chr4 the
// chr1 call never sees a split read's chr4 supplementary.
function isSvSignalChain(chain: Feature[]) {
  return chain.some(f => (readCategoryBitsOf(f) & READ_SV_SIGNAL) !== 0)
}

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
function mateKey(f: Feature) {
  const name = f.get('name')
  const nextPos = f.get('next_pos') as number | undefined
  if (!name || !(getFlags(f) & SAM_FLAG_SECONDARY) || nextPos === undefined) {
    return featureChainKey(f)
  }
  const start = f.get('start')
  return `${name}\0${Math.min(start, nextPos)}\0${Math.max(start, nextPos)}`
}

function isSingletonChain(mateCounts: Map<string, number>) {
  return (chain: Feature[]) =>
    chain.length === 1 && mateCounts.get(mateKey(chain[0]!)) === 1
}

// The records `minMapq` keeps, applied here rather than in the adapters so a
// synteny block, whose adapter takes no filter, answers it too; one record at
// a time, so a pair's low-quality mate goes and the other stays.
function passingMapq(features: Feature[], minMapq: number | undefined) {
  return minMapq === undefined
    ? features
    : features.filter(f => {
        const mapq = getMappingQuality(f)
        return mapq !== MAPQ_UNAVAILABLE && mapq >= minMapq
      })
}

// Keep the chains a category filter asks for. `'only'` keeps the ones the
// predicate holds for, `'exclude'` drops them, and absent leaves them alone.
function keepCategory(
  chains: Feature[][],
  filter: CategoryFilter | undefined,
  predicate: (chain: Feature[]) => boolean,
) {
  return filter === undefined
    ? chains
    : chains.filter(c => predicate(c) === (filter === 'only'))
}

// Both read-filter steps, for a caller with no use for the sample between them.
export function filterChainFeatures(
  features: Feature[],
  filterBy?: ReadFilter,
) {
  return selectChains(sampleFeatures(features, filterBy), filterBy)
}

// The reads the sample filters keep: one per record, at or above `minMapq`.
// These define what the track measures, so the insert-size band reads them
// (executeRenderAlignmentData) before `selectChains` picks what to show.
export function sampleFeatures(features: Feature[], filterBy?: ReadFilter) {
  return passingMapq(dedupeById(features), filterBy?.minMapq)
}

// The three read-category filters that need a whole chain to answer, applied
// to `sampleFeatures`' output after grouping reads by name. `filterBy.spliced`
// is the fourth and is not here: it is per-record, so the adapters answer it
// as they parse.
//
// PER WORKER CALL, i.e. per displayed region — the RPC takes `regions[0]`. So
// "chain of one" means "one alignment in THIS window", and in a multi-region
// view a read whose two alignments land in different windows is a singleton in
// both. `singletons` is absent by default, so this only bites a user who sets
// it; the menu's help text names the scope for that reason. `split` is the one
// that routes around it, by reading the SA tag rather than counting what this
// call happened to fetch (`chainIsSplit`) — the same move is not available for
// the other two, which are about what is on screen. Making them view-wide means
// moving the filter to the main thread, where the coverage histogram these also
// thin is no longer being computed.
export function selectChains(sample: Feature[], filterBy?: ReadFilter) {
  const { svSignal, singletons, split } = filterBy ?? {}
  if (
    svSignal === undefined &&
    singletons === undefined &&
    split === undefined
  ) {
    return sample
  }
  let rawChains = Object.values(groupBy(sample, featureChainKey))
  if (singletons !== undefined) {
    const mateCounts = new Map<string, number>()
    for (const f of sample) {
      const key = mateKey(f)
      mateCounts.set(key, (mateCounts.get(key) ?? 0) + 1)
    }
    rawChains = keepCategory(
      rawChains,
      singletons,
      isSingletonChain(mateCounts),
    )
  }
  rawChains = keepCategory(rawChains, svSignal, isSvSignalChain)
  rawChains = keepCategory(rawChains, split, chainIsSplit)
  // same key as the dedupe above, for the same reason: this is identity within
  // one fetch, which is the thing `readKeyOf` is cheap at
  const keptIds = new Set<ReadKey>()
  for (const chain of rawChains) {
    for (const f of chain) {
      keptIds.add(readKeyOf(f))
    }
  }
  return sample.filter(f => keptIds.has(readKeyOf(f)))
}
