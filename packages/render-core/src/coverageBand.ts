import * as coverageBarShader from './shaders/coverageBar.generated.ts'
import * as coverageIndicatorShader from './shaders/coverageIndicator.generated.ts'
import * as coverageInterbaseShader from './shaders/coverageInterbase.generated.ts'
import * as coverageModShader from './shaders/coverageMod.generated.ts'
import * as coverageSnpShader from './shaders/coverageSnp.generated.ts'
import { slangPass } from './slangPass.ts'

import type { CoverageBandBuffers } from './coverageBandBuffers.ts'
import type { InstancePass } from './instancePass.ts'

export { coverageBandBuffers } from './coverageBandBuffers.ts'
export type { CoverageBandBuffers } from './coverageBandBuffers.ts'

export const COVERAGE_BAND_UNIFORMS_SIZE_BYTES =
  coverageBarShader.UNIFORMS_SIZE_BYTES

/**
 * The fifth buffer, base modifications stacked in the same bars. Separate
 * because only one producer emits it — a MAF alignment carries no modification
 * calls — and a display that has no mod data must not have to ship an empty
 * buffer to satisfy the shape.
 */
export interface CoverageBandModBuffer {
  modCovPackedBuffer: ArrayBuffer
}

/**
 * One draw layer of the coverage band, and the id of the GPU pass that draws it.
 *
 * The band is the same five marks wherever it appears — a display either has a
 * layer's data or does not, and no display reorders them.
 */
export type CoverageLayerId =
  | 'coverage'
  | 'snpCov'
  | 'modCov'
  | 'interbase'
  | 'indicator'

/**
 * The band's z-order, back to front: the depth bars, the SNP slices stacked
 * inside them, the modification slices stacked on those, the interbase histogram
 * hanging from the band top, and its indicator triangles above that.
 *
 * The order is load-bearing rather than cosmetic — the interbase bars hang down
 * over the lower half the depth bars grow up into, so the two overlap at any
 * real depth — and it is one fact, so it is stated once here and every backend
 * of every display iterates it. It was stated per backend per display, which is
 * how "MAF drew its band in a different order on the fallback" was a screenshot
 * to catch rather than a compile error.
 *
 * What stays per display is the GATING, which genuinely differs: MAF has no
 * `showInterbaseIndicators` setting and no modification data at all.
 */
export const COVERAGE_BAND_LAYER_ORDER: readonly CoverageLayerId[] = [
  'coverage',
  'snpCov',
  'modCov',
  'interbase',
  'indicator',
]

/**
 * Whatever a display attaches to each band layer — a GPU pass, a Canvas2D
 * painter, a gate — resolved into paint order.
 *
 * The argument is exhaustive over `CoverageLayerId`, so a layer added to the
 * order above is a compile error in every display until it is wired. `undefined`
 * is how a display says it has no such layer (MAF carries no modification
 * calls); it is dropped rather than drawn empty, which keeps a display that has
 * no data for a layer from having to ship an empty buffer to satisfy the shape.
 */
export function orderCoverageBandLayers<T>(
  byId: Record<CoverageLayerId, T | undefined>,
) {
  return COVERAGE_BAND_LAYER_ORDER.map(id => byId[id]).filter(
    layer => layer !== undefined,
  )
}

// Each pass's instances are packed by the WORKER (or, for MAF, by the RPC that
// stands in for one) in the shader's own layout, so every "packer" here is the
// field the producer filled, uploaded verbatim. The layouts are generated from
// these shaders into @jbrowse/alignments-core, which is what the producers pack
// through.
export const COVERAGE_BAR_PASS: InstancePass<
  Pick<CoverageBandBuffers, 'coveragePackedBuffer'>
> = {
  ...slangPass({ id: 'coverage', mod: coverageBarShader }),
  pack: data => data.coveragePackedBuffer,
}

export const COVERAGE_SNP_PASS: InstancePass<
  Pick<CoverageBandBuffers, 'snpPackedBuffer'>
> = {
  ...slangPass({ id: 'snpCov', mod: coverageSnpShader }),
  pack: data => data.snpPackedBuffer,
}

export const COVERAGE_MOD_PASS: InstancePass<CoverageBandModBuffer> = {
  ...slangPass({ id: 'modCov', mod: coverageModShader }),
  pack: data => data.modCovPackedBuffer,
}

export const COVERAGE_INTERBASE_PASS: InstancePass<
  Pick<CoverageBandBuffers, 'interbasePackedBuffer'>
> = {
  ...slangPass({ id: 'interbase', mod: coverageInterbaseShader }),
  pack: data => data.interbasePackedBuffer,
}

export const COVERAGE_INDICATOR_PASS: InstancePass<
  Pick<CoverageBandBuffers, 'indicatorPackedBuffer'>
> = {
  ...slangPass({ id: 'indicator', mod: coverageIndicatorShader }),
  pack: data => data.indicatorPackedBuffer,
}

/** Palette slots the band paints by name, each a packed ABGR u32. */
export interface CoverageBandColors {
  coverage: number
  baseA: number
  baseC: number
  baseG: number
  baseT: number
  baseN: number
  insertionIndicator: number
  softclipIndicator: number
  hardclipIndicator: number
}

/**
 * Everything the band's UBO holds that a caller actually decides. `hpZero` is
 * absent because it is not one: it is a fixed sentinel the HP math needs — see
 * `writeCoverageBandUniforms`.
 */
export interface CoverageBandUniformValues {
  /** HP-split viewport start + visible span; keep `bpLen` POSITIVE and flip via `reversed`. */
  bpHi: number
  bpLo: number
  bpLen: number
  /** The span clip [-1,1] covers horizontally — a block's scissored width, not the canvas. */
  canvasW: number
  canvasH: number
  reversed: boolean
  /** Band box in CSS px: its height, the scalebar-label inset, and its top edge on the canvas. */
  covHeight: number
  covYOffset: number
  covTop: number
  /** The region's own peak depth, which is what the buffers' `relDepth` is a fraction of. */
  regionMaxDepth: number
  /** The display's autoscaled depth domain. `undefined` max = not resolved yet. */
  domainMin: number
  domainMax: number | undefined
  /** 0 = linear, 1 = log2, 2 = symlog, matching wiggle-core's SCALE_TYPE_*. */
  scaleType: number
  symlogConstant: number
  binSize: number
  /** `interbaseBarHeightPx` — the one rule the draw, the hit test and this share. */
  interbaseHeight: number
  snpMinFrequency: number
  colors: CoverageBandColors
}

/**
 * Fill the coverage band's uniform buffer. Total-write (the generated packer),
 * so a field left out is a compile error rather than last frame's value.
 *
 * `hpZero` is derived here rather than at each call site because getting it
 * wrong is a silently wrong band, not a broken one: it MUST be 0, since the HP
 * math materializes +inf as `1/hpZero` to stop the compiler folding the hi/lo
 * split it exists to preserve.
 */
export function writeCoverageBandUniforms(
  buf: ArrayBuffer,
  v: CoverageBandUniformValues,
) {
  const { domainMax, colors } = v
  coverageBarShader.writeUniforms(buf, {
    bpHi: v.bpHi,
    bpLo: v.bpLo,
    bpLen: v.bpLen,
    hpZero: 0,
    canvasW: v.canvasW,
    canvasH: v.canvasH,
    covHeight: v.covHeight,
    covYOffset: v.covYOffset,
    covTop: v.covTop,
    regionMaxDepth: v.regionMaxDepth,
    depthDomainMax: domainMax ?? 0,
    depthDomainMin: v.domainMin,
    coverageSymlogConstant: v.symlogConstant,
    binSize: v.binSize,
    interbaseHeight: v.interbaseHeight,
    snpMinFreq: v.snpMinFrequency,
    reversed: v.reversed ? 1 : 0,
    coverageScaleType: v.scaleType,
    colorCoverage: colors.coverage,
    colorBaseA: colors.baseA,
    colorBaseC: colors.baseC,
    colorBaseG: colors.baseG,
    colorBaseT: colors.baseT,
    colorBaseN: colors.baseN,
    colorInsertionIndicator: colors.insertionIndicator,
    colorSoftclipIndicator: colors.softclipIndicator,
    colorHardclipIndicator: colors.hardclipIndicator,
  })
}
