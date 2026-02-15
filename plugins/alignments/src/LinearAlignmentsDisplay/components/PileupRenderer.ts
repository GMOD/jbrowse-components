/**
 * PileupRenderer - Handles rendering of pileup mode
 *
 * This renderer draws individual reads as rectangles with CIGAR features
 * (gaps, mismatches, insertions, clips, modifications).
 *
 * Extracted from WebGLRenderer to improve code organization.
 */

import { splitPositionWithFrac } from './shaders/index.ts'

import type { RenderState, WebGLRenderer } from './WebGLRenderer.ts'
import type { ColorPalette } from './shaders/index.ts'

interface ClipRect {
  sx1: number
  sx2: number
  syTop: number
  syBot: number
}

function getChainBounds(
  indices: number[],
  readPositions: Uint32Array,
  readYs: Uint16Array,
) {
  let minStart = Infinity
  let maxEnd = -Infinity
  let y = 0
  for (const idx of indices) {
    const s = readPositions[idx * 2]
    const e = readPositions[idx * 2 + 1]
    const row = readYs[idx]
    if (s !== undefined && s < minStart) {
      minStart = s
    }
    if (e !== undefined && e > maxEnd) {
      maxEnd = e
    }
    if (row !== undefined) {
      y = row
    }
  }
  return minStart < Infinity ? { minStart, maxEnd, y } : undefined
}

function toClipRect(
  absStart: number,
  absEnd: number,
  y: number,
  state: RenderState,
  bpStartHi: number,
  bpStartLo: number,
  regionLengthBp: number,
  coverageOffset: number,
  canvasHeight: number,
): ClipRect {
  const splitStart = [
    Math.floor(absStart) - (Math.floor(absStart) & 0xfff),
    Math.floor(absStart) & 0xfff,
  ]
  const splitEnd = [
    Math.floor(absEnd) - (Math.floor(absEnd) & 0xfff),
    Math.floor(absEnd) & 0xfff,
  ]
  const sx1 =
    ((splitStart[0]! - bpStartHi + splitStart[1]! - bpStartLo) /
      regionLengthBp) *
      2 -
    1
  const sx2 =
    ((splitEnd[0]! - bpStartHi + splitEnd[1]! - bpStartLo) / regionLengthBp) *
      2 -
    1

  const rowHeight = state.featureHeight + state.featureSpacing
  const yTopPx = y * rowHeight - state.rangeY[0]
  const yBotPx = yTopPx + state.featureHeight
  const pileupTop = 1 - (coverageOffset / canvasHeight) * 2
  const pxToClip = 2 / canvasHeight
  const syTop = pileupTop - yTopPx * pxToClip
  const syBot = pileupTop - yBotPx * pxToClip

  return { sx1, sx2, syTop, syBot }
}

/**
 * PileupRenderer orchestrates rendering of reads and CIGAR features in pileup mode.
 *
 * The renderer receives a parent WebGLRenderer instance to access:
 * - WebGL context (gl)
 * - Shader programs and their uniform locations
 * - Buffers and VAOs for geometry
 */
export class PileupRenderer {
  constructor(private parent: WebGLRenderer) {}

  render(
    state: RenderState,
    domainOffset: [number, number],
    colors: ColorPalette,
    scissorX = 0,
  ) {
    const gl = this.parent.gl
    const buffers = this.parent.buffers

    if (!buffers || buffers.readCount === 0) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const regionStart = buffers.regionStart

    // Compute high-precision split domain for reads (12-bit split approach).
    // Uses splitPositionWithFrac to preserve fractional scroll position - without this,
    // reads would "stick" at integer bp positions and snap when crossing boundaries.
    const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    // Draw reads
    const coverageOffset = state.showCoverage ? state.coverageHeight : 0

    // Scissor clips pileup to area below coverage, within the block's X range.
    // gl.scissor uses device pixel coordinates (DPR-scaled).
    const dpr = this.parent.dpr
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      Math.round(scissorX * dpr),
      0,
      Math.round(canvasWidth * dpr),
      Math.round((canvasHeight - coverageOffset) * dpr),
    )

    // Stencil pass: mark skip (intron) regions so reads don't draw there
    if (buffers.gapVAO && buffers.gapCount > 0) {
      gl.enable(gl.STENCIL_TEST)
      gl.stencilMask(0xff)
      gl.clear(gl.STENCIL_BUFFER_BIT)
      gl.stencilFunc(gl.ALWAYS, 1, 0xff)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
      gl.colorMask(false, false, false, false)

      gl.useProgram(this.parent.gapProgram)
      gl.uniform2f(
        this.parent.gapUniforms.u_bpRangeX!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform2f(
        this.parent.gapUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(
        this.parent.gapUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.parent.gapUniforms.u_featureSpacing!,
        state.featureSpacing,
      )
      gl.uniform1f(this.parent.gapUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.parent.gapUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.parent.gapUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1i(this.parent.gapUniforms.u_eraseMode!, 1)

      gl.bindVertexArray(buffers.gapVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.gapCount)

      gl.colorMask(true, true, true, true)
      gl.stencilFunc(gl.EQUAL, 0, 0xff)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
    }

    gl.useProgram(this.parent.readProgram)
    // Use high-precision split domain for reads (vec3: hi, lo, extent)
    gl.uniform3f(
      this.parent.readUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    // Pass regionStart so shader can convert offsets to absolute positions (must be integer)
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
    gl.uniform1i(
      this.parent.readUniforms.u_highlightedIndex!,
      state.highlightedFeatureIndex,
    )
    const mode = state.renderingMode ?? 'pileup'
    const isChainMode = mode === 'cloud' || mode === 'linkedRead'
    gl.uniform1i(this.parent.readUniforms.u_chainMode!, isChainMode ? 1 : 0)
    gl.uniform1i(this.parent.readUniforms.u_showStroke!, isChainMode ? 1 : 0)

    // Set color uniforms for read shapes
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

    // Set insert size thresholds (defaults for when stats are unavailable)
    const stats = buffers.insertSizeStats
    const upperThreshold = stats?.upper ?? 1e9
    const lowerThreshold = stats?.lower ?? 0
    gl.uniform1f(this.parent.readUniforms.u_insertSizeUpper!, upperThreshold)
    gl.uniform1f(this.parent.readUniforms.u_insertSizeLower!, lowerThreshold)

    gl.uniform1i(this.parent.readUniforms.u_highlightOnlyMode!, 0)

    gl.bindVertexArray(buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, buffers.readCount)

    gl.disable(gl.STENCIL_TEST)

    // Draw gaps (deletions and skips) - always draw regardless of modifications
    if (state.showMismatches && buffers.gapVAO && buffers.gapCount > 0) {
      gl.useProgram(this.parent.gapProgram)
      gl.uniform2f(
        this.parent.gapUniforms.u_bpRangeX!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform2f(
        this.parent.gapUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(
        this.parent.gapUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.parent.gapUniforms.u_featureSpacing!,
        state.featureSpacing,
      )
      gl.uniform1f(this.parent.gapUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.parent.gapUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.parent.gapUniforms.u_canvasWidth!, canvasWidth)
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
      gl.uniform1i(this.parent.gapUniforms.u_eraseMode!, 0)

      gl.bindVertexArray(buffers.gapVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.gapCount)
    }

    // Draw mismatches only when not showing modifications
    if (state.showMismatches && !state.showModifications) {
      // Draw mismatches
      if (buffers.mismatchVAO && buffers.mismatchCount > 0) {
        gl.useProgram(this.parent.mismatchProgram)
        gl.uniform2f(
          this.parent.mismatchUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.parent.mismatchUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.parent.mismatchUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.parent.mismatchUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(
          this.parent.mismatchUniforms.u_coverageOffset!,
          coverageOffset,
        )
        gl.uniform1f(this.parent.mismatchUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.parent.mismatchUniforms.u_canvasWidth!, canvasWidth)
        // Base color uniforms from theme
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

    // Draw insertions - always draw regardless of modifications
    if (
      state.showMismatches &&
      buffers.insertionVAO &&
      buffers.insertionCount > 0
    ) {
      gl.useProgram(this.parent.insertionProgram)
      gl.uniform2f(
        this.parent.insertionUniforms.u_bpRangeX!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform2f(
        this.parent.insertionUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(
        this.parent.insertionUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.parent.insertionUniforms.u_featureSpacing!,
        state.featureSpacing,
      )
      gl.uniform1f(
        this.parent.insertionUniforms.u_coverageOffset!,
        coverageOffset,
      )
      gl.uniform1f(this.parent.insertionUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.parent.insertionUniforms.u_canvasWidth!, canvasWidth)
      // Insertion color uniform from theme
      gl.uniform3f(
        this.parent.insertionUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )

      gl.bindVertexArray(buffers.insertionVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, buffers.insertionCount)
    }

    // Draw clips and mismatches only when not showing modifications
    if (state.showMismatches && !state.showModifications) {
      // Draw soft clips
      if (buffers.softclipVAO && buffers.softclipCount > 0) {
        gl.useProgram(this.parent.softclipProgram)
        gl.uniform2f(
          this.parent.softclipUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.parent.softclipUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.parent.softclipUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.parent.softclipUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(
          this.parent.softclipUniforms.u_coverageOffset!,
          coverageOffset,
        )
        gl.uniform1f(this.parent.softclipUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.parent.softclipUniforms.u_canvasWidth!, canvasWidth)
        // Softclip color uniform from theme
        gl.uniform3f(
          this.parent.softclipUniforms.u_colorSoftclip!,
          ...colors.colorSoftclip,
        )

        gl.bindVertexArray(buffers.softclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.softclipCount)
      }

      // Draw hard clips
      if (buffers.hardclipVAO && buffers.hardclipCount > 0) {
        gl.useProgram(this.parent.hardclipProgram)
        gl.uniform2f(
          this.parent.hardclipUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.parent.hardclipUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.parent.hardclipUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.parent.hardclipUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(
          this.parent.hardclipUniforms.u_coverageOffset!,
          coverageOffset,
        )
        gl.uniform1f(this.parent.hardclipUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.parent.hardclipUniforms.u_canvasWidth!, canvasWidth)
        // Hardclip color uniform from theme
        gl.uniform3f(
          this.parent.hardclipUniforms.u_colorHardclip!,
          ...colors.colorHardclip,
        )

        gl.bindVertexArray(buffers.hardclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.hardclipCount)
      }
    }

    // Draw modifications (on top of reads and mismatches)
    if (
      state.showModifications &&
      buffers.modificationVAO &&
      buffers.modificationCount > 0
    ) {
      gl.useProgram(this.parent.modificationProgram)
      gl.uniform2f(
        this.parent.modificationUniforms.u_bpRangeX!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform2f(
        this.parent.modificationUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(
        this.parent.modificationUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.parent.modificationUniforms.u_featureSpacing!,
        state.featureSpacing,
      )
      gl.uniform1f(
        this.parent.modificationUniforms.u_coverageOffset!,
        coverageOffset,
      )
      gl.uniform1f(
        this.parent.modificationUniforms.u_canvasHeight!,
        canvasHeight,
      )
      gl.uniform1f(this.parent.modificationUniforms.u_canvasWidth!, canvasWidth)

      gl.bindVertexArray(buffers.modificationVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.modificationCount)
    }

    // Highlight overlay pass
    if (state.highlightedChainIndices.length > 0) {
      // Chain highlight: single spanning rectangle covering the full chain extent
      const bounds = getChainBounds(
        state.highlightedChainIndices,
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
    } else if (state.highlightedFeatureIndex >= 0) {
      // Single-feature highlight (pileup mode)
      gl.useProgram(this.parent.readProgram)
      gl.uniform1i(this.parent.readUniforms.u_highlightOnlyMode!, 1)
      gl.uniform1i(
        this.parent.readUniforms.u_highlightedIndex!,
        state.highlightedFeatureIndex,
      )
      gl.bindVertexArray(buffers.readVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, buffers.readCount)
      gl.uniform1i(this.parent.readUniforms.u_highlightOnlyMode!, 0)
    }

    gl.disable(gl.SCISSOR_TEST)

    // Draw selection outline
    if (state.selectedChainIndices.length > 0) {
      const bounds = getChainBounds(
        state.selectedChainIndices,
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
    } else if (
      state.selectedFeatureIndex >= 0 &&
      state.selectedFeatureIndex < buffers.readCount
    ) {
      const idx = state.selectedFeatureIndex
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

    gl.bindVertexArray(null)
  }

  private drawFilledRect(gl: WebGL2RenderingContext, clip: ClipRect) {
    const { sx1, sx2, syTop, syBot } = clip
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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
