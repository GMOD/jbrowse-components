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

// Canonical sample order for the code arrays: the VCF header order that
// `processGenotypes` reports its `sampleIdx` against. Read per feature rather
// than from the first one because SplitVcfTabixAdapter opens a different file,
// and so a different header, per refName. The array is identity-stable per
// parser, so the union runs once per distinct header, not once per variant.
//
// Empty for an adapter whose features carry no header sample list at all; that
// path takes its order from the genotype records instead, after the pass.
function collectSampleNames(filteredVariants: FilteredVariant[]) {
  const sampleNames: string[] = []
  const seen = new Set<string>()
  let lastNames: string[] | undefined
  for (let i = 0; i < filteredVariants.length; i++) {
    const names = filteredVariants[i]!.feature.get('sampleNames') as
      | string[]
      | undefined
    if (names !== undefined && names !== lastNames) {
      lastNames = names
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
  const memoStart = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoLen = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoCode = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPloidy = new Int32Array(SITE_GENOTYPE_MEMO_SIZE)
  const memoPhased = new Uint8Array(SITE_GENOTYPE_MEMO_SIZE)

  // Records to intern once the canonical order is known; only ever populated on
  // the no-header-sample-list path below.
  const pendingRecords: [string, Record<string, string>][] = []

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
      let memoN = 0
      let memoStr: string | undefined
      feature.processGenotypes((str, start, end, sampleIdx) => {
        const sampleName = sampleNames[sampleIdx]
        if (sampleName === undefined) {
          return
        }
        const len = end - start
        if (str !== memoStr) {
          memoStr = str
          memoN = 0
        }
        for (let m = 0; m < memoN; m++) {
          if (memoLen[m] === len) {
            const ms = memoStart[m]!
            let eq = true
            for (let k = 0; k < len; k++) {
              if (str.charCodeAt(ms + k) !== str.charCodeAt(start + k)) {
                eq = false
                break
              }
            }
            if (eq) {
              codes[sampleIdx] = memoCode[m]!
              // The legend flags are global ORs already folded in on this
              // genotype's first sighting at this site; only the per-sample
              // ploidy/phasing still has to be recorded.
              accumulateSampleInfo(
                sampleInfo,
                sampleName,
                memoPloidy[m]!,
                memoPhased[m] === 1,
              )
              return
            }
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
        // A no-call carries a `/` separator but isn't unphased data, so only a
        // genotype with an actual called allele counts toward "Unphased".
        hasUnphased ||= unphased && called
        // Mirror where the renderer actually draws a no-call cell: a phased
        // genotype draws one per missing haplotype allele; an unphased genotype
        // only when it's entirely missing (a partial `0/.` stays
        // black/unphased).
        hasNoCall ||= phased ? missing : !called
        accumulateSampleInfo(sampleInfo, sampleName, ploidy, phased)

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
          memoStart[memoN] = start
          memoLen[memoN] = len
          memoCode[memoN] = code
          memoPloidy[memoN] = ploidy
          memoPhased[memoN] = phased ? 1 : 0
          memoN++
        }
        codes[sampleIdx] = code
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
