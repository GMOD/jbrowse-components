import { internGenotype } from '../shared/genotypeCodec.ts'
import { featureHasPhaseSet } from '../shared/getPhasedColor.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import { featureHasConsequence } from '../shared/variantConsequence.ts'
import {
  assignSvTypeColors,
  getVariantSvType,
} from '../shared/variantSvType.ts'

import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type { SampleInfo } from '../shared/types.ts'
import type { ProgressReporter } from '@jbrowse/core/util'

export interface SimplifiedVariantFeature {
  id: string
  data: {
    start: unknown
    end: unknown
    refName: unknown
    name: unknown
  }
}

// How many distinct genotypes one site is expected to carry. A biallelic site
// has four ('0|0', '0|1', '1|0', '1|1') plus the no-call spellings; past this
// the scan simply stops memoizing and pays the dict Map, so the number sizes
// the fast path rather than bounding correctness.
const SITE_GENOTYPE_MEMO_SIZE = 32

// The whole genotype as one int, or 0 when it doesn't fit. Four characters is
// the width that matters: it holds every genotype a diploid biallelic-to-
// 9-allele callset spells, which is nearly every cell of nearly every VCF. No
// ASCII character is 0, so the zero padding of a shorter genotype cannot look
// like a longer one, and 0 is free to mean "didn't pack".
//
// Exported for the test that pins exactly that: distinct genotypes must not
// collide, and everything past four characters must decline.
export function packGenotypeKey(str: string, start: number, end: number) {
  const len = end - start
  if (len === 0 || len > 4) {
    return 0
  }
  // `seen` accumulates the raw code units so one test at the end can reject a
  // non-ASCII character. It has to be rejected rather than truncated: a code
  // unit above 0xFF would spill out of its byte and could land on the key of a
  // different genotype, which is a silently wrong cell rather than a slow one.
  const c0 = str.charCodeAt(start)
  let key = c0
  let seen = c0
  if (len > 1) {
    const c = str.charCodeAt(start + 1)
    key |= c << 8
    seen |= c
  }
  if (len > 2) {
    const c = str.charCodeAt(start + 2)
    key |= c << 16
    seen |= c
  }
  if (len > 3) {
    const c = str.charCodeAt(start + 3)
    key |= c << 24
    seen |= c
  }
  return (seen & 0xff80) === 0 ? key : 0
}

// Merge one sample's per-feature ploidy/phasing into the running sampleInfo
// (max ploidy seen, phased if ever phased).
function accumulateSampleInfo(
  sampleInfo: Record<string, SampleInfo>,
  key: string,
  ploidy: number,
  isPhased: boolean,
) {
  const existing = sampleInfo[key]
  if (existing) {
    if (ploidy > existing.maxPloidy) {
      existing.maxPloidy = ploidy
    }
    existing.isPhased ||= isPhased
  } else {
    sampleInfo[key] = { maxPloidy: ploidy, isPhased }
  }
}

export interface AnalyzedVariants {
  sampleInfo: Record<string, SampleInfo>
  hasPhased: boolean
  // Whether any called genotype is one the phased painter treats as phased or
  // haploid data — `isPhasedOrHaploid` in shared/getPhasedColor.ts, i.e. it
  // carries no `/`. Wider than `hasPhased`, deliberately: a pangenome callset is
  // haploid per assembly path and `vg deconstruct` writes bare `0`/`1`/`23`, so
  // no `|` appears anywhere in a file phased mode renders correctly. This is
  // what gates the menu entry, so the gate matches the painter.
  //
  // The one place it is narrower than the per-genotype predicate is an uncalled
  // genotype: `.` and `.|.` carry no `/` but are no data, so they count toward
  // neither this nor `hasUnphased` (which requires a called allele for the same
  // reason). A bare `.` is how plenty of files spell a missing diploid call, and
  // treating that as haploid evidence would offer the mode on any unphased
  // callset with a hole in it.
  hasPhasedOrHaploid: boolean
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  hasConsequence: boolean
  hasPhaseSet: boolean
  svTypeColors: Record<string, string>
  simplifiedFeatures: SimplifiedVariantFeature[]
  // The interned genotype payload, built here rather than in a later pass: per
  // feature a Uint32Array of codes aligned to `sampleNames` (0 = no genotype),
  // resolving against the shared `genotypeDict`. See shared/genotypeCodec.ts.
  featureGenotypeCodes: Map<string, Uint32Array>
  genotypeDict: string[]
  sampleNames: string[]
}

// Canonical sample order for the code arrays: the union of every header sample
// list in the fetch, in first-seen order. Read per feature rather than from the
// first one because SplitVcfTabixAdapter opens a different file, and so a
// different header, per refName. The array is identity-stable per parser, so
// this walks each distinct header once, not once per variant — tracked as a set
// of identities rather than just the previous one, because
// `getFeaturesInMultipleRegions` merges the per-region streams and a view
// spanning two contigs hands back their features interleaved.
//
// Empty for an adapter whose features carry no header sample list at all; that
// path takes its order from the genotype records instead, after the pass.
//
// Exported for the clustering matrix builders, which need the same union for
// the same reason and used to take feature 0's header alone.
export function collectSampleNames(filteredVariants: FilteredVariant[]) {
  const sampleNames: string[] = []
  const seen = new Set<string>()
  const seenHeaders = new Set<string[]>()
  for (let i = 0; i < filteredVariants.length; i++) {
    const names = filteredVariants[i]!.feature.get('sampleNames') as
      | string[]
      | undefined
    if (names !== undefined && !seenHeaders.has(names)) {
      seenHeaders.add(names)
      for (const name of names) {
        if (!seen.has(name)) {
          seen.add(name)
          sampleNames.push(name)
        }
      }
    }
  }
  return sampleNames
}

/**
 * Where each slot of one feature's own header lands in the canonical order, or
 * `undefined` when the two already agree position for position.
 *
 * `processGenotypes` documents `sampleIdx` as "the 0-based position in the
 * header sample list" — the header of the file THAT feature came from. The
 * canonical order is a union across every header in the fetch, so the two are
 * the same list only while every header agrees with the union. That is the case
 * for every adapter with one header, which is every adapter but
 * SplitVcfTabixAdapter, and for split files that all share a sample list.
 *
 * It is not the case for the very thing the union exists to handle: two files
 * whose headers order their samples differently, or where one omits a sample
 * another has (a chrY file called on the male subset, say). Then union position
 * and header position part company after the first difference, and indexing the
 * union by `sampleIdx` silently files each genotype — and each sample's ploidy —
 * against a neighbouring sample. `undefined` for the agreeing case keeps the hot
 * callback's read count unchanged there.
 */
export function buildHeaderRemap(
  names: string[] | undefined,
  columnByName: Map<string, number>,
) {
  if (names === undefined) {
    return undefined
  }
  const out = new Int32Array(names.length)
  let identity = true
  for (let i = 0; i < names.length; i++) {
    const column = columnByName.get(names[i]!) ?? -1
    out[i] = column
    if (column !== i) {
      identity = false
    }
  }
  return identity ? undefined : out
}

/**
 * One pass over the filtered variants that resolves everything the cell loops
 * and the legend need: per-sample ploidy/phasing, the legend flags, the
 * simplified feature list, and each feature's interned genotype codes.
 *
 * The genotypes used to cross this boundary as a `Record<sampleName, genotype>`
 * per feature, built by `@gmod/vcf`'s `GENOTYPES()` and then walked three more
 * times — here for the flags, in each cell loop for the colors, and once more
 * to intern it for transfer. Four traversals and F x S string allocations plus
 * a dictionary-mode object per feature, to reproduce a payload the worker only
 * ever ships as codes. Fusing them onto `processGenotypes`, which reports each
 * genotype as a range into the line, took the analyze+cells stage from 613ms to
 * 168ms on 2504 samples x 400 variants — and the 168ms is the whole stage,
 * including the cell painting the 613ms does not cover.
 *
 * The per-site memo is what removes the last allocation: a site carries a
 * handful of distinct genotypes across thousands of samples, so a linear scan
 * over the ranges already seen at this site answers almost every sample without
 * materializing its substring at all.
 */
export function computeSampleInfo(
  filteredVariants: FilteredVariant[],
  // Genotype records for adapters that cannot report ranges — populated by the
  // filter pass, and the only path that still builds one.
  genotypesCache: Map<string, Record<string, string>>,
  report?: ProgressReporter,
): AnalyzedVariants {
  const sampleInfo: Record<string, SampleInfo> = {}
  let hasPhased = false
  let hasPhasedOrHaploid = false
  let hasSecondaryAlt = false
  let hasUnphased = false
  let hasNoCall = false
  let hasConsequence = false
  let hasPhaseSet = false
  const svTypes = new Set<string>()

  const genotypeDict: string[] = []
  const genotypeDictIndex = new Map<string, number>()
  const featureGenotypeCodes = new Map<string, Uint32Array>()
  const sampleNames = collectSampleNames(filteredVariants)
  const numSamples = sampleNames.length
  const sampleIndexByName = new Map<string, number>()
  for (let i = 0; i < numSamples; i++) {
    sampleIndexByName.set(sampleNames[i]!, i)
  }

  // Per-site memo of the genotype ranges already seen, as parallel arrays so
  // the scan allocates nothing. A hit reuses the interned code AND the
  // classification, so the char walk below runs once per (site, distinct
  // genotype) rather than once per cell. `memoStr` guards an offset from being
  // compared against a different line.
  //
  // `memoKey` is what a probe compares. A genotype of four characters or fewer
  // packs whole into one int — `packGenotypeKey` — so recognizing a repeat is a
  // single int compare instead of walking two ranges character by character.
  // That covers every diploid call an ordinary VCF spells (`0|0`, `0/1`, `./.`,
  // haploid `1`), which is the case worth spending the branch on. A longer
  // genotype — polyploid, or a two-digit allele index at a decomposed
  // multiallelic site — keys 0 and falls back to the range compare, so nothing
  // is capped and nothing collides: key 0 means "not packable", never a
  // genotype, since no ASCII character is 0.
  const memoKey = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoStart = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoLen = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoCode = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPloidy = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPhased = new Uint8Array(SITE_GENOTYPE_MEMO_SIZE)

  // Per-sample ploidy/phasing for the range-reporting path, indexed by canonical
  // column rather than by sample name, and folded into `sampleInfo` once after
  // the pass. The callback already holds the column; going through the name cost
  // a string-keyed lookup on a 2504-property dictionary-mode object per
  // genotype, which is once per cell — 10^8 on a real panel. Ploidy 0 means the
  // column was never reported, which is what keeps a sample with no genotype out
  // of `sampleInfo` exactly as the name-keyed version did.
  const ploidyByColumn = new Int32Array(numSamples)
  const phasedByColumn = new Uint8Array(numSamples)

  // Records to intern once the canonical order is known; only ever populated on
  // the no-header-sample-list path below.
  const pendingRecords: [string, Record<string, string>][] = []

  // The header the last remap was built for, and the remap itself. Held across
  // features because a header array is identity-stable per parser, so a fetch
  // rebuilds this once per file rather than once per variant.
  let lastHeaderNames: string[] | undefined
  let lastHeaderRemap: Int32Array | undefined

  const simplifiedFeatures: SimplifiedVariantFeature[] = new Array(
    filteredVariants.length,
  )
  for (let featureIdx = 0; featureIdx < filteredVariants.length; featureIdx++) {
    report?.(featureIdx)
    const { feature } = filteredVariants[featureIdx]!
    const featureId = feature.id()
    const alt = feature.get('ALT') as string[] | undefined
    if (alt && alt.length > 1) {
      hasSecondaryAlt = true
    }
    if (!hasConsequence && featureHasConsequence(feature)) {
      hasConsequence = true
    }
    if (
      !hasPhaseSet &&
      featureHasPhaseSet(feature.get('FORMAT') as string | undefined)
    ) {
      hasPhaseSet = true
    }
    const svType = getVariantSvType(feature)
    if (svType) {
      svTypes.add(svType)
    }

    if (hasProcessGenotypes(feature) && numSamples > 0) {
      const codes = new Uint32Array(numSamples)
      featureGenotypeCodes.set(featureId, codes)
      // `sampleIdx` counts against this feature's own header; `codes` and
      // `sampleNames` are the canonical union. Rebuilt only when the header
      // array identity changes, so it is one pass per distinct header, and it
      // is `undefined` — the direct-index fast path — whenever the two orders
      // already agree, which is every single-header adapter.
      const headerNames = feature.get('sampleNames') as string[] | undefined
      if (headerNames !== lastHeaderNames) {
        lastHeaderNames = headerNames
        lastHeaderRemap = buildHeaderRemap(headerNames, sampleIndexByName)
      }
      // snapshotted into a const so the hot callback closes over a binding that
      // cannot change under it
      const remap = lastHeaderRemap
      let memoN = 0
      let memoStr: string | undefined
      feature.processGenotypes((str, start, end, sampleIdx) => {
        const column = remap === undefined ? sampleIdx : remap[sampleIdx]!
        // -1 is `buildHeaderRemap` reporting a header sample that is not in the
        // canonical order; the upper bound is the same guard `sampleNames[column]
        // === undefined` used to give.
        if (column < 0 || column >= numSamples) {
          return
        }
        const len = end - start
        if (str !== memoStr) {
          memoStr = str
          memoN = 0
        }
        // Probe the site memo. A packable genotype compares as one int; the
        // rest fall back to the range compare, and are only ever compared
        // against other unpackable entries (`memoKey[m] === 0`), so the two
        // kinds cannot answer for each other.
        const key = packGenotypeKey(str, start, end)
        for (let m = 0; m < memoN; m++) {
          let eq: boolean
          if (key !== 0) {
            eq = memoKey[m] === key
          } else if (memoKey[m] === 0 && memoLen[m] === len) {
            const ms = memoStart[m]!
            eq = true
            for (let k = 0; k < len; k++) {
              if (str.charCodeAt(ms + k) !== str.charCodeAt(start + k)) {
                eq = false
                break
              }
            }
          } else {
            eq = false
          }
          if (eq) {
            codes[column] = memoCode[m]!
            // The legend flags are global ORs already folded in on this
            // genotype's first sighting at this site; only the per-sample
            // ploidy/phasing still has to be recorded.
            if (memoPloidy[m]! > ploidyByColumn[column]!) {
              ploidyByColumn[column] = memoPloidy[m]!
            }
            phasedByColumn[column] ||= memoPhased[m]!
            return
          }
        }

        let ploidy = 1
        let called = false
        let missing = false
        let phased = false
        let unphased = false
        for (let i = start; i < end; i++) {
          const c = str.charCodeAt(i)
          if (c === 124 /* | */) {
            ploidy++
            phased = true
          } else if (c === 47 /* / */) {
            ploidy++
            unphased = true
          } else if (c === 46 /* . */) {
            missing = true
          } else {
            called = true
          }
        }
        hasPhased ||= phased
        hasPhasedOrHaploid ||= called && !unphased
        // A no-call carries a `/` separator but isn't unphased data, so only a
        // genotype with an actual called allele counts toward "Unphased".
        hasUnphased ||= unphased && called
        // Mirror where the renderer actually draws a no-call cell: a phased
        // genotype draws one per missing haplotype allele; an unphased genotype
        // only when it's entirely missing (a partial `0/.` stays
        // black/unphased).
        hasNoCall ||= phased ? missing : !called
        if (ploidy > ploidyByColumn[column]!) {
          ploidyByColumn[column] = ploidy
        }
        if (phased) {
          phasedByColumn[column] = 1
        }

        // An empty range is @gmod/vcf reporting a sample whose colon-separated
        // FORMAT fields stop before GT. It stays code 0 — "no genotype for this
        // sample", which every consumer already skips — matching the falsy ''
        // the record path put there, while still counting toward sampleInfo and
        // the no-call legend entry.
        const code =
          len === 0
            ? 0
            : internGenotype(
                str.slice(start, end),
                genotypeDict,
                genotypeDictIndex,
              )
        if (memoN < SITE_GENOTYPE_MEMO_SIZE) {
          memoKey[memoN] = key
          memoStart[memoN] = start
          memoLen[memoN] = len
          memoCode[memoN] = code
          memoPloidy[memoN] = ploidy
          memoPhased[memoN] = phased ? 1 : 0
          memoN++
        }
        codes[column] = code
      })
    } else {
      // Normalize the sites-only case to {} exactly as computeAlleleCounts
      // does, so the cache never hands a later consumer an undefined.
      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp =
          (feature.get('genotypes') as Record<string, string> | undefined) ?? {}
        genotypesCache.set(featureId, samp)
      }
      for (const key in samp) {
        const val = samp[key]!
        let ploidy = 1
        let called = false
        let missing = false
        let phased = false
        let unphased = false
        for (let i = 0, l = val.length; i < l; i++) {
          const c = val.charCodeAt(i)
          if (c === 124 /* | */) {
            ploidy++
            phased = true
          } else if (c === 47 /* / */) {
            ploidy++
            unphased = true
          } else if (c === 46 /* . */) {
            missing = true
          } else {
            called = true
          }
        }
        hasPhased ||= phased
        hasPhasedOrHaploid ||= called && !unphased
        hasUnphased ||= unphased && called
        hasNoCall ||= phased ? missing : !called
        accumulateSampleInfo(sampleInfo, key, ploidy, phased)
      }
      // Interned below: an adapter with no header sample list gets its
      // canonical order from the records themselves, which are only complete
      // once every feature has been seen.
      pendingRecords.push([featureId, samp])
    }

    simplifiedFeatures[featureIdx] = {
      id: featureId,
      data: {
        start: feature.get('start'),
        end: feature.get('end'),
        refName: feature.get('refName'),
        name: feature.get('name'),
      },
    }
  }

  // Fold the column-indexed ploidy/phasing into `sampleInfo`, through the same
  // merge the record path uses so a fetch mixing the two agrees on max ploidy
  // and "phased if ever phased". Runs before the record block below, which reads
  // `sampleInfo`'s keys to extend the canonical order.
  for (let column = 0; column < numSamples; column++) {
    const ploidy = ploidyByColumn[column]!
    if (ploidy > 0) {
      accumulateSampleInfo(
        sampleInfo,
        sampleNames[column]!,
        ploidy,
        phasedByColumn[column] === 1,
      )
    }
  }

  if (pendingRecords.length > 0) {
    // Record-backed adapters: the sample universe is whatever the records
    // mention, in first-seen order — the order `Object.keys(sampleInfo)` had
    // when this list was derived after the pass rather than before it.
    for (const key in sampleInfo) {
      if (!sampleIndexByName.has(key)) {
        sampleIndexByName.set(key, sampleNames.length)
        sampleNames.push(key)
      }
    }
    const total = sampleNames.length
    for (const [featureId, samp] of pendingRecords) {
      const codes = new Uint32Array(total)
      for (const key in samp) {
        const val = samp[key]!
        const idx = sampleIndexByName.get(key)
        if (idx !== undefined && val !== '') {
          codes[idx] = internGenotype(val, genotypeDict, genotypeDictIndex)
        }
      }
      featureGenotypeCodes.set(featureId, codes)
    }
  }

  return {
    sampleInfo,
    hasPhased,
    hasPhasedOrHaploid,
    hasSecondaryAlt,
    hasUnphased,
    hasNoCall,
    hasConsequence,
    hasPhaseSet,
    svTypeColors: assignSvTypeColors([...svTypes]),
    simplifiedFeatures,
    featureGenotypeCodes,
    genotypeDict,
    sampleNames,
  }
}

// Position of each source's sample in the canonical `sampleNames` order, or -1
// for a source the payload carries no genotypes for. Resolved once per fetch so
// the cell loops index a typed array instead of hashing a sample name per cell.
export function buildSourceSampleIndices(
  sources: { sampleName: string }[],
  sampleNames: string[],
) {
  const byName = new Map<string, number>()
  for (let i = 0; i < sampleNames.length; i++) {
    byName.set(sampleNames[i]!, i)
  }
  const out = new Int32Array(sources.length)
  for (let i = 0; i < sources.length; i++) {
    out[i] = byName.get(sources[i]!.sampleName) ?? -1
  }
  return out
}
