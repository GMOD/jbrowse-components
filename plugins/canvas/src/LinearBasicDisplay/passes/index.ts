// All four passes share the `FeatureGlyphUniforms` UBO, so a rect or line
// needing a different uniform set authors its own shader rather than bending
// this one.

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

export const RECT_PASS = 'rect'
export const LINE_PASS = 'line'
export const ARROW_PASS = 'arrow'
export const CHEVRON_PASS = 'chevron'
export const CONTINUATION_PASS = 'continuation'

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

// Chevron draws over line's vertex buffer, and its per-instance vertex count
// scales with the consumer's cap on chevrons per line, so each consumer builds
// its own.
export function makeChevronPass(
  maxChevronsPerLine: number,
): PipelineDescriptor {
  return slangPass({
    id: CHEVRON_PASS,
    mod: chevronShader,
    verticesPerInstance: maxChevronsPerLine * chevronShader.CHEVRON_VERTS,
  })
}

// Continuation reads rect's vertex buffer, so a marker drawing on at most two
// blocks of a frame needs no second per-region pack and upload.
export const ContinuationPass: PipelineDescriptor = slangPass({
  id: CONTINUATION_PASS,
  mod: continuationShader,
})

// The `.slang` draw dimensions and clamps stay out of this barrel: it
// namespace-imports the shader string modules, so anything reachable through it
// drags the WGSL/GLSL along. The display side reads them from each shader's own
// `.consts.generated.ts`.
