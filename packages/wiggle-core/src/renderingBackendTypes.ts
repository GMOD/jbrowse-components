import {
  MIN_FILL_WIDTH_PX as GENERATED_MIN_FILL_WIDTH_PX,
  NO_PREV_START as GENERATED_NO_PREV_START,
  RENDERING_TYPE_DENSITY as GENERATED_RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE as GENERATED_RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER as GENERATED_RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER as GENERATED_RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT as GENERATED_RENDERING_TYPE_XYPLOT,
} from './wiggleRenderModes.generated.ts'

import type { WiggleScaleType } from './normalize.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type WiggleRenderingType = 0 | 1 | 2 | 3 | 4

// The `renderingType` uniform's vocabulary. These are wiggle.slang's own
// numbers, generated in by `pnpm gen:shaders` (adr-051): the Canvas2D path
// branches on them to pick a draw function while the GPU path branches on them
// inside vs_main, so a renumbering that reached only one side would quietly
// draw a different plot type on each backend. Declared here rather than in the
// plugin because this is where `WiggleRenderingType` lives, and the annotations
// are what pin each generated value into that union.
export const RENDERING_TYPE_XYPLOT: WiggleRenderingType =
  GENERATED_RENDERING_TYPE_XYPLOT
export const RENDERING_TYPE_DENSITY: WiggleRenderingType =
  GENERATED_RENDERING_TYPE_DENSITY
export const RENDERING_TYPE_LINE: WiggleRenderingType =
  GENERATED_RENDERING_TYPE_LINE
export const RENDERING_TYPE_SCATTER: WiggleRenderingType =
  GENERATED_RENDERING_TYPE_SCATTER
// Point-to-point line: connects the score at each feature's bp midpoint to its
// neighbor's, instead of tracing the stepped bar tops that RENDERING_TYPE_LINE
// draws. Better for sparse/discrete data where the plateaus look wrong.
export const RENDERING_TYPE_LINE_CENTER: WiggleRenderingType =
  GENERATED_RENDERING_TYPE_LINE_CENTER

// `prevStartEnd.x` sentinel meaning "no previous feature" — the source start,
// or a hole wider than `gapLimitBp`. Larger than any genomic coordinate, so it
// cannot collide with a real start, and the shader collapses that quad to
// nothing. wiggle.slang's, generated in, because the encoder writes it and the
// shader tests for it.
export const NO_PREV_START = GENERATED_NO_PREV_START

// Narrowest an xyplot bar / density column paints, in CSS px, so a bin under a
// pixel wide still shows. wiggle.slang's, generated in, because both backends
// apply it: the shader through `extendToMinWidthX` and Canvas2D through
// `Math.max(WIGGLE_MIN_PX, …)`, which is what re-exports this under that name.
// It was a `1.5` in each, kept together by a comment in each pointing at the
// other.
export const MIN_FILL_WIDTH_PX = GENERATED_MIN_FILL_WIDTH_PX

export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: WiggleScaleType
  /**
   * symlog's linear-region width, already resolved from the domain by
   * `resolveSymlogConstant`. Both backends read this one number so the axis,
   * the shader and the Canvas2D fallback agree; unread by the other scales.
   */
  symlogConstant: number
  renderingType: WiggleRenderingType
  canvasWidth: number
  canvasHeight: number
  // Authoritative row count from the model (overlay = 1, else numSources).
  // Drives rowHeight in both backends so it matches getRowHeight/findHit even
  // when a source has no features in the visible region.
  numRows: number
  // Full height in px of a scatterplot point (the point spans scoreY ± size/2).
  // Default 2 reproduces the previous hardcoded scoreY±1 band.
  scatterPointSize: number
  // Stroke thickness in px for line rendering. Default 1 matches the canvas
  // default line width.
  lineWidth: number
  // Score value the xyplot bars pivot around and the density gradient centers
  // on (= the bicolorPivot config slot). Bars grow up for scores above it and
  // down for scores below; default 0 reproduces the fixed-at-zero baseline.
  origin: number
}

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
  rowIndex: number
  // The rendering this layer was encoded *for*, stamped by
  // buildSourceRenderData from the same `renderingType` that chose the layers.
  //
  // Load-bearing on the GPU path, where it names both which neighbor-derived
  // instance fields the encoder writes and which pass draws them — one
  // decision, so a buffer can't be drawn by a pass it wasn't encoded for. That
  // pairing used to be implicit: the encoder wrote every field unconditionally
  // and `drawRegion` picked the pass off the render state. The two reach the
  // display through separate autoruns (encode is per-region under
  // installUpload, render is RenderLifecycleMixin's), and the
  // render one is registered first, so a plot-type switch can paint once with
  // the new pass against the old buffer. Harmless while every buffer carried
  // every field; not harmless once the encoder skips the fields the pass in
  // force will never read.
  renderingType: WiggleRenderingType
  // Optional per-instance packed ABGR colors. Used by bicolor whiskers, where
  // each band (max/mean/min) is colored by its own value's sign vs the pivot,
  // then tinted. When present it overrides `color` per feature in both backends;
  // `color` stays the single-color fallback (and the legend/first-color source).
  colorsAbgr?: Uint32Array
  // Center-to-center bp distance past which the interpolated (linecenter) line
  // treats the span as a hole and starts a new run instead of drawing a chord
  // across it. Computed once per layer by buildSourceRenderData (see
  // gapBreakLimit) precisely so the two backends can't derive different numbers
  // — the Canvas2D path reads it directly, the GPU path has it baked into the
  // instance buffer as a NO_PREV_START sentinel. `undefined` never breaks.
  gapLimitBp?: number
}

// Per-region streamed, like canvas/MAF/manhattan. Spelled as the shared
// contract rather than re-declared member-for-member: the hand-written copy had
// drifted to referring the reader to `PerRegionRenderingBackend.renderBlocks`
// for its own method's meaning, and it silently lacked `setErrorHandler`, so
// nothing routed a HAL over-limit allocation to the display's renderError.
export type WiggleRenderingBackend = PerRegionRenderingBackend<
  SourceRenderData[],
  WiggleGPURenderState
>
