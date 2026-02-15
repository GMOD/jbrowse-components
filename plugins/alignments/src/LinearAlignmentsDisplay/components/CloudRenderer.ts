/**
 * CloudRenderer - Handles rendering of cloud/arc constellation mode
 *
 * This renderer draws a cloud visualization mode showing read connectivity
 * as a constellation of arcs, useful for viewing complex structural variations
 * and complex paired-end arrangements.
 *
 * Extracted from WebGLRenderer to improve code organization.
 */

import { splitPositionWithFrac } from './shaders/index.ts'

import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'

/**
 * CloudRenderer orchestrates rendering of cloud mode visualization.
 *
 * The renderer receives a parent WebGLRenderer instance to access:
 * - WebGL context (gl)
 * - Shader programs and their uniform locations
 * - Buffers and VAOs for geometry
 */
export class CloudRenderer {
  constructor(private parent: WebGLRenderer) {}

  render(state: RenderState) {
    const gl = this.parent.gl
    if (!this.parent.buffers || !this.parent.cloudProgram) {
      return
    }

    if (!this.parent.buffers.cloudVAO || this.parent.buffers.cloudCount === 0) {
      return
    }

    const { canvasHeight } = state

    const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    gl.useProgram(this.parent.cloudProgram)
    gl.uniform3f(
      this.parent.cloudUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    gl.uniform1ui(
      this.parent.cloudUniforms.u_regionStart!,
      Math.floor(this.parent.buffers.regionStart),
    )
    gl.uniform1f(
      this.parent.cloudUniforms.u_featureHeight!,
      state.featureHeight,
    )
    gl.uniform1f(this.parent.cloudUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(
      this.parent.cloudUniforms.u_coverageOffset!,
      state.showCoverage ? state.coverageHeight : 0,
    )
    gl.uniform1i(
      this.parent.cloudUniforms.u_colorScheme!,
      state.cloudColorScheme ?? 0,
    )

    gl.bindVertexArray(this.parent.buffers.cloudVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.parent.buffers.cloudCount)
    gl.bindVertexArray(null)
  }
}
