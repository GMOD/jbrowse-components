import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'

import {
  alleleBucketCounts,
  calculateAlleleCounts,
  countGenotypeAlleles,
  newAlleleBuckets,
} from '../shared/alleleCounts.ts'
import { buildSampleIndex, internGenotype } from '../shared/genotypeCodec.ts'
import { featureHasPhaseSet } from '../shared/getPhasedColor.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import {
  getFilteredVariants,
  passesSiteThresholds,
  summarizeAlleleCounts,
} from '../shared/minorAlleleFrequencyUtils.ts'
import { featureHasConsequence } from '../shared/variantConsequence.ts'

import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
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

// Distinct genotypes one site memoizes; past this the scan pays the dict Map,
// so the number sizes the fast path and does not bound correctness.
const SITE_GENOTYPE_MEMO_SIZE = 32

// The whole genotype as one int, or 0 when it doesn't fit. No ASCII character
// is 0, so a shorter genotype's zero padding cannot look like a longer one, and
// 0 means "didn't pack". Exported for the test that pins that distinct
// genotypes never collide and everything past four characters declines.
export function packGenotypeKey(str: string, start: number, end: number) {
  const len = end - start
  if (len === 0 || len > 4) {
    return 0
  }
  // `seen` collects the raw code units to reject a non-ASCII character rather
  // than truncate it: a unit above 0xFF would spill out of its byte onto the
  // key of a different genotype, a silently wrong cell.
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

function accumulatePloidy(
  samplePloidy: Record<string, number>,
  key: string,
  ploidy: number,
) {
  const existing = samplePloidy[key]
  if (existing === undefined || ploidy > existing) {
    samplePloidy[key] = ploidy
  }
}

export interface AnalyzedVariants {
  filteredVariants: FilteredVariant[]
  samplePloidy: Record<string, number>
  // Whether any called genotype is phased or haploid data per
  // `isPhasedOrHaploid` in shared/getPhasedColor.ts, i.e. carries no `/`. Not
  // "any `|`": pangenome callsets are haploid per assembly path and write bare
  // `0`/`1`, so the gate has to match the painter. An uncalled genotype (`.`,
  // `.|.`) counts toward neither this nor the legend's "Unphased" entry, since
  // a bare `.` is how many files spell a missing diploid call.
  hasPhasedOrHaploid: boolean
  hasConsequence: boolean
  hasPhaseSet: boolean
  hasSvType: boolean
  // per feature, codes aligned to `sampleNames` (0 = no genotype) against
  // `genotypeDict`; see shared/genotypeCodec.ts
  featureGenotypeCodes: Map<string, Uint32Array>
  genotypeDict: string[]
  sampleNames: string[]
}

// Canonical sample order for the code arrays: the union of every header sample
// list in the fetch, in first-seen order, because SplitVcfTabixAdapter has a
// different header per refName. A set of header identities, not just the
// previous one, because `getFeaturesInMultipleRegions` interleaves the features
// of a view spanning two contigs. Empty when no feature carries a header list;
// that path takes its order from the genotype records after the pass.
// Exported for the clustering matrix builders.
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
 * `processGenotypes` reports `sampleIdx` against the header of the file that
 * feature came from, while the canonical order is the union across the fetch.
 * They differ only for split files whose headers disagree (a different sample
 * order, or a sample one file omits); indexing the union by `sampleIdx` there
 * files each genotype and ploidy against a neighbouring sample. `undefined`
 * keeps the hot callback's read count unchanged in the agreeing case.
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
 * `buildHeaderRemap` for each feature of a fetch, rebuilt only when the header
 * array changes, which is once per file.
 */
export function makeHeaderRemapper(columnByName: Map<string, number>) {
  let lastNames: string[] | undefined
  let lastRemap: Int32Array | undefined
  return (feature: Feature) => {
    const names = feature.get('sampleNames') as string[] | undefined
    if (names !== lastNames) {
      lastNames = names
      lastRemap = buildHeaderRemap(names, columnByName)
    }
    return lastRemap
  }
}

/**
 * The one pass over a fetch's genotypes: the feature filters, per-sample
 * ploidy, the legend flags and each kept feature's interned genotype codes.
 *
 * `processGenotypes` reports each genotype as a range into the line, and a
 * site carries few distinct genotypes across thousands of samples, so a
 * per-site memo of ranges already seen answers most samples without
 * materializing a substring. The memo also counts samples per entry, so the
 * MAF and missingness filters weigh each distinct genotype once.
 *
 * With a MAF or missingness threshold set, `getFilteredVariants`' cheaper count
 * drops rejected sites before the analysis walks the rest.
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
  const samplePloidy: Record<string, number> = {}
  let hasPhasedOrHaploid = false
  let hasConsequence = false
  let hasPhaseSet = false
  let hasSvType = false

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
  const sampleIndexByName = buildSampleIndex(sampleNames)
  const headerRemapOf = makeHeaderRemapper(sampleIndexByName)

  // Per-site memo of genotype ranges already seen, as parallel arrays so the
  // scan allocates nothing. `memoKey` is the packed genotype
  // (`packGenotypeKey`); a longer genotype keys 0 and compares by range.
  const memoKey = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoStart = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoLen = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoCode = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPloidy = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoCount = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)

  // Ploidy 0 means the column was never reported, which keeps a sample with no
  // genotype out of `samplePloidy`.
  const ploidyByColumn = new Int32Array(numSamples)

  // only populated on the no-header-sample-list path
  const pendingRecords: [string, Record<string, string>][] = []

  // a dropped site's codes, zeroed for the next site to fill
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
      // `sampleIdx` counts against the feature's own header, `codes` against
      // the canonical union (see `buildHeaderRemap`)
      const remap = headerRemapOf(feature)
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
            return
          }
        }

        let ploidy = 1
        let called = false
        let unphased = false
        for (let i = start; i < end; i++) {
          const c = str.charCodeAt(i)
          if (c === 124 /* | */) {
            ploidy++
          } else if (c === 47 /* / */) {
            ploidy++
            unphased = true
          } else if (c !== 46 /* . */) {
            called = true
          }
        }
        hasPhasedOrHaploid ||= called && !unphased
        if (ploidy > ploidyByColumn[column]!) {
          ploidyByColumn[column] = ploidy
        }

        // an empty range is a sample whose FORMAT fields stop before GT: code
        // 0, counted as one no-call allele
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
        let unphased = false
        for (let i = 0, l = val.length; i < l; i++) {
          const c = val.charCodeAt(i)
          if (c === 124 /* | */) {
            ploidy++
          } else if (c === 47 /* / */) {
            ploidy++
            unphased = true
          } else if (c !== 46 /* . */) {
            called = true
          }
        }
        hasPhasedOrHaploid ||= called && !unphased
        accumulatePloidy(samplePloidy, key, ploidy)
      }
      alleleCounts = calculateAlleleCounts(record)
    }

    const summary = summarizeAlleleCounts(alleleCounts)
    const { mostFrequentAlt } = summary
    if (
      passesSiteThresholds(summary, {
        minorAlleleFrequencyFilter,
        maxMissingnessFilter,
      })
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
      hasSvType ||= !!feature.get(SV_TYPE_FIELD)
    } else if (codes) {
      codes.fill(0)
      spareCodes = codes
    }
  }

  // Runs before the record block below, which reads `samplePloidy`'s keys to
  // extend the canonical order.
  for (let column = 0; column < numSamples; column++) {
    const ploidy = ploidyByColumn[column]!
    if (ploidy > 0) {
      accumulatePloidy(samplePloidy, sampleNames[column]!, ploidy)
    }
  }

  if (pendingRecords.length > 0) {
    // record-backed adapters: the samples are whatever the records mention
    for (const key in samplePloidy) {
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
    samplePloidy,
    hasPhasedOrHaploid,
    hasConsequence,
    hasPhaseSet,
    hasSvType,
    featureGenotypeCodes,
    genotypeDict,
    sampleNames,
  }
}

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

// -1 for a source the payload carries no genotypes for; the cell loops index
// this typed array rather than hashing a sample name per cell
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
