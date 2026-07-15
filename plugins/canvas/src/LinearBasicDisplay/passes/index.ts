// The LGV feature-glyph passes (rect, line, arrow, chevron) for the canvas
// plugin's GpuCanvasFeatureRenderer. Only this plugin consumes them today; they
// were drafted as a cross-plugin "shared shape library" (RFC-001 §5) but until a
// second consumer appears they live here, alongside the renderer that uses them.
// Promote to @jbrowse/render-core if/when another plugin needs the same shapes.
// These are building blocks — the renderer still owns its pass list, upload, and
// draw loop; this module just supplies the shader modules, ready PassDescriptors,
// and the generated struct-of-arrays packers.
//
// All four passes share the `FeatureGlyphUniforms` UBO (see
// shaders/featureGlyphUniforms.slang): an hp-math bp range, canvas dimensions,
// scrollY, an outline color, and the reversed flag. A plugin whose rect/line
// needs a different uniform set should author its own shader rather than bend
// this one — these passes are the "BED-like rect/arrow/line" common case.
//
// No point/circle pass lives here yet: the only point display today
// (Manhattan) owns its SDF point shader, so a shared CirclePass would have no
// second consumer. Add one when a second point-shape display appears (RFC-001
// §5c — don't pre-design the family).

import { slangPass } from '@jbrowse/render-core/slangPass'

import * as arrowShader from './shaders/arrow.generated.ts'
import * as chevronShader from './shaders/chevron.generated.ts'
import * as continuationShader from './shaders/continuation.generated.ts'
import * as lineShader from './shaders/line.generated.ts'
import * as rectShader from './shaders/rect.generated.ts'

import type { PassDescriptor } from '@jbrowse/render-core/hal'

export {
  arrowShader,
  chevronShader,
  continuationShader,
  lineShader,
  rectShader,
}

// Pass IDs — the join key passed to `uploadBuffer` / `drawPass`.
export const RECT_PASS = 'rect'
export const LINE_PASS = 'line'
export const ARROW_PASS = 'arrow'
export const CHEVRON_PASS = 'chevron'
export const CONTINUATION_PASS = 'continuation'

// Ready PassDescriptors for the three self-contained passes.
export const RectPass: PassDescriptor = slangPass({
  id: RECT_PASS,
  mod: rectShader,
})
export const LinePass: PassDescriptor = slangPass({
  id: LINE_PASS,
  mod: lineShader,
})
export const ArrowPass: PassDescriptor = slangPass({
  id: ARROW_PASS,
  mod: arrowShader,
})

// Chevron reuses line's vertex buffer (bufferStride/bufferAttributes from
// `line`), and its per-instance vertex count scales with a consumer-chosen cap
// on how many chevrons one line can host — so it's built per consumer.
export function makeChevronPass(maxChevronsPerLine: number): PassDescriptor {
  return slangPass({
    id: CHEVRON_PASS,
    mod: chevronShader,
    verticesPerInstance: maxChevronsPerLine * 12,
    bufferStride: lineShader.INSTANCE_STRIDE_BYTES,
    bufferAttributes: lineShader.GL_ATTRIBUTES,
  })
}

// Continuation has its own buffer (uploaded alongside rects) carrying rect
// geometry + strand so the arrows point in the feature's genomic direction.
export const ContinuationPass: PassDescriptor = slangPass({
  id: CONTINUATION_PASS,
  mod: continuationShader,
})

// Generated struct-of-arrays packers (the u32/f32 destination view per field
// is derived from the shader struct — no hand-maintained packing to drift).
export const packRects = rectShader.packInstances
export const packLines = lineShader.packInstances
export const packArrows = arrowShader.packInstances
export const packContinuations = continuationShader.packInstances

// All passes bind the same UBO, so any pass's size is the uniform-buffer size.
export const FEATURE_GLYPH_UNIFORM_BYTE_SIZE = rectShader.UNIFORMS_SIZE_BYTES

// Minimum on-screen rect width clamp, shared by the GPU shader (where it lives)
// and the Canvas2D draw path so both backends clamp identically.
export const MIN_RECT_WIDTH_PX = rectShader.MIN_RECT_WIDTH_PX

// Alpha floor for collapsed (width-clamped, sub-MIN_RECT_WIDTH_PX) rects so
// dense features blend into a density texture rather than a flat block;
// non-collapsed features stay fully opaque. Shared by the Canvas2D draw path.
export const MIN_DENSITY_ALPHA = rectShader.MIN_DENSITY_ALPHA

// Glyph draw dimensions (px). Authored in the `.slang` so the GPU shader owns
// them; re-exported so the Canvas2D path draws matching geometry.
export const {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
} = chevronShader
export const { HEAD_HALF_H_PX, STEM_HALF_H_PX, STEM_LENGTH_PX } = arrowShader
export const {
  CONT_TRI_W_PX,
  CONT_TRI_HALF_H_PX,
  CONT_EDGE_MARGIN_PX,
  CONT_TRI_GAP_PX,
  CONT_MIN_OVERHANG_PX,
} = continuationShader
