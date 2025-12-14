import { colord } from '@jbrowse/core/util/colord'

import { fillRectCtx, fillTextCtx, measureTextSmallNumber } from '../util'
import {
  MISMATCH_TYPE,
  INSERTION_TYPE,
  DELETION_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
  HARDCLIP_TYPE,
} from '../../shared/forEachMismatchTypes'

import type { MismatchCallback } from '../../shared/forEachMismatchTypes'
import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

interface FeatureWithMismatchIterator {
  forEachMismatch(callback: MismatchCallback): void
}

function applyQualAlpha(baseColor: string, qual: number) {
  return qual >= 0
    ? colord(baseColor)
        .alpha(Math.min(1, qual / 50))
        .toHslString()
    : baseColor
}

export function renderMismatchesCallback({
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
  checkRef,
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
  checkRef?: boolean
  charWidth: number
  charHeight: number
  canvasWidth: number
}) {
  const items = [] as FlatbushItem[]
  const coords = [] as number[]
  const { heightPx, topPx, feature } = feat
  const bottomPx = topPx + heightPx
  const featStart = feature.get('start')
  const region = checkRef
    ? (regions.find(r => {
        const rn = feature.get('refName')
        const end = feature.get('end')
        return r.refName === rn && r.start <= featStart && end <= r.end
      }) ?? regions[0]!)
    : regions[0]!

  const invBpPerPx = 1 / bpPerPx
  const pxPerBp = Math.min(invBpPerPx, 2)
  const canRenderText = heightPx >= charHeight - 2
  const useAlpha = mismatchAlpha === true
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed

  // extraHorizontallyFlippedOffset is used to draw interbase items
  const extraHorizontallyFlippedOffset = reversed ? invBpPerPx + 1 : -1

  // Accumulate insertions/clips for second pass
  const secondPassItems: Array<{
    type: number
    start: number
    base: string
    cliplen: number
  }> = []

  // Check if feature has forEachMismatch method (BAM/CRAM adapters)
  const featureWithIterator = feature as unknown as FeatureWithMismatchIterator
  if (typeof featureWithIterator.forEachMismatch !== 'function') {
    // Fallback: feature doesn't support callback iteration
    return { coords, items }
  }

  // First pass: draw mismatches, deletions, skips - accumulate insertions/clips
  featureWithIterator.forEachMismatch((type, start, length, base, qualVal, altbase, cliplen) => {
    const mstart = featStart + start
    const mend = mstart + length

    // Handle insertions/clips in second pass
    if (type === INSERTION_TYPE || type === SOFTCLIP_TYPE || type === HARDCLIP_TYPE) {
      if (mstart >= regionStart && mstart < regionEnd) {
        secondPassItems.push({ type, start, base, cliplen })
      }
      return
    }

    // Skip items entirely outside visible region
    if (mend <= regionStart || mstart >= regionEnd) {
      return
    }

    const leftPx = reversed
      ? (regionEnd - mend) * invBpPerPx
      : (mstart - regionStart) * invBpPerPx
    const rightPx = reversed
      ? (regionEnd - mstart) * invBpPerPx
      : (mend - regionStart) * invBpPerPx
    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)

    if (type === MISMATCH_TYPE) {
      if (rightPx - leftPx >= 0.2) {
        items.push({ type: 'mismatch', seq: base })
        coords.push(leftPx, topPx, rightPx, bottomPx)
      }

      if (!drawSNPsMuted) {
        const baseColor = colorMap[base] || '#888'
        const c = useAlpha ? applyQualAlpha(baseColor, qualVal) : baseColor
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
          : colorContrastMap[base] || 'black'
        const textColor = useAlpha
          ? applyQualAlpha(contrastColor, qualVal)
          : contrastColor
        fillTextCtx(
          ctx,
          base,
          leftPx + (widthPx - charWidth) / 2 + 1,
          bottomPx,
          canvasWidth,
          textColor,
        )
      }
    } else if (type === DELETION_TYPE && drawIndels) {
      if (!hideSmallIndels || length >= 10) {
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
          items.push({ type: 'deletion', seq: `${length}` })
          coords.push(leftPx, topPx, rightPx, bottomPx)
        }
        const txt = String(length)
        const rwidth = measureTextSmallNumber(length, 10)
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
    } else if (type === SKIP_TYPE) {
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
  })

  // Second pass: draw insertions and clips on top
  for (const item of secondPassItems) {
    const { type, start, base, cliplen } = item
    const mstart = featStart + start

    const leftPx = reversed
      ? (regionEnd - mstart - 1) * invBpPerPx
      : (mstart - regionStart) * invBpPerPx
    const pos = leftPx + extraHorizontallyFlippedOffset

    if (type === INSERTION_TYPE && drawIndels) {
      const len = cliplen
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
              `(${len})`,
              pos + 3,
              bottomPx,
              canvasWidth,
            )
          }
          if (bpPerPx < 3) {
            items.push({ type: 'insertion', seq: base || 'unknown' })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, bottomPx)
          }
        }
      } else {
        items.push({ type: 'insertion', seq: base || 'unknown' })
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
          const rwidth = measureTextSmallNumber(len)
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
    } else if (type === SOFTCLIP_TYPE || type === HARDCLIP_TYPE) {
      const typeName = type === SOFTCLIP_TYPE ? 'softclip' : 'hardclip'
      const c = colorMap[typeName]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRectCtx(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
      items.push({ type: typeName, seq: base })
      coords.push(pos - clipW, topPx, pos + clipW * 2, bottomPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        fillRectCtx(ctx, l, topPx, clipW3, 1, canvasWidth, c)
        fillRectCtx(ctx, l, bottomPx - 1, clipW3, 1, canvasWidth, c)
        fillTextCtx(
          ctx,
          `(${base})`,
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
