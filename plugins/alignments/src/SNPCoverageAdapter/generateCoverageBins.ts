import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util'

// locals
import { getTag, getTagAlt } from '../util'
import {
  parseCigar,
  getNextRefPos,
  getModificationPositions,
  getModificationProbabilities,
  Mismatch,
  getModificationProbabilitiesUnmodified,
} from '../MismatchParser'
import { Bin, SkipMap } from './util'

function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

function isInterbase(type: string) {
  return type === 'softclip' || type === 'hardclip' || type === 'insertion'
}

function inc(bin: any, strand: number, type: string, field: string) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      total: 0,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.total++
  thisBin[strand]++
}

function incWithProbabilities(
  bin: any,
  strand: number,
  type: string,
  field: string,
  probability: number,
) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      total: 0,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.total++
  thisBin.probabilities.push(probability)
  thisBin[strand]++
}

export async function generateCoverageBins({
  features,
  region,
  opts,
}: {
  features: Feature[]
  region: Region
  opts: { bpPerPx?: number; colorBy?: { type: string; tag?: string } }
}) {
  const { colorBy } = opts
  const extendedRegion = {
    ...region,
    start: Math.max(0, region.start - 1),
    end: region.end + 1,
  }
  const binMax = Math.ceil(extendedRegion.end - extendedRegion.start)
  const skipmap = {} as SkipMap
  const bins = [] as Bin[]

  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1
    const mismatches =
      (feature.get('mismatches') as Mismatch[] | undefined) || []

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
        const probabilities = getModificationProbabilities(feature)
        const maxProbModForPosition = [] as {
          mod: string
          prob: number
          totalProb: number
        }[]

        let probIndex = 0
        for (const { type, positions } of modifications) {
          const mod = `mod_${type}`
          for (const { ref, idx } of getNextRefPos(ops, positions)) {
            const idx2 =
              probIndex + (fstrand === -1 ? positions.length - idx : idx)
            const prob = probabilities?.[idx2] || 0
            if (!maxProbModForPosition[ref]) {
              maxProbModForPosition[ref] = { mod, prob, totalProb: prob }
            } else if (maxProbModForPosition[ref].prob < prob) {
              maxProbModForPosition[ref] = {
                mod,
                prob,
                totalProb: maxProbModForPosition[ref].totalProb + prob,
              }
            }
          }
          probIndex += positions.length
        }
        maxProbModForPosition.forEach((entry, pos) => {
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
            if (1 - entry.totalProb < entry.prob) {
              incWithProbabilities(bin, fstrand, 'cov', entry.mod, entry.prob)
            } else {
              incWithProbabilities(bin, fstrand, 'cov', 'mod_NONE', entry.prob)
            }
          }
        })
      }
    }

    // normal SNP based coloring
    const colorSNPs = colorBy?.type !== 'modifications'

    for (const mismatch of mismatches) {
      const mstart = fstart + mismatch.start
      const mlen = mismatchLen(mismatch)
      const mend = mstart + mlen
      for (let j = mstart; j < mstart + mlen; j++) {
        const epos = j - region.start
        if (epos >= 0 && epos < bins.length) {
          const bin = bins[epos]!
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
        // for upper case XS and TS: reports the literal strand of the genomic
        // transcript
        const xs = getTag(feature, 'XS') || getTag(feature, 'TS')
        // for lower case ts from minimap2: genomic transcript flipped by read
        // strand
        const ts = getTag(feature, 'ts')
        const effectiveStrand =
          xs === '+'
            ? 1
            : xs === '-'
              ? -1
              : (ts === '+' ? 1 : xs === '-' ? -1 : 0) * fstrand
        const hash = `${mstart}_${mend}_${effectiveStrand}`
        if (skipmap[hash] === undefined) {
          skipmap[hash] = {
            feature: feature,
            start: mstart,
            end: mend,
            strand: fstrand,
            effectiveStrand,
            score: 0,
          }
        }
        skipmap[hash].score++
      }
    }
  }

  return {
    bins,
    skipmap,
  }
}
