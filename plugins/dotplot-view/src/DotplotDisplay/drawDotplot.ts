import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface DotplotDrawParams {
  viewBpH: number
  bpPerPxHInv: number
  viewBpV: number
  bpPerPxVInv: number
  viewWidth: number
  viewHeight: number
  lineWidth: number
}

export function drawDotplotInstances(
  ctx: Ctx2D,
  geometry: DotplotGeometryData,
  params: DotplotDrawParams,
) {
  const {
    viewBpH,
    bpPerPxHInv,
    viewBpV,
    bpPerPxVInv,
    viewWidth,
    viewHeight,
    lineWidth,
  } = params
  // Round caps make sub-lineWidth segments render as dots, matching the GPU
  // capsule-SDF path. Setting per call keeps callers from forgetting.
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  const { x1, y1, x2, y2, colors, instanceCount } = geometry

  // Batch consecutive same-color segments into one path, flushing only when the
  // packed color changes (same shape as Canvas2DManhattanRenderer). Runs are
  // long in practice: every CIGAR segment of one alignment carries that
  // alignment's color, and the common color-by modes resolve to a handful of
  // distinct colors. Worth it twice over — on the Canvas2D fallback the
  // per-segment strokeStyle write plus beginPath/stroke pair is the dominant
  // cost at 10^5+ segments, and in vector SVG export SvgCanvas emits one <path>
  // element per stroke() call, so batching divides the element count by the
  // average run length. `currentAbgr === undefined` means no path is open, so
  // the color switch and the trailing flush share one condition.
  //
  // Segments outside the plot are dropped: the fetch window is snapped and
  // padded well past the viewport, so most of a fetch is offscreen (87% on the
  // ExportSvgDotplot fixture). Canvas clips them for free, but SVG export
  // serializes every one into the <path> behind the clipPath — the dominant
  // term in export size. Padded by lineWidth so a round cap can't be clipped
  // out while its dot is still visible.
  // One CSS string per distinct color instead of one per color *change*. The
  // batching above only pays off when consecutive segments share a color, which
  // the chromosome-painting modes give and the ramp modes (identity,
  // meanQueryIdentity, mappingQuality) do not — there, neighbouring features
  // land on different LUT entries and every segment used to allocate its own
  // `rgba(...)`. A ramp is a 256-entry LUT, so this cache holds a few hundred
  // strings at most; per call rather than module-level, since alpha is packed
  // into the color and a slider drag would otherwise accumulate a set per stop.
  const cssByAbgr = new Map<number, string>()
  let currentAbgr: number | undefined
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = (x1[i]! - viewBpH) * bpPerPxHInv
    const sy1 = viewHeight - (y1[i]! - viewBpV) * bpPerPxVInv
    const sx2 = (x2[i]! - viewBpH) * bpPerPxHInv
    const sy2 = viewHeight - (y2[i]! - viewBpV) * bpPerPxVInv
    const offscreen =
      Math.max(sx1, sx2) < -lineWidth ||
      Math.min(sx1, sx2) > viewWidth + lineWidth ||
      Math.max(sy1, sy2) < -lineWidth ||
      Math.min(sy1, sy2) > viewHeight + lineWidth
    if (!offscreen) {
      const abgr = colors[i]!
      if (abgr !== currentAbgr) {
        if (currentAbgr !== undefined) {
          ctx.stroke()
        }
        currentAbgr = abgr
        let css = cssByAbgr.get(abgr)
        if (css === undefined) {
          css = abgrToCssRgba(abgr)
          cssByAbgr.set(abgr, css)
        }
        ctx.strokeStyle = css
        ctx.beginPath()
      }
      ctx.moveTo(sx1, sy1)
      ctx.lineTo(sx2, sy2)
    }
  }
  if (currentAbgr !== undefined) {
    ctx.stroke()
  }
}
