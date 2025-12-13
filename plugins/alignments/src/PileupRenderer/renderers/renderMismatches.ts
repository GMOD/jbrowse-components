import { measureText } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import {
  CHAR_CODE_TO_STRING,
  TYPE_DELETION,
  TYPE_HARDCLIP,
  TYPE_INSERTION,
  TYPE_MISMATCH,
  TYPE_SKIP,
  TYPE_SOFTCLIP,
  getMismatchesFromFeature,
} from '../../shared/types'
import { fillRectCtx, fillTextCtx } from '../util'

import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

function applyQualAlpha(baseColor: string, qual: number | undefined) {
  return qual !== undefined && qual > 0
    ? colord(baseColor)
        .alpha(Math.min(1, qual / 50))
        .toHslString()
    : baseColor
}

export function renderMismatches({
  ctx,
  feat,
  bpPerPx,
  regions,
  minSubfeatureWidth,
  largeInsertionIndicatorScale,
  mismatchAlpha,
  charWidth,
  charHeight,
  colorMap,
  colorContrastMap,
  hideSmallIndels,
  canvasWidth,
  drawSNPsMuted,
  drawIndels = true,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  bpPerPx: number
  regions: Region[]
  colorMap: Record<string, string>
  colorContrastMap: Record<string, string>
  mismatchAlpha?: boolean
  drawIndels?: boolean
  drawSNPsMuted?: boolean
  minSubfeatureWidth: number
  largeInsertionIndicatorScale: number
  hideSmallIndels: boolean
  charWidth: number
  charHeight: number
  canvasWidth: number
}) {
  const items = [] as FlatbushItem[]
  const coords = [] as number[]
  const { heightPx, topPx, feature } = feat
  const bottomPx = topPx + heightPx
  const featStart = feature.get('start')
  const region =
    regions.find(r => {
      const rn = feature.get('refName')
      const end = feature.get('end')
      return r.refName === rn && r.start <= featStart && end <= r.end
    }) || regions[0]!

  const invBpPerPx = 1 / bpPerPx
  const pxPerBp = Math.min(invBpPerPx, 2)
  const mismatches = getMismatchesFromFeature(feature)
  const canRenderText = heightPx >= charHeight - 2
  const useAlpha = mismatchAlpha === true
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed

  if (!mismatches || mismatches.count === 0) {
    return { coords, items }
  }

  const { count, starts, lengths, types, bases, quals, insertedBases } =
    mismatches

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = reversed ? invBpPerPx + 1 : -1

  // first pass: draw mismatches, deletions, skips
  for (let i = 0; i < count; i++) {
    const type = types[i]!
    if (
      type === TYPE_INSERTION ||
      type === TYPE_SOFTCLIP ||
      type === TYPE_HARDCLIP
    ) {
      continue
    }

    const mstart = featStart + starts[i]!
    const mlen = lengths[i]!
    const mend = mstart + mlen

    // Skip mismatches entirely outside visible region
    if (mend <= regionStart || mstart >= regionEnd) {
      continue
    }

    const leftPx = reversed
      ? (regionEnd - mend) * invBpPerPx
      : (mstart - regionStart) * invBpPerPx
    const rightPx = reversed
      ? (regionEnd - mstart) * invBpPerPx
      : (mend - regionStart) * invBpPerPx
    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)

    if (type === TYPE_MISMATCH) {
      const baseChar = CHAR_CODE_TO_STRING[bases[i]!]!
      const qual = quals[i]

      if (rightPx - leftPx >= 0.2) {
        items.push({ type: 'mismatch', seq: baseChar })
        coords.push(leftPx, topPx, rightPx, bottomPx)
      }

      if (!drawSNPsMuted) {
        const baseColor = colorMap[baseChar] || '#888'
        const c = useAlpha ? applyQualAlpha(baseColor, qual) : baseColor
        fillRectCtx(
          ctx,
          Math.round(leftPx),
          topPx,
          widthPx,
          heightPx,
          canvasWidth,
          c,
        )
      }

      if (widthPx >= charWidth && canRenderText) {
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[baseChar] || 'black'
        const textColor = useAlpha
          ? applyQualAlpha(contrastColor, qual)
          : contrastColor
        fillTextCtx(
          ctx,
          baseChar,
          leftPx + (widthPx - charWidth) / 2 + 1,
          bottomPx,
          canvasWidth,
          textColor,
        )
      }
    } else if (type === TYPE_DELETION && drawIndels) {
      const len = mlen
      if (!hideSmallIndels || len >= 10) {
        fillRectCtx(
          ctx,
          leftPx,
          topPx,
          Math.abs(leftPx - rightPx),
          heightPx,
          canvasWidth,
          colorMap.deletion,
        )
        if (bpPerPx < 3) {
          items.push({ type: 'deletion', seq: `${len}` })
          coords.push(leftPx, topPx, rightPx, bottomPx)
        }
        const txt = String(len)
        const rwidth = measureText(txt, 10)
        if (widthPx >= rwidth && canRenderText) {
          fillTextCtx(
            ctx,
            txt,
            (leftPx + rightPx) / 2 - rwidth / 2,
            bottomPx,
            canvasWidth,
            colorContrastMap.deletion,
          )
        }
      }
    } else if (type === TYPE_SKIP) {
      fillRectCtx(
        ctx,
        leftPx,
        topPx + heightPx / 2 - 1,
        Math.max(widthPx, 1.5),
        1,
        canvasWidth,
        colorMap.skip,
      )
    }
  }

  // second pass: draw insertions and clips on top
  for (let i = 0; i < count; i++) {
    const type = types[i]!
    if (
      type !== TYPE_INSERTION &&
      type !== TYPE_SOFTCLIP &&
      type !== TYPE_HARDCLIP
    ) {
      continue
    }

    const mstart = featStart + starts[i]!

    // Skip if outside visible region
    if (mstart < regionStart || mstart >= regionEnd) {
      continue
    }

    const leftPx = reversed
      ? (regionEnd - mstart - 1) * invBpPerPx
      : (mstart - regionStart) * invBpPerPx
    const pos = leftPx + extraHorizontallyFlippedOffset

    if (type === TYPE_INSERTION && drawIndels) {
      const len = lengths[i]!
      const insW = Math.max(0, Math.min(1.2, invBpPerPx))
      const insBasesStr = insertedBases.get(i) || 'unknown'

      if (len < 10) {
        if (!hideSmallIndels) {
          ctx.fillStyle = colorMap.insertion!
          fillRectCtx(ctx, pos, topPx, insW, heightPx, canvasWidth)
          if (invBpPerPx >= charWidth && canRenderText) {
            const l = Math.round(pos - insW)
            const insW3 = insW * 3
            fillRectCtx(ctx, l, topPx, insW3, 1, canvasWidth)
            fillRectCtx(ctx, l, bottomPx - 1, insW3, 1, canvasWidth)
            fillTextCtx(ctx, `(${len})`, pos + 3, bottomPx, canvasWidth)
          }
          if (bpPerPx < 3) {
            items.push({
              type: 'insertion',
              seq: insBasesStr,
            })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, bottomPx)
          }
        }
      } else {
        items.push({
          type: 'insertion',
          seq: insBasesStr,
        })
        const txt = `${len}`
        if (bpPerPx > largeInsertionIndicatorScale) {
          coords.push(leftPx - 1, topPx, leftPx + 1, bottomPx)
          fillRectCtx(
            ctx,
            leftPx - 1,
            topPx,
            2,
            heightPx,
            canvasWidth,
            colorMap.insertion,
          )
        } else if (heightPx > charHeight) {
          const rwidth = measureText(txt)
          const padding = 5
          coords.push(
            leftPx - rwidth / 2 - padding,
            topPx,
            leftPx + rwidth / 2 + padding,
            bottomPx,
          )
          fillRectCtx(
            ctx,
            leftPx - rwidth / 2 - padding,
            topPx,
            rwidth + 2 * padding,
            heightPx,
            canvasWidth,
            'purple',
          )
          fillTextCtx(
            ctx,
            txt,
            leftPx - rwidth / 2,
            bottomPx,
            canvasWidth,
            colorContrastMap.insertion,
          )
        } else {
          const padding = 2
          coords.push(leftPx - padding, topPx, leftPx + padding, bottomPx)
          fillRectCtx(
            ctx,
            leftPx - padding,
            topPx,
            2 * padding,
            heightPx,
            canvasWidth,
            colorMap.insertion,
          )
        }
      }
    } else if (type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP) {
      const typeName = type === TYPE_SOFTCLIP ? 'softclip' : 'hardclip'
      const len = lengths[i]!
      const baseStr = `${type === TYPE_SOFTCLIP ? 'S' : 'H'}${len}`
      const c = colorMap[typeName]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRectCtx(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
      items.push({ type: typeName, seq: baseStr })
      coords.push(pos - clipW, topPx, pos + clipW * 2, bottomPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        fillRectCtx(ctx, l, topPx, clipW3, 1, canvasWidth, c)
        fillRectCtx(ctx, l, bottomPx - 1, clipW3, 1, canvasWidth, c)
        fillTextCtx(ctx, `(${baseStr})`, pos + 3, bottomPx, canvasWidth, c)
      }
    }
  }

  return { coords, items }
}
