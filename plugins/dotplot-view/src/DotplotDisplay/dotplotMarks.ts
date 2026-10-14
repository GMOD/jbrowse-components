import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { defineMark } from '@jbrowse/render-core/marks'
import { nearestInk } from '@jbrowse/render-core/marks/hit'
import { capsuleDistPx } from '@jbrowse/render-core/shaders/capsule'
import { CAPSULE_MIN_LEN_PX } from '@jbrowse/render-core/shaders/capsuleConsts'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { cumBpToPxH, cumBpToPxV } from './dotplotProject.ts'
import { drawDotplotInstances } from './drawDotplot.ts'
import { dotplotInstanceCache } from './instanceInterleave.ts'
import * as dotplotShader from './shaders/dotplot.generated.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'
import type { MarkShape } from '@jbrowse/render-core/marks'

// The projection plus the per-axis fetch-time base the buffer was packed
// against: `baseH`/`baseV` ride the payload and the rest rides the frame, and
// `params(state, region)` is where the two meet.
export interface DotplotSegmentParams {
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  lineWidth: number
  alpha: number
  baseH: number
  baseV: number
}

// Where the cursor lands on a segment's ink, measured by the shader's own
// `capsuleDistPx` from each end, with `capsuleFrame`'s guard for the
// zero-length dots a whole-genome plot is mostly made of — so a hit is the ink
// the fragment shades, end caps included. The distance is to the centreline;
// the stroke's half width is the caller's tolerance.
function nearestOnSegmentPx(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  const degenerate = len <= CAPSULE_MIN_LEN_PX
  const tx = degenerate ? 1 : dx / len
  const ty = degenerate ? 0 : dy / len
  const rx = px - ax
  const ry = py - ay
  const fromStart = rx * tx + ry * ty
  const along = Math.min(Math.max(fromStart, 0), len)
  const distPx = capsuleDistPx(fromStart, len - fromStart, ry * tx - rx * ty)
  // x/y/distSq in `InkHit`'s own order, as the shared rect and point forms
  // declare them, so one hidden class serves every `nearestInk` caller.
  return {
    x: ax + tx * along,
    y: ay + ty * along,
    distSq: distPx * distPx,
  }
}

export const segmentMark: MarkShape<DotplotGeometryData, DotplotSegmentParams> =
  {
    id: 'line',
    pass: {
      ...slangPass({ id: 'line', mod: dotplotShader }),
      pack: data => dotplotInstanceCache.get(data),
    },

    writeUniforms(scratch, _clip, _block, frame, p) {
      // cumBpToPxH/V with the fetch-time base folded into the offset, in
      // float64: both operands of `base - viewBp` are near the view, so no
      // genome-scale magnitude reaches the Float32 the shader multiplies by.
      dotplotShader.writeUniforms(scratch, {
        resolution: [frame.canvasWidth, frame.canvasHeight],
        scale: [p.bpPerPxHInv, -p.bpPerPxVInv],
        offset: [
          cumBpToPxH(p.baseH, p.viewBpH, p.bpPerPxHInv),
          cumBpToPxV(p.baseV, p.viewBpV, p.bpPerPxVInv, frame.canvasHeight),
        ],
        lineWidth: p.lineWidth,
        alpha: p.alpha,
        devicePixelRatio: getDpr(),
      })
    },

    paintBlock(ctx, data, _block, frame, p) {
      drawDotplotInstances(ctx, data, {
        viewBpH: p.viewBpH,
        bpPerPxHInv: p.bpPerPxHInv,
        viewBpV: p.viewBpV,
        bpPerPxVInv: p.bpPerPxVInv,
        viewWidth: frame.canvasWidth,
        viewHeight: frame.canvasHeight,
        lineWidth: p.lineWidth,
        alpha: p.alpha,
      })
    },

    hitNearest(channels, _block, frame, p, xPx, yPx, candidates, maxDistSq) {
      const { x1, y1, x2, y2 } = channels
      const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv } = p
      const h = frame.canvasHeight
      return nearestInk(candidates, maxDistSq, i =>
        nearestOnSegmentPx(
          xPx,
          yPx,
          cumBpToPxH(x1[i]!, viewBpH, bpPerPxHInv),
          cumBpToPxV(y1[i]!, viewBpV, bpPerPxVInv, h),
          cumBpToPxH(x2[i]!, viewBpH, bpPerPxHInv),
          cumBpToPxV(y2[i]!, viewBpV, bpPerPxVInv, h),
        ),
      )
    },
  }

export const DOTPLOT_MARKS = [
  defineMark({
    shape: segmentMark,
    channels: (data: DotplotGeometryData) => data,
    params: (state: DotplotRenderState, data: DotplotGeometryData) => ({
      viewBpH: state.viewBpH,
      viewBpV: state.viewBpV,
      bpPerPxHInv: state.bpPerPxHInv,
      bpPerPxVInv: state.bpPerPxVInv,
      lineWidth: state.lineWidth,
      alpha: state.alpha,
      baseH: data.baseH,
      baseV: data.baseV,
    }),
  }),
]
