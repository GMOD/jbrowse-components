import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { getTag, getTagAlt, shouldFetchReferenceSequence } from '../util'
import {
  parseCigar,
  getNextRefPos,
  getModificationPositions,
  getMethBins,
  Mismatch,
} from '../MismatchParser'
import { doesIntersect2 } from '@jbrowse/core/util'
import { Bin, SkipMap } from './util'

function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

function isInterbase(type: string) {
  return type === 'softclip' || type === 'hardclip' || type === 'insertion'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inc(bin: any, strand: number, type: string, field: string) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      total: 0,
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.total++
  thisBin[strand]++
}

export default async function generateCoverageBins(
  features: Feature[],
  region: Region,
  opts: { bpPerPx?: number; colorBy?: { type: string; tag?: string } },
  fetchSequence: (arg: Region) => Promise<string>,
) {
  const { colorBy } = opts
  const extendedRegion = {
    ...region,
    start: Math.max(0, region.start - 1),
    end: region.end + 1,
  }
  const binMax = Math.ceil(extendedRegion.end - extendedRegion.start)
  const skipmap = {} as SkipMap
  const regionSequence =
    features.length && shouldFetchReferenceSequence(opts.colorBy?.type)
      ? await fetchSequence(region)
      : undefined

  const bins = [] as Bin[]

  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1
    const mismatches = (feature.get('mismatches') as Mismatch[]) || []

    for (let j = fstart; j < fend + 1; j++) {
      const i = j - region.start
      if (i >= 0 && i < binMax) {
        if (bins[i] === undefined) {
          bins[i] = {
            total: 0,
            all: 0,
            ref: 0,
            '-1': 0,
            '0': 0,
            '1': 0,
            lowqual: {},
            cov: {},
            delskips: {},
            noncov: {},
          }
        }
        if (j !== fend) {
          bins[i].total++
          bins[i].all++
          bins[i].ref++
          bins[i][fstrand]++
        }
      }
    }

    if (colorBy?.type === 'modifications') {
      const seq = feature.get('seq') as string | undefined
      const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
      const ops = parseCigar(feature.get('CIGAR'))
      const fend = feature.get('end')
      if (seq) {
        const modifications = getModificationPositions(mm, seq, fstrand)
        for (const { type, positions } of modifications) {
          const mod = `mod_${type}`
          for (const pos of getNextRefPos(ops, positions)) {
            const epos = pos + fstart - region.start
            if (epos >= 0 && epos < bins.length && pos + fstart < fend) {
              if (bins[epos] === undefined) {
                bins[epos] = {
                  total: 0,
                  all: 0,
                  ref: 0,
                  '-1': 0,
                  '0': 0,
                  '1': 0,
                  lowqual: {},
                  cov: {},
                  delskips: {},
                  noncov: {},
                }
              }
              const bin = bins[epos]
              if (bin) {
                inc(bin, fstrand, 'cov', mod)
              } else {
                console.warn(
                  'Undefined position in modifications snpcoverage encountered',
                )
              }
            }
          }
        }
      }
    }

    if (colorBy?.type === 'methylation') {
      if (!regionSequence) {
        throw new Error(
          'no region sequence detected, need sequenceAdapter configuration',
        )
      }
      const seq = feature.get('seq') as string | undefined
      if (!seq) {
        continue
      }
      const { methBins, methProbs } = getMethBins(feature)
      const dels = mismatches.filter(f => f.type === 'deletion')

      // methylation based coloring takes into account both reference sequence
      // CpG detection and reads
      for (let i = 0; i < fend - fstart; i++) {
        const j = i + fstart
        const l1 = regionSequence[j - region.start + 1]?.toLowerCase()
        const l2 = regionSequence[j - region.start + 2]?.toLowerCase()
        if (l1 === 'c' && l2 === 'g') {
          const bin0 = bins[j - region.start]
          const bin1 = bins[j - region.start + 1]
          const b0 = methBins[i]
          const b1 = methBins[i + 1]
          const p0 = methProbs[i]
          const p1 = methProbs[i + 1]

          // color
          if (
            (b0 && (p0 !== undefined ? p0 > 0.5 : true)) ||
            (b1 && (p1 !== undefined ? p1 > 0.5 : true))
          ) {
            if (bin0) {
              inc(bin0, fstrand, 'cov', 'meth')
              bin0.ref--
              bin0[fstrand]--
            }
            if (bin1) {
              inc(bin1, fstrand, 'cov', 'meth')
              bin1.ref--
              bin1[fstrand]--
            }
          } else {
            if (bin0) {
              if (
                !dels?.some(d =>
                  doesIntersect2(
                    j,
                    j + 1,
                    d.start + fstart,
                    d.start + fstart + d.length,
                  ),
                )
              ) {
                inc(bin0, fstrand, 'cov', 'unmeth')
                bin0.ref--
                bin0[fstrand]
              }
            }
            if (bin1) {
              if (
                !dels?.some(d =>
                  doesIntersect2(
                    j + 1,
                    j + 2,
                    d.start + fstart,
                    d.start + fstart + d.length,
                  ),
                )
              ) {
                inc(bin1, fstrand, 'cov', 'unmeth')
                bin1.ref--
                bin1[fstrand]--
              }
            }
          }
        }
      }
    }

    // normal SNP based coloring
    const colorSNPs =
      colorBy?.type !== 'modifications' && colorBy?.type !== 'methylation'

    for (const mismatch of mismatches) {
      const mstart = fstart + mismatch.start
      const mlen = mismatchLen(mismatch)
      const mend = mstart + mlen
      for (let j = mstart; j < mstart + mlen; j++) {
        const epos = j - region.start
        if (epos >= 0 && epos < bins.length) {
          const bin = bins[epos]
          const { base, type } = mismatch
          const interbase = isInterbase(type)
          if (!interbase) {
            bin.ref--
            bin[fstrand]--
          } else {
            inc(bin, fstrand, 'noncov', type)
          }

          if (type === 'deletion' || type === 'skip') {
            inc(bin, fstrand, 'delskips', type)
            bin.total--
          } else if (!interbase && colorSNPs) {
            inc(bin, fstrand, 'cov', base)
            bin.refbase = mismatch.altbase
          }
        }
      }

      if (mismatch.type === 'skip') {
        const hash = `${mstart}_${mend}_${fstrand}`
        if (skipmap[hash] === undefined) {
          skipmap[hash] = {
            feature: feature,
            start: mstart,
            end: mend,
            strand: fstrand,
            xs: getTag(feature, 'XS') || getTag(feature, 'TS'),
            score: 0,
          }
        }
        skipmap[hash].score++
      }
    }
  }

  return { bins, skipmap }
}
