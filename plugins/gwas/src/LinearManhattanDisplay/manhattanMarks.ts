import { defineMark, pointMark } from '@jbrowse/render-core/marks'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'

/**
 * What this display draws, as a declaration: one `point` mark over the
 * encoder's channels, which already carry the shape's lane names.
 *
 * The GPU pass and its packer, the Canvas2D painter (which is also the SVG
 * export) and the hit-test geometry all come from `pointMark`; what is written
 * here is only which of this display's render-state values reach the shape's
 * uniforms.
 */
export const MANHATTAN_MARKS = [
  defineMark({
    shape: pointMark,
    channels: (d: ManhattanRpcResult) => d,
    params: (s: ManhattanRenderState) => ({
      domain: s.domainY,
      diameterPx: s.pointDiameterPx,
    }),
  }),
]
