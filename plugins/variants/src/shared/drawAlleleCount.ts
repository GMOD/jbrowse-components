import { colord } from '@jbrowse/core/util/colord'

import { f2 } from './constants'

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

  if (!alt && !alt2 && !uncalled) {
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
