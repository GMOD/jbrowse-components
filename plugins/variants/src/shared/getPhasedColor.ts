import { set1 } from '@jbrowse/core/ui/colors'

import { REFERENCE_COLOR, UNPHASED_COLOR } from './constants.ts'

// Fast-path diploid genotype split. The 3-char form "a|b" hits on the vast
// majority of human VCFs; the general split handles polyploid or multi-digit
// allele indices ("10|0").
export function splitPhasedAlleles(genotype: string) {
  return genotype.length === 3
    ? [genotype[0]!, genotype[2]!]
    : genotype.split('|')
}

export function getPhasedColor(
  alleles: string[],
  HP: number,
  mostFrequentAlt: string,
  PS?: string,
  drawReference = true,
) {
  const allele = alleles[HP]!
  if (allele !== '0' && allele !== '.') {
    if (PS !== undefined) {
      // Hash the phase-set id to a hue. Hue is a cyclic 0-360 axis, so the wrap
      // is correct (not a bug) — the old `% 255` just truncated the wheel,
      // never emitting the 255-360 magenta/red arc. The golden-angle multiplier
      // spreads consecutive phase sets far apart instead of by a single degree.
      const ps = +PS
      const hue = Number.isFinite(ps) ? (ps * 137.508) % 360 : 0
      return `hsl(${hue}, 50%, 50%)`
    }
    const colorIdx = allele === mostFrequentAlt ? 0 : 1
    return set1[colorIdx] ?? UNPHASED_COLOR
  }
  return allele === '0' && drawReference ? REFERENCE_COLOR : undefined
}
