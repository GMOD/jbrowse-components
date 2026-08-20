import { classifyGenotypeDosage } from './parseGenotypeDosage.ts'

import type { ProcessedSource } from './types.ts'

// A row with nothing to say at a site. Sorts last, and never groups rows
// together: two rows both missing here are still refined by the next site.
const MISSING_VALUE = -1

// Read outward from `anchor`, alternating left and right, so the sites nearest
// the anchor break ties first and the ones furthest away break them last.
export function* anchorOutwardSites(
  anchor: number,
  total: number,
  maxFlank: number,
) {
  if (anchor >= 0 && anchor < total) {
    yield anchor
    for (let d = 1; d <= maxFlank; d++) {
      const left = anchor - d
      const right = anchor + d
      if (left < 0 && right >= total) {
        return
      }
      if (left >= 0) {
        yield left
      }
      if (right < total) {
        yield right
      }
    }
  }
}

/**
 * Order rows by what they carry at one site, then by how far they agree with
 * their neighbours on either side of it.
 *
 * This is the ordering a haplotype display wants and hierarchical clustering
 * cannot give it. A tree asks for one distance summarizing the whole window,
 * but a haplotype is a mosaic of segments with different histories, so past the
 * first recombination breakpoint the window-averaged distance describes no
 * position in particular. Anchoring instead makes the mosaic legible: rows
 * carrying the same allele at the anchor sit together, their shared block reads
 * as a solid rectangle, and it frays outward exactly where their shared
 * ancestry ends. The breakpoints become the visible signal rather than the
 * noise being averaged over.
 *
 * Implemented as a stable refinement rather than a comparison sort over a
 * composite key: rows start in one bucket, each site splits every bucket by the
 * value its rows carry there, and it stops as soon as no bucket holds more than
 * one row. Real panels resolve within a couple of dozen sites of the anchor, so
 * this reads far fewer sites than it is offered.
 *
 * Site values are a handful of small categories (a dosage, or an allele), so
 * each split is a counting sort rather than a comparison sort. That is what
 * keeps this cheap enough to run on a click: the refinement visits every row
 * once per site it reads, and the deep passes produce thousands of two- and
 * three-row buckets, so anything allocating per bucket or per row dominates.
 * Every buffer here is allocated once and reused across sites and buckets, and
 * `readSite` resolves a site's data once for the whole pass rather than once
 * per row.
 */
export function refineRowsBySite<T>({
  items,
  readSite,
  sites,
  maxValue,
}: {
  items: T[]
  // Bind `site`, returning a reader for one row's categorical value there, in
  // [MISSING_VALUE, maxValue]. Larger sorts first, so alt-carrying rows lead
  // and MISSING_VALUE lands last. Returning undefined means the site has
  // nothing to say about any row, and is skipped without touching one.
  readSite: (site: number) => ((itemIndex: number) => number) | undefined
  sites: Iterable<number>
  maxValue: number
}): T[] {
  const total = items.length
  const order = new Int32Array(total)
  for (let i = 0; i < total; i++) {
    order[i] = i
  }
  // Buckets are the [start, end) ranges of `order` still holding tied rows,
  // held in flat parallel arrays and double-buffered so a pass can write the
  // next generation while reading the current one.
  let starts = new Int32Array(total)
  let ends = new Int32Array(total)
  let nextStarts = new Int32Array(total)
  let nextEnds = new Int32Array(total)
  let numBuckets = 0
  if (total > 1) {
    ends[0] = total
    numBuckets = 1
  }

  // Values shift up by one so MISSING_VALUE indexes slot 0 and sorts last.
  const numSlots = maxValue + 2
  const cursors = new Int32Array(numSlots)
  const values = new Int32Array(total)
  const scratch = new Int32Array(total)

  for (const site of sites) {
    if (numBuckets === 0) {
      break
    }
    const valueAt = readSite(site)
    if (!valueAt) {
      continue
    }
    let numNext = 0
    for (let b = 0; b < numBuckets; b++) {
      const start = starts[b]!
      const end = ends[b]!
      cursors.fill(0)
      for (let i = start; i < end; i++) {
        const slot = valueAt(order[i]!) + 1
        values[i] = slot
        cursors[slot] = cursors[slot]! + 1
      }
      const size = end - start
      let offset = start
      let split = false
      for (let slot = numSlots - 1; slot >= 0; slot--) {
        const count = cursors[slot]!
        if (count !== 0) {
          if (count !== size) {
            split = true
          }
          if (count > 1) {
            nextStarts[numNext] = offset
            nextEnds[numNext] = offset + count
            numNext++
          }
          // reuse the count slot as this value's write cursor
          cursors[slot] = offset
          offset += count
        }
      }
      // Every row in the bucket carries the same value, so the scatter would
      // be an identity permutation — common once the buckets are small.
      if (split) {
        for (let i = start; i < end; i++) {
          const slot = values[i]!
          scratch[cursors[slot]!] = order[i]!
          cursors[slot] = cursors[slot]! + 1
        }
        for (let i = start; i < end; i++) {
          order[i] = scratch[i]!
        }
      }
    }
    // swap the generations rather than reallocating
    ;[starts, nextStarts] = [nextStarts, starts]
    ;[ends, nextEnds] = [nextEnds, ends]
    numBuckets = numNext
  }

  const out: T[] = new Array(total)
  for (let i = 0; i < total; i++) {
    out[i] = items[order[i]!]!
  }
  return out
}

// Per-genotype-code lookup tables, built once per sort from the interned
// genotype dictionary (a handful of distinct strings, so the parsing here is
// not a hot path). Code 0 means the sample had no genotype at all.
//
// `phased` keeps allele identity rather than the alt indicator the clustering
// matrix uses: sorting compares alleles for equality, so it can tell allele 1
// from allele 2 at a multiallelic site where a Euclidean distance cannot.
// Values run alts (by ascending VCF allele number) then reference then missing,
// so a descending sort puts the alt-carrying rows on top with allele 1 above
// allele 2 — an order fixed by the data rather than by the order the genotype
// strings happened to be interned in.
function buildValueTable({
  genotypeDict,
  phased,
  ploidy,
}: {
  genotypeDict: string[]
  phased: boolean
  ploidy: number
}) {
  const numCodes = genotypeDict.length + 1
  const stride = phased ? ploidy : 1
  const table = new Int32Array(numCodes * stride).fill(MISSING_VALUE)
  if (!phased) {
    for (let d = 0; d < genotypeDict.length; d++) {
      // Dosage, matching what the display paints: 2 all-alt, 1 mixed, 0 all-ref
      // and -1 (MISSING_VALUE) no-call.
      table[d + 1] = classifyGenotypeDosage(genotypeDict[d]!)
    }
    return { table, stride, maxValue: 2 }
  }
  // An unphased call assigns no allele to either haplotype row, so it keeps the
  // MISSING fill rather than claiming one.
  const split = genotypeDict.map(genotype =>
    genotype.includes('/') ? undefined : genotype.split('|'),
  )
  // Rank the alt alleles the window actually uses, densely: the refinement
  // counting-sorts over this range, so it tracks the alts present rather than
  // the highest allele number, which a multiallelic panel can push far up.
  const alts = new Set<number>()
  for (const alleles of split) {
    if (alleles) {
      for (const allele of alleles) {
        const num = +allele
        if (Number.isInteger(num) && num > 0) {
          alts.add(num)
        }
      }
    }
  }
  const altValue = new Map<number, number>()
  const sortedAlts = [...alts].sort((a, b) => a - b)
  for (let i = 0; i < sortedAlts.length; i++) {
    altValue.set(sortedAlts[i]!, sortedAlts.length - i)
  }
  for (let d = 0; d < split.length; d++) {
    const alleles = split[d]
    if (alleles) {
      const base = (d + 1) * stride
      for (let hp = 0; hp < ploidy && hp < alleles.length; hp++) {
        const num = +alleles[hp]!
        if (num === 0) {
          table[base + hp] = 0
        } else {
          const value = altValue.get(num)
          if (value !== undefined) {
            table[base + hp] = value
          }
        }
      }
    }
  }
  return { table, stride, maxValue: sortedAlts.length }
}

/**
 * Sort sample/haplotype rows around one clicked variant. Returns undefined when
 * the anchor isn't among the loaded features, so the caller can leave the
 * existing order alone.
 */
export function sortSourcesAroundVariant({
  sources,
  sampleNames,
  genotypeDict,
  featureIds,
  genotypeCodesByFeatureId,
  anchorFeatureId,
  phased,
  maxFlank = 1000,
}: {
  sources: ProcessedSource[]
  sampleNames: string[]
  genotypeDict: string[]
  // Loaded features in genomic order
  featureIds: string[]
  genotypeCodesByFeatureId: Map<string, Uint32Array>
  anchorFeatureId: string
  phased: boolean
  // How far out ties may be broken, in variants each side. This is a locality
  // bound, not a budget: the point of anchoring is to show the haplotype block
  // around one position, and a variant a thousand sites away is in a different
  // block with a different history, so letting it order rows here imports noise
  // from an unrelated locus. Rows still tied that far out keep their input
  // order.
  maxFlank?: number
}) {
  const anchor = featureIds.indexOf(anchorFeatureId)
  if (anchor === -1) {
    return undefined
  }
  const sampleIndex = new Map<string, number>()
  for (let i = 0; i < sampleNames.length; i++) {
    sampleIndex.set(sampleNames[i]!, i)
  }
  const sourceSampleIdx = new Int32Array(sources.length)
  const sourceHp = new Int32Array(sources.length)
  let ploidy = 1
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!
    sourceSampleIdx[i] = sampleIndex.get(source.sampleName) ?? -1
    const hp = source.HP ?? 0
    sourceHp[i] = hp
    if (hp + 1 > ploidy) {
      ploidy = hp + 1
    }
  }
  const { table, stride, maxValue } = buildValueTable({
    genotypeDict,
    phased,
    ploidy,
  })

  return refineRowsBySite<ProcessedSource>({
    items: sources,
    maxValue,
    sites: anchorOutwardSites(anchor, featureIds.length, maxFlank),
    // One `genotypeCodesByFeatureId` lookup per site rather than per row, and
    // separate phased/dosage readers so neither re-tests the mode per row.
    readSite: site => {
      const codes = genotypeCodesByFeatureId.get(featureIds[site]!)
      if (!codes) {
        return undefined
      }
      return phased
        ? sourceIdx => {
            const sampleIdx = sourceSampleIdx[sourceIdx]!
            if (sampleIdx === -1) {
              return MISSING_VALUE
            }
            const code = codes[sampleIdx]!
            return code === 0
              ? MISSING_VALUE
              : table[code * stride + sourceHp[sourceIdx]!]!
          }
        : sourceIdx => {
            const sampleIdx = sourceSampleIdx[sourceIdx]!
            if (sampleIdx === -1) {
              return MISSING_VALUE
            }
            const code = codes[sampleIdx]!
            return code === 0 ? MISSING_VALUE : table[code]!
          }
    },
  })
}
