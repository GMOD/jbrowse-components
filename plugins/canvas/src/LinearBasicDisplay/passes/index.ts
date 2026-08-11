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

// Continuation reads RECT's vertex buffer (drawPass(continuation, region,
// bufferPassId=rect)) — the strand it points by is a field on RectInstance
// (rectInstance.slang), shared by both shaders. Same arrangement as chevron over
// line's buffer, and the reason there is no second per-region pack + upload for
// a marker that draws on at most two blocks of a frame. As with chevron, nothing
// here restates rect's layout: sharing the struct is what makes the two agree.
export const ContinuationPass: PipelineDescriptor = slangPass({
  id: CONTINUATION_PASS,
  mod: continuationShader,
})

// Generated struct-of-arrays packers (the u32/f32 destination view per field
// is derived from the shader struct — no hand-maintained packing to drift).
export const packRects = rectShader.packInstances
export const packLines = lineShader.packInstances
export const packArrows = arrowShader.packInstances

// All passes bind the same UBO, so any pass's size is the uniform-buffer size.
export const FEATURE_GLYPH_UNIFORM_BYTE_SIZE = rectShader.UNIFORMS_SIZE_BYTES

// The draw dimensions and clamps authored in the `.slang` sources are NOT
// re-exported here, deliberately. This barrel namespace-imports the shader
// string modules above, so anything reachable through it carries the WGSL/GLSL
// with it; the display side reads those numbers from each shader's own
// `.consts.generated.ts` instead (via `components/sharedRendererConstants.ts`).
// A hand-written `constants.ts` used to stand in for that and is gone — the
// codegen emits the shader-string-free door now.
