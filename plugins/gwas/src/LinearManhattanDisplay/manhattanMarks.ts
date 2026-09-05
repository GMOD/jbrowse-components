import { defineMark, pointMark } from '@jbrowse/render-core/marks'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'

/**
 * What this display draws, as a declaration: one `point` mark, its channels
 * read straight off the RPC result's parallel arrays.
 *
 * The GPU pass and its packer, the Canvas2D painter (which is also the SVG
 * export) and the hit-test geometry all come from `pointMark`; what is written
 * here is only which of this display's arrays feed which lane, and which of its
 * render-state values reach the shape's uniforms.
 */
export const MANHATTAN_MARKS = [
  defineMark({
    shape: pointMark,
    channels: (d: ManhattanRpcResult) => ({
      x: d.positions,
      x2: d.ends,
      y: d.scores,
      color: d.colors,
      glyph: d.glyphs,
      count: d.numFeatures,
    }),
    params: (s: ManhattanRenderState) => ({
      domain: s.domainY,
      diameterPx: s.pointDiameterPx,
    }),
  }),
]
