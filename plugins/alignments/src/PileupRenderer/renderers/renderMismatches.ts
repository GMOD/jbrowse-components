import { bpSpanPx, measureText } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import { fillRectCtx, fillTextCtx } from '../util'

import type { Mismatch } from '../../shared/types'
import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

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
  const bottomPx = topPx + heightPx
  const featStart = feature.get('start')
  const region =
    regions.find(r => {
      const rn = feature.get('refName')
      const end = feature.get('end')
      return r.refName === rn && r.start <= featStart && end <= r.end
    }) || regions[0]!

  const pxPerBp = Math.min(1 / bpPerPx, 2)
  const invBpPerPx = 1 / bpPerPx
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const canRenderText = heightPx >= charHeight - 2
  const useAlpha = mismatchAlpha === true

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = region.reversed ? invBpPerPx + 1 : -1

  // first pass: draw mismatches, deletions, skips
  for (let i = 0, l = mismatches.length; i < l; i++) {
    const mismatch = mismatches[i]!
    const type = mismatch.type
    if (type === 'insertion' || type === 'softclip' || type === 'hardclip') {
      continue
    }

    const mstart = featStart + mismatch.start
    const [leftPx, rightPx] = bpSpanPx(
      mstart,
      mstart + mismatch.length,
      region,
      bpPerPx,
    )
    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)

    if (type === 'mismatch') {
      if (rightPx - leftPx >= 0.2) {
        items.push({ type: 'mismatch', seq: mismatch.base })
        coords.push(leftPx, topPx, rightPx, bottomPx)
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
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[mismatch.base] || 'black'
        const textColor = useAlpha
          ? applyQualAlpha(contrastColor, mismatch.qual)
          : contrastColor
        fillTextCtx(
          ctx,
          mismatch.base,
          leftPx + (widthPx - charWidth) / 2 + 1,
          bottomPx,
          canvasWidth,
          textColor,
        )
      }
    } else if (type === 'deletion' && drawIndels) {
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
    } else if (type === 'skip') {
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
  for (let i = 0, l = mismatches.length; i < l; i++) {
    const mismatch = mismatches[i]!
    const type = mismatch.type
    if (type !== 'insertion' && type !== 'softclip' && type !== 'hardclip') {
      continue
    }

    const mstart = featStart + mismatch.start
    const [leftPx] = bpSpanPx(mstart, mstart + 1, region, bpPerPx)
    const pos = leftPx + extraHorizontallyFlippedOffset

    if (type === 'insertion' && drawIndels) {
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
            fillRectCtx(ctx, l, bottomPx - 1, insW3, 1, canvasWidth)
            fillTextCtx(
              ctx,
              `(${mismatch.base})`,
              pos + 3,
              bottomPx,
              canvasWidth,
            )
          }
          if (bpPerPx < 3) {
            items.push({
              type: 'insertion',
              seq: mismatch.insertedBases || 'unknown',
            })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, bottomPx)
          }
        }
      } else {
        items.push({
          type: 'insertion',
          seq: mismatch.insertedBases || 'unknown',
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
    } else if (type === 'softclip' || type === 'hardclip') {
      const c = colorMap[type]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRectCtx(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
      items.push({ type, seq: mismatch.base })
      coords.push(pos - clipW, topPx, pos + clipW * 2, bottomPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        fillRectCtx(ctx, l, topPx, clipW3, 1, canvasWidth, c)
        fillRectCtx(ctx, l, bottomPx - 1, clipW3, 1, canvasWidth, c)
        fillTextCtx(
          ctx,
          `(${mismatch.base})`,
          pos + 3,
          bottomPx,
          canvasWidth,
          c,
        )
      }
    }
  }

  return { coords, items }
}
