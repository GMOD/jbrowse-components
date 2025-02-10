import { colord } from '@jbrowse/core/util/colord'

import { f2 } from './constants'

function getColorAlleleCount(alleles: string[], mostFrequentAlt: string) {
  const total = alleles.length
  let alt = 0
  let uncalled = 0
  let alt2 = 0
  let ref = 0
  for (const allele of alleles) {
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

  if (ref === total) {
    return `#ccc`
  } else {
    let a1 = colord(`hsl(200,50%,${80 - (alt / total) * 50}%)`)
    if (alt2) {
      // @ts-ignore
      a1 = a1.mix(`hsla(0,100%,20%,${alt2 / total})`)
    }
    if (uncalled) {
      // @ts-ignore
      a1 = a1.mix(`hsla(50,50%,50%,${uncalled / total / 2})`)
    }
    return a1.toHex()
  }
}

export function drawColorAlleleCount(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mostFrequentAlt: string,
) {
  ctx.fillStyle = getColorAlleleCount(alleles, mostFrequentAlt)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}
