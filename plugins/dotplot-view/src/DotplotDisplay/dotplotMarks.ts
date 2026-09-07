import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { defineMark } from '@jbrowse/render-core/marks'
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
import type { MarkHit, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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

/**
 * One display's whole canvas as one block. A dotplot's x axis is not the
 * block's bp span — a segment's screen x comes from the payload's own absolute
 * cumBp through the shader's `panPx` fold and the painter's `cumBpToPxH` — so
 * the block carries nothing but its key and the identity bp span that keeps
 * `clipBlock` well-formed. `hicMarkBlocks` and `ldMarkBlocks` are the same
 * shape for the same reason.
 */
export function dotplotMarkBlock(
  displayKey: number,
  canvasWidth: number,
): RenderBlock {
  return {
    displayedRegionIndex: displayKey,
    start: 0,
    end: canvasWidth,
    screenStartPx: 0,
    screenEndPx: canvasWidth,
    reversed: false,
  }
}

export function dotplotMarkBlocks(
  displayKeys: Iterable<number>,
  canvasWidth: number,
): RenderBlock[] {
  return [...displayKeys].map(key => dotplotMarkBlock(key, canvasWidth))
}

// Where the cursor lands on a segment's ink, in the segment's own frame: the
// shader's `capsuleFrame` (with its guard for the zero-length dots a
// whole-genome plot is mostly made of) measured by the shader's own
// `capsuleDistPx`, so a hit is the ink the fragment actually shades, end caps
// included. The distance is to the centreline — the stroke's half width is the
// caller's tolerance, as it is for `point`.
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
  const cx = (ax + bx) / 2
  const cy = (ay + by) / 2
  const rx = px - cx
  const ry = py - cy
  const halfLen = len / 2
  const along = rx * tx + ry * ty
  const clamped = Math.min(Math.max(along, -halfLen), halfLen)
  return {
    distPx: capsuleDistPx(along, ry * tx - rx * ty, halfLen),
    x: cx + tx * clamped,
    y: cy + ty * clamped,
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
      dotplotShader.writeUniforms(scratch, {
        resolution: [frame.canvasWidth, frame.canvasHeight],
        lineWidth: p.lineWidth,
        alpha: p.alpha,
        bpPerPxHInv: p.bpPerPxHInv,
        bpPerPxVInv: p.bpPerPxVInv,
        // panPx = (base - viewBp)/bpPerPx: how far the view has panned from the
        // fetch-time base, in px. Both operands are near the view (small delta),
        // so no genome-scale magnitude multiplies the rounded inv — that's what
        // keeps a single Float32 coord sub-pixel. SYNC: the `bpRel*bpPerPxInv +
        // panPx` reconstruction in dotplot.slang's vs_main, and
        // drawDotplotInstances' equivalent from absolute cumBp.
        panPxH: (p.baseH - p.viewBpH) * p.bpPerPxHInv,
        panPxV: (p.baseV - p.viewBpV) * p.bpPerPxVInv,
        // The shader measures in CSS px (the frame's dims are the view's, and the
        // HAL scales the backing store by getDpr()), so it needs the ratio to
        // size its AA ramp at one output pixel — see aaHalf in dotplot.slang.
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
      let best: MarkHit | undefined
      let bestDistSq = maxDistSq
      for (const i of candidates) {
        const near = nearestOnSegmentPx(
          xPx,
          yPx,
          cumBpToPxH(x1[i]!, viewBpH, bpPerPxHInv),
          cumBpToPxV(y1[i]!, viewBpV, bpPerPxVInv, h),
          cumBpToPxH(x2[i]!, viewBpH, bpPerPxHInv),
          cumBpToPxV(y2[i]!, viewBpV, bpPerPxVInv, h),
        )
        const distSq = near.distPx * near.distPx
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          best = { index: i, x: near.x, y: near.y, distSq }
        }
      }
      return best
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
