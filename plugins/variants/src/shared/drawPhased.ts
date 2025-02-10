import { set1 } from '@jbrowse/core/ui/colors'

import { f2 } from './constants'
import { colorify } from './util'

function getColorPhased(alleles: string[], HP: number) {
  const c = +alleles[HP]!
  return c ? set1[c - 1] || 'black' : '#ccc'
}

function getColorPhasedWithPhaseSet(alleles: string[], HP: number, PS: string) {
  const c = +alleles[HP]!
  return c ? colorify(+PS) || 'black' : '#ccc'
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
) {
  ctx.fillStyle =
    PS !== undefined
      ? getColorPhasedWithPhaseSet(alleles, HP, PS)
      : getColorPhased(alleles, HP)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}
