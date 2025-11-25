import { bpSpanPx, measureText } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import { fillRectCtx, fillTextCtx } from '../util'
import {
  MISMATCH_TYPE_CLIP_MASK,
  MISMATCH_TYPE_DELETION,
  MISMATCH_TYPE_HARDCLIP,
  MISMATCH_TYPE_INSERTION,
  MISMATCH_TYPE_MISMATCH,
  MISMATCH_TYPE_SKIP,
  MISMATCH_TYPE_SOFTCLIP,
} from '../../shared/types'

import type { Mismatch } from '../../shared/types'
import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

const MISMATCH_TYPE_NAMES: Record<number, string> = {
  [MISMATCH_TYPE_MISMATCH]: 'mismatch',
  [MISMATCH_TYPE_INSERTION]: 'insertion',
  [MISMATCH_TYPE_DELETION]: 'deletion',
  [MISMATCH_TYPE_SKIP]: 'skip',
  [MISMATCH_TYPE_SOFTCLIP]: 'softclip',
  [MISMATCH_TYPE_HARDCLIP]: 'hardclip',
}

// Helper to apply alpha to color based on quality score
function applyQualAlpha(baseColor: string, qual: number | undefined) {
  return qual !== undefined
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
  const featRefName = feature.get('refName')
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  const region =
    regions.find(
      r =>
        r.refName === featRefName && r.start <= featStart && featEnd <= r.end,
    ) || regions[0]!
  const start = featStart

  const pxPerBp = Math.min(1 / bpPerPx, 2)
  const invBpPerPx = 1 / bpPerPx
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const heightLim = charHeight - 2
  const canRenderText = heightPx >= heightLim
  const useAlpha = mismatchAlpha === true

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = region.reversed ? invBpPerPx + 1 : -1

  // two pass rendering: first pass, draw all the mismatches except wide
  // insertion markers
  for (let i = 0, l = mismatches.length; i < l; i++) {
    const mismatch = mismatches[i]!
    const mstart = start + mismatch.start
    const mlen = mismatch.length
    const mbase = mismatch.base
    const [leftPx, rightPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)
    const w = rightPx - leftPx
    if (mismatch.type === MISMATCH_TYPE_MISMATCH) {
      if (w >= 0.2) {
        items.push({
          type: MISMATCH_TYPE_MISMATCH,
          seq: mismatch.base,
        })
        coords.push(leftPx, topPx, rightPx, topPx + heightPx)
      }

      if (!drawSNPsMuted) {
        const baseColor = colorMap[mismatch.base] || '#888'
        const c = useAlpha
          ? applyQualAlpha(baseColor, mismatch.qual)
          : baseColor

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
        // normal SNP coloring
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[mismatch.base] || 'black'
        const textColor = useAlpha
          ? applyQualAlpha(contrastColor, mismatch.qual)
          : contrastColor
        fillTextCtx(
          ctx,
          mbase,
          leftPx + (widthPx - charWidth) / 2 + 1,
          topPx + heightPx,
          canvasWidth,
          textColor,
        )
      }
    } else if (mismatch.type === MISMATCH_TYPE_DELETION && drawIndels) {
      const len = mismatch.length
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
          items.push({
            type: MISMATCH_TYPE_DELETION,
            seq: `${mismatch.length}`,
          })
          coords.push(leftPx, topPx, rightPx, topPx + heightPx)
        }
        const txt = String(len)
        const rwidth = measureText(txt, 10)
        if (widthPx >= rwidth && canRenderText) {
          fillTextCtx(
            ctx,
            txt,
            (leftPx + rightPx) / 2 - rwidth / 2,
            topPx + heightPx,
            canvasWidth,
            colorContrastMap.deletion,
          )
        }
      }
    } else if (mismatch.type === MISMATCH_TYPE_INSERTION && drawIndels) {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const len = +mismatch.base || mismatch.length
      const insW = Math.max(0, Math.min(1.2, invBpPerPx))
      if (len < 10) {
        if (!hideSmallIndels) {
          ctx.fillStyle = colorMap.insertion!
          fillRectCtx(ctx, pos, topPx, insW, heightPx, canvasWidth)
          if (invBpPerPx >= charWidth && canRenderText) {
            const l = Math.round(pos - insW)
            const insW3 = insW * 3
            fillRectCtx(ctx, l, topPx, insW3, 1, canvasWidth)
            fillRectCtx(ctx, l, topPx + heightPx - 1, insW3, 1, canvasWidth)
            fillTextCtx(
              ctx,
              `(${mismatch.base})`,
              pos + 3,
              topPx + heightPx,
              canvasWidth,
            )
          }
          if (bpPerPx < 3) {
            items.push({
              type: MISMATCH_TYPE_INSERTION,
              seq: mismatch.insertedBases || 'unknown',
            })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, topPx + heightPx)
          }
        }
      }
    } else if ((mismatch.type & MISMATCH_TYPE_CLIP_MASK) !== 0) {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const typeName = MISMATCH_TYPE_NAMES[mismatch.type]!
      const c = colorMap[typeName]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRectCtx(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
      items.push({
        type: mismatch.type,
        seq: mismatch.base,
      })
      coords.push(pos - clipW, topPx, pos + clipW * 2, topPx + heightPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        fillRectCtx(ctx, l, topPx, clipW3, 1, canvasWidth, c)
        fillRectCtx(ctx, l, topPx + heightPx - 1, clipW3, 1, canvasWidth, c)
        fillTextCtx(
          ctx,
          `(${mismatch.base})`,
          pos + 3,
          topPx + heightPx,
          canvasWidth,
          colorContrastMap[typeName],
        )
      }
    } else if (mismatch.type === MISMATCH_TYPE_SKIP) {
      const t = topPx + heightPx / 2 - 1
      fillRectCtx(
        ctx,
        leftPx,
        t,
        Math.max(widthPx, 1.5),
        1,
        canvasWidth,
        colorMap.skip,
      )
    }
  }

  // second pass, draw wide insertion markers on top
  if (drawIndels) {
    for (let i = 0, l = mismatches.length; i < l; i++) {
      const mismatch = mismatches[i]!
      const mstart = start + mismatch.start
      const mlen = mismatch.length
      const len = +mismatch.base || mismatch.length
      if (mismatch.type === MISMATCH_TYPE_INSERTION && len >= 10) {
        const [leftPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
        const txt = `${len}`
        items.push({
          type: MISMATCH_TYPE_INSERTION,
          seq: mismatch.insertedBases || 'unknown',
        })
        if (bpPerPx > largeInsertionIndicatorScale) {
          coords.push(leftPx - 1, topPx, leftPx + 1, topPx + heightPx)
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
            topPx + heightPx,
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
            topPx + heightPx,
            canvasWidth,
            colorContrastMap.insertion,
          )
        } else {
          const padding = 2
          coords.push(
            leftPx - padding,
            topPx,
            leftPx + padding,
            topPx + heightPx,
          )
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
    }
  }
  return {
    coords,
    items,
  }
}
