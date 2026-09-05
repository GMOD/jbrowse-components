import { bpAtPxExact, makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
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
import {
  SCALE_TYPE_LINEAR,
  makeScoreNormalizer,
} from '@jbrowse/wiggle-core/normalize'

import { interbaseBarHeightPx } from './coverageBandBox.ts'
import { interbaseEdgePx } from './interbaseEdge.generated.ts'
import {
  readIndicators,
  readInterbaseSegments,
  recordsWithin,
} from './interbaseSegments.ts'
import {
  INDICATOR_TRIANGLE_H,
  INDICATOR_TRIANGLE_HW,
} from './labelConstants.ts'
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
  MarkHit,
  MarkShape,
} from '@jbrowse/render-core/marks'
import type {
  BpRegionBounds,
  RenderBlock,
} from '@jbrowse/render-core/renderBlock'
import type { WiggleScaleType } from '@jbrowse/wiggle-core/normalize'

/**
 * What a region carries for the band: the worker-packed buffers and the peaks
 * that un-bake their fractions. The alignments worker's `PileupDataResult` and
 * MAF's `MafCoverageRegion` both satisfy it.
 */
export interface CoverageBandRegion extends CoverageBandBuffers {
  /** The region's own peak depth, which its buffers' `relDepth` is a fraction of. */
  coverageMaxDepth: number
  /** Each depth record's width in bp. */
  coverageBinSize: number
  /** The peak interbase count the histogram's stack fractions were baked against. */
  interbaseMaxCount: number
}

/**
 * The display's half of the band: where it sits, the depth axis it is read on,
 * and its palette. Both backends draw against exactly this, and the hit test
 * reads its first four fields.
 *
 * The depth domain is the display's autoscale; `domainMax` is undefined while
 * that settles, which draws no depth-scaled layer rather than bars of arbitrary
 * height. `colors` are packed ABGR — the display resolves its palette once, and
 * the painters convert per block, so the two backends cannot be handed two
 * palettes.
 */
export interface CoverageBandState {
  /** The band's height and its top edge on the canvas, CSS px. */
  height: number
  top: number
  domainMin: number
  domainMax: number | undefined
  scaleType: WiggleScaleType
  symlogConstant: number
  /** SNP slices under this allele fraction are not drawn. */
  snpMinFrequency: number
  /** Whether the interbase bars and their indicator triangles draw at all. */
  showInterbase: boolean
  colors: CoverageBandColors
}

export type CoverageBandParams = CoverageBandState &
  Pick<CoverageBandRegion, 'coverageBinSize' | 'interbaseMaxCount'> & {
    regionMaxDepth: number
  }

function bandParams(
  state: CoverageBandState,
  region: CoverageBandRegion,
): CoverageBandParams {
  return {
    ...state,
    regionMaxDepth: region.coverageMaxDepth,
    coverageBinSize: region.coverageBinSize,
    interbaseMaxCount: region.interbaseMaxCount,
  }
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
    binSize: p.coverageBinSize,
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

type Placed = CoverageBandParams & { domainMax: number }

type LayerPainter<TChannels> = (
  ctx: MarkContext2D,
  channels: TChannels,
  bpToX: (bp: number) => number,
  viewWidth: number,
  p: Placed,
) => void

/**
 * A rectangle of ink and a cursor: distance 0 inside, else to the nearest
 * edge. What each band shape's `hitNearest` measures its records with.
 */
function rectHit(
  index: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  xPx: number,
  yPx: number,
): MarkHit {
  const nx = Math.min(Math.max(xPx, left), right)
  const ny = Math.min(Math.max(yPx, top), bottom)
  const dx = xPx - nx
  const dy = yPx - ny
  return { index, x: nx, y: ny, distSq: dx * dx + dy * dy }
}

function nearest(
  hits: Iterable<MarkHit | undefined>,
  maxDistSq: number,
): MarkHit | undefined {
  let best: MarkHit | undefined
  let bestDistSq = maxDistSq
  for (const hit of hits) {
    if (hit && hit.distSq < bestDistSq) {
      bestDistSq = hit.distSq
      best = hit
    }
  }
  return best
}

/**
 * One band layer: render-core's pass, the shared uniform write, and an
 * alignments-core painter placed the way the shader places it — anchored at
 * the band's top, translated down to it on a stacked canvas. `hit` measures the
 * layer's records against a cursor under the same gate the painter draws under.
 */
function layerShape<TChannels>(
  pass: MarkShape<TChannels, CoverageBandParams>['pass'],
  draws: (p: CoverageBandParams) => boolean,
  paint: LayerPainter<TChannels>,
  hit?: (
    channels: TChannels,
    bpToX: (bp: number) => number,
    p: CoverageBandParams,
    xPx: number,
    yPx: number,
    candidates: Iterable<number>,
    maxDistSq: number,
  ) => MarkHit | undefined,
): MarkShape<TChannels, CoverageBandParams> {
  return {
    id: pass.id,
    pass,
    writeUniforms: writeBandUniforms,
    paintsBlock: (_block, _frame, p) => draws(p),
    paintBlock(ctx, channels, block, frame, p) {
      const bpToX = makeBpMapper(block)
      const viewWidth = Math.min(block.screenEndPx, frame.canvasWidth)
      const placed = p as Placed
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
    hitNearest: hit
      ? (channels, block, _frame, p, xPx, yPx, candidates, maxDistSq) =>
          draws(p)
            ? hit(
                channels,
                makeBpMapper(block),
                p,
                xPx,
                yPx,
                candidates,
                maxDistSq,
              )
            : undefined
      : undefined,
  }
}

const normalizer = (p: Placed) =>
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
    p.coverageBinSize,
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

/**
 * The interbase histogram: 1 px bars hanging from just below the indicator
 * strip, each position a stack of up to three typed segments. Both the
 * painter and the hit read the segment edges through `interbaseEdgePx`, the
 * shader's own snapped edge math, so the hit rectangle is the painted one.
 * A bar taller than the band is clipped to it on both backends, and here too.
 */
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
  (c, bpToX, p, xPx, yPx, candidates, maxDistSq) => {
    const barHeight = interbaseBarHeightPx(
      p.height,
      p.interbaseMaxCount,
      p.domainMax,
    )
    if (barHeight === 0) {
      return undefined
    }
    const segments = readInterbaseSegments(c.interbasePackedBuffer)
    const bandBottom = p.top + p.height
    return nearest(
      Array.from(candidates, i => {
        const px = bpToX(segments.position(i))
        const top = p.top + interbaseEdgePx(segments.stackStart(i), barHeight)
        const bottom = Math.min(
          bandBottom,
          p.top + interbaseEdgePx(segments.stackEnd(i), barHeight),
        )
        return bottom < top
          ? undefined
          : rectHit(i, px - 0.5, px + 0.5, top, bottom, xPx, yPx)
      }),
      maxDistSq,
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
  (c, bpToX, p, xPx, yPx, candidates, maxDistSq) => {
    const indicators = readIndicators(c.indicatorPackedBuffer)
    const bottom = p.top + Math.min(p.height, INDICATOR_TRIANGLE_H)
    return nearest(
      Array.from(candidates, i => {
        const px = bpToX(indicators.position(i))
        return rectHit(
          i,
          px - INDICATOR_TRIANGLE_HW,
          px + INDICATOR_TRIANGLE_HW,
          p.top,
          bottom,
          xPx,
          yPx,
        )
      }),
      maxDistSq,
    )
  },
)

/** A hovered interbase bar or indicator triangle. `type` is 1 insertion, 2 softclip, 3 hardclip. */
export interface CoverageBandHit {
  layer: 'interbase' | 'indicator'
  position: number
  type: number
}

// Horizontal slack so the 1 px bars are practical to hover, as a pixel budget:
// the marks are fixed-size on screen, so a bp tolerance would mean something
// different at every zoom. The triangles get their own half-width.
const BAR_HIT_SLACK_PX = 3

const NO_FRAME: MarkFrame = { canvasWidth: 0, canvasHeight: 0 }

const NO_COLORS: CoverageBandColors = {
  coverage: 0,
  baseA: 0,
  baseC: 0,
  baseG: 0,
  baseT: 0,
  baseN: 0,
  insertionIndicator: 0,
  softclipIndicator: 0,
  hardclipIndicator: 0,
}

function range(lo: number, hi: number) {
  const out: number[] = []
  for (let i = lo; i < hi; i++) {
    out.push(i)
  }
  return out
}

/**
 * The interbase mark under a canvas point, triangles before bars, or undefined
 * for the depth area and the rest of the canvas. The candidates are the
 * records within each mark's pixel slack of the cursor's bp, found by binary
 * search in the packed buffers; the shapes measure the ink.
 *
 * The depth bin under the cursor is a different question — a bp, not ink —
 * and `coverageBinAt` answers it.
 */
export function hitCoverageBand(
  region: CoverageBandRegion,
  band: Pick<
    CoverageBandState,
    'height' | 'top' | 'domainMax' | 'showInterbase'
  >,
  bounds: BpRegionBounds,
  xPx: number,
  yPx: number,
): CoverageBandHit | undefined {
  if (
    band.height <= 0 ||
    !band.showInterbase ||
    yPx < band.top ||
    yPx > band.top + band.height
  ) {
    return undefined
  }
  const p: CoverageBandParams = {
    ...band,
    domainMin: 0,
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    snpMinFrequency: 0,
    colors: NO_COLORS,
    regionMaxDepth: region.coverageMaxDepth,
    coverageBinSize: region.coverageBinSize,
    interbaseMaxCount: region.interbaseMaxCount,
  }
  // the shapes read the block's bounds and nothing else of it
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    ...bounds,
    reversed: bounds.reversed ?? false,
  }
  const bpPerPx =
    (block.end - block.start) / (block.screenEndPx - block.screenStartPx)
  const gpos = bpAtPxExact(xPx, block)

  const indicators = readIndicators(region.indicatorPackedBuffer)
  const triangle = coverageIndicatorShape.hitNearest!(
    region,
    block,
    NO_FRAME,
    p,
    xPx,
    yPx,
    range(...recordsWithin(indicators, gpos, bpPerPx * INDICATOR_TRIANGLE_HW)),
    Number.MIN_VALUE,
  )
  if (triangle) {
    return {
      layer: 'indicator',
      position: indicators.position(triangle.index),
      type: indicators.colorType(triangle.index) || 1,
    }
  }

  const segments = readInterbaseSegments(region.interbasePackedBuffer)
  const bar = coverageInterbaseShape.hitNearest!(
    region,
    block,
    NO_FRAME,
    p,
    xPx,
    yPx,
    range(...recordsWithin(segments, gpos, bpPerPx * BAR_HIT_SLACK_PX)),
    BAR_HIT_SLACK_PX ** 2,
  )
  return bar
    ? {
        layer: 'interbase',
        position: segments.position(bar.index),
        type: segments.colorType(bar.index) || 1,
      }
    : undefined
}

interface CoverageBandSpec<TRegion, TState extends MarkFrame, TBuffers> {
  channels: (region: TRegion) => TBuffers
  state: (state: TState) => CoverageBandState
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
 * the band's and which of its state's values are, and both backends walk the
 * list.
 */
export function coverageBandMarks<TRegion, TState extends MarkFrame>(
  spec: CoverageBandSpec<
    TRegion,
    TState,
    CoverageBandRegion & CoverageBandModBuffer
  > & { modCov: true },
): Mark<TRegion, TState>[]
export function coverageBandMarks<TRegion, TState extends MarkFrame>(
  spec: CoverageBandSpec<TRegion, TState, CoverageBandRegion> & {
    modCov?: false
  },
): Mark<TRegion, TState>[]
export function coverageBandMarks<TRegion, TState extends MarkFrame>(
  spec: CoverageBandSpec<
    TRegion,
    TState,
    CoverageBandRegion & Partial<CoverageBandModBuffer>
  > & { modCov?: boolean },
): Mark<TRegion, TState>[] {
  const { channels, state, band } = spec
  const params = (s: TState, r: TRegion) => bandParams(state(s), channels(r))
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
