import { colord } from '@jbrowse/core/util/colord'

import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_REV_MAP,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '../../shared/forEachMismatchTypes'
import { measureTextSmallNumber } from '../util'

import type { MismatchCallback } from '../../shared/forEachMismatchTypes'
import type { Mismatch } from '../../shared/types'
import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

interface FeatureWithMismatchIterator {
  forEachMismatch(callback: MismatchCallback): void
}

const alphaColorCache = new Map<string, string>()
function applyQualAlpha(baseColor: string, qual: number) {
  const key = `${baseColor},${qual}`
  const hit = alphaColorCache.get(key)
  if (hit) {
    return hit
  }
  const result =
    qual >= 0
      ? colord(baseColor)
          .alpha(Math.min(1, qual / 50))
          .toHslString()
      : baseColor
  alphaColorCache.set(key, result)
  return result
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
  let lastColor = 'NONCOLOR'
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
  const secondPassItems: {
    type: number
    start: number
    base: string
    cliplen: number
  }[] = []

  // Check if feature has forEachMismatch method (BAM/CRAM adapters)
  const featureWithIterator = feature as unknown as FeatureWithMismatchIterator
  const mismatchHandler = (
    type: number,
    start: number,
    length: number,
    base: string,
    qualVal: number | undefined,
    _altbase: number | undefined,
    cliplen: number | undefined,
  ) => {
    const mismatchStart = featStart + start
    const mismatchEnd = mismatchStart + length

    // Handle insertions/clips in second pass
    if (
      type === INSERTION_TYPE ||
      type === SOFTCLIP_TYPE ||
      type === HARDCLIP_TYPE
    ) {
      if (mismatchStart >= regionStart && mismatchStart < regionEnd) {
        secondPassItems.push({
          type,
          start,
          base,
          cliplen: cliplen!,
        })
      }
      return
    }

    // Skip items entirely outside visible region
    if (mismatchEnd <= regionStart || mismatchStart >= regionEnd) {
      return
    }

    const leftPx = reversed
      ? (regionEnd - mismatchEnd) * invBpPerPx
      : (mismatchStart - regionStart) * invBpPerPx
    const rightPx = reversed
      ? (regionEnd - mismatchStart) * invBpPerPx
      : (mismatchEnd - regionStart) * invBpPerPx

    // if the mismatch is off-screen, don't render it
    if (rightPx < 0 || leftPx > canvasWidth) {
      return
    }

    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)

    if (type === MISMATCH_TYPE) {
      if (rightPx - leftPx >= 0.2) {
        items.push({
          type: 'mismatch',
          seq: base,
        })
        coords.push(leftPx, topPx, rightPx, bottomPx)
      }

      if (!drawSNPsMuted) {
        const baseColor = colorMap[base] || '#888'
        const c =
          useAlpha && qualVal ? applyQualAlpha(baseColor, qualVal) : baseColor
        const l = Math.round(leftPx)
        const w = widthPx
        if (l + w > 0 && l < canvasWidth) {
          if (lastColor !== c) {
            ctx.fillStyle = c
            lastColor = c
          }
          ctx.fillRect(l, topPx, w, heightPx)
        }
      }

      if (widthPx >= charWidth && canRenderText) {
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[base] || 'black'
        const textColor =
          useAlpha && qualVal
            ? applyQualAlpha(contrastColor, qualVal)
            : contrastColor
        const x = leftPx + (widthPx - charWidth) / 2 + 1
        if (x > 0 && x < canvasWidth) {
          if (textColor && lastColor !== textColor) {
            ctx.fillStyle = textColor
            lastColor = textColor
          }
          ctx.fillText(base, x, bottomPx)
        }
      }
    } else if (type === DELETION_TYPE && drawIndels) {
      if (!hideSmallIndels || length >= 10) {
        const w = Math.abs(leftPx - rightPx)
        if (leftPx + w > 0 && leftPx < canvasWidth) {
          const c = colorMap.deletion!
          if (lastColor !== c) {
            ctx.fillStyle = c
            lastColor = c
          }
          ctx.fillRect(leftPx, topPx, w, heightPx)
        }
        if (bpPerPx < 3) {
          items.push({
            type: 'deletion',
            seq: `${length}`,
          })
          coords.push(leftPx, topPx, rightPx, bottomPx)
        }
        const txt = String(length)
        const rwidth = measureTextSmallNumber(length, 10)
        if (widthPx >= rwidth && canRenderText) {
          const x = (leftPx + rightPx) / 2 - rwidth / 2
          const c = colorContrastMap.deletion!
          if (x > 0 && x < canvasWidth) {
            if (lastColor !== c) {
              ctx.fillStyle = c
              lastColor = c
            }
            ctx.fillText(txt, x, bottomPx)
          }
        }
      }
    } else if (type === SKIP_TYPE) {
      const w = Math.max(widthPx, 1.5)
      if (leftPx + w > 0 && leftPx < canvasWidth) {
        const c = colorMap.skip!
        if (lastColor !== c) {
          ctx.fillStyle = c
          lastColor = c
        }
        ctx.fillRect(leftPx, topPx + heightPx / 2 - 1, w, 1)
      }
    }
  }

  // First pass: draw mismatches, deletions, skips - accumulate insertions/clips
  if ('forEachMismatch' in feature) {
    featureWithIterator.forEachMismatch(mismatchHandler)
  } else {
    const mismatches = feature.get('mismatches') as Mismatch[] | undefined
    if (mismatches) {
      for (let i = 0, l = mismatches.length; i < l; i++) {
        const m = mismatches[i]!
        mismatchHandler(
          MISMATCH_REV_MAP[m.type],
          m.start,
          m.length,
          m.base,
          m.qual,
          m.altbase?.charCodeAt(0),
          m.cliplen || +m.base,
        )
      }
    }
  }

  // Second pass: draw insertions and clips on top
  for (const item of secondPassItems) {
    const { type, start, base, cliplen } = item
    const mstart = featStart + start

    const leftPx = reversed
      ? (regionEnd - mstart - 1) * invBpPerPx
      : (mstart - regionStart) * invBpPerPx
    const pos = leftPx + extraHorizontallyFlippedOffset

    // if the mismatch is off-screen, don't render it. give 20px buffer
    if (pos < -20 || pos > canvasWidth + 20) {
      continue
    }

    if (type === INSERTION_TYPE && drawIndels) {
      const len = cliplen
      const insW = Math.max(0, Math.min(1.2, invBpPerPx))

      if (len < 10) {
        if (!hideSmallIndels) {
          const c = colorMap.insertion!
          if (pos + insW > 0 && pos < canvasWidth) {
            if (lastColor !== c) {
              ctx.fillStyle = c
              lastColor = c
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
              ctx.fillText(`(${len})`, x, bottomPx)
            }
          }
          if (bpPerPx < 3) {
            items.push({
              type: 'insertion',
              seq: base || 'unknown',
            })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, bottomPx)
          }
        }
      } else {
        items.push({ type: 'insertion', seq: base || 'unknown' })
        const txt = `${len}`
        if (bpPerPx > largeInsertionIndicatorScale) {
          coords.push(leftPx - 1, topPx, leftPx + 1, bottomPx)
          const l = leftPx - 1
          const w = 2
          if (l + w > 0 && l < canvasWidth) {
            const c = colorMap.insertion!
            if (lastColor !== c) {
              ctx.fillStyle = c
              lastColor = c
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
            const c = colorMap.insertion!
            if (lastColor !== c) {
              ctx.fillStyle = c
              lastColor = c
            }
            ctx.fillRect(l, topPx, w, heightPx)
          }
          const x = leftPx - rwidth / 2
          const c = colorContrastMap.insertion!
          if (x > 0 && x < canvasWidth) {
            if (lastColor !== c) {
              ctx.fillStyle = c
              lastColor = c
            }
            ctx.fillText(txt, x, bottomPx)
          }
        } else {
          const padding = 2
          coords.push(leftPx - padding, topPx, leftPx + padding, bottomPx)
          const l = leftPx - padding
          const w = 2 * padding
          if (l + w > 0 && l < canvasWidth) {
            const c = colorMap.insertion!
            if (lastColor !== c) {
              ctx.fillStyle = c
              lastColor = c
            }
            ctx.fillRect(l, topPx, w, heightPx)
          }
        }
      }
    } else if (type === SOFTCLIP_TYPE || type === HARDCLIP_TYPE) {
      const typeName = type === SOFTCLIP_TYPE ? 'softclip' : 'hardclip'
      const c = colorMap[typeName]!
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      if (pos + clipW > 0 && pos < canvasWidth) {
        if (lastColor !== c) {
          ctx.fillStyle = c
          lastColor = c
        }
        ctx.fillRect(pos, topPx, clipW, heightPx)
      }
      items.push({ type: typeName, seq: base })
      coords.push(pos - clipW, topPx, pos + clipW * 2, bottomPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        if (l + clipW3 > 0 && l < canvasWidth) {
          if (lastColor !== c) {
            ctx.fillStyle = c
            lastColor = c
          }
          ctx.fillRect(l, topPx, clipW3, 1)
          ctx.fillRect(l, bottomPx - 1, clipW3, 1)
        }
        const x = pos + 3
        if (x > 0 && x < canvasWidth) {
          if (lastColor !== c) {
            ctx.fillStyle = c
            lastColor = c
          }
          ctx.fillText(`(${base})`, x, bottomPx)
        }
      }
    }
  }

  return {
    coords,
    items,
  }
}
