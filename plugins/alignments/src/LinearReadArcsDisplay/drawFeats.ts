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
  const type = self.colorBy?.type || 'insertSizeAndOrientation'

  function draw(
    k1: {
      strand: number
      refName: string
      start: number
      end: number
      tlen?: number
      pair_orientation?: string
    },
    k2: { strand: number; refName: string; start: number; end: number },
  ) {
    const s1 = k1.strand
    const s2 = k2.strand
    const f1 = s1 === -1
    const f2 = s2 === -1

    const p1 = f1 ? k1.start : k1.end
    const p2 = hasPaired ? (f2 ? k2.start : k2.end) : f2 ? k2.end : k2.start

    const r1 = view.bpToPx({ refName: k1.refName, coord: p1 })
    const r2 = view.bpToPx({ refName: k2.refName, coord: p2 })

    if (!r1 || !r2) {
      return
    }
    const radius = (r2.offsetPx - r1.offsetPx) / 2
    const absrad = Math.abs(radius)
    const p = r1.offsetPx - view.offsetPx
    ctx.beginPath()
    ctx.moveTo(p, 0)

    if (hasPaired) {
      if (type === 'insertSizeAndOrientation') {
        ctx.strokeStyle = getInsertSizeAndOrientationColor(k1, k2, stats)
      } else if (type === 'orientation') {
        ctx.strokeStyle = getOrientationColor(k1)
      } else if (type === 'insertSize') {
        ctx.strokeStyle = getInsertSizeColor(k1, k2, stats) || 'grey'
      } else if (type === 'gradient') {
        ctx.strokeStyle = `hsl(${Math.log10(Math.abs(p1 - p2)) * 10},50%,50%)`
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
        ctx.strokeStyle = `hsl(${Math.log10(Math.abs(p1 - p2)) * 10},50%,50%)`
      }
    }

    const destX = p + radius * 2
    const destY = Math.min(displayHeight, absrad)
    ctx.bezierCurveTo(p, destY, destX, destY, destX, 0)
    ctx.stroke()
  }

  for (let i = 0; i < chains.length; i++) {
    let chain = chains[i]
    if (!hasPaired) {
      chain.sort((a, b) => a.clipPos - b.clipPos)
    } else {
      // ignore split/supplementary reads for hasPaired=true for now
      chain = chain.filter(f => !(f.flags & 2048))
    }
    if (chain.length === 1 && asm) {
      const v0 = chain[0]

      // special case where we look at RPOS/RNEXT
      if (hasPaired) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const refName = asm.getCanonicalRefName(v0.next_ref!)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const coord = v0.next_pos!
        draw(v0, {
          refName,
          start: coord,
          end: coord,
          strand: v0.strand,
        })
      }

      // special case where we look at SA
      else {
        const suppAlns = featurizeSA(v0.SA, v0.id, v0.strand, v0.name)
        const features = [v0, ...suppAlns]
        for (let i = 0; i < features.length - 1; i++) {
          const v0 = features[i]
          const v1 = features[i + 1]
          draw(v0, {
            refName: asm.getCanonicalRefName(v1.refName),
            start: v1.start,
            end: v1.end,
            strand: v1.strand,
          })
        }
      }
    } else {
      for (let i = 0; i < chain.length - 1; i++) {
        draw(chain[i], chain[i + 1])
      }
    }
  }
}
