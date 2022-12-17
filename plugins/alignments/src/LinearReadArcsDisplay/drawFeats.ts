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

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0].flags & 1) {
      return true
    }
  }
  return false
}

type LGV = LinearGenomeViewModel

interface CoreFeat {
  strand: number
  refName: string
  start: number
  end: number
}

export default async function drawFeats(
  self: {
    setLastDrawnOffsetPx: (n: number) => void
    drawInter?: boolean
    drawLongRange?: boolean
    setError: (e: unknown) => void
    colorBy?: { type: string }
    height: number
    chainData?: ChainData
    lineWidthSetting: number
  },
  ctx: CanvasRenderingContext2D,
) {
  const { chainData } = self
  if (!chainData) {
    return
  }
  const displayHeight = self.height
  const view = getContainingView(self) as LGV
  const { assemblyManager } = getSession(self)
  self.setLastDrawnOffsetPx(view.offsetPx)
  ctx.lineWidth = self.lineWidthSetting
  const { chains, stats } = chainData
  const hasPaired = hasPairedReads(chainData)
  const assemblyName = view.assemblyNames[0]
  const asm = assemblyManager.get(assemblyName)
  const type = self.colorBy?.type || 'insertSizeAndOrientation'
  if (!asm) {
    return
  }

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

    const r1 = view.bpToPx({
      refName: assembly.getCanonicalRefName(k1.refName),
      coord: p1,
    })
    const r2 = view.bpToPx({
      refName: assembly.getCanonicalRefName(k2.refName),
      coord: p2,
    })

    if (r1 && r2) {
      const radius = (r2.offsetPx - r1.offsetPx) / 2
      const absrad = Math.abs(radius)
      const p = r1.offsetPx - view.offsetPx

      // bezier (used for non-long-range arcs) requires moveTo before beginPath
      // arc (used for long-range) requires moveTo after beginPath (or else a
      // unwanted line at y=0 is rendered along with the arc)
      if (longRange) {
        ctx.moveTo(p, 0)
        ctx.beginPath()
      } else {
        ctx.beginPath()
        ctx.moveTo(p, 0)
      }

      if (longRange) {
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
            ctx.strokeStyle = `hsl(${
              Math.log10(Math.abs(p1 - p2)) * 10
            },50%,50%)`
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
            ctx.strokeStyle = `hsl(${
              Math.log10(Math.abs(p1 - p2)) * 10
            },50%,50%)`
          }
        }
      }

      const destX = p + radius * 2
      const destY = Math.min(displayHeight, absrad)
      if (longRange) {
        ctx.arc(p + radius, 0, absrad, 0, Math.PI)
      } else {
        ctx.bezierCurveTo(p, destY, destX, destY, destX, 0)
      }
      ctx.stroke()
    } else if (r1 && self.drawInter) {
      // draws a vertical line off to middle of nowhere if the second end not found
      const p = r1.offsetPx - view.offsetPx
      ctx.strokeStyle = 'purple'
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, displayHeight)
      ctx.stroke()
    }
  }

  for (let i = 0; i < chains.length; i++) {
    let chain = chains[i]

    if (chain.length === 1 && self.drawLongRange) {
      // singleton feature
      const f = chain[0]

      // special case where we look at RPOS/RNEXT
      if (hasPaired) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const refName = f.next_ref!
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const coord = f.next_pos!
        draw(
          f,
          {
            refName,
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
      if (!hasPaired) {
        chain.sort((a, b) => a.clipPos - b.clipPos)
        chain = chain.filter(f => !(f.flags & 256))
      } else {
        // ignore split/supplementary reads for hasPaired=true for now
        chain = chain.filter(f => !(f.flags & 2048))
      }
      for (let i = 0; i < chain.length - 1; i++) {
        draw(chain[i], chain[i + 1], asm, false)
      }
    }
  }
}
