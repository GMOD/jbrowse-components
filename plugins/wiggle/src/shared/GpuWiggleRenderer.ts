import { clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import {
  RENDERING_TYPE_LINE,
  VERTICES_PER_INSTANCE,
} from './wiggleComponentUtils.ts'
import {
  computeNumRows,
  interleaveInstances,
} from './wiggleInstanceBuffer.ts'

import type { WiggleBackend } from './wiggleBackendTypes.ts'
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

export function GpuWiggleRenderer(hal: GpuHal): WiggleBackend {
  const uniformData = new ArrayBuffer(wiggleShader.UNIFORMS_SIZE_BYTES)
  const uniformF32 = new Float32Array(uniformData)
  const uniformI32 = new Int32Array(uniformData)
  const uniformU32 = new Uint32Array(uniformData)
  const regionInfo = new Map<number, RegionInfo>()

  return {
    uploadRegion(regionNumber, regionStart, sources) {
      let totalFeatures = 0
      for (const source of sources) {
        totalFeatures += source.numFeatures
      }
      if (totalFeatures === 0 || sources.length === 0) {
        hal.deleteRegion(regionNumber)
        regionInfo.delete(regionNumber)
        return
      }
      const buf = interleaveInstances(sources, totalFeatures)
      // Upload once to PASS_FILL; PASS_LINE shares the same buffer via drawPass
      hal.uploadBuffer(regionNumber, PASS_FILL, buf, totalFeatures)
      hal.setRegionMeta(regionNumber, { regionStart })
      regionInfo.set(regionNumber, { numRows: computeNumRows(sources) })
    },

    pruneRegions(activeRegions) {
      pruneRegionMap(regionInfo, activeRegions, n => {
        hal.deleteRegion(n)
      })
    },

    renderBlocks(blocks, state) {
      const { canvasWidth, canvasHeight } = state
      const dpr = window.devicePixelRatio || 1

      hal.resize(canvasWidth, canvasHeight)
      hal.beginFrame(0, 0, 0, 0)

      const passId =
        state.renderingType === RENDERING_TYPE_LINE ? PASS_LINE : PASS_FILL

      for (const block of blocks) {
        if (hal.getBufferCount(block.regionNumber, PASS_FILL) === 0) {
          continue
        }
        const meta = hal.getRegionMeta(block.regionNumber)
        const info = regionInfo.get(block.regionNumber)
        if (!meta || !info) {
          continue
        }
        const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
        if (!clip) {
          continue
        }

        hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
        hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

        uniformF32[U.bpRangeX] = clip.bpStartHi
        uniformF32[U.bpRangeX + 1] = clip.bpStartLo
        uniformF32[U.bpRangeX + 2] = clip.clippedLengthBp
        uniformU32[U.regionStart] = Math.floor(meta.regionStart)
        uniformF32[U.canvasHeight] = canvasHeight
        uniformI32[U.scaleType] = state.scaleType
        uniformI32[U.renderingType] = state.renderingType
        uniformF32[U.numRows] = info.numRows
        uniformF32[U.domainYMin] = state.domainY[0]
        uniformF32[U.domainYMax] = state.domainY[1]
        // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
        uniformF32[U.zero] = 0
        uniformF32[U.viewportWidth] = clip.pxW
        uniformF32[U.reversed] = block.reversed ? 1 : 0

        hal.writeUniforms(uniformData)
        hal.drawPass(passId, block.regionNumber, PASS_FILL)
      }

      hal.clearScissor()
      hal.clearViewport()
      hal.endFrame()
    },

    dispose() {
      regionInfo.clear()
      hal.dispose()
    },
  }
}
