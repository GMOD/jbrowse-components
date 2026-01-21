import { set1 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { REFERENCE_COLOR, UNPHASED_COLOR, f2 } from './constants.ts'

function colorify(n: number) {
  return `hsl(${n % 255}, 50%, 50%)`
}

export function drawPhased(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  HP: number,
  PS?: string,
  drawReference = true,
  alpha = 1,
  featureType = '',
  featureStrand?: number,
) {
  const allele = +alleles[HP]!
  const c = allele
    ? PS !== undefined
      ? colorify(+PS) || UNPHASED_COLOR
      : set1[allele - 1] || UNPHASED_COLOR
    : drawReference
      ? REFERENCE_COLOR
      : undefined
  if (c) {
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
  return c
}
