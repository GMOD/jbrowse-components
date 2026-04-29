import { getDevicePixelRatio } from '@jbrowse/alignments-core'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import { fillSyntenyUniforms } from './multiSyntenyGpuUtils.ts'
import * as coverageShader from '../shaders/multiSyntenyCoverage.generated.ts'
import * as fillShader from '../shaders/multiSyntenyFill.generated.ts'
import * as indicatorShader from '../shaders/multiSyntenyIndicator.generated.ts'
import * as snpShader from '../shaders/multiSyntenySnp.generated.ts'
import { computeBlockRenderParams } from '../shared/blockRenderParams.ts'
import { BG_COLOR_GL } from '../shared/types.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderState,
} from './rendererTypes.ts'
import type { BlockCoverageUploadData } from '../features/coverage/packGpu.ts'
import type { BlockGeometryData } from '../features/fill/packGpu.ts'
import type { BlockIndicatorUploadData } from '../features/indicator/packGpu.ts'
import type { BlockSnpUploadData } from '../features/snpCoverage/packGpu.ts'
import type { BlockRenderParams } from '../shared/blockRenderParams.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const PASS_FILL = 'fill'
const PASS_COVERAGE = 'coverage'
const PASS_SNP = 'snp'
const PASS_INDICATORS = 'indicators'

const UNIFORMS_SIZE_BYTES = fillShader.UNIFORMS_SIZE_BYTES

export const SYNTENY_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_FILL,
    mod: fillShader,
  }),
  slangPass({
    id: PASS_COVERAGE,
    mod: coverageShader,
  }),
  slangPass({
    id: PASS_SNP,
    mod: snpShader,
  }),
  slangPass({
    id: PASS_INDICATORS,
    mod: indicatorShader,
  }),
]

export class GpuMultiSyntenyRenderer implements MultiSyntenyBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadGeometryForBlock(
    displayedRegionIndex: number,
    data: BlockGeometryData & { regionStart: number },
  ) {
    this.hal.setRegionMeta(displayedRegionIndex, {
      regionStart: data.regionStart,
    })
    this.hal.uploadBuffer(
      displayedRegionIndex,
      PASS_FILL,
      data.buffer,
      data.instanceCount,
    )
  }

  uploadCoverageForBlock(
    displayedRegionIndex: number,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ) {
    this.hal.setRegionMeta(displayedRegionIndex, { maxDepth: data.maxDepth })
    this.hal.uploadBuffer(
      displayedRegionIndex,
      PASS_COVERAGE,
      data.buffer,
      data.binCount,
    )
  }

  uploadSnpCoverageForBlock(
    displayedRegionIndex: number,
    data: BlockSnpUploadData,
  ) {
    this.hal.uploadBuffer(
      displayedRegionIndex,
      PASS_SNP,
      data.buffer,
      data.segmentCount,
    )
  }

  uploadIndicatorsForBlock(
    displayedRegionIndex: number,
    data: BlockIndicatorUploadData,
  ) {
    this.hal.uploadBuffer(
      displayedRegionIndex,
      PASS_INDICATORS,
      data.buffer,
      data.indicatorCount,
    )
  }

  clearAllBlocks() {
    this.hal.deleteAllRegions()
  }

  renderBlocks(state: MultiSyntenyRenderState) {
    const {
      contentBlocks,
      viewOffsetPx,
      width,
      height,
      rowHeight,
      rowSpacing,
      coverageHeight,
      palette,
    } = state

    this.hal.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = Math.round(width * dpr) / dpr
    const logicalH = Math.round(height * dpr) / dpr
    const rowPadding = rowSpacing ? 1 : 0

    let globalMaxDepth = 0
    for (const block of contentBlocks) {
      if (block.displayedRegionIndex !== undefined) {
        const meta = this.hal.getRegionMeta(block.displayedRegionIndex)
        if (meta && meta.maxDepth > globalMaxDepth) {
          globalMaxDepth = meta.maxDepth
        }
      }
    }
    // depthScale multiplies coverage bar heights in the shader; 1 = no cross-region normalization
    // (should eventually be region.maxDepth / globalMaxDepth, as GpuAlignmentsRenderer does)
    const depthScale = 1

    this.hal.beginFrame(BG_COLOR_GL, BG_COLOR_GL, BG_COLOR_GL)

    if (coverageHeight > 0) {
      this.drawPassForVisibleBlocks(
        PASS_COVERAGE,
        contentBlocks,
        viewOffsetPx,
        logicalW,
        logicalH,
        rowHeight,
        rowPadding,
        coverageHeight,
        depthScale,
        palette,
      )
      this.drawPassForVisibleBlocks(
        PASS_SNP,
        contentBlocks,
        viewOffsetPx,
        logicalW,
        logicalH,
        rowHeight,
        rowPadding,
        coverageHeight,
        depthScale,
        palette,
      )
      this.drawPassForVisibleBlocks(
        PASS_INDICATORS,
        contentBlocks,
        viewOffsetPx,
        logicalW,
        logicalH,
        rowHeight,
        rowPadding,
        coverageHeight,
        depthScale,
        palette,
      )
    }

    this.drawPassForVisibleBlocks(
      PASS_FILL,
      contentBlocks,
      viewOffsetPx,
      logicalW,
      logicalH,
      rowHeight,
      rowPadding,
      coverageHeight,
      depthScale,
      palette,
    )

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }

  private drawPassForVisibleBlocks(
    passId: string,
    contentBlocks: ContentBlock[],
    viewOffsetPx: number,
    logicalW: number,
    logicalH: number,
    rowHeight: number,
    rowPadding: number,
    coverageHeight: number,
    depthScale: number,
    palette: MultiSyntenyRenderState['palette'],
  ) {
    for (const [regionKey, params] of this.visibleBlocks(
      contentBlocks,
      viewOffsetPx,
      logicalW,
    )) {
      if (this.hal.getBufferCount(regionKey, passId) === 0) {
        continue
      }
      fillSyntenyUniforms(
        this.uniformF32,
        logicalW,
        logicalH,
        rowHeight,
        params.bpRangeHi,
        params.bpRangeLo,
        params.bpRangeLen,
        params.regionScreenLeft,
        params.regionScreenWidth,
        rowPadding,
        coverageHeight,
        depthScale,
        palette,
      )
      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(passId, regionKey)
    }
  }

  private *visibleBlocks(
    contentBlocks: ContentBlock[],
    viewOffsetPx: number,
    viewWidth: number,
  ): Generator<[number, BlockRenderParams]> {
    for (const block of contentBlocks) {
      if (block.displayedRegionIndex === undefined) {
        continue
      }
      if (!this.hal.getRegionMeta(block.displayedRegionIndex)) {
        continue
      }
      const params = computeBlockRenderParams(block, viewOffsetPx)
      if (
        params.regionScreenLeft + params.regionScreenWidth < 0 ||
        params.regionScreenLeft > viewWidth
      ) {
        continue
      }
      yield [block.displayedRegionIndex, params]
    }
  }
}

export { UNIFORMS_SIZE_BYTES as SYNTENY_UNIFORM_BYTE_SIZE }
