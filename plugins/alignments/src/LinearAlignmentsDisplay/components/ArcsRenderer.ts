/**
 * ArcsRenderer - Handles rendering of arcs and sashimi junction overlays
 *
 * This renderer draws:
 * - Arcs: Bezier ribbon curves connecting regions (for split reads)
 * - Arc lines: Vertical connector lines for inter-chromosomal or long-range connections
 * - Sashimi arcs: Splice junction arcs overlaid on coverage visualizations
 *
 * Extracted from WebGLRenderer to improve code organization.
 */

import { ARC_CURVE_SEGMENTS, arcColorPalette, arcLineColorPalette, sashimiColorPalette, splitPositionWithFrac } from './shaders/index.ts'
import { NUM_ARC_COLORS, NUM_LINE_COLORS, NUM_SASHIMI_COLORS } from './shaders/index.ts'

// Import RenderState interface directly without importing the class
// to avoid circular dependency
import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'

interface GPUBuffers {
  regionStart: number
  arcVAO: WebGLVertexArrayObject | null
  arcCount: number
  arcLineVAO: WebGLVertexArrayObject | null
  arcLineCount: number
  sashimiVAO: WebGLVertexArrayObject | null
  sashimiCount: number
}

/**
 * ArcsRenderer orchestrates rendering of arc geometry including bezier curves,
 * vertical connector lines, and sashimi splice junction overlays.
 *
 * The renderer receives a parent WebGLRenderer instance to access:
 * - WebGL context (gl)
 * - Shader programs and their uniform locations
 * - Buffers and VAOs for geometry
 */
export class ArcsRenderer {
  constructor(private parent: WebGLRenderer) {}

  renderArcs(
    state: RenderState,
    blockStartPx = 0,
    blockWidth = state.canvasWidth,
  ) {
    const gl = this.parent.gl
    if (!this.parent.buffers || !this.parent.arcProgram || !this.parent.arcLineProgram) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const lineWidth = state.arcLineWidth ?? 1

    // Draw arcs using instanced triangle strip rendering
    if (this.parent.buffers.arcVAO && this.parent.buffers.arcCount > 0) {
      gl.useProgram(this.parent.arcProgram)

      const bpStartOffset = state.bpRangeX[0] - this.parent.buffers.regionStart
      const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

      const coverageOffset = state.showCoverage ? state.coverageHeight : 0
      gl.uniform1f(this.parent.arcUniforms.u_bpStartOffset!, bpStartOffset)
      gl.uniform1f(this.parent.arcUniforms.u_bpRegionLength!, regionLengthBp)
      gl.uniform1f(this.parent.arcUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(this.parent.arcUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.parent.arcUniforms.u_blockStartPx!, blockStartPx)
      gl.uniform1f(this.parent.arcUniforms.u_blockWidth!, blockWidth)
      gl.uniform1f(this.parent.arcUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.parent.arcUniforms.u_lineWidthPx!, lineWidth)
      gl.uniform1f(this.parent.arcUniforms.u_gradientHue!, 0)

      for (let i = 0; i < NUM_ARC_COLORS; i++) {
        const c = arcColorPalette[i]!
        gl.uniform3f(this.parent.arcUniforms[`u_arcColors[${i}]`]!, c[0], c[1], c[2])
      }

      gl.bindVertexArray(this.parent.buffers.arcVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (ARC_CURVE_SEGMENTS + 1) * 2,
        this.parent.buffers.arcCount,
      )
    }

    // Draw vertical lines for inter-chromosomal / long-range
    if (this.parent.buffers.arcLineVAO && this.parent.buffers.arcLineCount > 0) {
      gl.useProgram(this.parent.arcLineProgram)

      const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
      const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

      gl.uniform3f(
        this.parent.arcLineUniforms.u_bpRangeX!,
        bpStartHi,
        bpStartLo,
        regionLengthBp,
      )
      gl.uniform1ui(
        this.parent.arcLineUniforms.u_regionStart!,
        Math.floor(this.parent.buffers.regionStart),
      )
      gl.uniform1f(this.parent.arcLineUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.parent.arcLineUniforms.u_blockStartPx!, blockStartPx)
      gl.uniform1f(this.parent.arcLineUniforms.u_blockWidth!, blockWidth)
      gl.uniform1f(this.parent.arcLineUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(
        this.parent.arcLineUniforms.u_coverageOffset!,
        state.showCoverage ? state.coverageHeight : 0,
      )

      for (let i = 0; i < NUM_LINE_COLORS; i++) {
        const c = arcLineColorPalette[i]!
        gl.uniform3f(
          this.parent.arcLineUniforms[`u_arcLineColors[${i}]`]!,
          c[0],
          c[1],
          c[2],
        )
      }

      gl.lineWidth(lineWidth)
      gl.bindVertexArray(this.parent.buffers.arcLineVAO)
      gl.drawArrays(gl.LINES, 0, this.parent.buffers.arcLineCount * 2)
    }

    gl.bindVertexArray(null)
  }

  renderSashimiArcs(
    state: RenderState,
    blockStartPx = 0,
    blockWidth = state.canvasWidth,
  ) {
    const gl = this.parent.gl
    if (!this.parent.buffers || !this.parent.sashimiProgram) {
      return
    }

    if (!this.parent.buffers.sashimiVAO || this.parent.buffers.sashimiCount === 0) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const coverageOffset = state.showCoverage ? state.coverageYOffset : 0
    const coverageHeight = state.coverageHeight

    gl.useProgram(this.parent.sashimiProgram)

    const bpStartOffset = state.bpRangeX[0] - this.parent.buffers.regionStart
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    gl.uniform1f(this.parent.sashimiUniforms.u_bpStartOffset!, bpStartOffset)
    gl.uniform1f(this.parent.sashimiUniforms.u_bpRegionLength!, regionLengthBp)
    gl.uniform1f(this.parent.sashimiUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(this.parent.sashimiUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.parent.sashimiUniforms.u_blockStartPx!, blockStartPx)
    gl.uniform1f(this.parent.sashimiUniforms.u_blockWidth!, blockWidth)
    gl.uniform1f(this.parent.sashimiUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.parent.sashimiUniforms.u_coverageHeight!, coverageHeight)

    for (let i = 0; i < NUM_SASHIMI_COLORS; i++) {
      const c = sashimiColorPalette[i]!
      gl.uniform3f(
        this.parent.sashimiUniforms[`u_sashimiColors[${i}]`]!,
        c[0],
        c[1],
        c[2],
      )
    }

    gl.bindVertexArray(this.parent.buffers.sashimiVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      (ARC_CURVE_SEGMENTS + 1) * 2,
      this.parent.buffers.sashimiCount,
    )
    gl.bindVertexArray(null)
  }
}
