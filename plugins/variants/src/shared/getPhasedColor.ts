import { set1 } from '@jbrowse/core/ui/colors'

import { REFERENCE_COLOR, UNPHASED_COLOR } from './constants.ts'

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
      return `hsl(${+PS % 255}, 50%, 50%)`
    }
    const colorIdx = allele === mostFrequentAlt ? 0 : 1
    return set1[colorIdx] ?? UNPHASED_COLOR
  }
  return allele === '0' && drawReference ? REFERENCE_COLOR : undefined
}
