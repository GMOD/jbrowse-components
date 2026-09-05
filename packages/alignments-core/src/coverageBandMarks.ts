import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import {
  COVERAGE_BAR_PASS,
  COVERAGE_INDICATOR_PASS,
  COVERAGE_INTERBASE_PASS,
  COVERAGE_MOD_PASS,
  COVERAGE_SNP_PASS,
  orderCoverageBandLayers,
  writeCoverageBandUniforms,
} from '@jbrowse/render-core/coverageBand'
import { defineMark } from '@jbrowse/render-core/marks'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core/normalize'

import { interbaseBarHeightPx } from './coverageBandBox.ts'
import {
  COVERAGE_BAR_SEAM_FUDGE_PX,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawModCovSegments,
  drawSnpSegments,
} from './rendererUtils.ts'

import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type {
  CoverageBandBuffers,
  CoverageBandColors,
  CoverageBandModBuffer,
} from '@jbrowse/render-core/coverageBand'
import type {
  Mark,
  MarkBand,
  MarkContext2D,
  MarkFrame,
  MarkShape,
} from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { WiggleScaleType } from '@jbrowse/wiggle-core/normalize'

/**
 * Everything the coverage band's five layers draw against, on both backends:
 * the GPU reads it as the band's uniform block, the painters as arguments.
 *
 * The depth domain is the display's autoscale; `domainMax` is undefined while
 * that settles, which draws no depth-scaled layer rather than bars of arbitrary
 * height. The three region fields un-bake the worker's per-region fractions.
 * `colors` are packed ABGR — the display resolves its palette once, and the
 * painters convert per block, so the two backends cannot be handed two palettes.
 */
export interface CoverageBandParams {
  /** The band's height and its top edge on the canvas, CSS px. */
  height: number
  top: number
  domainMin: number
  domainMax: number | undefined
  scaleType: WiggleScaleType
  symlogConstant: number
  /** The region's own peak depth, its bin width in bp, and its peak interbase count. */
  regionMaxDepth: number
  binSize: number
  interbaseMaxCount: number
  /** SNP slices under this allele fraction are not drawn. */
  snpMinFrequency: number
  /** Whether the interbase bars and their indicator triangles draw at all. */
  showInterbase: boolean
  colors: CoverageBandColors
}

function writeBandUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  p: CoverageBandParams,
) {
  writeCoverageBandUniforms(scratch, {
    // the low bp and a POSITIVE length: the band passes flip via `reversed`
    bpHi: clip.bpStartHi,
    bpLo: clip.bpStartLo,
    bpLen: clip.clippedLengthBp,
    // CSS px: the band's 1-px floors are CSS px
    canvasW: clip.scissorW,
    canvasH: frame.canvasHeight,
    reversed: block.reversed,
    covHeight: p.height,
    // The scalebar-label inset the axis gutter reserves at both ends, which is
    // also what `coverageLayout` measures every painter from.
    covYOffset: YSCALEBAR_LABEL_OFFSET,
    covTop: p.top,
    regionMaxDepth: p.regionMaxDepth,
    domainMin: p.domainMin,
    domainMax: p.domainMax,
    scaleType: p.scaleType,
    symlogConstant: p.symlogConstant,
    binSize: p.binSize,
    interbaseHeight: interbaseBarHeightPx(
      p.height,
      p.interbaseMaxCount,
      p.domainMax,
    ),
    snpMinFrequency: p.snpMinFrequency,
    colors: p.colors,
  })
}

const hasDomain = (p: CoverageBandParams) => p.domainMax !== undefined

type LayerPainter<TChannels> = (
  ctx: MarkContext2D,
  channels: TChannels,
  bpToX: (bp: number) => number,
  viewWidth: number,
  p: CoverageBandParams & { domainMax: number },
) => void

/**
 * One band layer: render-core's pass, the shared uniform write, and an
 * alignments-core painter placed the way the shader places it — anchored at
 * the band's top, translated down to it on a stacked canvas.
 */
function layerShape<TChannels>(
  pass: MarkShape<TChannels, CoverageBandParams>['pass'],
  draws: (p: CoverageBandParams) => boolean,
  paint: LayerPainter<TChannels>,
): MarkShape<TChannels, CoverageBandParams> {
  return {
    id: pass.id,
    pass,
    writeUniforms: writeBandUniforms,
    paintsBlock: (_block, _frame, p) => draws(p),
    paintBlock(ctx, channels, block, frame, p) {
      const bpToX = makeBpMapper(block)
      const viewWidth = Math.min(block.screenEndPx, frame.canvasWidth)
      const placed = p as CoverageBandParams & { domainMax: number }
      if (p.top === 0) {
        paint(ctx, channels, bpToX, viewWidth, placed)
        return
      }
      ctx.save()
      ctx.translate(0, p.top)
      try {
        paint(ctx, channels, bpToX, viewWidth, placed)
      } finally {
        ctx.restore()
      }
    },
  }
}

const normalizer = (p: CoverageBandParams & { domainMax: number }) =>
  makeScoreNormalizer(p.domainMin, p.domainMax, p.scaleType, p.symlogConstant)

const interbaseColors = (c: CoverageBandColors) => ({
  insertion: abgrToCssRgba(c.insertionIndicator),
  softclip: abgrToCssRgba(c.softclipIndicator),
  hardclip: abgrToCssRgba(c.hardclipIndicator),
})

export const coverageBarShape = layerShape<
  Pick<CoverageBandBuffers, 'coveragePackedBuffer'>
>(COVERAGE_BAR_PASS, hasDomain, (ctx, c, bpToX, viewWidth, p) => {
  drawCoverageBins(
    ctx,
    c.coveragePackedBuffer,
    normalizer(p),
    p.regionMaxDepth,
    p.height,
    abgrToCssRgba(p.colors.coverage),
    bpToX,
    viewWidth,
    p.binSize,
    COVERAGE_BAR_SEAM_FUDGE_PX,
  )
})

export const coverageSnpShape = layerShape<
  Pick<CoverageBandBuffers, 'snpPackedBuffer'>
>(COVERAGE_SNP_PASS, hasDomain, (ctx, c, bpToX, viewWidth, p) => {
  const { colors } = p
  drawSnpSegments(
    ctx,
    c.snpPackedBuffer,
    normalizer(p),
    p.regionMaxDepth,
    p.height,
    {
      baseA: abgrToCssRgba(colors.baseA),
      baseC: abgrToCssRgba(colors.baseC),
      baseG: abgrToCssRgba(colors.baseG),
      baseT: abgrToCssRgba(colors.baseT),
      baseN: abgrToCssRgba(colors.baseN),
    },
    bpToX,
    viewWidth,
    p.snpMinFrequency,
  )
})

export const coverageModShape = layerShape<CoverageBandModBuffer>(
  COVERAGE_MOD_PASS,
  hasDomain,
  (ctx, c, bpToX, viewWidth, p) => {
    drawModCovSegments(
      ctx,
      c.modCovPackedBuffer,
      normalizer(p),
      p.regionMaxDepth,
      p.height,
      bpToX,
      viewWidth,
    )
  },
)

export const coverageInterbaseShape = layerShape<
  Pick<CoverageBandBuffers, 'interbasePackedBuffer'>
>(
  COVERAGE_INTERBASE_PASS,
  p => p.showInterbase && hasDomain(p),
  (ctx, c, bpToX, viewWidth, p) => {
    drawInterbaseSegments(
      ctx,
      c.interbasePackedBuffer,
      p.interbaseMaxCount,
      interbaseColors(p.colors),
      bpToX,
      viewWidth,
      p.height,
      p.domainMax,
    )
  },
)

// Fixed-size triangles, so they draw before the domain resolves: gating them on
// data would blank them for the whole fetch.
export const coverageIndicatorShape = layerShape<
  Pick<CoverageBandBuffers, 'indicatorPackedBuffer'>
>(
  COVERAGE_INDICATOR_PASS,
  p => p.showInterbase,
  (ctx, c, bpToX, viewWidth, p) => {
    drawIndicators(
      ctx,
      c.indicatorPackedBuffer,
      interbaseColors(p.colors),
      bpToX,
      viewWidth,
    )
  },
)

interface CoverageBandSpec<TRegion, TState extends MarkFrame, TBuffers> {
  channels: (region: TRegion) => TBuffers
  params: (state: TState, region: TRegion) => CoverageBandParams
  band?: (state: TState) => MarkBand
}

/**
 * The coverage band as a mark list in `COVERAGE_BAND_LAYER_ORDER`: the depth
 * bars, the SNP slices stacked inside them, the modification slices on those
 * for the one producer that packs them, the interbase histogram hanging from
 * the band top and its indicator triangles above that.
 *
 * Two displays draw exactly this band off the same worker-packed buffers, and
 * each used to state it twice — a pass table and a painter table, in an order
 * each backend restated. A display now writes which of its region's fields are
 * the buffers and which of its state's values are the band's, and both
 * backends walk the list.
 */
export function coverageBandMarks<TRegion, TState extends MarkFrame>(
  spec: CoverageBandSpec<
    TRegion,
    TState,
    CoverageBandBuffers & CoverageBandModBuffer
  > & { modCov: true },
): Mark<TRegion, TState>[]
export function coverageBandMarks<TRegion, TState extends MarkFrame>(
  spec: CoverageBandSpec<TRegion, TState, CoverageBandBuffers> & {
    modCov?: false
  },
): Mark<TRegion, TState>[]
export function coverageBandMarks<TRegion, TState extends MarkFrame>(
  spec: CoverageBandSpec<
    TRegion,
    TState,
    CoverageBandBuffers & Partial<CoverageBandModBuffer>
  > & { modCov?: boolean },
): Mark<TRegion, TState>[] {
  const { channels, params, band } = spec
  return orderCoverageBandLayers<Mark<TRegion, TState>>({
    coverage: defineMark({ shape: coverageBarShape, channels, params, band }),
    snpCov: defineMark({ shape: coverageSnpShape, channels, params, band }),
    modCov: spec.modCov
      ? defineMark({
          shape: coverageModShape,
          channels: channels as (region: TRegion) => CoverageBandModBuffer,
          params,
          band,
        })
      : undefined,
    interbase: defineMark({
      shape: coverageInterbaseShape,
      channels,
      params,
      band,
    }),
    indicator: defineMark({
      shape: coverageIndicatorShape,
      channels,
      params,
      band,
    }),
  })
}
