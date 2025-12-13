import { measureText } from '@jbrowse/core/util'

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

import type { FlatbushItem } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'
import { isInterbaseType } from '../../SNPCoverageAdapter/util'

// Pre-computed alpha lookup table for quality scores 0-50
// Maps quality score to alpha value (qual/50, clamped to 1)
const QUAL_ALPHA_TABLE = new Float32Array(51)
for (let i = 0; i <= 50; i++) {
  QUAL_ALPHA_TABLE[i] = i / 50
}

// Cache for alpha-modified colors: "color:qual" -> rgba string
const alphaColorCache = new Map<string, string>()
const MAX_ALPHA_CACHE_SIZE = 500

function applyQualAlpha(baseColor: string, qual: number | undefined) {
  if (qual === undefined || qual <= 0) {
    return baseColor
  }
  const alpha = qual >= 50 ? 1 : QUAL_ALPHA_TABLE[qual]!
  if (alpha === 1) {
    return baseColor
  }

  const cacheKey = `${baseColor}:${qual}`
  let cached = alphaColorCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Parse hex color and apply alpha directly
  if (baseColor.startsWith('#') && baseColor.length === 7) {
    const r = parseInt(baseColor.slice(1, 3), 16)
    const g = parseInt(baseColor.slice(3, 5), 16)
    const b = parseInt(baseColor.slice(5, 7), 16)
    cached = `rgba(${r},${g},${b},${alpha.toFixed(2)})`
  } else {
    // Fallback for non-hex colors
    cached = baseColor
  }

  if (alphaColorCache.size >= MAX_ALPHA_CACHE_SIZE) {
    alphaColorCache.clear()
  }
  alphaColorCache.set(cacheKey, cached)
  return cached
}

// Pre-computed deletion text widths for lengths 1-20 (common cases)
// Index 0 is unused, indices 1-20 contain widths
const DELETION_TEXT_WIDTHS: number[] = new Array(21)
for (let i = 1; i <= 20; i++) {
  DELETION_TEXT_WIDTHS[i] = measureText(String(i), 10)
}

function getDeletionTextWidth(len: number) {
  return len <= 20 ? DELETION_TEXT_WIDTHS[len]! : measureText(String(len), 10)
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
  checkRef,
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
  checkRef?: boolean
}) {
  const items: FlatbushItem[] = []
  const coords: number[] = []
  const { heightPx, topPx, feature } = feat
  const bottomPx = topPx + heightPx
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  const featRefName = feature.get('refName')

  // Optimize region lookup - check first region (common case) before searching
  const region = checkRef
    ? regions.find(
        r =>
          r.refName === featRefName && r.start <= featStart && featEnd <= r.end,
      )!
    : regions[0]!

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

  // Extract frequently used colorMap values to locals
  const deletionColor = colorMap.deletion!
  const skipColor = colorMap.skip!
  const insertionColor = colorMap.insertion!
  const deletionContrastColor = colorContrastMap.deletion!
  const insertionContrastColor = colorContrastMap.insertion!

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = reversed ? invBpPerPx + 1 : -1

  // first pass: draw mismatches, deletions, skips
  for (let i = 0; i < count; i++) {
    const type = types[i]!
    if (isInterbaseType(type)) {
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
        // Inline fillRectCtx for hot path
        const l = Math.round(leftPx)
        if (l + widthPx >= 0 && l <= canvasWidth) {
          ctx.fillStyle = c
          ctx.fillRect(l, topPx, widthPx, heightPx)
        }
      }

      if (widthPx >= charWidth && canRenderText) {
        const contrastColor = drawSNPsMuted
          ? 'black'
          : colorContrastMap[baseChar] || 'black'
        const textColor = useAlpha
          ? applyQualAlpha(contrastColor, qual)
          : contrastColor
        const textX = leftPx + (widthPx - charWidth) / 2 + 1
        if (textX >= 0 && textX <= canvasWidth) {
          ctx.fillStyle = textColor
          ctx.fillText(baseChar, textX, bottomPx)
        }
      }
    } else if (type === TYPE_DELETION && drawIndels) {
      const len = mlen
      if (!hideSmallIndels || len >= 10) {
        const delWidth = Math.abs(leftPx - rightPx)
        if (leftPx + delWidth >= 0 && leftPx <= canvasWidth) {
          ctx.fillStyle = deletionColor
          ctx.fillRect(leftPx, topPx, delWidth, heightPx)
        }
        if (bpPerPx < 3) {
          items.push({ type: 'deletion', seq: `${len}` })
          coords.push(leftPx, topPx, rightPx, bottomPx)
        }
        const rwidth = getDeletionTextWidth(len)
        if (widthPx >= rwidth && canRenderText) {
          const txt = String(len)
          const textX = (leftPx + rightPx) / 2 - rwidth / 2
          if (textX >= 0 && textX <= canvasWidth) {
            ctx.fillStyle = deletionContrastColor
            ctx.fillText(txt, textX, bottomPx)
          }
        }
      }
    } else if (type === TYPE_SKIP) {
      const skipWidth = Math.max(widthPx, 1.5)
      if (leftPx + skipWidth >= 0 && leftPx <= canvasWidth) {
        ctx.fillStyle = skipColor
        ctx.fillRect(leftPx, topPx + heightPx / 2 - 1, skipWidth, 1)
      }
    }
  }

  // Pre-extract clip colors
  const softclipColor = colorMap.softclip!
  const hardclipColor = colorMap.hardclip!

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
          ctx.fillStyle = insertionColor
          if (pos + insW >= 0 && pos <= canvasWidth) {
            ctx.fillRect(pos, topPx, insW, heightPx)
          }
          if (invBpPerPx >= charWidth && canRenderText) {
            const l = Math.round(pos - insW)
            const insW3 = insW * 3
            if (l + insW3 >= 0 && l <= canvasWidth) {
              ctx.fillRect(l, topPx, insW3, 1)
              ctx.fillRect(l, bottomPx - 1, insW3, 1)
            }
            const textX = pos + 3
            if (textX >= 0 && textX <= canvasWidth) {
              ctx.fillText(`(${len})`, textX, bottomPx)
            }
          }
          if (bpPerPx < 3) {
            items.push({ type: 'insertion', seq: insBasesStr })
            coords.push(leftPx - 2, topPx, leftPx + insW + 2, bottomPx)
          }
        }
      } else {
        items.push({ type: 'insertion', seq: insBasesStr })
        const txt = String(len)
        if (bpPerPx > largeInsertionIndicatorScale) {
          coords.push(leftPx - 1, topPx, leftPx + 1, bottomPx)
          if (leftPx + 1 >= 0 && leftPx - 1 <= canvasWidth) {
            ctx.fillStyle = insertionColor
            ctx.fillRect(leftPx - 1, topPx, 2, heightPx)
          }
        } else if (heightPx > charHeight) {
          const rwidth = getDeletionTextWidth(len)
          const padding = 5
          const rectX = leftPx - rwidth / 2 - padding
          const rectW = rwidth + 2 * padding
          coords.push(rectX, topPx, leftPx + rwidth / 2 + padding, bottomPx)
          if (rectX + rectW >= 0 && rectX <= canvasWidth) {
            ctx.fillStyle = 'purple'
            ctx.fillRect(rectX, topPx, rectW, heightPx)
            ctx.fillStyle = insertionContrastColor
            ctx.fillText(txt, leftPx - rwidth / 2, bottomPx)
          }
        } else {
          const padding = 2
          coords.push(leftPx - padding, topPx, leftPx + padding, bottomPx)
          if (leftPx + padding >= 0 && leftPx - padding <= canvasWidth) {
            ctx.fillStyle = insertionColor
            ctx.fillRect(leftPx - padding, topPx, 2 * padding, heightPx)
          }
        }
      }
    } else if (type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP) {
      const isSoftclip = type === TYPE_SOFTCLIP
      const len = lengths[i]!
      const baseStr = isSoftclip ? `S${len}` : `H${len}`
      const c = isSoftclip ? softclipColor : hardclipColor
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      if (pos + clipW >= 0 && pos <= canvasWidth) {
        ctx.fillStyle = c
        ctx.fillRect(pos, topPx, clipW, heightPx)
      }
      items.push({ type: isSoftclip ? 'softclip' : 'hardclip', seq: baseStr })
      coords.push(pos - clipW, topPx, pos + clipW * 2, bottomPx)
      if (invBpPerPx >= charWidth && canRenderText) {
        const l = pos - clipW
        const clipW3 = clipW * 3
        if (l + clipW3 >= 0 && l <= canvasWidth) {
          ctx.fillRect(l, topPx, clipW3, 1)
          ctx.fillRect(l, bottomPx - 1, clipW3, 1)
        }
        const textX = pos + 3
        if (textX >= 0 && textX <= canvasWidth) {
          ctx.fillText(`(${baseStr})`, textX, bottomPx)
        }
      }
    }
  }

  return { coords, items }
}
