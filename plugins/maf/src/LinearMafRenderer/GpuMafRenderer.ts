import { interbaseBarHeightPx } from '@jbrowse/alignments-core'
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { devicePxBand } from '@jbrowse/render-core/canvas2dUtils'
import {
  COVERAGE_BAND_UNIFORMS_SIZE_BYTES,
  COVERAGE_BAR_PASS,
  COVERAGE_INDICATOR_PASS,
  COVERAGE_INTERBASE_PASS,
  COVERAGE_SNP_PASS,
  orderCoverageBandLayers,
  writeCoverageBandUniforms,
} from '@jbrowse/render-core/coverageBand'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'
import { SCALE_TYPE_LINEAR } from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import * as mafShader from './shaders/maf.generated.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/maf.iface.generated.ts'

import type {
  MafCoverageBandState,
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'

const PASS_RECT = 'rect'

const ROW_PASS: InstancePass<MafUploadPayload> = {
  ...slangPass({ id: PASS_RECT, mod: mafShader }),
  // Pre-encoded on the main thread by the per-region encode autorun
  // (`InstanceWriter`, right-sized on finish), so the pack is the handoff.
  // The shader unpacks absolute genomic coords + rowIndex + color.
  pack: data => data.instanceBuffer,
}

// The coverage band's passes, in render-core's paint order — the same order the
// Canvas2D fallback's painters are resolved into (`MAF_CANVAS_COVERAGE_DRAW`),
// because both come out of `COVERAGE_BAND_LAYER_ORDER`.
//
// render-core's passes, not this plugin's — the alignments pileup draws the same
// band off the same worker-packed layouts, so the shaders, the uniform struct
// and these packers live where both can reach them. See
// packages/render-core/src/shaders/coverageBand.slang.
export const MAF_COVERAGE_PASSES = orderCoverageBandLayers<
  InstancePass<MafUploadPayload>
>({
  coverage: COVERAGE_BAR_PASS,
  snpCov: COVERAGE_SNP_PASS,
  // A MAF alignment carries no base-modification calls, so there is no fifth
  // buffer to upload and nothing for the layer to draw.
  modCov: undefined,
  interbase: COVERAGE_INTERBASE_PASS,
  indicator: COVERAGE_INDICATOR_PASS,
})

// Everything the HAL compiles and `upload` fills. Two feeds, not one: the
// rows instances are encoded on the main thread from theme + toggles, the band's
// four buffers arrive packed out of the RPC.
export const MAF_PASSES: InstancePass<MafUploadPayload>[] = [
  ROW_PASS,
  ...MAF_COVERAGE_PASSES,
]

// The HAL's uniform ring slot has to hold whichever struct is largest, and the
// two are unrelated declarations — the rows pass reads render-core's
// `RowRectUniforms`, the band's passes its `CoverageBandUniforms`.
export const MAF_UNIFORM_BYTE_SIZE = Math.max(
  UNIFORMS_SIZE_BYTES,
  COVERAGE_BAND_UNIFORMS_SIZE_BYTES,
)

export class GpuMafRenderer extends GpuPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  protected regionPasses = MAF_PASSES

  constructor(hal: GpuHal) {
    super(hal, MAF_UNIFORM_BYTE_SIZE)
  }

  // The band's own UBO. A second buffer rather than a second view over
  // `uniformData`, because the two structs share no field: writing one over the
  // other in place would leave whichever wrote first reading the other's words.
  private coverageUniformData = new ArrayBuffer(
    COVERAGE_BAND_UNIFORMS_SIZE_BYTES,
  )

  protected drawRegion(
    block: MafRenderBlock,
    clip: BlockClipResult,
    region: MafRegionData,
    state: MafGPURenderState,
  ) {
    // Two bands out of one canvas: the coverage strip pinned at the top, the
    // rows viewport under it. Each narrows the scissor the base already set to
    // the block's full-height column — the viewport stays full-height, since
    // both shaders place Y in clip space against the whole canvas.
    if (state.coverage) {
      this.drawCoverageBand(block, clip, region, state, state.coverage)
    }
    this.drawRows(block, clip, state)
  }

  private drawCoverageBand(
    block: MafRenderBlock,
    clip: BlockClipResult,
    region: MafRegionData,
    state: MafGPURenderState,
    band: MafCoverageBandState,
  ) {
    const scissor = devicePxBand(0, band.height, clip.scaleY, clip.pxH)
    if (scissor.height === 0) {
      return
    }
    const { coverage } = region
    writeCoverageBandUniforms(this.coverageUniformData, {
      // POSITIVE length plus the `reversed` flag, not `bpRangeXTuple`'s negated
      // pivot: the shared band passes flip X the way the alignments passes do.
      bpHi: clip.bpStartHi,
      bpLo: clip.bpStartLo,
      bpLen: clip.clippedLengthBp,
      // CSS px, not the device-px `pxW`: the band's 1-px floors (the min cell
      // width, the interbase bar, the indicator triangle) are all CSS px.
      canvasW: clip.scissorW,
      canvasH: state.canvasHeight,
      reversed: block.reversed,
      covHeight: band.height,
      // The band is pinned at the canvas top — MAF has no stacked sections to
      // scroll one with.
      covTop: 0,
      // The scalebar-label inset the axis gutter reserves at both ends, which is
      // also what `coverageLayout` (and so every Canvas2D coverage painter)
      // measures from. Not a render-state field: it is a constant, and a second
      // spelling of it is a band whose GPU and Canvas2D bars disagree.
      covYOffset: YSCALEBAR_LABEL_OFFSET,
      regionMaxDepth: coverage.coverageMaxDepth,
      // MAF's domain starts at no aligned species and is linear: sample counts
      // are already bounded and well-distributed, so there is no log/symlog
      // option to carry and no `minScore` slot to read.
      domainMin: 0,
      domainMax: band.domainMax,
      scaleType: SCALE_TYPE_LINEAR,
      symlogConstant: 1,
      // Per-bp: the worker packs one record per reference base and never
      // downsamples (see buildMafCoverageRegion).
      binSize: 1,
      // The one rule the Canvas2D draw, this uniform and the tooltip's hit test
      // all read — see `interbaseBarHeightPx`.
      interbaseHeight: interbaseBarHeightPx(
        band.height,
        coverage.interbaseMaxCount,
        band.domainMax,
      ),
      // MAF has no allele-frequency filter: every mismatch column the alignment
      // carries is a real observation in a real species, not a possible
      // sequencing error, so there is nothing to floor away.
      snpMinFrequency: 0,
      colors: band.gpuColors,
    })
    this.hal.writeUniforms(this.coverageUniformData)
    this.hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
    for (const pass of MAF_COVERAGE_PASSES) {
      this.hal.drawPass(pass.id, block.displayedRegionIndex)
    }
  }

  private drawRows(
    block: MafRenderBlock,
    clip: BlockClipResult,
    state: MafGPURenderState,
  ) {
    const scissor = devicePxBand(
      state.rowsTop,
      state.rowsHeight,
      clip.scaleY,
      clip.pxH,
    )
    if (scissor.height === 0) {
      return
    }
    mafShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      // Inert while `minCellPx` is 0, and kept only because the uniform struct
      // is shared. The unit used to matter and used to be device px, which made
      // the floor move with the monitor.
      minCellDenomPx: clip.pxW,
      // MAF does not floor. Its cells tile the row, so a sub-pixel cell is read
      // as part of the run around it, and widening one to a whole pixel paints
      // ink the alignment does not contain: measured at 2.3x the colour of a
      // supersampled ground truth, against 1.05x for no floor
      // (agent-docs/reference/MAF_SUBPIXEL_CELLS.md). The multi-row painter floors
      // and should — its features are sparse intervals, not a tiling, and
      // MULTI_ROW_MIN_CELL_PX says why.
      minCellPx: 0,
      zero: 0,
      rowHeight: state.rowHeight,
      rowProportion: state.rowProportion,
      // The rows band is the viewport, not the rows content: rows past it are
      // scrolled to, not grown into. `- rowsTop` is what places the band inside
      // a canvas that now also holds the coverage strip above it — the shader
      // paints row i at `rowHeight*i - scrollTop`, so offsetting the scroll is
      // offsetting the band, and the scissor below keeps a scrolled row from
      // painting up into the strip. Every other MAF layer (Canvas2D fallback,
      // overlays, tree, hit-test) shifts by the same model.scrollTop inside a
      // container that already carries `rowsTopOffset`.
      scrollTop: state.scrollTop - state.rowsTop,
    })

    this.hal.writeUniforms(this.uniformData)
    this.hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
