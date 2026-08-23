import * as coverageBarShader from './shaders/coverageBar.generated.ts'
import * as coverageIndicatorShader from './shaders/coverageIndicator.generated.ts'
import * as coverageInterbaseShader from './shaders/coverageInterbase.generated.ts'
import * as coverageModShader from './shaders/coverageMod.generated.ts'
import * as coverageSnpShader from './shaders/coverageSnp.generated.ts'
import { slangPass } from './slangPass.ts'

import type { InstancePass } from './instancePass.ts'

export const COVERAGE_BAND_UNIFORMS_SIZE_BYTES =
  coverageBarShader.UNIFORMS_SIZE_BYTES

/**
 * The four coverage-band buffers a producer packs per region, in the layouts
 * `coverageBand.slang`'s passes read. Every field is filled by
 * `@jbrowse/alignments-core` — `packCoverageBinsForGpu`, `computeSNPCoverage`
 * and `computeInterbaseCoverage` (which emits the last two) — so a display gets
 * these by running that pipeline, not by shaping them itself.
 *
 * Structural rather than nominal, and named after the layout rather than after
 * either display: the alignments worker's `CoverageUploadData` and the MAF
 * worker's `MafCoverageRegion` both satisfy it, which is what lets the passes
 * below carry their own packers instead of each plugin restating four field
 * reads.
 */
export interface CoverageBandBuffers {
  coveragePackedBuffer: ArrayBuffer
  snpPackedBuffer: ArrayBuffer
  interbasePackedBuffer: ArrayBuffer
  indicatorPackedBuffer: ArrayBuffer
}

/**
 * Just the band's four buffers out of a wider per-region payload — the field set
 * stated once, so a display carrying them into its own upload payload cannot
 * spell three of them.
 */
export function coverageBandBuffers(
  src: CoverageBandBuffers,
): CoverageBandBuffers {
  return {
    coveragePackedBuffer: src.coveragePackedBuffer,
    snpPackedBuffer: src.snpPackedBuffer,
    interbasePackedBuffer: src.interbasePackedBuffer,
    indicatorPackedBuffer: src.indicatorPackedBuffer,
  }
}

/**
 * The fifth buffer, base modifications stacked in the same bars. Separate
 * because only one producer emits it — a MAF alignment carries no modification
 * calls — and a display that has no mod data must not have to ship an empty
 * buffer to satisfy the shape.
 */
export interface CoverageBandModBuffer {
  modCovPackedBuffer: ArrayBuffer
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
 * Everything the band's UBO holds that a caller actually decides. `hpZero` and
 * `depthScale` are absent because neither is a decision: the first is a fixed
 * sentinel the HP math needs, the second falls out of the region's peak against
 * the display's domain — see `writeCoverageBandUniforms`.
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
 * The two derived slots are here rather than at each call site because getting
 * either wrong is a silently wrong band, not a broken one:
 *
 * - `depthScale` un-bakes the region's peak from the buffer's `relDepth` so the
 *   bars land on the display's domain. 1 when the domain has not resolved or
 *   the region is empty, which is the identity that leaves `relDepth` alone.
 * - `hpZero` MUST be 0: the HP math materializes +inf as `1/hpZero` to stop the
 *   compiler folding the hi/lo split it exists to preserve.
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
    depthScale:
      domainMax !== undefined && v.regionMaxDepth > 0
        ? v.regionMaxDepth / domainMax
        : 1,
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
