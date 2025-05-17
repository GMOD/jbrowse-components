import { set1 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { f2 } from './constants'
import { colorify } from './util'

function getColorPhased(alleles: string[], HP: number, drawReference = true) {
  const c = +alleles[HP]!
  return c ? set1[c - 1] || 'black' : drawReference ? '#ccc' : undefined
}

function getColorPhasedWithPhaseSet(
  alleles: string[],
  HP: number,
  PS: string,
  drawReference = true,
) {
  const c = +alleles[HP]!
  return c ? colorify(+PS) || 'black' : drawReference ? '#ccc' : undefined
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
  const c =
    PS !== undefined
      ? getColorPhasedWithPhaseSet(alleles, HP, PS, drawReference)
      : getColorPhased(alleles, HP, drawReference)
  if (c) {
    ctx.fillStyle = alpha !== 1 ? colord(c).alpha(alpha).toHex() : c
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  return c
}
