import { clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import { RENDERING_TYPE_LINE } from './wiggleComponentUtils.ts'
import { computeNumRows, interleaveInstances } from './wiggleInstanceBuffer.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_FILL = 'fill'
const PASS_LINE = 'line'

const U = wiggleShader.UNIFORM_OFFSET_F32

// One shader, two passes: same vertex buffer, different primitive topology.
// PASS_LINE draws the score polyline via line-list; PASS_FILL draws xyplot /
// density / scatter quads via triangle-list.
export const WIGGLE_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_FILL,
    mod: wiggleShader,
    topology: 'triangle-list',
  }),
  slangPass({
    id: PASS_LINE,
    mod: wiggleShader,
    topology: 'line-list',
  }),
]

interface RegionInfo {
  numRows: number
}

export class GpuWiggleRenderer implements WiggleBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(wiggleShader.UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionInfo = new Map<number, RegionInfo>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(displayedRegionIndex: number, sources: SourceRenderData[]) {
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }
    if (totalFeatures === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      this.regionInfo.delete(displayedRegionIndex)
      return
    }
    const buf = interleaveInstances(sources, totalFeatures)
    // Upload once to PASS_FILL; PASS_LINE shares the same buffer via drawPass
    this.hal.uploadBuffer(displayedRegionIndex, PASS_FILL, buf, totalFeatures)
    this.regionInfo.set(displayedRegionIndex, {
      numRows: computeNumRows(sources),
    })
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionInfo, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = getDpr()

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const passId =
      state.renderingType === RENDERING_TYPE_LINE ? PASS_LINE : PASS_FILL

    for (const block of blocks) {
      if (
        this.hal.getBufferCount(block.displayedRegionIndex, PASS_FILL) === 0
      ) {
        continue
      }
      const info = this.regionInfo.get(block.displayedRegionIndex)
      if (!info) {
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
      this.hal.drawPass(passId, block.displayedRegionIndex, PASS_FILL)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  dispose() {
    console.warn('[GpuWiggleRenderer] dispose called, clearing region info')
    this.regionInfo.clear()
    console.warn('[GpuWiggleRenderer] dispose calling hal.dispose()')
    this.hal.dispose()
    console.warn('[GpuWiggleRenderer] dispose complete')
  }
}
