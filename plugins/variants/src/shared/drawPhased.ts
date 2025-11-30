import { set1 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { f2 } from './constants'

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
) {
  const allele = +alleles[HP]!
  const c = allele
    ? PS !== undefined
      ? colorify(+PS) || 'black'
      : set1[allele - 1] || 'black'
    : drawReference
      ? '#ccc'
      : undefined
  if (c) {
    ctx.fillStyle = alpha !== 1 ? colord(c).alpha(alpha).toHex() : c
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  return c
}
