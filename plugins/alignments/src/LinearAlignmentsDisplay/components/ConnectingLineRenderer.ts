import { splitPositionWithFrac } from './shaders/index.ts'

import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'

export function renderConnectingLine(
  renderer: WebGLRenderer,
  state: RenderState,
) {
  const gl = renderer.gl
  if (
    !renderer.buffers ||
    !renderer.connectingLineProgram ||
    !renderer.buffers.connectingLineVAO ||
    renderer.buffers.connectingLineCount === 0
  ) {
    return
  }

  const { canvasHeight } = state

  const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
  const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

  const arcsOffset = state.showArcs && state.arcsHeight ? state.arcsHeight : 0
  const coverageOffset =
    (state.showCoverage ? state.coverageHeight : 0) + arcsOffset

  gl.useProgram(renderer.connectingLineProgram)
  // WARNING: u_zero must be 0.0 — HP shader precision guard. See utils.ts.
  gl.uniform1f(renderer.connectingLineUniforms.u_zero!, 0)
  gl.uniform3f(
    renderer.connectingLineUniforms.u_bpRangeX!,
    bpStartHi,
    bpStartLo,
    regionLengthBp,
  )
  gl.uniform1ui(
    renderer.connectingLineUniforms.u_regionStart!,
    Math.floor(renderer.buffers.regionStart),
  )
  gl.uniform1f(
    renderer.connectingLineUniforms.u_featureHeight!,
    state.featureHeight,
  )
  gl.uniform1f(
    renderer.connectingLineUniforms.u_featureSpacing!,
    state.featureSpacing,
  )
  gl.uniform1f(renderer.connectingLineUniforms.u_canvasHeight!, canvasHeight)
  gl.uniform1f(renderer.connectingLineUniforms.u_scrollTop!, state.rangeY[0])
  gl.uniform1f(
    renderer.connectingLineUniforms.u_coverageOffset!,
    coverageOffset,
  )

  gl.bindVertexArray(renderer.buffers.connectingLineVAO)
  gl.drawArraysInstanced(
    gl.TRIANGLES,
    0,
    6,
    renderer.buffers.connectingLineCount,
  )
  gl.bindVertexArray(null)
}
