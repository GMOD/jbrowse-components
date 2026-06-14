// Shared GPU pass library: the proven LGV feature-glyph passes (rect, line,
// arrow, chevron) promoted out of the canvas plugin so any plugin can compose
// them without re-authoring `.slang` (RFC-001 §5). These are building blocks —
// a consuming renderer still owns its pass list, upload, and draw loop; the
// library just supplies the shader modules, ready PassDescriptors, and the
// generated struct-of-arrays packers.
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
import * as lineShader from './shaders/line.generated.ts'
import * as rectShader from './shaders/rect.generated.ts'

import type { PassDescriptor } from '@jbrowse/render-core/hal'

export { arrowShader, chevronShader, lineShader, rectShader }

// Pass IDs — the join key passed to `uploadBuffer` / `drawPass`.
export const RECT_PASS = 'rect'
export const LINE_PASS = 'line'
export const ARROW_PASS = 'arrow'
export const CHEVRON_PASS = 'chevron'

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

// Generated struct-of-arrays packers (the u32/f32 destination view per field
// is derived from the shader struct — no hand-maintained packing to drift).
export const packRects = rectShader.packInstances
export const packLines = lineShader.packInstances
export const packArrows = arrowShader.packInstances

// All passes bind the same UBO, so any pass's size is the uniform-buffer size.
export const FEATURE_GLYPH_UNIFORM_BYTE_SIZE = rectShader.UNIFORMS_SIZE_BYTES

// Minimum on-screen rect width clamp, shared by the GPU shader (where it lives)
// and the Canvas2D draw path so both backends clamp identically.
export const MIN_RECT_WIDTH_PX = rectShader.MIN_RECT_WIDTH_PX

// Glyph draw dimensions (px). Authored in the `.slang` so the GPU shader owns
// them; re-exported so the Canvas2D path draws matching geometry.
export const {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
} = chevronShader
export const { HEAD_HALF_H_PX, STEM_HALF_H_PX, STEM_LENGTH_PX } = arrowShader
