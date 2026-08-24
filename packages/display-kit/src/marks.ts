import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  barPass,
  barShader,
  barUniforms,
  paintBars,
} from '@jbrowse/render-core/marks/bar'

import type {
  GpuSpec,
  Paint,
  ParamSchema,
  ParamValues,
} from './defineDisplay.tsx'
import type { BarEncoding } from '@jbrowse/render-core/marks/bar'

/**
 * A mark is a shape plus the channels that feed it. `x`, `x2` and `y` read
 * parallel arrays off the region's payload; `color` reads the resolved
 * settings, so it is one uniform per frame rather than a lane per instance.
 * The GPU pass, the Canvas2D painter and the SVG export all derive from the
 * one declaration.
 */
export interface BarMark<
  Payload,
  P extends ParamSchema,
> extends BarEncoding<Payload> {
  type: 'bar'
  color: (params: ParamValues<P>) => string
}

export type Mark<Payload, P extends ParamSchema> = BarMark<Payload, P>

export function markPaint<Payload, P extends ParamSchema>(
  mark: Mark<Payload, P>,
): Paint<Payload, P> {
  return (ctx, regions, blocks, { canvasWidth, canvasHeight, params }) => {
    paintBars(
      ctx,
      regions,
      blocks,
      { canvasWidth, canvasHeight, color: mark.color(params) },
      mark,
    )
  }
}

// #region markGpu
export function markGpu<Payload, P extends ParamSchema>(
  mark: Mark<Payload, P>,
): GpuSpec<Payload, P, barShader.Uniforms> {
  return {
    shader: barShader,
    passes: [barPass(mark)],
    uniforms: (block, clip, _region, { canvasWidth, canvasHeight, params }) =>
      barUniforms(block, clip, {
        canvasWidth,
        canvasHeight,
        color: cssColorToABGR(mark.color(params)),
      }),
  }
}
// #endregion
