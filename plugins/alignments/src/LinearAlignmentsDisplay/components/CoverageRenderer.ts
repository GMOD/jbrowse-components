/**
 * CoverageRenderer - Handles rendering of coverage visualizations
 *
 * This renderer draws:
 * - Grey coverage bars (main coverage visualization)
 * - SNP/modification coverage segments (colored by base or modification type)
 * - Non-coverage (interbase) histogram bars
 * - Interbase indicator triangles at the top of the coverage area
 *
 * Extracted from WebGLRenderer to improve code organization.
 */

import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'
import type { ColorPalette } from './shaders/index.ts'

/**
 * CoverageRenderer orchestrates rendering of coverage data including coverage bars,
 * SNP/modification overlays, and interbase visualizations.
 *
 * The renderer receives a parent WebGLRenderer instance to access:
 * - WebGL context (gl)
 * - Shader programs and their uniform locations
 * - Buffers and VAOs for geometry
 */
export class CoverageRenderer {
  constructor(private parent: WebGLRenderer) {}

  render(
    state: RenderState,
    domainOffset: [number, number],
    colors: ColorPalette,
  ) {
    const gl = this.parent.gl
    if (!this.parent.buffers) {
      return
    }
    const { canvasWidth, canvasHeight } = state

    const willDrawCoverage =
      state.showCoverage &&
      this.parent.buffers.coverageVAO &&
      this.parent.buffers.coverageCount > 0
    if (!willDrawCoverage) {
      return
    }

    // Draw grey coverage bars - coverage uses offset-based positions
    gl.useProgram(this.parent.coverageProgram)
    gl.uniform2f(
      this.parent.coverageUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(
      this.parent.coverageUniforms.u_coverageHeight!,
      state.coverageHeight,
    )
    gl.uniform1f(
      this.parent.coverageUniforms.u_coverageYOffset!,
      state.coverageYOffset,
    )
    gl.uniform1f(
      this.parent.coverageUniforms.u_binSize!,
      this.parent.buffers.binSize,
    )
    gl.uniform1f(this.parent.coverageUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.parent.coverageUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform3f(
      this.parent.coverageUniforms.u_colorCoverage!,
      ...colors.colorCoverage,
    )

    gl.bindVertexArray(this.parent.buffers.coverageVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      6,
      this.parent.buffers.coverageCount,
    )

    // Draw modification coverage bars OR SNP coverage bars (not both)
    if (
      state.showModifications &&
      this.parent.buffers.modCoverageVAO &&
      this.parent.buffers.modCoverageCount > 0
    ) {
      gl.useProgram(this.parent.modCoverageProgram)
      gl.uniform2f(
        this.parent.modCoverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.parent.modCoverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.parent.modCoverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(
        this.parent.modCoverageUniforms.u_canvasHeight!,
        canvasHeight,
      )
      gl.uniform1f(this.parent.modCoverageUniforms.u_canvasWidth!, canvasWidth)

      // Scissor clips modification bars to the coverage area, equivalent to
      // the canvas boundary clipping in the reference canvas renderer
      const scissorY = canvasHeight - state.coverageHeight
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(0, scissorY, canvasWidth, state.coverageHeight)

      gl.bindVertexArray(this.parent.buffers.modCoverageVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        6,
        this.parent.buffers.modCoverageCount,
      )

      gl.disable(gl.SCISSOR_TEST)
    } else if (
      this.parent.buffers.snpCoverageVAO &&
      this.parent.buffers.snpCoverageCount > 0
    ) {
      gl.useProgram(this.parent.snpCoverageProgram)
      gl.uniform2f(
        this.parent.snpCoverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.parent.snpCoverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.parent.snpCoverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(
        this.parent.snpCoverageUniforms.u_canvasHeight!,
        canvasHeight,
      )
      gl.uniform1f(this.parent.snpCoverageUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(
        this.parent.snpCoverageUniforms.u_colorBaseA!,
        ...colors.colorBaseA,
      )
      gl.uniform3f(
        this.parent.snpCoverageUniforms.u_colorBaseC!,
        ...colors.colorBaseC,
      )
      gl.uniform3f(
        this.parent.snpCoverageUniforms.u_colorBaseG!,
        ...colors.colorBaseG,
      )
      gl.uniform3f(
        this.parent.snpCoverageUniforms.u_colorBaseT!,
        ...colors.colorBaseT,
      )

      gl.bindVertexArray(this.parent.buffers.snpCoverageVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        6,
        this.parent.buffers.snpCoverageCount,
      )
    }

    // Draw noncov (interbase) histogram - bars growing DOWN from top
    // Height is 1/4 of coverage height to keep it compact
    const noncovHeight = state.coverageHeight / 4
    if (
      state.showInterbaseCounts &&
      this.parent.buffers.noncovHistogramVAO &&
      this.parent.buffers.noncovHistogramCount > 0
    ) {
      gl.useProgram(this.parent.noncovHistogramProgram)
      gl.uniform2f(
        this.parent.noncovHistogramUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.parent.noncovHistogramUniforms.u_noncovHeight!,
        noncovHeight,
      )
      gl.uniform1f(
        this.parent.noncovHistogramUniforms.u_canvasHeight!,
        canvasHeight,
      )
      gl.uniform1f(
        this.parent.noncovHistogramUniforms.u_canvasWidth!,
        canvasWidth,
      )
      gl.uniform3f(
        this.parent.noncovHistogramUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )
      gl.uniform3f(
        this.parent.noncovHistogramUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )
      gl.uniform3f(
        this.parent.noncovHistogramUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(this.parent.buffers.noncovHistogramVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        6,
        this.parent.buffers.noncovHistogramCount,
      )
    }

    // Draw interbase indicators - triangles at top of coverage area
    if (
      state.showInterbaseIndicators &&
      this.parent.buffers.indicatorVAO &&
      this.parent.buffers.indicatorCount > 0
    ) {
      gl.useProgram(this.parent.indicatorProgram)
      gl.uniform2f(
        this.parent.indicatorUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(this.parent.indicatorUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.parent.indicatorUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(
        this.parent.indicatorUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )
      gl.uniform3f(
        this.parent.indicatorUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )
      gl.uniform3f(
        this.parent.indicatorUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(this.parent.buffers.indicatorVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        3,
        this.parent.buffers.indicatorCount,
      )
    }
  }
}
