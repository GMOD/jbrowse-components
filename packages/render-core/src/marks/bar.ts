import { bpRangeXTuple } from '../blockClipUtils.ts'
import { bpToScreenPx, forEachClippedBlock } from '../canvas2dUtils.ts'
import * as shader from '../shaders/bar.generated.ts'
import { slangPass } from '../slangPass.ts'

import type { BlockClipResult } from '../blockClipUtils.ts'
import type { ClipContext2D } from '../canvas2dUtils.ts'
import type { InstancePass } from '../instancePass.ts'
import type { RenderBlock } from '../renderBlock.ts'

export { shader as barShader }

/**
 * The `bar` shape's channels: a box from `x` to `x2` in absolute bp, `y` tall
 * as a fraction of the canvas height, grown up from the bottom. One value per
 * instance, read off the payload as parallel arrays.
 */
export interface BarEncoding<Payload> {
  x: (payload: Payload) => ArrayLike<number>
  x2: (payload: Payload) => ArrayLike<number>
  y: (payload: Payload) => ArrayLike<number>
}

export interface BarFrame {
  canvasWidth: number
  canvasHeight: number
}

export interface BarContext2D extends ClipContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
}

export const BAR_PASS = 'bar'

// #region barPass
/** The pass that draws every bar of one region, packed from its channels. */
export function barPass<Payload>(
  encoding: BarEncoding<Payload>,
): InstancePass<Payload> {
  return {
    ...slangPass({ id: BAR_PASS, mod: shader }),
    pack: payload => {
      const x = encoding.x(payload)
      return shader.packInstances(
        { x, x2: encoding.x2(payload), y: encoding.y(payload) },
        x.length,
      )
    },
  }
}
// #endregion

// #region barUniforms
/** The uniforms one clipped block draws its bars with; `color` is packed ABGR. */
export function barUniforms(
  block: RenderBlock,
  clip: BlockClipResult,
  frame: BarFrame & { color: number },
): shader.Uniforms {
  return {
    bpRangeX: bpRangeXTuple(clip, block.reversed),
    zero: 0,
    canvasWidth: frame.canvasWidth,
    canvasHeight: frame.canvasHeight,
    color: frame.color,
  }
}
// #endregion

// #region paintBars
/**
 * The Canvas2D twin of the shader, and so also the SVG export. A sub-pixel
 * bar widens to 1px so it still paints, which is what `extendToMinWidthX`
 * does on the GPU side.
 */
export function paintBars<Payload>(
  ctx: BarContext2D,
  regions: ReadonlyMap<number, Payload>,
  blocks: RenderBlock[],
  frame: BarFrame & { color: string },
  encoding: BarEncoding<Payload>,
) {
  const { canvasWidth, canvasHeight } = frame
  ctx.fillStyle = frame.color
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (payload, block) => {
      const { start, end, screenStartPx, screenEndPx, reversed } = block
      const x = encoding.x(payload)
      const x2 = encoding.x2(payload)
      const y = encoding.y(payload)
      for (let i = 0; i < x.length; i++) {
        const left = bpToScreenPx(
          x[i]!,
          start,
          end,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const right = bpToScreenPx(
          x2[i]!,
          start,
          end,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const h = y[i]! * canvasHeight
        ctx.fillRect(
          Math.min(left, right),
          canvasHeight - h,
          Math.abs(right - left) || 1,
          h,
        )
      }
    },
  )
}
// #endregion
