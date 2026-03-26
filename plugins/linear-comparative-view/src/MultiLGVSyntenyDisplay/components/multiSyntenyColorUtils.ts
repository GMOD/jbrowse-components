import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from '@jbrowse/alignments-core'

import {
  OP_D,
  OP_EQ,
  OP_I,
  OP_M,
  OP_N,
  OP_X,
  isDigit,
  parseCsSeqLen,
} from './cigarConstants.ts'
import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

type Ctx = CanvasRenderingContext2D | SvgCanvas

function getStrandColor(feat: MultiPairFeature) {
  return feat.strand === -1 ? '#6899e0' : '#c8c8c8'
}

function getSyriColor(feat: MultiPairFeature) {
  return syriColors[feat.syriType ?? 'SYN']
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

const MISMATCH_COLOR = '#f00'
const DELETION_COLOR = '#888'
const INSERTION_COLOR = '#c000c0'

const BASE_COLORS: Record<string, string> = {
  a: '#00bf00',
  c: '#4747ff',
  g: '#d5bb04',
  t: '#f00',
}

function drawDeletion(ctx: Ctx, px: number, y: number, pw: number, h: number) {
  ctx.fillStyle = DELETION_COLOR
  ctx.fillRect(px, y, Math.max(pw, 1), h)
}

function textWidthForNumber(num: number) {
  const digits =
    num < 10 ? 1 : num < 100 ? 2 : num < 1000 ? 3 : num < 10000 ? 4 : 5
  return digits * 6 + 10
}

function drawSerifs(ctx: Ctx, px: number, y: number, h: number, triW: number) {
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

function drawInsertion(
  ctx: Ctx,
  px: number,
  y: number,
  h: number,
  len: number,
  pxPerBp: number,
) {
  ctx.fillStyle = INSERTION_COLOR
  const isLong = len >= LONG_INSERTION_MIN_LENGTH
  const widthPx = isLong ? len * pxPerBp : 0

  if (isLong && widthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX) {
    const boxW = textWidthForNumber(len)
    ctx.fillRect(px - boxW / 2, y, boxW, h)
  } else if (isLong) {
    const barW = Math.min(5, widthPx / 3)
    ctx.fillRect(px - barW / 2, y, barW, h)
    if (h >= 6) {
      drawSerifs(ctx, px, y, h, Math.min(4, h / 3))
    }
  } else {
    ctx.fillRect(px - 0.5, y, 1, h)
    if (h >= 6) {
      drawSerifs(ctx, px, y, h, Math.min(3, h / 3))
    }
  }
}

export function drawCigarOps(
  ctx: Ctx,
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
      if (pw >= 0.1) {
        ctx.fillStyle = MISMATCH_COLOR
        ctx.fillRect(px, y, Math.max(pw, 1), h)
      }
      refPos += len
    } else if (op === OP_D || op === OP_N) {
      const pw = len * pxPerBp
      if (pw >= 0.1) {
        drawDeletion(ctx, x + refPos * pxPerBp, y, pw, h)
      }
      refPos += len
    } else if (op === OP_I) {
      drawInsertion(ctx, x + refPos * pxPerBp, y, h, len, pxPerBp)
    }
  }
}

export function drawCsOps(
  ctx: Ctx,
  cs: string,
  x: number,
  y: number,
  w: number,
  h: number,
  bpLen: number,
) {
  const pxPerBp = w / bpLen
  let refPos = 0
  let i = 0

  while (i < cs.length) {
    const ch = cs[i]!

    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2] ?? ''
      const px = x + refPos * pxPerBp
      const pw = Math.max(pxPerBp, 1)
      ctx.fillStyle = BASE_COLORS[queryBase.toLowerCase()] ?? MISMATCH_COLOR
      ctx.fillRect(px, y, pw, h)
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        const pw = len * pxPerBp
        if (pw >= 0.1) {
          drawDeletion(ctx, x + refPos * pxPerBp, y, pw, h)
        }
        refPos += len
      }
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        drawInsertion(ctx, x + refPos * pxPerBp, y, h, len, pxPerBp)
      }
    } else {
      i++
    }
  }
}

export const legendItems: Record<string, { label: string; color: string }[]> = {
  strand: [
    { label: 'Forward (+)', color: '#c8c8c8' },
    { label: 'Reverse (inversion)', color: '#6899e0' },
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
