// The LGV feature-glyph passes (rect, line, arrow, chevron) for the canvas
// plugin's GpuCanvasFeatureRenderer. Only this plugin consumes them today; they
// were drafted as a cross-plugin "shared shape library" (RFC-001 §5) but until a
// second consumer appears they live here, alongside the renderer that uses them.
// Promote to @jbrowse/render-core if/when another plugin needs the same shapes.
// These are building blocks — the renderer still owns its pass list, upload, and
// draw loop; this module just supplies the shader modules, ready PipelineDescriptors,
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

import type { PipelineDescriptor } from '@jbrowse/render-core/hal'

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

// Ready PipelineDescriptors for the three self-contained passes.
export const RectPass: PipelineDescriptor = slangPass({
  id: RECT_PASS,
  mod: rectShader,
})
export const LinePass: PipelineDescriptor = slangPass({
  id: LINE_PASS,
  mod: lineShader,
})
export const ArrowPass: PipelineDescriptor = slangPass({
  id: ARROW_PASS,
  mod: arrowShader,
})

// Chevron is drawn over line's vertex buffer (`drawPass(chevron, region,
// bufferPassId=line)`), and its per-instance vertex count scales with a
// consumer-chosen cap on how many chevrons one line can host — so it's built per
// consumer. Both halves of that product now come from somewhere that can't
// drift: the cap from the renderer, `CHEVRON_VERTS` from the `vid` split in the
// shader itself.
//
// Nothing here restates line's layout. `chevron.slang` declares the same
// `LineInstance` struct that `line.slang` does (`lineInstance.slang` is why both
// can), so its own generated stride and VERTEX_ATTRIBUTES already *are* line's —
// the two `bufferStride`/`bufferAttributes` overrides this used to pass were
// copying that rather than causing it, and would have masked the structs
// drifting apart.
export function makeChevronPass(
  maxChevronsPerLine: number,
): PipelineDescriptor {
  return slangPass({
    id: CHEVRON_PASS,
    mod: chevronShader,
    verticesPerInstance: maxChevronsPerLine * chevronShader.CHEVRON_VERTS,
  })
}

// Continuation has its own buffer (uploaded alongside rects) carrying rect
// geometry + strand so the arrows point in the feature's genomic direction.
export const ContinuationPass: PipelineDescriptor = slangPass({
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

// The draw dimensions and clamps authored in the `.slang` sources (so the GPU
// shader owns them) and shared with the Canvas2D path so both backends draw
// matching geometry. Re-exported from `./constants.ts` rather than destructured
// off the shader namespaces above: display-side importers must reach these
// WITHOUT pulling in the WGSL/GLSL source strings, and that file is the
// shader-string-free door. See its header.
export {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
  CONT_EDGE_MARGIN_PX,
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
  HEAD_HALF_H_PX,
  MIN_DENSITY_ALPHA,
  MIN_RECT_WIDTH_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from './constants.ts'
