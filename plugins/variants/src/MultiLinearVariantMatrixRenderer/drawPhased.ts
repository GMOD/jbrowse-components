import {
  getColorPhased,
  getColorPhasedWithPhaseSet,
} from '../shared/multiVariantColor'
import { f2 } from './constants'

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
