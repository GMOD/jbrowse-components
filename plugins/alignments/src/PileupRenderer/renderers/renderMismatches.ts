import { bpSpanPx, measureText } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import { fillRectCtx, fillTextCtx } from '../util'

import type { Mismatch } from '../../shared/types'
import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

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
    if (mismatch.type === 'mismatch') {
      if (w >= 0.2) {
        items.push({
          type: 'mismatch',
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
    } else if (mismatch.type === 'deletion' && drawIndels) {
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
            type: 'deletion',
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
    } else if (mismatch.type === 'insertion' && drawIndels) {
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
              type: 'insertion',
              seq: mismatch.insertedBases || 'unknown',
            })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, topPx + heightPx)
          }
        }
      }
    } else if (mismatch.type === 'hardclip' || mismatch.type === 'softclip') {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const c = colorMap[mismatch.type]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRectCtx(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
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
          colorContrastMap[mismatch.type],
        )
      }
    } else if (mismatch.type === 'skip') {
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
      if (mismatch.type === 'insertion' && len >= 10) {
        const [leftPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
        const txt = `${len}`
        items.push({
          type: 'insertion',
          seq: mismatch.insertedBases || 'unknown',
        })
        coords.push(leftPx - 3, topPx, leftPx + 4, topPx + heightPx)
        if (bpPerPx > largeInsertionIndicatorScale) {
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
