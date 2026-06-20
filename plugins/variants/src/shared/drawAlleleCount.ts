import { colord } from '@jbrowse/core/util/colord'

import {
  ALT_COLOR_HUE,
  ALT_COLOR_SATURATION,
  GENOTYPE_SPLITTER,
  NO_CALL_COLOR,
  REFERENCE_COLOR,
} from './constants.ts'

export function getAlleleColor(
  genotype: string,
  mostFrequentAlt: string,
  colorCache: Record<string, string | undefined>,
  drawRef = true,
) {
  const cacheKey = `${genotype}:${mostFrequentAlt}`
  let c = colorCache[cacheKey]
  if (c === undefined) {
    let alt = 0
    let uncalled = 0
    let alt2 = 0
    let ref = 0

    const alleles =
      genotype.length === 3 && (genotype[1] === '/' || genotype[1] === '|')
        ? [genotype[0]!, genotype[2]!]
        : genotype.split(GENOTYPE_SPLITTER)
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

// Per-cell allele-count color from a packed int8 callGenotype slice. Tallies
// the ploidy alleles at `offset` (-2 = ploidy padding, skipped) and resolves a
// color via `getColorAlleleCount`, memoized on the packed counts in `cache`.
// Returns undefined when the sample has no called alleles (caller skips the
// cell); an empty string from `getColorAlleleCount` means "drawn ref omitted"
// and is likewise falsy. Shared by the regular + matrix cell computations.
export function getRawAlleleCountColor(
  callGt: Int8Array,
  offset: number,
  ploidy: number,
  mostFreqAltInt: number,
  drawReference: boolean,
  cache: Map<number, string>,
): string | undefined {
  let refCount = 0
  let altCount = 0
  let alt2Count = 0
  let uncalled = 0
  let total = 0
  for (let pi = 0; pi < ploidy; pi++) {
    const a = callGt[offset + pi]!
    if (a === -2) {
      continue
    }
    total++
    if (a === 0) {
      refCount++
    } else if (a === -1) {
      uncalled++
    } else if (a === mostFreqAltInt) {
      altCount++
    } else {
      alt2Count++
    }
  }
  if (total === 0) {
    return undefined
  }
  const colorKey =
    refCount | (altCount << 8) | (alt2Count << 16) | (uncalled << 24)
  let c = cache.get(colorKey)
  if (c === undefined) {
    c = getColorAlleleCount(
      refCount,
      altCount,
      alt2Count,
      uncalled,
      total,
      drawReference,
    )
    cache.set(colorKey, c)
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
  return a1?.toHex() ?? 'black'
}
