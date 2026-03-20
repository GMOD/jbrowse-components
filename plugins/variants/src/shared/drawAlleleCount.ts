import { colord } from '@jbrowse/core/util/colord'

import {
  ALT_COLOR_HUE,
  ALT_COLOR_SATURATION,
  NO_CALL_COLOR,
  REFERENCE_COLOR,
} from './constants.ts'

export function getAlleleColor(
  genotype: string,
  mostFrequentAlt: string,
  colorCache: Record<string, string | undefined>,
  drawRef: boolean,
) {
  const cacheKey = `${genotype}:${mostFrequentAlt}`
  let c = colorCache[cacheKey]
  if (c === undefined) {
    let alt = 0
    let uncalled = 0
    let alt2 = 0
    let ref = 0

    const alleles =
      genotype.length === 3 &&
      (genotype[1] === '/' || genotype[1] === '|')
        ? [genotype[0]!, genotype[2]!]
        : genotype.split(/[/|]/)
    const total = alleles.length

    for (let i = 0; i < total; i++) {
      const allele = alleles[i]!
      if (allele === mostFrequentAlt) {
        alt++
      } else if (allele === '0') {
        ref++
      } else if (allele === '.') {
        uncalled++
      } else {
        alt2++
      }
    }
    c = getColorAlleleCount(ref, alt, alt2, uncalled, total, drawRef)
    colorCache[cacheKey] = c
  }
  return c
}

export function getColorAlleleCount(
  ref: number,
  alt: number,
  alt2: number,
  uncalled: number,
  total: number,
  drawReference = true,
) {
  if (ref === total) {
    return drawReference ? REFERENCE_COLOR : ''
  }

  if (!(alt || alt2 || uncalled)) {
    return ''
  }

  let a1
  if (alt) {
    const lightness = 80 - (alt / total) * 50
    a1 = colord(`hsl(${ALT_COLOR_HUE},${ALT_COLOR_SATURATION}%,${lightness}%)`)
  }
  if (alt2) {
    const alpha = alt2 / total
    const l = `hsla(0,100%,20%,${alpha})`
    a1 = a1 ? a1.mix(l) : colord(l)
  }
  if (uncalled) {
    const alpha = uncalled / total
    const l = NO_CALL_COLOR.replace(')', `,${alpha})`).replace('hsl', 'hsla')
    a1 = a1 ? a1.mix(l) : colord(l)
  }
  return a1?.toHex() || 'black'
}

