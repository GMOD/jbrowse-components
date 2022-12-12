import { getContainingView, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getOrientationColor,
  getInsertSizeColor,
  getInsertSizeAndOrientationColor,
} from '../shared/color'
import { ChainData } from '../shared/fetchChains'

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0].flags & 1) {
      return true
    }
  }
  return false
}

type LGV = LinearGenomeViewModel

export default async function drawFeats(
  self: {
    setLastDrawnOffsetPx: (n: number) => void
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

  for (let i = 0; i < chains.length; i++) {
    let chain = chains[i]
    if (!hasPaired) {
      chain.sort((a, b) => a.clipPos - b.clipPos)
    } else {
      // ignore split reads for now, just draw pairs
      chain = chain.filter(f => !(f.flags & 2048))
    }
    //console.log(chain.length, chain)
    if (chain.length === 1 && asm) {
      const v0 = chain[0]
      if (hasPaired) {
        const r1 = view.bpToPx({
          refName: v0.refName,
          coord: v0.start,
        })
        const nextRef = asm.getCanonicalRefName(v0.next_refName!)
        const r2 = view.bpToPx({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          refName: nextRef,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          coord: v0.next_segment_position!,
        })
        //console.log({ r1, r2, nextRef, v0 })
      } else {
      }
    } else {
      for (let i = 0; i < chain.length - 1; i++) {
        const v0 = chain[i]
        const v1 = chain[i + 1]
        const s1 = v0.strand
        const s2 = v1.strand
        const f1 = s1 === -1
        const f2 = s2 === -1
        const p1 = f1 ? v0.start : v0.end
        const p2 = hasPaired ? (f2 ? v1.start : v1.end) : f2 ? v1.end : v1.start

        const r1 = view.bpToPx({ refName: v0.refName, coord: p1 })
        const r2 = view.bpToPx({ refName: v0.refName, coord: p2 })

        if (!r1 || !r2) {
          continue
        }
        const radius = (r2.offsetPx - r1.offsetPx) / 2
        const absrad = Math.abs(radius)
        const p = r1.offsetPx - view.offsetPx
        ctx.beginPath()
        ctx.moveTo(p, 0)
        const type = self.colorBy?.type || 'insertSizeAndOrientation'

        if (hasPaired) {
          if (type === 'insertSizeAndOrientation') {
            ctx.strokeStyle = getInsertSizeAndOrientationColor(v0, v1, stats)
          } else if (type === 'orientation') {
            ctx.strokeStyle = getOrientationColor(v0)
          } else if (type === 'insertSize') {
            ctx.strokeStyle = getInsertSizeColor(v0, v1, stats) || 'grey'
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

        const destX = p + radius * 2
        const destY = Math.min(displayHeight, absrad)
        ctx.bezierCurveTo(p, destY, destX, destY, destX, 0)
        ctx.stroke()
      }
    }
  }
}
