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
    let a1
    if (alt) {
      a1 = colord(`hsl(200,50%,${80 - (alt / total) * 50}%)`)
    }
    if (alt2) {
      const l = `hsla(0,100%,20%,${alt2 / total})`
      // @ts-ignore
      a1 = a1 ? a1.mix(l) : colord(l)
    }
    if (uncalled) {
      const l = `hsl(50,50%,50%,${uncalled / total})`
      // @ts-ignore
      a1 = a1 ? a1.mix(l) : colord(l)
    }
    return a1?.toHex() || 'black'
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
