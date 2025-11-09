import { bpSpanPx, measureText } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import { fillRect } from '../util'

import type { Mismatch } from '../../shared/types'
import type { FlatbushItem, ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'

/**
 * Get alpha-blended color for mismatch quality
 */
function getMismatchColor(
  baseColor: string,
  qual: number | undefined,
  mismatchAlpha?: boolean,
): string {
  if (mismatchAlpha && qual !== undefined) {
    return colord(baseColor)
      .alpha(Math.min(1, qual / 50))
      .toHslString()
  }
  return baseColor
}

export function renderMismatches({
  ctx,
  feat,
  renderArgs,
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
  renderArgs: ProcessedRenderArgs
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
  const { bpPerPx, regions } = renderArgs
  const { heightPx, topPx, feature } = feat
  const region = regions[0]!
  const start = feature.get('start')

  const pxPerBp = Math.min(1 / bpPerPx, 2)
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const heightLim = charHeight - 2
  const recipBpPerPx = 1 / bpPerPx
  const bottomY = topPx + heightPx

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = region.reversed ? recipBpPerPx + 1 : -1

  // two pass rendering: first pass, draw all the mismatches except wide
  // insertion markers
  const mismatchesLen = mismatches.length
  for (let i = 0; i < mismatchesLen; i++) {
    const mismatch = mismatches[i]!
    const mstart = start + mismatch.start
    const mlen = mismatch.length
    const mbase = mismatch.base
    const mtype = mismatch.type
    const qual = mismatch.qual
    const [leftPx, rightPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)
    if (mtype === 'mismatch') {
      items.push({
        type: 'mismatch',
        seq: mbase,
      })
      coords.push(leftPx, topPx, rightPx, bottomY)

      if (!drawSNPsMuted) {
        const baseColor = colorMap[mbase] || '#888'
        const c = getMismatchColor(baseColor, qual, mismatchAlpha)

        fillRect(
          ctx,
          Math.round(leftPx),
          topPx,
          widthPx,
          heightPx,
          canvasWidth,
          c,
        )
      }

      if (widthPx >= charWidth && heightPx >= heightLim) {
        // normal SNP coloring
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[mbase] || 'black'
        ctx.fillStyle = getMismatchColor(contrastColor, qual, mismatchAlpha)
        ctx.fillText(mbase, leftPx + (widthPx - charWidth) / 2 + 1, bottomY)
      }
    } else if (mtype === 'deletion' && drawIndels) {
      if (!hideSmallIndels || mlen >= 10) {
        fillRect(
          ctx,
          leftPx,
          topPx,
          Math.abs(leftPx - rightPx),
          heightPx,
          canvasWidth,
          colorMap.deletion,
        )
        const lenStr = `${mlen}`
        items.push({
          type: 'deletion',
          seq: lenStr,
        })
        coords.push(leftPx, topPx, rightPx, bottomY)
        const rwidth = measureText(lenStr, 10)
        if (widthPx >= rwidth && heightPx >= heightLim) {
          ctx.fillStyle = colorContrastMap.deletion!
          ctx.fillText(lenStr, (leftPx + rightPx) / 2 - rwidth / 2, bottomY)
        }
      }
    } else if (mtype === 'insertion' && drawIndels) {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const len = +mbase || mlen
      const insW = Math.max(0, Math.min(1.2, recipBpPerPx))
      if (len < 10) {
        if (!hideSmallIndels) {
          fillRect(
            ctx,
            pos,
            topPx,
            insW,
            heightPx,
            canvasWidth,
            colorMap.insertion,
          )
          items.push({
            type: 'insertion',
            seq: mismatch.insertedBases || 'unknown',
          })
          coords.push(leftPx - 2, topPx, leftPx + insW + 2, bottomY)
          if (recipBpPerPx >= charWidth && heightPx >= heightLim) {
            const l = Math.round(pos - insW)
            fillRect(ctx, l, topPx, insW * 3, 1, canvasWidth)
            fillRect(ctx, l, bottomY - 1, insW * 3, 1, canvasWidth)
            ctx.fillText(`(${mbase})`, pos + 3, bottomY)
          }
        }
      }
    } else if (mtype === 'hardclip' || mtype === 'softclip') {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const c = colorMap[mtype]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRect(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
      if (recipBpPerPx >= charWidth && heightPx >= heightLim) {
        const l = pos - clipW
        fillRect(ctx, l, topPx, clipW * 3, 1, canvasWidth)
        fillRect(ctx, l, bottomY - 1, clipW * 3, 1, canvasWidth)
        ctx.fillText(`(${mbase})`, pos + 3, bottomY)
      }
    } else if (mtype === 'skip') {
      // fix to avoid bad rendering note that this was also related to chrome
      // bug https://bugs.chromium.org/p/chromium/issues/detail?id=1131528
      //
      // also affected firefox ref #1236 #2750
      if (leftPx + widthPx > 0) {
        // make small exons more visible when zoomed far out
        const adjustPx = widthPx - (bpPerPx > 10 ? 1.5 : 0)
        const l = Math.max(0, leftPx)
        const t = topPx + heightPx / 2 - 1
        const w = adjustPx + Math.min(leftPx, 0)
        const h = 1
        fillRect(ctx, l, t, w, h, canvasWidth, colorMap.skip)
      }
    }
  }

  // second pass, draw wide insertion markers on top
  if (drawIndels) {
    for (let i = 0; i < mismatchesLen; i++) {
      const mismatch = mismatches[i]!
      const mstart = start + mismatch.start
      const mlen = mismatch.length
      const len = +mismatch.base || mlen
      if (mismatch.type === 'insertion' && len >= 10) {
        const [leftPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
        const txt = `${len}`
        items.push({
          type: 'insertion',
          seq: mismatch.insertedBases || 'unknown',
        })
        coords.push(leftPx - 3, topPx, leftPx + 4, bottomY)
        if (bpPerPx > largeInsertionIndicatorScale) {
          fillRect(
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
          fillRect(
            ctx,
            leftPx - rwidth / 2 - padding,
            topPx,
            rwidth + 2 * padding,
            heightPx,
            canvasWidth,
            'purple',
          )
          ctx.fillStyle = colorContrastMap.insertion!
          ctx.fillText(txt, leftPx - rwidth / 2, bottomY)
        } else {
          const padding = 2
          fillRect(
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
