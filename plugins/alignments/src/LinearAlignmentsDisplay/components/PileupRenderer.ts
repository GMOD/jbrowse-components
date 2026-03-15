import { getChainBounds, toClipRect } from './chainOverlayUtils.ts'
import { splitPositionWithFrac } from './shaders/index.ts'

import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'
import type { ClipRect } from './chainOverlayUtils.ts'
import type { ColorPalette } from './shaders/index.ts'

export class PileupRenderer {
  constructor(private parent: WebGLRenderer) {}

  private setCigarUniforms(
    uniforms: Record<string, WebGLUniformLocation | null>,
    gl: WebGL2RenderingContext,
    domainOffset: [number, number],
    state: RenderState,
    coverageOffset: number,
  ) {
    gl.uniform2f(uniforms.u_bpRangeX!, domainOffset[0], domainOffset[1])
    gl.uniform2f(uniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
    gl.uniform1f(uniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(uniforms.u_featureSpacing!, state.featureSpacing)
    gl.uniform1f(uniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(uniforms.u_canvasHeight!, state.canvasHeight)
    gl.uniform1f(uniforms.u_canvasWidth!, state.canvasWidth)
  }

  render(state: RenderState, colors: ColorPalette, scissorX = 0) {
    const gl = this.parent.gl
    const buffers = this.parent.buffers

    if (!buffers || buffers.segmentCount === 0) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const regionStart = buffers.regionStart
    const domainOffset: [number, number] = [
      state.bpRangeX[0] - regionStart,
      state.bpRangeX[1] - regionStart,
    ]

    const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    const arcsOffset = state.showArcs && state.arcsHeight ? state.arcsHeight : 0
    const coverageOffset =
      (state.showCoverage ? state.coverageHeight : 0) + arcsOffset

    const dpr = this.parent.dpr
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      Math.round(scissorX * dpr),
      0,
      Math.round(canvasWidth * dpr),
      Math.round((canvasHeight - coverageOffset) * dpr),
    )

    gl.useProgram(this.parent.readProgram)
    // WARNING: u_zero must be 0.0 — HP shader precision guard. See utils.ts.
    gl.uniform1f(this.parent.readUniforms.u_zero!, 0)
    gl.uniform3f(
      this.parent.readUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    gl.uniform1ui(
      this.parent.readUniforms.u_regionStart!,
      Math.floor(regionStart),
    )
    gl.uniform2f(
      this.parent.readUniforms.u_rangeY!,
      state.rangeY[0],
      state.rangeY[1],
    )
    gl.uniform1i(this.parent.readUniforms.u_colorScheme!, state.colorScheme)
    gl.uniform1f(this.parent.readUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(
      this.parent.readUniforms.u_featureSpacing!,
      state.featureSpacing,
    )
    gl.uniform1f(this.parent.readUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.parent.readUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.parent.readUniforms.u_canvasWidth!, canvasWidth)
    const regionHlIdx = state.highlightedFeatureId
      ? (buffers.readIdToIndex.get(state.highlightedFeatureId) ?? -1)
      : -1
    gl.uniform1i(this.parent.readUniforms.u_highlightedIndex!, regionHlIdx)
    const mode = state.renderingMode ?? 'pileup'
    const isChainMode = mode === 'linkedRead'
    gl.uniform1i(this.parent.readUniforms.u_chainMode!, isChainMode ? 1 : 0)
    gl.uniform1i(
      this.parent.readUniforms.u_flipStrandLongReadChains!,
      state.flipStrandLongReadChains !== false ? 1 : 0,
    )
    const showStroke = state.showOutline && state.featureHeight >= 4 ? 1 : 0
    gl.uniform1i(this.parent.readUniforms.u_showStroke!, showStroke)

    gl.uniform3f(
      this.parent.readUniforms.u_colorFwdStrand!,
      ...colors.colorFwdStrand,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorRevStrand!,
      ...colors.colorRevStrand,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorNostrand!,
      ...colors.colorNostrand,
    )
    gl.uniform3f(this.parent.readUniforms.u_colorPairLR!, ...colors.colorPairLR)
    gl.uniform3f(this.parent.readUniforms.u_colorPairRL!, ...colors.colorPairRL)
    gl.uniform3f(this.parent.readUniforms.u_colorPairRR!, ...colors.colorPairRR)
    gl.uniform3f(this.parent.readUniforms.u_colorPairLL!, ...colors.colorPairLL)
    gl.uniform3f(
      this.parent.readUniforms.u_colorModificationFwd!,
      ...colors.colorModificationFwd,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorModificationRev!,
      ...colors.colorModificationRev,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorLongInsert!,
      ...colors.colorLongInsert,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorShortInsert!,
      ...colors.colorShortInsert,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorSupplementary!,
      ...colors.colorSupplementary,
    )
    gl.uniform3f(
      this.parent.readUniforms.u_colorUnmappedMate!,
      ...colors.colorUnmappedMate,
    )

    const stats = buffers.insertSizeStats
    gl.uniform1f(
      this.parent.readUniforms.u_insertSizeUpper!,
      stats?.upper ?? 1e9,
    )
    gl.uniform1f(this.parent.readUniforms.u_insertSizeLower!, stats?.lower ?? 0)

    gl.uniform1i(this.parent.readUniforms.u_highlightOnlyMode!, 0)

    gl.bindVertexArray(buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, buffers.segmentCount)

    if (state.showMismatches && buffers.gapVAO && buffers.gapCount > 0) {
      gl.useProgram(this.parent.gapProgram)
      this.setCigarUniforms(
        this.parent.gapUniforms,
        gl,
        domainOffset,
        state,
        coverageOffset,
      )
      gl.uniform3f(
        this.parent.gapUniforms.u_colorDeletion!,
        colors.colorDeletion[0],
        colors.colorDeletion[1],
        colors.colorDeletion[2],
      )
      gl.uniform3f(
        this.parent.gapUniforms.u_colorSkip!,
        colors.colorSkip[0],
        colors.colorSkip[1],
        colors.colorSkip[2],
      )

      gl.bindVertexArray(buffers.gapVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.gapCount)
    }

    if (state.showMismatches && !state.showModifications) {
      if (buffers.mismatchVAO && buffers.mismatchCount > 0) {
        gl.useProgram(this.parent.mismatchProgram)
        this.setCigarUniforms(
          this.parent.mismatchUniforms,
          gl,
          domainOffset,
          state,
          coverageOffset,
        )
        gl.uniform3f(
          this.parent.mismatchUniforms.u_colorBaseA!,
          ...colors.colorBaseA,
        )
        gl.uniform3f(
          this.parent.mismatchUniforms.u_colorBaseC!,
          ...colors.colorBaseC,
        )
        gl.uniform3f(
          this.parent.mismatchUniforms.u_colorBaseG!,
          ...colors.colorBaseG,
        )
        gl.uniform3f(
          this.parent.mismatchUniforms.u_colorBaseT!,
          ...colors.colorBaseT,
        )

        gl.bindVertexArray(buffers.mismatchVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.mismatchCount)
      }
    }

    if (
      state.showMismatches &&
      buffers.insertionVAO &&
      buffers.insertionCount > 0
    ) {
      gl.useProgram(this.parent.insertionProgram)
      this.setCigarUniforms(
        this.parent.insertionUniforms,
        gl,
        domainOffset,
        state,
        coverageOffset,
      )
      gl.uniform3f(
        this.parent.insertionUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )

      gl.bindVertexArray(buffers.insertionVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, buffers.insertionCount)
    }

    if (buffers.softclipVAO && buffers.softclipCount > 0) {
      gl.useProgram(this.parent.softclipProgram)
      this.setCigarUniforms(
        this.parent.softclipUniforms,
        gl,
        domainOffset,
        state,
        coverageOffset,
      )
      gl.uniform3f(
        this.parent.softclipUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )

      gl.bindVertexArray(buffers.softclipVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.softclipCount)
    }

    if (buffers.hardclipVAO && buffers.hardclipCount > 0) {
      gl.useProgram(this.parent.hardclipProgram)
      this.setCigarUniforms(
        this.parent.hardclipUniforms,
        gl,
        domainOffset,
        state,
        coverageOffset,
      )
      gl.uniform3f(
        this.parent.hardclipUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(buffers.hardclipVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.hardclipCount)
    }

    if (
      state.showSoftClipping &&
      buffers.softclipBaseVAO &&
      buffers.softclipBaseCount > 0
    ) {
      gl.useProgram(this.parent.mismatchProgram)
      this.setCigarUniforms(
        this.parent.mismatchUniforms,
        gl,
        domainOffset,
        state,
        coverageOffset,
      )
      gl.uniform3f(
        this.parent.mismatchUniforms.u_colorBaseA!,
        ...colors.colorBaseA,
      )
      gl.uniform3f(
        this.parent.mismatchUniforms.u_colorBaseC!,
        ...colors.colorBaseC,
      )
      gl.uniform3f(
        this.parent.mismatchUniforms.u_colorBaseG!,
        ...colors.colorBaseG,
      )
      gl.uniform3f(
        this.parent.mismatchUniforms.u_colorBaseT!,
        ...colors.colorBaseT,
      )
      gl.bindVertexArray(buffers.softclipBaseVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.softclipBaseCount)
    }

    if (
      state.showModifications &&
      buffers.modificationVAO &&
      buffers.modificationCount > 0
    ) {
      gl.useProgram(this.parent.modificationProgram)
      this.setCigarUniforms(
        this.parent.modificationUniforms,
        gl,
        domainOffset,
        state,
        coverageOffset,
      )

      gl.bindVertexArray(buffers.modificationVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.modificationCount)
    }

    if (state.highlightedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.highlightedChainIds,
        buffers.readIdToIndex,
        buffers.readPositions,
        buffers.readYs,
      )
      if (bounds) {
        const clip = toClipRect(
          bounds.minStart + regionStart,
          bounds.maxEnd + regionStart,
          bounds.y,
          state,
          bpStartHi,
          bpStartLo,
          regionLengthBp,
          coverageOffset,
          canvasHeight,
        )
        this.drawFilledRect(gl, clip)
      }
    } else if (state.highlightedFeatureId) {
      const hlIdx = buffers.readIdToIndex.get(state.highlightedFeatureId) ?? -1
      if (hlIdx >= 0) {
        gl.useProgram(this.parent.readProgram)
        gl.uniform1i(this.parent.readUniforms.u_highlightOnlyMode!, 1)
        gl.uniform1i(this.parent.readUniforms.u_highlightedIndex!, hlIdx)
        gl.bindVertexArray(buffers.readVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, buffers.segmentCount)
        gl.uniform1i(this.parent.readUniforms.u_highlightOnlyMode!, 0)
      }
    }

    gl.disable(gl.SCISSOR_TEST)

    if (state.selectedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.selectedChainIds,
        buffers.readIdToIndex,
        buffers.readPositions,
        buffers.readYs,
      )
      if (bounds) {
        const clip = toClipRect(
          bounds.minStart + regionStart,
          bounds.maxEnd + regionStart,
          bounds.y,
          state,
          bpStartHi,
          bpStartLo,
          regionLengthBp,
          coverageOffset,
          canvasHeight,
        )
        this.drawOutlineRect(gl, clip, 0, canvasWidth, regionLengthBp, state)
      }
    } else if (state.selectedFeatureId) {
      const idx = buffers.readIdToIndex.get(state.selectedFeatureId) ?? -1
      if (idx >= 0) {
        const startOffset = buffers.readPositions[idx * 2]
        const endOffset = buffers.readPositions[idx * 2 + 1]
        const y = buffers.readYs[idx]
        if (
          startOffset !== undefined &&
          endOffset !== undefined &&
          y !== undefined
        ) {
          const clip = toClipRect(
            startOffset + regionStart,
            endOffset + regionStart,
            y,
            state,
            bpStartHi,
            bpStartLo,
            regionLengthBp,
            coverageOffset,
            canvasHeight,
          )
          this.drawOutlineRect(
            gl,
            clip,
            buffers.readStrands[idx] ?? 0,
            canvasWidth,
            regionLengthBp,
            state,
          )
        }
      }
    }

    gl.bindVertexArray(null)
  }

  private drawFilledRect(gl: WebGL2RenderingContext, clip: ClipRect) {
    const { sx1, sx2, syTop, syBot } = clip
    gl.useProgram(this.parent.lineProgram)
    gl.uniform4f(this.parent.lineUniforms.u_color!, 0, 0, 0, 0.4)
    const quadData = new Float32Array([
      sx1,
      syTop,
      sx2,
      syTop,
      sx1,
      syBot,
      sx1,
      syBot,
      sx2,
      syTop,
      sx2,
      syBot,
    ])
    gl.bindVertexArray(this.parent.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.parent.lineBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private drawOutlineRect(
    gl: WebGL2RenderingContext,
    clip: ClipRect,
    strand: number,
    canvasWidth: number,
    regionLengthBp: number,
    state: RenderState,
  ) {
    const { sx1, sx2, syTop, syBot } = clip
    gl.useProgram(this.parent.lineProgram)
    gl.uniform4f(this.parent.lineUniforms.u_color!, 0, 0, 0, 1)

    const bpPerPx = regionLengthBp / canvasWidth
    const showChevron = bpPerPx < 10 && state.featureHeight > 5
    const chevronClip = (8 / canvasWidth) * 2
    const syMid = (syTop + syBot) / 2

    let outlineData: Float32Array
    if (showChevron && strand === 1) {
      outlineData = new Float32Array([
        sx1,
        syTop,
        sx2,
        syTop,
        sx2 + chevronClip,
        syMid,
        sx2,
        syBot,
        sx1,
        syBot,
        sx1,
        syTop,
      ])
    } else if (showChevron && strand === -1) {
      outlineData = new Float32Array([
        sx1,
        syTop,
        sx2,
        syTop,
        sx2,
        syBot,
        sx1,
        syBot,
        sx1 - chevronClip,
        syMid,
        sx1,
        syTop,
      ])
    } else {
      outlineData = new Float32Array([
        sx1,
        syTop,
        sx2,
        syTop,
        sx2,
        syBot,
        sx1,
        syBot,
        sx1,
        syTop,
      ])
    }

    gl.bindVertexArray(this.parent.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.parent.lineBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, outlineData, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.LINE_STRIP, 0, outlineData.length / 2)
  }
}
