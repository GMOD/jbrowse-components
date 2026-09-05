import { interbaseBarHeightPx } from '@jbrowse/alignments-core'
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
import { SCALE_TYPE_LINEAR } from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { MAF_ROW_MARK } from './mafMarks.ts'

import type {
  MafCoverageBandState,
  MafGPURenderState,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'

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
  MAF_ROW_MARK.pass,
  ...MAF_COVERAGE_PASSES,
]

export class GpuMafRenderer extends GpuPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState
> {
  protected regionPasses = MAF_PASSES

  constructor(hal: GpuHal) {
    super(hal)
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
    region: MafUploadPayload,
    state: MafGPURenderState,
  ) {
    // Two bands out of one canvas: the coverage strip pinned at the top, the
    // rows viewport under it. Each narrows the scissor the base already set to
    // the block's full-height column — the viewport stays full-height, since
    // both shaders place Y in clip space against the whole canvas.
    if (state.coverage) {
      this.drawCoverageBand(block, clip, region, state, state.coverage)
    }
    this.drawRows(block, clip, region, state)
  }

  private drawCoverageBand(
    block: MafRenderBlock,
    clip: BlockClipResult,
    region: MafUploadPayload,
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
    region: MafUploadPayload,
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
    // The rows band is the viewport, not the rows content: rows past it are
    // scrolled to, not grown into, and the scissor is what keeps a scrolled row
    // from painting up into the strip above. Everything inside the band — the
    // row placement, the min-width rule, the hp clip-x span — is the `span`
    // shape's, drawn from the very channels the Canvas2D painter walks.
    this.hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
    MAF_ROW_MARK.drawRegion(
      this.hal,
      this.uniformData,
      block,
      clip,
      region,
      state,
    )
  }
}
