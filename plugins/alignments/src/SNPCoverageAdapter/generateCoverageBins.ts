import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { Feature, max, sum } from '@jbrowse/core/util'

// locals
import { getTagAlt } from '../util'
import { parseCigar, getNextRefPos, Mismatch } from '../MismatchParser'
import { getModPositions, getModProbabilities } from '../ModificationParser'
import {
  PreBaseCoverageBin,
  PreBaseCoverageBinSubtypes,
  SkipMap,
} from '../shared/types'

function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

function isInterbase(type: string) {
  return type === 'softclip' || type === 'hardclip' || type === 'insertion'
}

function inc(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      entryDepth: 0,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.entryDepth++
  thisBin[strand]++
}

function incWithProbabilities(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  probability: number,
) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      entryDepth: 0,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.entryDepth++
  thisBin.probabilities.push(probability)
  thisBin[strand]++
}

export async function generateCoverageBins({
  regionSequence = '',
  features,
  region,
  opts,
}: {
  regionSequence: string
  features: Feature[]
  region: Region
  opts: {
    bpPerPx?: number
    colorBy?: {
      type: string
      tag?: string
      extra?: { modifications?: { twoColor: boolean } }
    }
  }
}) {
  const { colorBy } = opts
  const regionLength = region.end - region.start
  const skipmap = {} as SkipMap
  const bins = [] as PreBaseCoverageBin[]

  for (const feature of features) {
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const fstrand = feature.get('strand') as -1 | 0 | 1
    const mismatches =
      (feature.get('mismatches') as Mismatch[] | undefined) ?? []

    for (let j = fstart; j < fend + 1; j++) {
      const i = j - region.start
      if (i >= 0 && i < regionLength) {
        if (bins[i] === undefined) {
          bins[i] = {
            depth: 0,
            readsCounted: 0,
            refbase: regionSequence[i],
            ref: {
              probabilities: [],
              entryDepth: 0,
              '-1': 0,
              0: 0,
              1: 0,
            },
            snps: {},
            mods: {},
            nonmods: {},
            delskips: {},
            noncov: {},
          }
        }
        if (j !== fend) {
          bins[i].depth++
          bins[i].readsCounted++
          bins[i].ref.entryDepth++
          bins[i].ref[fstrand]++
        }
      }
    }

    if (colorBy?.type === 'modifications') {
      const seq = feature.get('seq') as string | undefined
      const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
      const ops = parseCigar(feature.get('CIGAR'))
      const fend = feature.get('end')
      const twoColor = colorBy?.extra?.modifications?.twoColor
      if (seq) {
        const modifications = getModPositions(mm, seq, fstrand)
        const probabilities = getModProbabilities(feature)
        const maxProbModForPosition = [] as {
          mod: string
          prob: number
          allProbs: number[]
        }[]

        let probIndex = 0
        for (const { type, positions } of modifications) {
          const mod = `mod_${type}`
          for (const { ref, idx } of getNextRefPos(ops, positions)) {
            const prob =
              probabilities?.[
                probIndex + (fstrand === -1 ? positions.length - 1 - idx : idx)
              ] || 0
            if (!maxProbModForPosition[ref]) {
              maxProbModForPosition[ref] = {
                mod,
                prob,
                allProbs: [prob],
              }
            } else if (prob > maxProbModForPosition[ref].prob) {
              maxProbModForPosition[ref] = {
                ...maxProbModForPosition[ref],
                prob,
                mod,
              }
            } else {
              maxProbModForPosition[ref].allProbs.push(prob)
            }
          }
          probIndex += positions.length
        }
        maxProbModForPosition.forEach((entry, pos) => {
          const epos = pos + fstart - region.start
          if (epos >= 0 && epos < bins.length && pos + fstart < fend) {
            if (bins[epos] === undefined) {
              bins[epos] = {
                depth: 0,
                readsCounted: 0,
                refbase: regionSequence[epos],
                snps: {},
                ref: {
                  probabilities: [],
                  entryDepth: 0,
                  '-1': 0,
                  0: 0,
                  1: 0,
                },
                mods: {},
                nonmods: {},
                delskips: {},
                noncov: {},
              }
            }

            if (twoColor && 1 - sum(entry.allProbs) > max(entry.allProbs)) {
              incWithProbabilities(
                bins[epos],
                fstrand,
                'nonmods',
                entry.mod,
                1 - sum(entry.allProbs),
              )
            } else {
              incWithProbabilities(
                bins[epos],
                fstrand,
                'mods',
                entry.mod,
                entry.prob,
              )
            }
          }
        })
      }
    }

    // normal SNP based coloring
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
            // bin.ref.entryDepth++
            // bin.ref[fstrand]++
          } else {
            inc(bin, fstrand, 'noncov', type)
          }

          if (type === 'deletion' || type === 'skip') {
            inc(bin, fstrand, 'delskips', type)
            bin.depth--
          } else if (!interbase) {
            inc(bin, fstrand, 'snps', base)
            bin.ref.entryDepth--
            bin.ref[fstrand]--
          }
        }
      }

      if (mismatch.type === 'skip') {
        // for upper case XS and TS: reports the literal strand of the genomic
        // transcript
        const tags = feature.get('tags')
        const xs = tags?.XS || tags?.TS
        // for lower case ts from minimap2: genomic transcript flipped by read
        // strand
        const ts = tags?.ts
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

  for (const bin of bins) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (bin) {
      bin.mods = Object.fromEntries(
        Object.entries(bin.mods).map(([key, val]) => {
          return [
            key,
            {
              ...val,
              avgProbability: sum(val.probabilities) / val.probabilities.length,
            },
          ] as const
        }),
      )
      bin.nonmods = Object.fromEntries(
        Object.entries(bin.nonmods).map(([key, val]) => {
          return [
            key,
            {
              ...val,
              avgProbability: sum(val.probabilities) / val.probabilities.length,
            },
          ] as const
        }),
      )
    }
  }

  return {
    bins,
    skipmap,
  }
}
