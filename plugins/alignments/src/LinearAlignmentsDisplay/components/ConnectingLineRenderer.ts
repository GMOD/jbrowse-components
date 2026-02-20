/**
 * ConnectingLineRenderer - Draws thin connecting lines between reads in a chain
 *
 * Used by cloud and linkedRead modes to visually connect reads that belong
 * to the same chain (read name group).
 */

import { splitPositionWithFrac } from './shaders/index.ts'

import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'

export class ConnectingLineRenderer {
  constructor(private parent: WebGLRenderer) {}

  render(state: RenderState) {
    const gl = this.parent.gl
    if (
      !this.parent.buffers ||
      !this.parent.connectingLineProgram ||
      !this.parent.buffers.connectingLineVAO ||
      this.parent.buffers.connectingLineCount === 0
    ) {
      return
    }

    const { canvasHeight } = state

    const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    const coverageOffset = state.showCoverage ? state.coverageHeight : 0

    gl.useProgram(this.parent.connectingLineProgram)
    // WARNING: u_zero must be 0.0 — used by HP shader functions to create a
    // runtime infinity that prevents compiler from defeating precision guards.
    gl.uniform1f(this.parent.connectingLineUniforms.u_zero!, 0.0)
    gl.uniform3f(
      this.parent.connectingLineUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    gl.uniform1ui(
      this.parent.connectingLineUniforms.u_regionStart!,
      Math.floor(this.parent.buffers.regionStart),
    )
    gl.uniform1f(
      this.parent.connectingLineUniforms.u_featureHeight!,
      state.featureHeight,
    )
    gl.uniform1f(
      this.parent.connectingLineUniforms.u_featureSpacing!,
      state.featureSpacing,
    )
    gl.uniform1f(
      this.parent.connectingLineUniforms.u_canvasHeight!,
      canvasHeight,
    )
    gl.uniform1f(
      this.parent.connectingLineUniforms.u_scrollTop!,
      state.rangeY[0],
    )
    gl.uniform1f(
      this.parent.connectingLineUniforms.u_coverageOffset!,
      coverageOffset,
    )

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )

    gl.bindVertexArray(this.parent.buffers.connectingLineVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      6,
      this.parent.buffers.connectingLineCount,
    )
    gl.bindVertexArray(null)
  }
}
