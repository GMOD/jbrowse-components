import { Feature, revcom } from '@jbrowse/core/util'
import { getTagAlt } from '../util'
import { getNextRefPos } from '../MismatchParser'

const modificationRegex = new RegExp(/([A-Z])([-+])([^,.?]+)([.?])?/)

export function getModProbabilities(feature: Feature) {
  const m = (getTagAlt(feature, 'ML', 'Ml') as number[] | string) || []
  return m
    ? (typeof m === 'string' ? m.split(',').map(e => +e) : m).map(e => e / 255)
    : (getTagAlt(feature, 'MP', 'Mp') as string | undefined)
        ?.split('')
        .map(s => s.charCodeAt(0) - 33)
        .map(elt => Math.min(1, elt / 50))
}

export function getModPositions(mm: string, fseq: string, fstrand: number) {
  const seq = fstrand === -1 ? revcom(fseq) : fseq
  const mods = mm.split(';').filter(mod => !!mod)
  const result = []
  for (const mod of mods) {
    const [basemod, ...skips] = mod.split(',')

    // regexes based on parse_mm.pl from hts-specs
    // https://github.com/samtools/hts-specs/blob/master/test/SAMtags/parse_mm.pl
    const matches = modificationRegex.exec(basemod!)
    if (!matches) {
      throw new Error('bad format for MM tag')
    }
    const [, base, strand, typestr] = matches

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so split,
    // and they can also be chemical codes (ChEBI) e.g. C+16061
    const types = typestr!.split(/(\d+|.)/).filter(f => !!f)

    if (strand === '-') {
      console.warn('unsupported negative strand modifications')
      result.push({
        type: 'unsupported',
        positions: [] as number[],
        base: base!,
        strand: strand,
      })
    }

    // this logic based on parse_mm.pl from hts-specs
    for (const type of types) {
      let i = 0
      const positions = []
      for (const d of skips) {
        let delta = +d
        do {
          if (base === 'N' || base === seq[i]) {
            delta--
          }
          i++
        } while (delta >= 0 && i < seq.length)
        if (fstrand === -1) {
          const pos = seq.length - i
          if (pos >= 0) {
            // avoid negative-number-positions in array, seen in #4629 cause
            // unknown, could warrant some further investigation
            positions.unshift(pos)
          }
        } else {
          positions.push(i - 1)
        }
      }

      result.push({
        type,
        base: base!,
        strand: strand!,
        positions,
      })
    }
  }
  return result
}

export function getModTypes(mm: string) {
  return mm
    .split(';')
    .filter(mod => !!mod)
    .flatMap(mod => {
      const basemod = mod.split(',')[0]!

      const matches = modificationRegex.exec(basemod)
      if (!matches) {
        throw new Error('bad format for MM tag')
      }
      const [, base, strand, typestr] = matches
      // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so
      // split, and they can also be chemical codes (ChEBI) e.g. C+16061
      return typestr!
        .split(/(\d+|.)/)
        .filter(f => !!f)
        .map(type => ({
          type,
          base: base!,
          strand: strand!,
        }))
    })
}

export function getMethBins(feature: Feature, cigarOps: string[]) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const flen = fend - fstart
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string | undefined) || ''
  const methBins = []
  const methProbs = []
  const seq = feature.get('seq') as string | undefined
  if (seq) {
    const probabilities = getModProbabilities(feature)
    const modifications = getModPositions(mm, seq, fstrand)
    let probIndex = 0
    for (const { type, positions } of modifications) {
      for (const { ref, idx } of getNextRefPos(cigarOps, positions)) {
        const prob =
          probabilities?.[
            probIndex + (fstrand === -1 ? positions.length - 1 - idx : idx)
          ] || 0
        probIndex++
        if (type === 'm') {
          if (ref >= 0 && ref < flen) {
            methBins[ref] = 1
            methProbs[ref] = prob
          }
        }
      }
    }
  }
  return { methBins, methProbs }
}
