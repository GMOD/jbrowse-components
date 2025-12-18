import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { featurizeSA } from '../MismatchParser'
import {
  fillColor,
  getPairedInsertSizeAndOrientationColor,
  getPairedInsertSizeColor,
  getPairedOrientationColor,
} from '../shared/color'
import { hasPairedReads } from '../shared/util'

import type { ChainData, ColorBy } from '../shared/types'

function jitter(n: number) {
  return Math.random() * 2 * n - n
}

interface CoreFeat {
  strand: number
  refName: string
  start: number
  end: number
}

function drawLineAtOffset(
  ctx: CanvasRenderingContext2D,
  offset: number,
  height: number,
  color: string,
) {
  // draws a vertical line off to middle of nowhere if the second end not found
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(offset, 0)
  ctx.lineTo(offset, height)
  ctx.stroke()
}

interface DrawFeatsRPCParams {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  chainData: ChainData
  colorBy: ColorBy
  drawInter: boolean
  drawLongRange: boolean
  lineWidth: number
  jitter: number
  view: any
  offsetPx: number
  stopToken?: string
}

export function drawFeatsRPC(params: DrawFeatsRPCParams) {
  const {
    ctx,
    height,
    chainData,
    colorBy,
    drawInter,
    drawLongRange,
    lineWidth,
    jitter: jitterVal,
    view,
    offsetPx,
    stopToken,
  } = params

  const { chains, stats } = chainData
  const { type } = colorBy
  const hasPaired = hasPairedReads(chainData)

  ctx.lineWidth = lineWidth

  function draw(
    k1: CoreFeat & { tlen?: number; pair_orientation?: string },
    k2: CoreFeat,
    longRange?: boolean,
  ) {
    const s1 = k1.strand
    const s2 = k2.strand
    const f1 = s1 === -1
    const f2 = s2 === -1

    const p1 = f1 ? k1.start : k1.end
    const p2 = hasPaired ? (f2 ? k2.start : k2.end) : f2 ? k2.end : k2.start
    // Assume refNames are already canonical in the webworker context
    const r1 = view.bpToPx({ refName: k1.refName, coord: p1 })?.offsetPx
    const r2 = view.bpToPx({ refName: k2.refName, coord: p2 })?.offsetPx

    if (r1 !== undefined && r2 !== undefined) {
      const radius = (r2 - r1) / 2
      const absrad = Math.abs(radius)
      const p = r1 - offsetPx
      const p2 = r2 - offsetPx
      const drawArcInsteadOfBezier = absrad > 10_000

      // bezier (used for non-long-range arcs) requires moveTo before beginPath
      // arc (used for long-range) requires moveTo after beginPath (or else a
      // unwanted line at y=0 is rendered along with the arc)
      if (longRange && drawArcInsteadOfBezier) {
        ctx.moveTo(p, 0)
        ctx.beginPath()
      } else {
        ctx.beginPath()
        ctx.moveTo(p, 0)
      }

      if (longRange && drawArcInsteadOfBezier) {
        ctx.strokeStyle = fillColor.color_longinsert
      } else {
        if (hasPaired) {
          if (type === 'insertSizeAndOrientation') {
            ctx.strokeStyle = getPairedInsertSizeAndOrientationColor(
              k1,
              stats,
            )[0]
          } else if (type === 'orientation') {
            ctx.strokeStyle = getPairedOrientationColor(k1)[0]
          } else if (type === 'insertSize') {
            ctx.strokeStyle =
              getPairedInsertSizeColor(k1, stats)?.[0] ||
              fillColor.color_unknown
          } else if (type === 'gradient') {
            ctx.strokeStyle = `hsl(${Math.log10(absrad) * 10},50%,50%)`
          }
        } else {
          if (type === 'orientation' || type === 'insertSizeAndOrientation') {
            if (s1 === -1 && s2 === 1) {
              ctx.strokeStyle = fillColor.color_longread_rev_fwd
            } else if (s1 === 1 && s2 === -1) {
              ctx.strokeStyle = fillColor.color_longread_fwd_rev
            } else {
              ctx.strokeStyle = fillColor.color_longread_same
            }
          } else if (type === 'gradient') {
            ctx.strokeStyle = `hsl(${Math.log10(absrad) * 10},50%,50%)`
          }
        }
      }

      const destX = p + radius * 2
      const destY = Math.min(height + jitter(jitterVal), absrad)
      if (longRange) {
        // avoid drawing gigantic circles that glitch out the rendering,
        // instead draw vertical lines
        if (absrad > 100_000) {
          drawLineAtOffset(
            ctx,
            p + jitter(jitterVal),
            height,
            fillColor.color_longinsert,
          )
          drawLineAtOffset(
            ctx,
            p2 + jitter(jitterVal),
            height,
            fillColor.color_longinsert,
          )
        } else if (drawArcInsteadOfBezier) {
          ctx.arc(p + radius + jitter(jitterVal), 0, absrad, 0, Math.PI)
          ctx.stroke()
        } else {
          ctx.bezierCurveTo(
            p + jitter(jitterVal),
            destY,
            destX,
            destY,
            destX + jitter(jitterVal),
            0,
          )
          ctx.stroke()
        }
      } else {
        ctx.bezierCurveTo(
          p + jitter(jitterVal),
          destY,
          destX,
          destY,
          destX + jitter(jitterVal),
          0,
        )
        ctx.stroke()
      }
    } else if (r1 && drawInter) {
      drawLineAtOffset(ctx, r1 - offsetPx, height, fillColor.color_interchrom)
    }
  }

  forEachWithStopTokenCheck(chains, stopToken, chain => {
    // chain.length === 1, singleton (other pairs/mates not in view)
    if (chain.length === 1 && drawLongRange) {
      const f = chain[0]!
      if (hasPaired && !(f.get('flags') & 8)) {
        const mate = {
          refName: f.get('next_ref') || '',
          start: f.get('next_pos') || 0,
          end: f.get('next_pos') || 0,
          strand: f.get('strand'),
        }
        const k1 = {
          refName: f.get('refName'),
          next_ref: f.get('next_ref'),
          start: f.get('start'),
          end: f.get('end'),
          strand: f.get('strand'),
          tlen: f.get('template_length'),
          pair_orientation: f.get('pair_orientation'),
        }
        draw(k1, mate, true)
      } else {
        const features = [
          f,
          ...featurizeSA(f.get('SA'), f.id(), f.get('strand'), f.get('name')),
        ].sort((a, b) => {
          const aClipPos = 'get' in a ? a.get('clipPos') : a.clipPos
          const bClipPos = 'get' in b ? b.get('clipPos') : b.clipPos
          return aClipPos - bClipPos
        })
        for (let i = 0; i < features.length - 1; i++) {
          const fItem = features[i]!
          const v1Item = features[i + 1]!
          const k1 =
            'get' in fItem
              ? {
                  refName: fItem.get('refName'),
                  next_ref: fItem.get('next_ref'),
                  start: fItem.get('start'),
                  end: fItem.get('end'),
                  strand: fItem.get('strand'),
                  tlen: fItem.get('template_length'),
                  pair_orientation: fItem.get('pair_orientation'),
                }
              : fItem
          const k2 =
            'get' in v1Item
              ? {
                  refName: v1Item.get('refName'),
                  start: v1Item.get('start'),
                  end: v1Item.get('end'),
                  strand: v1Item.get('strand'),
                }
              : v1Item
          draw(k1, k2, true)
        }
      }
    } else {
      const res = hasPaired
        ? chain.filter(f => !(f.get('flags') & 2048) && !(f.get('flags') & 8))
        : chain
            .sort((a, b) => a.get('clipPos') - b.get('clipPos'))
            .filter(f => !(f.get('flags') & 256))
      for (let i = 0; i < res.length - 1; i++) {
        const f = res[i]!
        const v1 = res[i + 1]!
        const k1 = {
          refName: f.get('refName'),
          next_ref: f.get('next_ref'),
          start: f.get('start'),
          end: f.get('end'),
          strand: f.get('strand'),
          tlen: f.get('template_length'),
          pair_orientation: f.get('pair_orientation'),
        }
        const k2 = {
          refName: v1.get('refName'),
          start: v1.get('start'),
          end: v1.get('end'),
          strand: v1.get('strand'),
        }
        draw(k1, k2, false)
      }
    }
  })
}
