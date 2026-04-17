import { clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import { computeNumRows, interleaveInstances } from './webglUtils.ts'
import { RENDERING_TYPE_LINE, VERTICES_PER_INSTANCE } from './wiggleShader.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_FILL = 'fill'
const PASS_LINE = 'line'

const UNIFORMS_SIZE_BYTES = wiggleShader.UNIFORMS_SIZE_BYTES
const U = wiggleShader.UNIFORM_OFFSET_F32

// One shader, two passes: same vertex buffer, different primitive topology.
// PASS_LINE draws the score polyline via line-list; PASS_FILL draws xyplot /
// density / scatter quads via triangle-list.
export const WIGGLE_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_FILL,
    mod: wiggleShader,
    verticesPerInstance: VERTICES_PER_INSTANCE,
    topology: 'triangle-list',
  }),
  slangPass({
    id: PASS_LINE,
    mod: wiggleShader,
    verticesPerInstance: VERTICES_PER_INSTANCE,
    topology: 'line-list',
  }),
]

interface RegionInfo {
  numRows: number
}

export class GpuWiggleRenderer implements WiggleBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionInfo = new Map<number, RegionInfo>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      this.hal.deleteRegion(regionNumber)
      this.regionInfo.delete(regionNumber)
      return
    }

    const buf = interleaveInstances(sources, totalFeatures)

    // Upload once to PASS_FILL; PASS_LINE shares the same buffer via drawPass
    this.hal.uploadBuffer(regionNumber, PASS_FILL, buf, totalFeatures)
    this.hal.setRegionMeta(regionNumber, { regionStart })
    this.regionInfo.set(regionNumber, { numRows: computeNumRows(sources) })
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionInfo, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const isLine = state.renderingType === RENDERING_TYPE_LINE
    const passId = isLine ? PASS_LINE : PASS_FILL

    for (const block of blocks) {
      const bufCount = this.hal.getBufferCount(block.regionNumber, PASS_FILL)
      if (bufCount === 0) {
        continue
      }

      const meta = this.hal.getRegionMeta(block.regionNumber)
      const info = this.regionInfo.get(block.regionNumber)
      if (!meta || !info) {
        continue
      }

      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      this.uniformF32[U.bpRangeX] = clip.bpStartHi
      this.uniformF32[U.bpRangeX + 1] = clip.bpStartLo
      this.uniformF32[U.bpRangeX + 2] = clip.clippedLengthBp
      this.uniformU32[U.regionStart] = Math.floor(meta.regionStart)
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformI32[U.scaleType] = state.scaleType
      this.uniformI32[U.renderingType] = state.renderingType
      this.uniformF32[U.numRows] = info.numRows
      this.uniformF32[U.domainYMin] = state.domainY[0]
      this.uniformF32[U.domainYMax] = state.domainY[1]
      // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
      this.uniformF32[U.zero] = 0
      this.uniformF32[U.viewportWidth] = clip.pxW
      this.uniformF32[U.reversed] = block.reversed ? 1 : 0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(passId, block.regionNumber, PASS_FILL)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  dispose() {
    this.regionInfo.clear()
    this.hal.dispose()
  }
}

export { UNIFORMS_SIZE_BYTES as WIGGLE_UNIFORM_BYTE_SIZE }
