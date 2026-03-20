import type { WebGLRenderer } from './WebGLRenderer.ts'
import type { RenderState } from './rendererTypes.ts'
import type { ColorPalette } from './shaders/index.ts'

export function renderCoverage(
  renderer: WebGLRenderer,
  state: RenderState,
  colors: ColorPalette,
) {
  const gl = renderer.gl
  if (!renderer.buffers) {
    return
  }
  const { canvasWidth, canvasHeight } = state

  const willDrawCoverage =
    state.showCoverage &&
    state.coverageNicedMax !== undefined &&
    renderer.buffers.coverageVAO &&
    renderer.buffers.coverageCount > 0
  if (!willDrawCoverage) {
    return
  }

  const regionStart = renderer.buffers.regionStart
  const domainOffset: [number, number] = [
    state.bpRangeX[0] - regionStart,
    state.bpRangeX[1] - regionStart,
  ]

  // depthScale corrects for nice() domain expansion and multi-region max differences
  // Bars are normalized per-region to perRegionMax, but the scalebar uses nicedMax
  const depthScale = renderer.buffers.maxDepth / state.coverageNicedMax!

  gl.useProgram(renderer.coverageProgram)
  gl.uniform2f(
    renderer.coverageUniforms.u_visibleRange!,
    domainOffset[0],
    domainOffset[1],
  )
  gl.uniform1f(
    renderer.coverageUniforms.u_coverageHeight!,
    state.coverageHeight,
  )
  gl.uniform1f(
    renderer.coverageUniforms.u_coverageYOffset!,
    state.coverageYOffset,
  )
  gl.uniform1f(renderer.coverageUniforms.u_depthScale!, depthScale)
  gl.uniform1f(renderer.coverageUniforms.u_binSize!, renderer.buffers.binSize)
  gl.uniform1f(renderer.coverageUniforms.u_canvasHeight!, canvasHeight)
  gl.uniform1f(renderer.coverageUniforms.u_canvasWidth!, canvasWidth)
  gl.uniform3f(
    renderer.coverageUniforms.u_colorCoverage!,
    ...colors.colorCoverage,
  )

  gl.bindVertexArray(renderer.buffers.coverageVAO)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, renderer.buffers.coverageCount)

  if (
    state.showModifications &&
    renderer.buffers.modCoverageVAO &&
    renderer.buffers.modCoverageCount > 0
  ) {
    gl.useProgram(renderer.modCoverageProgram)
    gl.uniform2f(
      renderer.modCoverageUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(
      renderer.modCoverageUniforms.u_coverageHeight!,
      state.coverageHeight,
    )
    gl.uniform1f(
      renderer.modCoverageUniforms.u_coverageYOffset!,
      state.coverageYOffset,
    )
    gl.uniform1f(renderer.modCoverageUniforms.u_depthScale!, depthScale)
    gl.uniform1f(renderer.modCoverageUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(renderer.modCoverageUniforms.u_canvasWidth!, canvasWidth)

    // Scissor clips modification bars to the coverage area
    const dpr = renderer.dpr
    const scissorY = Math.round((canvasHeight - state.coverageHeight) * dpr)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      0,
      scissorY,
      Math.round(canvasWidth * dpr),
      Math.round(state.coverageHeight * dpr),
    )

    gl.bindVertexArray(renderer.buffers.modCoverageVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      6,
      renderer.buffers.modCoverageCount,
    )

    gl.disable(gl.SCISSOR_TEST)
  } else if (
    renderer.buffers.snpCoverageVAO &&
    renderer.buffers.snpCoverageCount > 0
  ) {
    gl.useProgram(renderer.snpCoverageProgram)
    gl.uniform2f(
      renderer.snpCoverageUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(
      renderer.snpCoverageUniforms.u_coverageHeight!,
      state.coverageHeight,
    )
    gl.uniform1f(
      renderer.snpCoverageUniforms.u_coverageYOffset!,
      state.coverageYOffset,
    )
    gl.uniform1f(renderer.snpCoverageUniforms.u_depthScale!, depthScale)
    gl.uniform1f(renderer.snpCoverageUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(renderer.snpCoverageUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform3f(
      renderer.snpCoverageUniforms.u_colorBaseA!,
      ...colors.colorBaseA,
    )
    gl.uniform3f(
      renderer.snpCoverageUniforms.u_colorBaseC!,
      ...colors.colorBaseC,
    )
    gl.uniform3f(
      renderer.snpCoverageUniforms.u_colorBaseG!,
      ...colors.colorBaseG,
    )
    gl.uniform3f(
      renderer.snpCoverageUniforms.u_colorBaseT!,
      ...colors.colorBaseT,
    )

    gl.bindVertexArray(renderer.buffers.snpCoverageVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      6,
      renderer.buffers.snpCoverageCount,
    )
  }

  const noncovHeight = state.coverageHeight / 2
  if (
    state.showInterbaseIndicators &&
    renderer.buffers.noncovHistogramVAO &&
    renderer.buffers.noncovHistogramCount > 0
  ) {
    gl.useProgram(renderer.noncovHistogramProgram)
    gl.uniform2f(
      renderer.noncovHistogramUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(renderer.noncovHistogramUniforms.u_noncovHeight!, noncovHeight)
    gl.uniform1f(renderer.noncovHistogramUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(renderer.noncovHistogramUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform3f(
      renderer.noncovHistogramUniforms.u_colorInsertion!,
      ...colors.colorInsertion,
    )
    gl.uniform3f(
      renderer.noncovHistogramUniforms.u_colorSoftclip!,
      ...colors.colorSoftclip,
    )
    gl.uniform3f(
      renderer.noncovHistogramUniforms.u_colorHardclip!,
      ...colors.colorHardclip,
    )

    gl.bindVertexArray(renderer.buffers.noncovHistogramVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      6,
      renderer.buffers.noncovHistogramCount,
    )
  }

  if (
    state.showInterbaseIndicators &&
    renderer.buffers.indicatorVAO &&
    renderer.buffers.indicatorCount > 0
  ) {
    gl.useProgram(renderer.indicatorProgram)
    gl.uniform2f(
      renderer.indicatorUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(renderer.indicatorUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(renderer.indicatorUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform3f(
      renderer.indicatorUniforms.u_colorInsertion!,
      ...colors.colorInsertion,
    )
    gl.uniform3f(
      renderer.indicatorUniforms.u_colorSoftclip!,
      ...colors.colorSoftclip,
    )
    gl.uniform3f(
      renderer.indicatorUniforms.u_colorHardclip!,
      ...colors.colorHardclip,
    )

    gl.bindVertexArray(renderer.buffers.indicatorVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, renderer.buffers.indicatorCount)
  }
}
