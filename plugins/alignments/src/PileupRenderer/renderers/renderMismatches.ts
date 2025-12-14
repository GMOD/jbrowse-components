import { colord } from '@jbrowse/core/util/colord'

import { measureTextSmallNumber } from '../util'

import type { Mismatch } from '../../shared/types'
import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

const lastFillStyleMap = new WeakMap<CanvasRenderingContext2D, string>()

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
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const canRenderText = heightPx >= charHeight - 2
  const useAlpha = mismatchAlpha === true
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = reversed ? invBpPerPx + 1 : -1

  // first pass: draw mismatches, deletions, skips
  for (let i = 0, l = mismatches.length; i < l; i++) {
    const mismatch = mismatches[i]!
    const type = mismatch.type
    if (type === 'insertion' || type === 'softclip' || type === 'hardclip') {
      continue
    }

    const mstart = featStart + mismatch.start
    const mend = mstart + mismatch.length

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
        const w = widthPx
        const l = Math.round(leftPx)
        if (l + w > 0 && l < canvasWidth) {
          if (c && lastFillStyleMap.get(ctx) !== c) {
            ctx.fillStyle = c
            lastFillStyleMap.set(ctx, c)
          }
          ctx.fillRect(l, topPx, w, heightPx)
        }
      }

      if (widthPx >= charWidth && canRenderText) {
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[mismatch.base] || 'black'
        const textColor = useAlpha
          ? applyQualAlpha(contrastColor, mismatch.qual)
          : contrastColor
        const x = leftPx + (widthPx - charWidth) / 2 + 1
        if (x > 0 && x < canvasWidth) {
          if (textColor && lastFillStyleMap.get(ctx) !== textColor) {
            ctx.fillStyle = textColor
            lastFillStyleMap.set(ctx, textColor)
          }
          ctx.fillText(mismatch.base, x, bottomPx)
        }
      }
    } else if (type === 'deletion' && drawIndels) {
      const len = mismatch.length
      if (!hideSmallIndels || len >= 10) {
        const w = Math.abs(leftPx - rightPx)
        if (leftPx + w > 0 && leftPx < canvasWidth) {
          const c = colorMap.deletion
          if (c && lastFillStyleMap.get(ctx) !== c) {
            ctx.fillStyle = c
            lastFillStyleMap.set(ctx, c)
          }
          ctx.fillRect(leftPx, topPx, w, heightPx)
        }
        if (bpPerPx < 3) {
          items.push({ type: 'deletion', seq: `${len}` })
          coords.push(leftPx, topPx, rightPx, bottomPx)
        }
        const txt = String(len)
        const rwidth = measureTextSmallNumber(len, 10)
        if (widthPx >= rwidth && canRenderText) {
          const x = (leftPx + rightPx) / 2 - rwidth / 2
          const c = colorContrastMap.deletion
          if (x > 0 && x < canvasWidth) {
            if (c && lastFillStyleMap.get(ctx) !== c) {
              ctx.fillStyle = c
              lastFillStyleMap.set(ctx, c)
            }
            ctx.fillText(txt, x, bottomPx)
          }
        }
      }
    } else if (type === 'skip') {
      const w = Math.max(widthPx, 1.5)
      if (leftPx + w > 0 && leftPx < canvasWidth) {
        const c = colorMap.skip
        if (c && lastFillStyleMap.get(ctx) !== c) {
          ctx.fillStyle = c
          lastFillStyleMap.set(ctx, c)
        }
        ctx.fillRect(leftPx, topPx + heightPx / 2 - 1, w, 1)
      }
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

    // Skip if outside visible region
    if (mstart < regionStart || mstart >= regionEnd) {
      continue
    }

    const leftPx = reversed
      ? (regionEnd - mstart - 1) * invBpPerPx
      : (mstart - regionStart) * invBpPerPx
    const pos = leftPx + extraHorizontallyFlippedOffset

    if (type === 'insertion' && drawIndels) {
      const len = +mismatch.base || mismatch.length
      const insW = Math.max(0, Math.min(1.2, invBpPerPx))

      if (len < 10) {
        if (!hideSmallIndels) {
          if (pos + insW > 0 && pos < canvasWidth) {
            const c = colorMap.insertion!
            if (c && lastFillStyleMap.get(ctx) !== c) {
              ctx.fillStyle = c
              lastFillStyleMap.set(ctx, c)
            }
            ctx.fillRect(pos, topPx, insW, heightPx)
          }

          if (invBpPerPx >= charWidth && canRenderText) {
            const l = Math.round(pos - insW)
            const insW3 = insW * 3
            if (l + insW3 > 0 && l < canvasWidth) {
              ctx.fillRect(l, topPx, insW3, 1)
              ctx.fillRect(l, bottomPx - 1, insW3, 1)
            }
            const x = pos + 3
            if (x > 0 && x < canvasWidth) {
              ctx.fillText(`(${mismatch.base})`, x, bottomPx)
            }
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
          const l = leftPx - 1
          const w = 2
          if (l + w > 0 && l < canvasWidth) {
            const c = colorMap.insertion
            if (c && lastFillStyleMap.get(ctx) !== c) {
              ctx.fillStyle = c
              lastFillStyleMap.set(ctx, c)
            }
            ctx.fillRect(l, topPx, w, heightPx)
          }
        } else if (heightPx > charHeight) {
          const rwidth = measureTextSmallNumber(len)
          const padding = 5
          coords.push(
            leftPx - rwidth / 2 - padding,
            topPx,
            leftPx + rwidth / 2 + padding,
            bottomPx,
          )
          const l = leftPx - rwidth / 2 - padding
          const w = rwidth + 2 * padding
          if (l + w > 0 && l < canvasWidth) {
            const c = 'purple'
            if (lastFillStyleMap.get(ctx) !== c) {
              ctx.fillStyle = c
              lastFillStyleMap.set(ctx, c)
            }
            ctx.fillRect(l, topPx, w, heightPx)
          }
          const x = leftPx - rwidth / 2
          const c = colorContrastMap.insertion
          if (x > 0 && x < canvasWidth) {
            if (c && lastFillStyleMap.get(ctx) !== c) {
              ctx.fillStyle = c
              lastFillStyleMap.set(ctx, c)
            }
            ctx.fillText(txt, x, bottomPx)
          }
        } else {
          const padding = 2
          coords.push(leftPx - padding, topPx, leftPx + padding, bottomPx)
          const l = leftPx - padding
          const w = 2 * padding
          if (l + w > 0 && l < canvasWidth) {
            const c = colorMap.insertion
            if (c && lastFillStyleMap.get(ctx) !== c) {
              ctx.fillStyle = c
              lastFillStyleMap.set(ctx, c)
            }
            ctx.fillRect(l, topPx, w, heightPx)
          }
        }
      }
    } else if (type === 'softclip' || type === 'hardclip') {
      const c = colorMap[type]
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      if (pos + clipW > 0 && pos < canvasWidth) {
        if (c && lastFillStyleMap.get(ctx) !== c) {
          ctx.fillStyle = c
          lastFillStyleMap.set(ctx, c)
        }
        ctx.fillRect(pos, topPx, clipW, heightPx)
      }
      items.push({ type, seq: mismatch.base })
      coords.push(pos - clipW, topPx, pos + clipW * 2, bottomPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        if (l + clipW3 > 0 && l < canvasWidth) {
          if (c && lastFillStyleMap.get(ctx) !== c) {
            ctx.fillStyle = c
            lastFillStyleMap.set(ctx, c)
          }
          ctx.fillRect(l, topPx, clipW3, 1)
          ctx.fillRect(l, bottomPx - 1, clipW3, 1)
        }
        const x = pos + 3
        if (x > 0 && x < canvasWidth) {
          if (c && lastFillStyleMap.get(ctx) !== c) {
            ctx.fillStyle = c
            lastFillStyleMap.set(ctx, c)
          }
          ctx.fillText(`(${mismatch.base})`, x, bottomPx)
        }
      }
    }
  }

  return { coords, items }
}
