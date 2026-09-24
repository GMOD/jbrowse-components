import {
  alleleBucketCounts,
  calculateAlleleCounts,
  countGenotypeAlleles,
  newAlleleBuckets,
} from '../shared/alleleCounts.ts'
import { internGenotype } from '../shared/genotypeCodec.ts'
import { featureHasPhaseSet } from '../shared/getPhasedColor.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import {
  getFilteredVariants,
  summarizeAlleleCounts,
} from '../shared/minorAlleleFrequencyUtils.ts'
import { featureHasConsequence } from '../shared/variantConsequence.ts'
import {
  NON_SV_TYPE,
  assignSvTypeColors,
  getVariantSvType,
} from '../shared/variantSvType.ts'

import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type { SampleInfo } from '../shared/types.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

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
  // The features the filters kept, each with its most frequent alt allele
  filteredVariants: FilteredVariant[]
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
  // neither this nor the legend's "Unphased" entry, which the paint loops raise
  // only for a cell they actually drew black. A bare `.` is how plenty of files
  // spell a missing diploid call, and treating that as haploid evidence would
  // offer the mode on any unphased callset with a hole in it.
  hasPhasedOrHaploid: boolean
  hasConsequence: boolean
  hasPhaseSet: boolean
  // Whether any visible record has a structural class, which gates the "Color
  // by...→SV type" entry. Not `svTypeColors` being non-empty: that map now
  // carries the scale's NON_SV_TYPE member too, so a callset of plain SNVs
  // fills it.
  hasSvType: boolean
  svTypeColors: Record<string, string>
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
export function collectSampleNames(features: Feature[]) {
  const sampleNames: string[] = []
  const seen = new Set<string>()
  const seenHeaders = new Set<string[]>()
  for (let i = 0; i < features.length; i++) {
    const names = features[i]!.get('sampleNames') as string[] | undefined
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
 * The union exists for split files whose headers disagree: two files that order
 * their samples differently, or where one omits a sample another has (a chrY
 * file called on the male subset, say). There union position and header position
 * diverge after the first difference, and indexing the union by `sampleIdx`
 * files each genotype, and each sample's ploidy, against a neighbouring sample,
 * which then draws the wrong sample's calls. `undefined` for the agreeing case
 * keeps the hot callback's read count unchanged there.
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
 * The one pass over a fetch's genotypes: the feature filters, and everything
 * the cell loops and the legend need — per-sample ploidy/phasing, the legend
 * flags and each kept feature's interned genotype codes.
 *
 * `processGenotypes` reports each genotype as a range into the line, and a
 * site carries a handful of distinct genotypes across thousands of samples, so
 * a per-site memo of the ranges already seen answers almost every sample
 * without materializing its substring. The memo also counts how many samples
 * carry each entry, which is all the MAF and missingness filters need: their
 * allele counts come from each distinct genotype once, weighted by its count,
 * rather than from a second scan of every line.
 *
 * With a MAF or missingness threshold set, `getFilteredVariants`' cheaper
 * count drops the sites it rejects first: the analysis costs more per cell than
 * the count does, and a threshold typically keeps a small fraction of a
 * window. Ploidy and phasing fold in from the sites the analysis walks.
 */
export function analyzeVariants({
  features,
  minorAlleleFrequencyFilter = 0,
  maxMissingnessFilter = 1,
  filterChain,
  report,
}: {
  features: Feature[]
  minorAlleleFrequencyFilter?: number
  maxMissingnessFilter?: number
  filterChain?: SerializableFilterChain
  report?: ProgressReporter
}): AnalyzedVariants {
  const sampleInfo: Record<string, SampleInfo> = {}
  let hasPhased = false
  let hasPhasedOrHaploid = false
  let hasConsequence = false
  let hasPhaseSet = false
  let hasSvType = false
  const svTypes = new Set<string>()

  // With a threshold set, a cheaper counting pass drops what it rejects before
  // the analysis walks the rest; unset, the analysis is the only pass.
  const passing =
    minorAlleleFrequencyFilter > 0 || maxMissingnessFilter < 1
      ? getFilteredVariants({
          features,
          minorAlleleFrequencyFilter,
          maxMissingnessFilter,
          filterChain,
        }).map(v => v.feature)
      : filterChain
        ? features.filter(f => filterChain.passes(f))
        : features
  const filteredVariants: FilteredVariant[] = []
  const genotypeDict: string[] = []
  const genotypeDictIndex = new Map<string, number>()
  const featureGenotypeCodes = new Map<string, Uint32Array>()
  const sampleNames = collectSampleNames(passing)
  const numSamples = sampleNames.length
  const sampleIndexByName = new Map<string, number>()
  for (let i = 0; i < numSamples; i++) {
    sampleIndexByName.set(sampleNames[i]!, i)
  }

  // Per-site memo of the genotype ranges already seen, as parallel arrays so
  // the scan allocates nothing. A hit reuses the interned code and the
  // classification, so the char walk runs once per (site, distinct genotype)
  // rather than once per cell, and bumps the entry's sample count.
  //
  // `memoKey` is what a probe compares: a genotype of four characters or fewer
  // packs whole into one int (`packGenotypeKey`), and a longer one keys 0 and
  // falls back to the range compare.
  const memoKey = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoStart = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoLen = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoCode = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPloidy = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPhased = new Uint8Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoCount = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)

  // Per-sample ploidy/phasing, indexed by canonical column and folded into
  // `sampleInfo` once after the pass. Ploidy 0 means the column was never
  // reported, which keeps a sample with no genotype out of `sampleInfo`.
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

  // A dropped site's codes, zeroed for the next site to fill
  let spareCodes: Uint32Array | undefined

  for (let featureIdx = 0; featureIdx < passing.length; featureIdx++) {
    report?.(featureIdx)
    const feature = passing[featureIdx]!
    let codes: Uint32Array | undefined
    let record: Record<string, string> | undefined
    let alleleCounts: Record<string, number>

    if (hasProcessGenotypes(feature) && numSamples > 0) {
      const siteCodes = spareCodes ?? new Uint32Array(numSamples)
      spareCodes = undefined
      codes = siteCodes
      // `sampleIdx` counts against this feature's own header; `codes` and
      // `sampleNames` are the canonical union (see `buildHeaderRemap`).
      const headerNames = feature.get('sampleNames') as string[] | undefined
      if (headerNames !== lastHeaderNames) {
        lastHeaderNames = headerNames
        lastHeaderRemap = buildHeaderRemap(headerNames, sampleIndexByName)
      }
      const remap = lastHeaderRemap
      // genotypes past a full memo are counted as they come
      const overflow = newAlleleBuckets()
      let memoN = 0
      let memoStr = ''
      feature.processGenotypes((str, start, end, sampleIdx) => {
        const column = remap === undefined ? sampleIdx : remap[sampleIdx]!
        if (column < 0 || column >= numSamples) {
          return
        }
        const len = end - start
        // memo offsets index one string; a new one flushes what they counted
        if (str !== memoStr) {
          for (let m = 0; m < memoN; m++) {
            countGenotypeAlleles(
              memoStr,
              memoStart[m]!,
              memoStart[m]! + memoLen[m]!,
              memoCount[m]!,
              overflow,
            )
          }
          memoStr = str
          memoN = 0
        }
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
            siteCodes[column] = memoCode[m]!
            memoCount[m]!++
            if (memoPloidy[m]! > ploidyByColumn[column]!) {
              ploidyByColumn[column] = memoPloidy[m]!
            }
            phasedByColumn[column] ||= memoPhased[m]!
            return
          }
        }

        let ploidy = 1
        let called = false
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
          } else if (c !== 46 /* . */) {
            called = true
          }
        }
        hasPhased ||= phased
        hasPhasedOrHaploid ||= called && !unphased
        if (ploidy > ploidyByColumn[column]!) {
          ploidyByColumn[column] = ploidy
        }
        if (phased) {
          phasedByColumn[column] = 1
        }

        // An empty range is a sample whose colon-separated FORMAT fields stop
        // before GT: code 0, "no genotype", counted as one no-call allele.
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
          memoCount[memoN] = 1
          memoN++
        } else {
          countGenotypeAlleles(str, start, end, 1, overflow)
        }
        siteCodes[column] = code
      })
      for (let m = 0; m < memoN; m++) {
        countGenotypeAlleles(
          memoStr,
          memoStart[m]!,
          memoStart[m]! + memoLen[m]!,
          memoCount[m]!,
          overflow,
        )
      }
      alleleCounts = alleleBucketCounts(overflow)
    } else {
      // A sites-only VCF has no genotypes field at all
      record =
        (feature.get('genotypes') as Record<string, string> | undefined) ?? {}
      for (const key in record) {
        const val = record[key]!
        let ploidy = 1
        let called = false
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
          } else if (c !== 46 /* . */) {
            called = true
          }
        }
        hasPhased ||= phased
        hasPhasedOrHaploid ||= called && !unphased
        accumulateSampleInfo(sampleInfo, key, ploidy, phased)
      }
      alleleCounts = calculateAlleleCounts(record)
    }

    const {
      minorAlleleFrequency,
      missingness,
      mostFrequentAlt,
      calledAlleleCount,
    } = summarizeAlleleCounts(alleleCounts)
    // A site with no called allele anywhere has no cell to draw, so it drops
    // regardless of the thresholds. A monomorphic site does *not*: with the
    // filters off it is a real row of the file.
    if (
      calledAlleleCount > 0 &&
      minorAlleleFrequency >= minorAlleleFrequencyFilter &&
      missingness <= maxMissingnessFilter
    ) {
      const featureId = feature.id()
      filteredVariants.push({ feature, mostFrequentAlt })
      if (codes) {
        featureGenotypeCodes.set(featureId, codes)
      } else if (record) {
        pendingRecords.push([featureId, record])
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
      svTypes.add(svType || NON_SV_TYPE)
      hasSvType ||= !!svType
    } else if (codes) {
      codes.fill(0)
      spareCodes = codes
    }
  }

  // Fold the column-indexed ploidy/phasing into `sampleInfo`, through the same
  // merge the record path uses so a fetch mixing the two agrees. Runs before
  // the record block below, which reads `sampleInfo`'s keys to extend the
  // canonical order.
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
    // mention, in first-seen order.
    for (const key in sampleInfo) {
      if (!sampleIndexByName.has(key)) {
        sampleIndexByName.set(key, sampleNames.length)
        sampleNames.push(key)
      }
    }
    const total = sampleNames.length
    for (const [featureId, samp] of pendingRecords) {
      const recordCodes = new Uint32Array(total)
      for (const key in samp) {
        const val = samp[key]!
        const idx = sampleIndexByName.get(key)
        if (idx !== undefined && val !== '') {
          recordCodes[idx] = internGenotype(
            val,
            genotypeDict,
            genotypeDictIndex,
          )
        }
      }
      featureGenotypeCodes.set(featureId, recordCodes)
    }
  }

  return {
    filteredVariants,
    sampleInfo,
    hasPhased,
    hasPhasedOrHaploid,
    hasConsequence,
    hasPhaseSet,
    hasSvType,
    svTypeColors: assignSvTypeColors([...svTypes]),
    featureGenotypeCodes,
    genotypeDict,
    sampleNames,
  }
}

/**
 * The positional fields the main thread needs of each kept variant, in the
 * order it lists them.
 */
export function simplifyFeatures(
  filteredVariants: FilteredVariant[],
): SimplifiedVariantFeature[] {
  return filteredVariants.map(({ feature }) => ({
    id: feature.id(),
    data: {
      start: feature.get('start'),
      end: feature.get('end'),
      refName: feature.get('refName'),
      name: feature.get('name'),
    },
  }))
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
