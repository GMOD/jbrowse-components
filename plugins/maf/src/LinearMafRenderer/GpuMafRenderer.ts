import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/maf.iface.generated.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'

const PASS_RECT = 'rect'

export const MAF_PASSES = [
  {
    ...slangPass({ id: PASS_RECT, mod: mafShader }),
    // Pre-encoded on the main thread by the per-region encode autorun
    // (`InstanceWriter`, right-sized on finish), so the pack is the handoff.
    // The shader unpacks absolute genomic coords + rowIndex + color.
    pack: (data: MafUploadPayload) => data.instanceBuffer,
  },
]

export class GpuMafRenderer extends GpuPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  protected regionPasses = MAF_PASSES

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
  }

  protected drawRegion(
    block: MafRenderBlock,
    clip: BlockClipResult,
    _region: MafRegionData,
    state: MafGPURenderState,
  ) {
    mafShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      // viewportWidth feeds only the shader's `extendToMinWidthX` X-axis floor;
      // it never interacts with canvasHeight. Device px here gives a
      // 1-device-px minimum cell width (0.5 CSS px at dpr 2).
      //
      // NOTE: GpuMultiRowRenderer draws the same shared `rowRect` module but
      // feeds CSS px (scissorW) for a 1-CSS-px floor — it moved off pxW in
      // e1c2585e4d to match its Canvas2D `Math.max(1, ...)`. maf has no such
      // Canvas2D floor (drawMafBlocks draws cells at natural sub-pixel width),
      // so the two are not interchangeable and neither is obviously wrong.
      //
      // Device px also means **this floor moves with the monitor** — 0.5 CSS px
      // at dpr 2 — so MAF renders differently on a retina screen than on a plain
      // one, and differently from its own Canvas2D fallback at either. That half
      // is a defect rather than a preference. The other half, what the floor
      // should be, is an aesthetic call about dense alignments that wants a
      // capture and not an argument; `agent-docs/ideas/maf-subpixel-cells.md`
      // has the three candidates, why alignments' `sizeAlpha` is not one of
      // them, and why fixing the dpr-dependence on its own is the wrong move.
      viewportWidth: clip.pxW,
      zero: 0,
      rowHeight: state.rowHeight,
      rowProportion: state.rowProportion,
      // The canvas is the rows viewport, not the rows content: rows past it are
      // scrolled to, not grown into. Every other MAF layer (Canvas2D fallback,
      // overlays, tree, hit-test) shifts by the same model.scrollTop.
      scrollTop: state.scrollTop,
    })

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
