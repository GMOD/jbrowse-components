import { readConfObject } from '@jbrowse/core/configuration'

import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  getCigarOps,
} from './cigarUtil'
import { getCharWidthHeight } from '../../shared/util'

import type { Mismatch } from '../../shared/types'
import type { ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Theme } from '@mui/material'

const lastFillStyleMap = new WeakMap<CanvasRenderingContext2D, string>()

export function renderSoftClipping({
  ctx,
  feat,
  renderArgs,
  config,
  theme,
  colorMap,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: ProcessedRenderArgs
  config: AnyConfigurationModel
  colorMap: Record<string, string>
  theme: Theme
  canvasWidth: number
}) {
  const { feature, topPx, heightPx } = feat
  const { regions, bpPerPx } = renderArgs
  const region = regions[0]!
  const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
  const mismatches = feature.get('mismatches') as Mismatch[] | undefined
  const seq = feature.get('seq') as string | undefined
  const { charWidth, charHeight } = getCharWidthHeight()

  // Display all bases softclipped off in lightened colors
  if (!(seq && mismatches)) {
    return
  }

  const heightLim = charHeight - 2
  let seqOffset = 0
  let refOffset = 0
  const CIGAR =
    feature.get('NUMERIC_CIGAR') || (feature.get('CIGAR') as string | undefined)
  const ops = getCigarOps(CIGAR)
  const featStart = feature.get('start')
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx

  for (let i = 0, l = ops.length; i < l; i++) {
    const packed = ops[i]!
    const len = packed >> 4
    const op = packed & 0xf
    if (op === CIGAR_S) {
      // Calculate soft clip region bounds
      const clipStart = featStart - (i === 0 ? len : 0) + refOffset
      const clipEnd = clipStart + len

      // Skip if entirely outside visible region
      if (clipEnd > regionStart && clipStart < regionEnd) {
        const visStart = Math.max(0, regionStart - clipStart)
        const visEnd = Math.min(len, regionEnd - clipStart)

        for (let k = visStart; k < visEnd; k++) {
          const base = seq[seqOffset + k]!
          const s0 = clipStart + k
          const leftPx = reversed
            ? (regionEnd - s0 - 1) * invBpPerPx
            : (s0 - regionStart) * invBpPerPx
          const rightPx = reversed
            ? (regionEnd - s0) * invBpPerPx
            : (s0 + 1 - regionStart) * invBpPerPx
          const widthPx = Math.max(minFeatWidth, rightPx - leftPx)

          // Black accounts for IUPAC ambiguity code bases such as N that
          // show in soft clipping
          const baseColor = colorMap[base] || '#000000'
          ctx.fillStyle = baseColor
          ctx.fillRect(leftPx, topPx, widthPx, heightPx)

          if (widthPx >= charWidth && heightPx >= heightLim) {
            const x = leftPx + (widthPx - charWidth) / 2 + 1
            const y = topPx + heightPx
            const color = theme.palette.getContrastText(baseColor)
            if (x >= 0 && x <= canvasWidth) {
              if (color && lastFillStyleMap.get(ctx) !== color) {
                ctx.fillStyle = color
                lastFillStyleMap.set(ctx, color)
              }
              ctx.fillText(base, x, y)
            }
          }
        }
      }
      seqOffset += len
    } else if (op === CIGAR_N) {
      refOffset += len
    } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
      refOffset += len
      seqOffset += len
    } else if (op === CIGAR_D) {
      refOffset += len
    } else if (op === CIGAR_I) {
      seqOffset += len
    }
  }
}
