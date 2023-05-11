import { getContainingView, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getOrientationColor,
  getInsertSizeColor,
  getInsertSizeAndOrientationColor,
} from '../shared/color'
import { ChainData } from '../shared/fetchChains'
import { featurizeSA } from '../MismatchParser'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { LinearReadArcsDisplayModel } from './model'

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0].flags & 1) {
      return true
    }
  }
  return false
}

type LGV = LinearGenomeViewModel

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

export default function drawFeats(
  self: LinearReadArcsDisplayModel,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const {
    chainData,
    colorBy,
    drawInter,
    drawLongRange,
    lineWidthSetting,
    jitterVal,
  } = self
  if (!chainData) {
    return
  }
  const view = getContainingView(self) as LGV
  const { assemblyManager } = getSession(self)
  const { chains, stats } = chainData
  const hasPaired = hasPairedReads(chainData)
  const asm = assemblyManager.get(view.assemblyNames[0])
  const type = colorBy?.type || 'insertSizeAndOrientation'
  if (!asm) {
    return
  }
  ctx.lineWidth = lineWidthSetting

  function draw(
    k1: CoreFeat & { tlen?: number; pair_orientation?: string },
    k2: CoreFeat,
    assembly: Assembly,
    longRange?: boolean,
  ) {
    const s1 = k1.strand
    const s2 = k2.strand
    const f1 = s1 === -1
    const f2 = s2 === -1

    const p1 = f1 ? k1.start : k1.end
    const p2 = hasPaired ? (f2 ? k2.start : k2.end) : f2 ? k2.end : k2.start
    const ra1 = assembly.getCanonicalRefName(k1.refName) || k1.refName
    const ra2 = assembly.getCanonicalRefName(k2.refName) || k2.refName
    const r1 = view.bpToPx({ refName: ra1, coord: p1 })
    const r2 = view.bpToPx({ refName: ra2, coord: p2 })

    if (r1 && r2) {
      const radius = (r2.offsetPx - r1.offsetPx) / 2
      const absrad = Math.abs(radius)
      const p = r1.offsetPx - view.offsetPx
      const p2 = r2.offsetPx - view.offsetPx
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
        ctx.strokeStyle = 'red'
      } else {
        if (hasPaired) {
          if (type === 'insertSizeAndOrientation') {
            ctx.strokeStyle = getInsertSizeAndOrientationColor(k1, k2, stats)
          } else if (type === 'orientation') {
            ctx.strokeStyle = getOrientationColor(k1)
          } else if (type === 'insertSize') {
            ctx.strokeStyle = getInsertSizeColor(k1, k2, stats) || 'grey'
          } else if (type === 'gradient') {
            ctx.strokeStyle = `hsl(${Math.log10(absrad) * 10},50%,50%)`
          }
        } else {
          if (type === 'orientation' || type === 'insertSizeAndOrientation') {
            if (s1 === -1 && s2 === 1) {
              ctx.strokeStyle = 'navy'
            } else if (s1 === 1 && s2 === -1) {
              ctx.strokeStyle = 'green'
            } else {
              ctx.strokeStyle = 'grey'
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
          drawLineAtOffset(ctx, p + jitter(jitterVal), height, 'red')
          drawLineAtOffset(ctx, p2 + jitter(jitterVal), height, 'red')
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
      drawLineAtOffset(ctx, r1.offsetPx - view.offsetPx, height, 'purple')
    }
  }

  for (const chain of chains) {
    if (chain.length === 1 && drawLongRange) {
      // singleton feature
      const f = chain[0]

      // special case where we look at RPOS/RNEXT
      if (hasPaired) {
        const coord = f.next_pos || 0
        draw(
          f,
          {
            refName: f.next_ref || '',
            start: coord,
            end: coord,
            strand: f.strand,
          },
          asm,
          true,
        )
      }

      // special case where we look at SA
      else {
        const suppAlns = featurizeSA(f.SA, f.id, f.strand, f.name)
        const features = [f, ...suppAlns].sort((a, b) => a.clipPos - b.clipPos)
        for (let i = 0; i < features.length - 1; i++) {
          const f = features[i]
          const v1 = features[i + 1]
          draw(f, v1, asm, true)
        }
      }
    } else {
      const res = hasPaired
        ? chain.filter(f => !(f.flags & 2048))
        : chain
            .sort((a, b) => a.clipPos - b.clipPos)
            .filter(f => !(f.flags & 256))
      for (let i = 0; i < res.length - 1; i++) {
        draw(res[i], res[i + 1], asm, false)
      }
    }
  }
}
