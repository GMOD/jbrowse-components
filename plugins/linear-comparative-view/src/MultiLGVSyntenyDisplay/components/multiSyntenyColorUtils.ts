import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
  drawDeletion,
  drawInsertion,
} from '@jbrowse/alignments-core'

import { isDigit, parseCsSeqLen } from './cigarConstants.ts'
import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { SyntenyColors } from './multiSyntenyBackendTypes.ts'
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

export function drawCigarOps(
  ctx: Ctx,
  cigar: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  bpLen: number,
  colors: SyntenyColors,
) {
  const pxPerBp = w / bpLen
  let refPos = 0

  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      refPos += len
    } else if (op === CIGAR_X) {
      const pw = len * pxPerBp
      if (pw >= 0.1) {
        ctx.fillStyle = colors.mismatch
        ctx.fillRect(x + refPos * pxPerBp, y, Math.max(pw, 1), h)
      }
      refPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      const pw = len * pxPerBp
      if (pw >= 0.1) {
        drawDeletion(ctx, x + refPos * pxPerBp, y, pw, h, colors.deletion)
      }
      refPos += len
    } else if (op === CIGAR_I) {
      drawInsertion(ctx, x + refPos * pxPerBp, y, h, len, pxPerBp, colors.insertion)
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
  colors: SyntenyColors,
) {
  const pxPerBp = w / bpLen
  let refPos = 0
  let i = 0
  const baseColors: Record<string, string> = {
    a: colors.baseA,
    c: colors.baseC,
    g: colors.baseG,
    t: colors.baseT,
  }

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
      ctx.fillStyle = baseColors[queryBase.toLowerCase()] ?? colors.mismatch
      ctx.fillRect(x + refPos * pxPerBp, y, Math.max(pxPerBp, 1), h)
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        const pw = len * pxPerBp
        if (pw >= 0.1) {
          ctx.fillStyle = colors.deletion
          ctx.fillRect(x + refPos * pxPerBp, y, Math.max(pw, 1), h)
        }
        refPos += len
      }
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        drawInsertion(ctx, x + refPos * pxPerBp, y, h, len, pxPerBp, colors.insertion)
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
