import { revcom } from '@jbrowse/core/util'

import { modificationRegex } from './consts'

export function getModPositions(mm: string, fseq: string, fstrand: number) {
  const seq = fstrand === -1 ? revcom(fseq) : fseq
  const mods = mm.split(';')
  const result = []
  for (const mod of mods) {
    // Empty string
    if (mod === '') {
      continue
    }

    const split = mod.split(',')
    const basemod = split[0]!
    const matches = modificationRegex.exec(basemod)
    if (!matches) {
      throw new Error(`bad format for MM tag: "${mod}"`)
    }
    const [, base, strand, typestr] = matches

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so split,
    // and they can also be chemical codes (ChEBI) e.g. C+16061
    const types = typestr!.split(/(\d+|.)/)

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
      if (type === '') {
        continue
      }
      let currPos = 0
      const positions = []
      for (let i = 1, l = split.length; i < l; i++) {
        let delta = +split[i]!
        do {
          if (base === 'N' || base === seq[currPos]) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < seq.length)
        if (fstrand === -1) {
          const pos = seq.length - currPos
          if (pos >= 0) {
            // avoid negative-number-positions in array, seen in #4629 cause
            // unknown, could warrant some further investigation
            positions.unshift(pos)
          }
        } else {
          positions.push(currPos - 1)
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
