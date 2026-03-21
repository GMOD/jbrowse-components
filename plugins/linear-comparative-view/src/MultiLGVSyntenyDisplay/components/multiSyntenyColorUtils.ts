import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

function getStrandColor(feat: MultiPairFeature) {
  return feat.strand === -1 ? '#f57c00' : '#5677fc'
}

function getSyriColor(feat: MultiPairFeature) {
  return syriColors[feat.syriType ?? 'SYN'] ?? syriColors.SYN
}

function getIdentityColor(feat: MultiPairFeature) {
  if (feat.identity < 0) {
    return '#999'
  }
  const t = feat.identity
  if (t >= 0.95) {
    const f = (t - 0.95) / 0.05
    return `rgb(${Math.round(255 * (1 - f))},${Math.round(200 + 55 * f)},50)`
  }
  if (t >= 0.8) {
    const f = (t - 0.8) / 0.15
    return `rgb(255,${Math.round(200 * f)},0)`
  }
  return 'rgb(200,0,0)'
}

export function getFeatureColor(feat: MultiPairFeature, colorBy: string) {
  switch (colorBy) {
    case 'syri':
      return getSyriColor(feat)
    case 'identity':
      return getIdentityColor(feat)
    default:
      return getStrandColor(feat)
  }
}

const OP_M = 0
const OP_I = 1
const OP_D = 2
const OP_N = 3
const OP_EQ = 7
const OP_X = 8

const MISMATCH_COLOR = '#f00'
const DELETION_COLOR = '#888'
const INSERTION_COLOR = '#c000c0'

export function drawCigarOps(
  ctx: CanvasRenderingContext2D,
  cigar: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  bpLen: number,
) {
  const pxPerBp = w / bpLen
  let refPos = 0

  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === OP_M || op === OP_EQ) {
      refPos += len
    } else if (op === OP_X) {
      const px = x + refPos * pxPerBp
      const pw = len * pxPerBp
      if (pw >= 0.5) {
        ctx.fillStyle = MISMATCH_COLOR
        ctx.fillRect(px, y, Math.max(pw, 1), h)
      }
      refPos += len
    } else if (op === OP_D || op === OP_N) {
      const px = x + refPos * pxPerBp
      const pw = len * pxPerBp
      if (pw >= 0.5) {
        ctx.fillStyle = DELETION_COLOR
        ctx.fillRect(px, y, Math.max(pw, 1), h)
        if (pw > 12 && h >= 10) {
          ctx.fillStyle = '#fff'
          ctx.font = `${Math.min(h - 2, 10)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`${len}`, px + pw / 2, y + h / 2)
          ctx.textAlign = 'start'
        }
      }
      refPos += len
    } else if (op === OP_I) {
      // Draw insertion marker: vertical line with triangle markers
      // at top and bottom (like pileup insertion rendering).
      // Insertions don't consume reference space.
      const px = x + refPos * pxPerBp
      ctx.fillStyle = INSERTION_COLOR
      ctx.fillRect(px - 0.5, y, 1, h)

      if (h >= 6) {
        const triW = Math.min(3, h / 3)
        ctx.beginPath()
        ctx.moveTo(px - triW, y)
        ctx.lineTo(px + triW, y)
        ctx.lineTo(px, y + triW)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(px - triW, y + h)
        ctx.lineTo(px + triW, y + h)
        ctx.lineTo(px, y + h - triW)
        ctx.closePath()
        ctx.fill()
      }
    }
  }
}

export const legendItems: Record<
  string,
  { label: string; color: string }[]
> = {
  strand: [
    { label: 'Forward (+)', color: '#5677fc' },
    { label: 'Reverse (-)', color: '#f57c00' },
  ],
  syri: Object.entries(syriColors).map(([label, color]) => ({
    label,
    color,
  })),
  identity: [
    { label: '>99%', color: 'rgb(0,255,50)' },
    { label: '95%', color: 'rgb(255,200,0)' },
    { label: '80%', color: 'rgb(255,0,0)' },
    { label: '<80%', color: 'rgb(200,0,0)' },
  ],
}
