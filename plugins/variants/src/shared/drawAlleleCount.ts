import { colord } from '@jbrowse/core/util/colord'

import { f2 } from './constants'

export function getAlleleColor(
  genotype: string,
  mostFrequentAlt: string,
  colorCache: Record<string, string | undefined>,
  splitCache: Record<string, string[]>,
  drawRef: boolean,
) {
  const cacheKey = `${genotype}:${mostFrequentAlt}`
  let c = colorCache[cacheKey]
  if (c === undefined) {
    let alt = 0
    let uncalled = 0
    let alt2 = 0
    let ref = 0
    const alleles = splitCache[genotype] ?? (splitCache[genotype] = genotype.split(/[/|]/))
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
    return drawReference ? '#ccc' : ''
  }

  if (!(alt || alt2 || uncalled)) {
    return ''
  }

  let a1
  if (alt) {
    const lightness = 80 - (alt / total) * 50
    a1 = colord(`hsl(200,50%,${lightness}%)`)
  }
  if (alt2) {
    const alpha = alt2 / total
    const l = `hsla(0,100%,20%,${alpha})`
    a1 = a1 ? a1.mix(l) : colord(l)
  }
  if (uncalled) {
    const alpha = uncalled / total
    const l = `hsl(50,50%,50%,${alpha})`
    a1 = a1 ? a1.mix(l) : colord(l)
  }
  return a1?.toHex() || 'black'
}

export function drawColorAlleleCount(
  c: string,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  featureType = '',
  featureStrand?: number,
  alpha = 1,
) {
  ctx.fillStyle = alpha !== 1 ? colord(c).alpha(alpha).toHex() : c
  if (featureType === 'inversion') {
    if (featureStrand === 1) {
      ctx.beginPath()
      ctx.moveTo(x - f2, y - f2)
      ctx.lineTo(x - f2, y + h + f2)
      ctx.lineTo(x + w + f2, y + h / 2)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(x + w + f2, y - f2)
      ctx.lineTo(x + w + f2, y + h + f2)
      ctx.lineTo(x - f2, y + h / 2)
      ctx.closePath()
      ctx.fill()
    }
  } else {
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
}
