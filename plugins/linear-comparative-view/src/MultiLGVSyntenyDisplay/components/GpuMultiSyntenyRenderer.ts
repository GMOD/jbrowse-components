import {
  computeDepthScale,
  getDevicePixelRatio,
} from '@jbrowse/alignments-core'

import { BG_COLOR_GL } from './multiSyntenyBackendTypes.ts'
import {
  INDICATOR_BYTE_SIZE,
  SNP_SEGMENT_BYTE_SIZE,
  computeBlockRenderParams,
} from './multiSyntenyGpuData.ts'
import {
  COVERAGE_BIN_BYTE_SIZE,
  COVERAGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_VERTEX_SHADER,
  GLSL_INDICATOR_VERTEX_SHADER,
  GLSL_SNP_COVERAGE_VERTEX_SHADER,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  WGSL_COVERAGE_SHADER,
  WGSL_FILL_SHADER,
  WGSL_INDICATOR_SHADER,
  WGSL_SNP_COVERAGE_SHADER,
} from './multiSyntenyGpuShaders.ts'
import { fillSyntenyUniforms } from './multiSyntenyGpuUtils.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderState,
} from './multiSyntenyBackendTypes.ts'
import type {
  BlockCoverageUploadData,
  BlockGeometryData,
  BlockIndicatorUploadData,
  BlockRenderParams,
  BlockSnpUploadData,
} from './multiSyntenyGpuData.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

const PASS_FILL = 'fill'
const PASS_COVERAGE = 'coverage'
const PASS_SNP = 'snp'
const PASS_INDICATORS = 'indicators'

export const SYNTENY_PASSES: PassDescriptor[] = [
  {
    id: PASS_FILL,
    wgslSource: WGSL_FILL_SHADER,
    glslVertex: FILL_VERTEX_SHADER,
    glslFragment: FILL_FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTE_SIZE,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      {
        name: 'a_data0',
        components: 4,
        type: 'uint',
        offsetBytes: 0,
        integer: true,
      },
      {
        name: 'a_color',
        components: 4,
        type: 'float',
        offsetBytes: 16,
        integer: false,
      },
    ],
  },
  {
    id: PASS_COVERAGE,
    wgslSource: WGSL_COVERAGE_SHADER,
    glslVertex: COVERAGE_VERTEX_SHADER,
    glslFragment: FILL_FRAGMENT_SHADER,
    instanceStride: COVERAGE_BIN_BYTE_SIZE,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      {
        name: 'a_position',
        components: 1,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
      {
        name: 'a_minDepth',
        components: 1,
        type: 'float',
        offsetBytes: 4,
        integer: false,
      },
      {
        name: 'a_maxDepth',
        components: 1,
        type: 'float',
        offsetBytes: 8,
        integer: false,
      },
    ],
  },
  {
    id: PASS_SNP,
    wgslSource: WGSL_SNP_COVERAGE_SHADER,
    glslVertex: GLSL_SNP_COVERAGE_VERTEX_SHADER,
    glslFragment: FILL_FRAGMENT_SHADER,
    instanceStride: SNP_SEGMENT_BYTE_SIZE,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      {
        name: 'a_position',
        components: 1,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
      {
        name: 'a_yOffset',
        components: 1,
        type: 'float',
        offsetBytes: 4,
        integer: false,
      },
      {
        name: 'a_height',
        components: 1,
        type: 'float',
        offsetBytes: 8,
        integer: false,
      },
      {
        name: 'a_colorType',
        components: 1,
        type: 'float',
        offsetBytes: 12,
        integer: false,
      },
    ],
  },
  {
    id: PASS_INDICATORS,
    wgslSource: WGSL_INDICATOR_SHADER,
    glslVertex: GLSL_INDICATOR_VERTEX_SHADER,
    glslFragment: FILL_FRAGMENT_SHADER,
    instanceStride: INDICATOR_BYTE_SIZE,
    verticesPerInstance: 3,
    blend: true,
    glAttributes: [
      {
        name: 'a_position',
        components: 1,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
    ],
  },
]

export class GpuMultiSyntenyRenderer implements MultiSyntenyBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  uploadGeometryForBlock(
    regionNumber: number,
    data: BlockGeometryData & { regionStart: number },
  ) {
    this.hal.setRegionMeta(regionNumber, { regionStart: data.regionStart })
    this.hal.uploadBuffer(
      regionNumber,
      PASS_FILL,
      data.buffer,
      data.instanceCount,
    )
  }

  uploadCoverageForBlock(
    regionNumber: number,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ) {
    this.hal.setRegionMeta(regionNumber, { maxDepth: data.maxDepth })
    this.hal.uploadBuffer(
      regionNumber,
      PASS_COVERAGE,
      data.buffer,
      data.binCount,
    )
  }

  uploadSnpCoverageForBlock(regionNumber: number, data: BlockSnpUploadData) {
    this.hal.uploadBuffer(
      regionNumber,
      PASS_SNP,
      data.buffer,
      data.segmentCount,
    )
  }

  uploadIndicatorsForBlock(
    regionNumber: number,
    data: BlockIndicatorUploadData,
  ) {
    this.hal.uploadBuffer(
      regionNumber,
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
      if (block.regionNumber !== undefined) {
        const meta = this.hal.getRegionMeta(block.regionNumber)
        if (meta && meta.maxDepth > globalMaxDepth) {
          globalMaxDepth = meta.maxDepth
        }
      }
    }
    const depthScale = computeDepthScale(globalMaxDepth)

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
    contentBlocks: BaseBlock[],
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
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    viewWidth: number,
  ): Generator<[number, BlockRenderParams]> {
    for (const block of contentBlocks) {
      if (block.regionNumber === undefined) {
        continue
      }
      if (!this.hal.getRegionMeta(block.regionNumber)) {
        continue
      }
      const params = computeBlockRenderParams(block, viewOffsetPx)
      if (
        params.regionScreenLeft + params.regionScreenWidth < 0 ||
        params.regionScreenLeft > viewWidth
      ) {
        continue
      }
      yield [block.regionNumber, params]
    }
  }
}

export { UNIFORM_BYTE_SIZE as SYNTENY_UNIFORM_BYTE_SIZE } from './multiSyntenyGpuShaders.ts'
