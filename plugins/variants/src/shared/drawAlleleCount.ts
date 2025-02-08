import { f2 } from './constants'
import { getColorAlleleCount } from './multiVariantColor'

export function drawColorAlleleCount(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = getColorAlleleCount(alleles)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}
