import { bpSpanPx, measureText } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { fillRect } from './util'
import type { RenderArgsWithColor } from './makeImageData'
import type { LayoutFeature } from './util'
import type { Mismatch } from '../shared/types'

export function renderMismatches({
  ctx,
  feat,
  renderArgs,
  minSubfeatureWidth,
  largeInsertionIndicatorScale,
  mismatchAlpha,
  charWidth,
  charHeight,
  colorForBase,
  contrastForBase,
  canvasWidth,
  drawSNPsMuted,
  drawIndels = true,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: RenderArgsWithColor
  colorForBase: Record<string, string>
  contrastForBase: Record<string, string>
  mismatchAlpha?: boolean
  drawIndels?: boolean
  drawSNPsMuted?: boolean
  minSubfeatureWidth: number
  largeInsertionIndicatorScale: number
  charWidth: number
  charHeight: number
  canvasWidth: number
}) {
  const { bpPerPx, regions } = renderArgs
  const { heightPx, topPx, feature } = feat
  const region = regions[0]!
  const start = feature.get('start')

  const pxPerBp = Math.min(1 / bpPerPx, 2)
  const mismatches = feature.get('mismatches') as Mismatch[] | undefined
  const heightLim = charHeight - 2

  // extraHorizontallyFlippedOffset is used to draw interbase items, which are
  // located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = region.reversed ? 1 / bpPerPx + 1 : -1

  if (!mismatches) {
    return
  }

  // two pass rendering: first pass, draw all the mismatches except wide
  // insertion markers
  for (const mismatch of mismatches) {
    const mstart = start + mismatch.start
    const mlen = mismatch.length
    const mbase = mismatch.base
    const [leftPx, rightPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
    const widthPx = Math.max(minSubfeatureWidth, rightPx - leftPx)
    if (mismatch.type === 'mismatch') {
      if (!drawSNPsMuted) {
        const baseColor = colorForBase[mismatch.base] || '#888'
        const c =
          mismatchAlpha && mismatch.qual !== undefined
            ? colord(baseColor)
                .alpha(Math.min(1, mismatch.qual / 50))
                .toHslString()
            : baseColor

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
          : contrastForBase[mismatch.base] || 'black'
        ctx.fillStyle =
          mismatchAlpha && mismatch.qual !== undefined
            ? colord(contrastColor)
                .alpha(Math.min(1, mismatch.qual / 50))
                .toHslString()
            : contrastColor
        ctx.fillText(
          mbase,
          leftPx + (widthPx - charWidth) / 2 + 1,
          topPx + heightPx,
        )
      }
    } else if (mismatch.type === 'deletion' && drawIndels) {
      fillRect(
        ctx,
        leftPx,
        topPx,
        Math.abs(leftPx - rightPx),
        heightPx,
        canvasWidth,
        colorForBase.deletion,
      )
      const txt = `${mismatch.length}`
      const rwidth = measureText(txt, 10)
      if (widthPx >= rwidth && heightPx >= heightLim) {
        ctx.fillStyle = contrastForBase.deletion!
        ctx.fillText(txt, (leftPx + rightPx) / 2 - rwidth / 2, topPx + heightPx)
      }
    } else if (mismatch.type === 'insertion' && drawIndels) {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const len = +mismatch.base || mismatch.length
      const insW = Math.max(0, Math.min(1.2, 1 / bpPerPx))
      if (len < 10) {
        fillRect(ctx, pos, topPx, insW, heightPx, canvasWidth, 'purple')
        if (1 / bpPerPx >= charWidth && heightPx >= heightLim) {
          const l = pos - insW
          fillRect(ctx, l, topPx, insW * 3, 1, canvasWidth)
          fillRect(ctx, l, topPx + heightPx - 1, insW * 3, 1, canvasWidth)
          ctx.fillText(`(${mismatch.base})`, pos + 3, topPx + heightPx)
        }
      }
    } else if (mismatch.type === 'hardclip' || mismatch.type === 'softclip') {
      const pos = leftPx + extraHorizontallyFlippedOffset
      const c = mismatch.type === 'hardclip' ? 'red' : 'blue'
      const clipW = Math.max(minSubfeatureWidth, pxPerBp)
      fillRect(ctx, pos, topPx, clipW, heightPx, canvasWidth, c)
      if (1 / bpPerPx >= charWidth && heightPx >= heightLim) {
        const l = pos - clipW
        fillRect(ctx, l, topPx, clipW * 3, 1, canvasWidth)
        fillRect(ctx, l, topPx + heightPx - 1, clipW * 3, 1, canvasWidth)
        ctx.fillText(`(${mismatch.base})`, pos + 3, topPx + heightPx)
      }
    } else if (mismatch.type === 'skip') {
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
        fillRect(ctx, l, t, w, h, canvasWidth, 'rgb(151,184,201)')
      }
    }
  }

  // second pass, draw wide insertion markers on top
  if (drawIndels) {
    for (const mismatch of mismatches) {
      const mstart = start + mismatch.start
      const mlen = mismatch.length
      const len = +mismatch.base || mismatch.length
      if (mismatch.type === 'insertion' && len >= 10) {
        const [leftPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
        const txt = `${len}`
        if (bpPerPx > largeInsertionIndicatorScale) {
          fillRect(ctx, leftPx - 1, topPx, 2, heightPx, canvasWidth, 'purple')
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
          ctx.fillStyle = 'white'
          ctx.fillText(txt, leftPx - rwidth / 2, topPx + heightPx)
        } else {
          const padding = 2
          fillRect(
            ctx,
            leftPx - padding,
            topPx,
            2 * padding,
            heightPx,
            canvasWidth,
            'purple',
          )
        }
      }
    }
  }
}
