import {
  ARC_CURVE_SEGMENTS,
  MAX_REGIONS,
  NUM_ARC_COLORS,
  NUM_LINE_COLORS,
  NUM_SASHIMI_COLORS,
  arcColorPalette,
  arcLineColorPalette,
  sashimiColorPalette,
  splitPositionWithFrac,
} from './shaders/index.ts'

import type { WebGLRenderer } from './WebGLRenderer.ts'
import type { RenderState } from './rendererTypes.ts'

export interface RegionTableEntry {
  startBpOffset: number
  endBpOffset: number
  startPx: number
  endPx: number
}

function uploadRegionTable(
  gl: WebGL2RenderingContext,
  uniforms: Record<string, WebGLUniformLocation | null>,
  regionTable: RegionTableEntry[],
) {
  const count = Math.min(regionTable.length, MAX_REGIONS)
  gl.uniform1i(uniforms.u_numRegions!, count)
  for (let i = 0; i < count; i++) {
    const r = regionTable[i]!
    gl.uniform4fv(uniforms[`u_regions[${i}]`]!, [
      r.startBpOffset,
      r.endBpOffset,
      r.startPx,
      r.endPx,
    ])
  }
}

export function renderArcs(
  renderer: WebGLRenderer,
  state: RenderState,
  regionTable: RegionTableEntry[],
) {
  const gl = renderer.gl
  if (!renderer.buffers || !renderer.arcProgram || !renderer.arcLineProgram) {
    return
  }

  const { canvasWidth, canvasHeight } = state
  const lineWidth = state.arcLineWidth ?? 1

  if (renderer.buffers.arcVAO && renderer.buffers.arcCount > 0) {
    gl.useProgram(renderer.arcProgram)

    const coverageOffset = state.showCoverage ? state.coverageHeight : 0
    gl.uniform1f(renderer.arcUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(renderer.arcUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(renderer.arcUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(renderer.arcUniforms.u_lineWidthPx!, lineWidth)
    gl.uniform1f(renderer.arcUniforms.u_gradientHue!, 0)

    uploadRegionTable(gl, renderer.arcUniforms, regionTable)

    for (let i = 0; i < NUM_ARC_COLORS; i++) {
      const c = arcColorPalette[i]!
      gl.uniform3f(renderer.arcUniforms[`u_arcColors[${i}]`]!, c[0], c[1], c[2])
    }

    gl.bindVertexArray(renderer.buffers.arcVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      (ARC_CURVE_SEGMENTS + 1) * 2,
      renderer.buffers.arcCount,
    )
  }

  gl.bindVertexArray(null)
}

export function renderArcLines(
  renderer: WebGLRenderer,
  state: RenderState,
  blockStartPx = 0,
  blockWidth = state.canvasWidth,
) {
  const gl = renderer.gl
  if (!renderer.buffers || !renderer.arcLineProgram) {
    return
  }

  const { canvasWidth, canvasHeight } = state
  const lineWidth = state.arcLineWidth ?? 1

  if (renderer.buffers.arcLineVAO && renderer.buffers.arcLineCount > 0) {
    gl.useProgram(renderer.arcLineProgram)
    gl.uniform1f(renderer.arcLineUniforms.u_zero!, 0)

    const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    gl.uniform3f(
      renderer.arcLineUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    gl.uniform1ui(
      renderer.arcLineUniforms.u_regionStart!,
      Math.floor(renderer.buffers.regionStart),
    )
    gl.uniform1f(renderer.arcLineUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(renderer.arcLineUniforms.u_blockStartPx!, blockStartPx)
    gl.uniform1f(renderer.arcLineUniforms.u_blockWidth!, blockWidth)
    gl.uniform1f(renderer.arcLineUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(
      renderer.arcLineUniforms.u_coverageOffset!,
      state.showCoverage ? state.coverageHeight : 0,
    )

    for (let i = 0; i < NUM_LINE_COLORS; i++) {
      const c = arcLineColorPalette[i]!
      gl.uniform3f(
        renderer.arcLineUniforms[`u_arcLineColors[${i}]`]!,
        c[0],
        c[1],
        c[2],
      )
    }

    gl.lineWidth(lineWidth)
    gl.bindVertexArray(renderer.buffers.arcLineVAO)
    gl.drawArrays(gl.LINES, 0, renderer.buffers.arcLineCount * 2)
  }

  gl.bindVertexArray(null)
}

export function renderSashimiArcs(
  renderer: WebGLRenderer,
  state: RenderState,
  regionTable: RegionTableEntry[],
) {
  const gl = renderer.gl
  if (!renderer.buffers || !renderer.sashimiProgram) {
    return
  }

  if (!renderer.buffers.sashimiVAO || renderer.buffers.sashimiCount === 0) {
    return
  }

  const { canvasWidth, canvasHeight } = state
  const coverageOffset = state.showCoverage ? state.coverageYOffset : 0
  const coverageHeight = state.coverageHeight

  gl.useProgram(renderer.sashimiProgram)

  gl.uniform1f(renderer.sashimiUniforms.u_canvasWidth!, canvasWidth)
  gl.uniform1f(renderer.sashimiUniforms.u_canvasHeight!, canvasHeight)
  gl.uniform1f(renderer.sashimiUniforms.u_coverageOffset!, coverageOffset)
  gl.uniform1f(renderer.sashimiUniforms.u_coverageHeight!, coverageHeight)

  uploadRegionTable(gl, renderer.sashimiUniforms, regionTable)

  for (let i = 0; i < NUM_SASHIMI_COLORS; i++) {
    const c = sashimiColorPalette[i]!
    gl.uniform3f(
      renderer.sashimiUniforms[`u_sashimiColors[${i}]`]!,
      c[0],
      c[1],
      c[2],
    )
  }

  gl.bindVertexArray(renderer.buffers.sashimiVAO)
  gl.drawArraysInstanced(
    gl.TRIANGLE_STRIP,
    0,
    (ARC_CURVE_SEGMENTS + 1) * 2,
    renderer.buffers.sashimiCount,
  )
  gl.bindVertexArray(null)
}
