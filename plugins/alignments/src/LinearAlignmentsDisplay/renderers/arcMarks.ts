import { defineMark } from '@jbrowse/render-core/marks'

import { arcAnchorY } from '../../features/arcs/arcYScale.ts'
import {
  arcDrawOpts,
  drawArcBars,
  drawArcDomes,
  drawArcMarkers,
  drawArcTicks,
} from '../../features/arcs/drawCanvas.ts'
import {
  ARC_FLAT_PASS,
  ARC_LINE_PASS,
  ARC_MARKER_PASS,
  ARC_PASS,
} from '../../features/arcs/packGpu.ts'
import { writeArcBandUniforms } from './arcBandUniforms.ts'

import type { ArcsPackData } from '../../features/arcs/packGpu.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ArcBand, RenderState } from './rendererTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type {
  Mark,
  MarkContext2D,
  MarkFrame,
  MarkShape,
} from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * A section's arc band plus the block clip the band is measured against, on top
 * of the section's render state.
 *
 * `screenWidthPx` is the block's clamped on-screen width — `clip.scissorW`, the
 * same number the shader reads as `canvasW`. It decides the near/far
 * ellipse-vs-circle branch in `arcMark`, so a painter handed the whole track's
 * width instead would measure an ellipse against a painted circle. Both
 * renderers already resolve it before they reach the band; this is where it
 * crosses to the painter, which has no clip of its own.
 */
export interface ArcMarkState extends RenderState {
  arcBand: ArcBand
  screenWidthPx: number
}

/** What both backends draw the band from, resolved once per block per section. */
interface ArcBandParams {
  band: ArcBand
  screenWidthPx: number
  arcsYDomainBp: number | undefined
  /** The configured `readConnectionsLineWidth`, unfloored — see `DrawArcsOpts`. */
  lineWidth: number
  colors: RenderState['colors']
}

function arcBandParams(state: ArcMarkState): ArcBandParams {
  return {
    band: state.arcBand,
    screenWidthPx: state.screenWidthPx,
    arcsYDomainBp: state.arcsYDomainBp,
    lineWidth: state.readConnectionsLineWidth,
    colors: state.colors,
  }
}

// One writer for all four shapes by reference, which is what lets a section's
// block stage the struct once and draw every layer off it.
function writeArcMarkUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  p: ArcBandParams,
) {
  writeArcBandUniforms(scratch, {
    bpHi: clip.bpStartHi,
    bpLo: clip.bpStartLo,
    // The BLOCK's span, not the clipped one: an arc's foot may be
    // extrapolated well outside the block, and `blockStartPx`/`blockWidth`
    // are what carry that.
    bpLen: block.end - block.start,
    canvasW: clip.scissorW,
    canvasH: frame.canvasHeight,
    reversed: block.reversed,
    arcAnchorPx: arcAnchorY(p.band.top, p.band.height, p.band.down),
    arcBandH: p.band.height,
    blockStartPx: block.screenStartPx - clip.scissorX,
    blockWidth: block.screenEndPx - block.screenStartPx,
    lineWidthPx: p.lineWidth,
    down: p.band.down,
    arcsYDomainBp: p.arcsYDomainBp,
    dpr: clip.scaleY,
    colors: p.colors,
  })
}

type ArcPainter = (
  ctx: MarkContext2D,
  data: ArcsUploadData,
  opts: ReturnType<typeof arcDrawOpts>,
) => void

/**
 * One arc-band layer: the pass, the shared uniform write, and the Canvas2D
 * painter that is that pass's twin.
 *
 * All four share `writeUniforms`, unlike the coverage band's per-layer writes,
 * because the arc band's block IS one struct — `ArcBandUniforms` carries no
 * per-layer field. What the split buys is that the pass, its painter and the
 * uniforms it reads are declared together.
 */
function arcLayerShape(
  pass: MarkShape<ArcsPackData, ArcBandParams>['pass'],
  paint: ArcPainter,
): MarkShape<ArcsPackData, ArcBandParams> {
  return {
    id: pass.id,
    pass,
    writeUniforms: writeArcMarkUniforms,
    // A band with no room draws nothing on either backend, and the GPU would
    // otherwise shade a whole feed's worth of vertices to produce no pixel.
    paintsBlock: (_block, _frame, p) => p.band.height > 0,
    paintBlock(ctx, data, block, _frame, p) {
      paint(
        ctx,
        data.arcs,
        arcDrawOpts({
          block,
          bpLength: block.end - block.start,
          fullBlockWidth: block.screenEndPx - block.screenStartPx,
          arcsTop: p.band.top,
          arcsH: p.band.height,
          pairedArcsDown: p.band.down,
          screenWidthPx: p.screenWidthPx,
          arcsYDomainBp: p.arcsYDomainBp,
          lineWidth: p.lineWidth,
          colors: p.colors,
        }),
      )
    },
  }
}

const bandMark = (
  pass: MarkShape<ArcsPackData, ArcBandParams>['pass'],
  paint: ArcPainter,
): Mark<ArcsPackData, ArcMarkState> =>
  defineMark({
    shape: arcLayerShape(pass, paint),
    channels: region => region,
    params: arcBandParams,
  })

/**
 * The arc band's four layers, in paint order — the interchromosomal ticks
 * FIRST, then curves and flat connectors (one of the two is always empty, since
 * read cloud draws only flats and arc mode only curves), then the endpoint
 * squares that paint on top of the flat connector lines. `hitTestArcBand`
 * resolves its ties by this same order.
 *
 * The ticks used to run last, on the reading that a full-band vertical is the
 * strongest statement in the band. On deep short-read data it is the opposite:
 * mismapped pairs put a tick at a large share of loci, each one a full-height
 * opaque line straight through every arc crossing it, and the arcs are the marks
 * carrying insert size and orientation. A translocation is also the one call
 * here that a single window cannot support on its own, so it is the claim to
 * draw UNDER the evidence rather than over it.
 *
 * No `band` on any of them: a grouped section carries its own, and the two
 * renderers scissor and clip around this list the way they do for
 * `ALIGNMENTS_COVERAGE_MARKS`.
 */
export const ARC_BAND_MARKS: Mark<ArcsPackData, ArcMarkState>[] = [
  bandMark(ARC_LINE_PASS, drawArcTicks),
  bandMark(ARC_PASS, drawArcDomes),
  bandMark(ARC_FLAT_PASS, drawArcBars),
  bandMark(ARC_MARKER_PASS, drawArcMarkers),
]

/**
 * Paint one block of the band, in `ARC_BAND_MARKS` order. The caller clips to
 * the band; `baseWidth` is the CONFIGURED stroke width, since the GPU's
 * 1.5-device-px floor is `writeArcBandUniforms`' and deliberately not this
 * path's.
 */
export function paintArcBand(
  ctx: MarkContext2D,
  arcs: ArcsUploadData,
  block: RenderBlock,
  state: ArcMarkState,
) {
  const region = { arcs, baseWidth: state.readConnectionsLineWidth }
  for (const mark of ARC_BAND_MARKS) {
    mark.paintBlock(ctx, region, block, state)
  }
}
