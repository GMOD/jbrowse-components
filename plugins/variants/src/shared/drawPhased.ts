import { set1 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { f2 } from './constants'
import { colorify } from './util'

function getColorPhased(allele: string, drawReference: boolean) {
  const c = +allele
  return c ? set1[c - 1] || 'black' : drawReference ? '#ccc' : undefined
}

function getColorPhasedWithPhaseSet(
  allele: string,
  PS: string,
  drawReference: boolean,
) {
  const c = +allele
  return c ? colorify(+PS) || 'black' : drawReference ? '#ccc' : undefined
}

export function drawPhasedBatched(
  alleles: string[],
  colorBatches: Record<string, Array<[number, number]>>,
  x: number,
  y: number,
  HP: number,
  PS?: string,
  drawReference = true,
) {
  const allele = alleles[HP]!
  const c =
    PS !== undefined
      ? getColorPhasedWithPhaseSet(allele, PS, drawReference)
      : getColorPhased(allele, drawReference)
  if (c) {
    const batch = colorBatches[c] || (colorBatches[c] = [])
    batch.push([x - f2, y - f2])
  }
  return c
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
  const allele = alleles[HP]!
  const c =
    PS !== undefined
      ? getColorPhasedWithPhaseSet(allele, PS, drawReference)
      : getColorPhased(allele, drawReference)
  if (c) {
    ctx.fillStyle = alpha !== 1 ? colord(c).alpha(alpha).toHex() : c
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  return c
}
