import {
  YSCALEBAR_LABEL_OFFSET,
  getDevicePixelRatio,
} from '@jbrowse/alignments-core'

import { packCoverageForGpu } from '../features/coverage/packGpu.ts'
import {
  COVERAGE_PASS,
  PASS_COVERAGE,
  uploadCoverageToGpu,
} from '../features/coverage/uploadGpu.ts'
import { prepareBlockGeometry } from '../features/fill/packGpu.ts'
import {
  FILL_PASS,
  PASS_FILL,
  uploadFillToGpu,
} from '../features/fill/uploadGpu.ts'
import { packIndicatorsForGpu } from '../features/indicator/packGpu.ts'
import {
  INDICATORS_PASS,
  PASS_INDICATORS,
  uploadIndicatorsToGpu,
} from '../features/indicator/uploadGpu.ts'
import { packSnpCoverageForGpu } from '../features/snpCoverage/packGpu.ts'
import {
  PASS_SNP,
  SNP_PASS,
  uploadSnpCoverageToGpu,
} from '../features/snpCoverage/uploadGpu.ts'
import * as fillShader from '../shaders/slang/multiSyntenyFill.generated.ts'
import { UNIFORM_OFFSET_F32 as U } from '../shaders/slang/multiSyntenyFill.generated.ts'
import { computeBlockRenderParams } from '../shared/blockRenderParams.ts'
import { BG_COLOR_GL } from '../shared/types.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderState,
  MultiSyntenySources,
} from './rendererTypes.ts'
import type { BlockRenderParams } from '../shared/blockRenderParams.ts'
import type { SyntenyColorPalette } from '../shared/types.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const UNIFORMS_SIZE_BYTES = fillShader.UNIFORMS_SIZE_BYTES

export const SYNTENY_PASSES: PassDescriptor[] = [
  FILL_PASS,
  COVERAGE_PASS,
  SNP_PASS,
  INDICATORS_PASS,
]

export class GpuMultiSyntenyRenderer implements MultiSyntenyBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  sync(sources: MultiSyntenySources) {
    const {
      rpcDataMap,
      displayedGenomes,
      colorBy,
      showSnps,
      showCoverage,
      coverageGlobalMax,
      viewWidth,
      palette,
    } = sources

    const active = new Set<number>()
    for (const [idx, data] of rpcDataMap) {
      active.add(idx)
      uploadFillToGpu(
        this.hal,
        idx,
        prepareBlockGeometry(
          data.genomeFeatures,
          displayedGenomes,
          colorBy,
          showSnps,
          palette.syntenyColors,
        ),
      )
      if (showCoverage) {
        uploadCoverageToGpu(
          this.hal,
          idx,
          packCoverageForGpu(
            data.coverageDepths,
            data.coverageStartPos,
            coverageGlobalMax,
            viewWidth,
          ),
          data.coverageMaxDepth,
        )
        uploadSnpCoverageToGpu(
          this.hal,
          idx,
          packSnpCoverageForGpu(
            data.snpPositions,
            data.snpYOffsets,
            data.snpHeights,
            data.snpColorTypes,
            data.snpCount,
          ),
        )
        uploadIndicatorsToGpu(
          this.hal,
          idx,
          packIndicatorsForGpu(data.indicatorPositions, data.numIndicators),
        )
      }
    }
    if (active.size === 0) {
      this.hal.deleteAllRegions()
    }
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
    // depthScale multiplies coverage bar heights in the shader; 1 = no
    // cross-region normalization (should eventually be region.maxDepth /
    // globalMaxDepth, as GpuAlignmentsRenderer does)
    const depthScale = 1

    this.hal.beginFrame(BG_COLOR_GL, BG_COLOR_GL, BG_COLOR_GL)

    const passes = coverageHeight > 0
      ? [PASS_COVERAGE, PASS_SNP, PASS_INDICATORS, PASS_FILL]
      : [PASS_FILL]

    for (const passId of passes) {
      this.drawPassForVisibleBlocks(
        passId,
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

    this.hal.endFrame()
    return true
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
    palette: SyntenyColorPalette,
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

type Rgb3 = [number, number, number]

function writeRgb(f: Float32Array, offset: number, rgb: Rgb3) {
  f[offset] = rgb[0]
  f[offset + 1] = rgb[1]
  f[offset + 2] = rgb[2]
}

function fillSyntenyUniforms(
  f: Float32Array,
  width: number,
  height: number,
  rowHeight: number,
  bpRangeHi: number,
  bpRangeLo: number,
  bpRangeLen: number,
  regionScreenLeft: number,
  regionScreenWidth: number,
  rowPadding: number,
  coverageHeight: number,
  depthScale: number,
  palette: SyntenyColorPalette,
) {
  f[U.resolutionX] = width
  f[U.resolutionY] = height
  f[U.rowHeight] = rowHeight
  f[U.coverageHeight] = coverageHeight
  f[U.bpRangeHi] = bpRangeHi
  f[U.bpRangeLo] = bpRangeLo
  f[U.bpRangeLen] = bpRangeLen
  f[U.regionScreenLeft] = regionScreenLeft
  f[U.regionScreenWidth] = regionScreenWidth
  f[U.hpZero] = 0
  f[U.rowPadding] = rowPadding
  f[U.coverageYOffset] = YSCALEBAR_LABEL_OFFSET
  f[U.depthScale] = depthScale
  writeRgb(f, U.coverageR, palette.coverageColorRgb)
  writeRgb(f, U.baseAR, palette.baseColorGl.A)
  writeRgb(f, U.baseCR, palette.baseColorGl.C)
  writeRgb(f, U.baseGR, palette.baseColorGl.G)
  writeRgb(f, U.baseTR, palette.baseColorGl.T)
}
