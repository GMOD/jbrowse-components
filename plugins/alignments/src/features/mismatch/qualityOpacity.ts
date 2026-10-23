/**
 * `pileup.mismatches.encoding.opacity` folded into the four numbers
 * mismatch.slang's `qualityFade` reads: a base of quality `q` draws at
 * `clamp((q - zero) * slope, min, max)`. Off is `min = max = 1`, which every
 * quality clamps to.
 */
export interface QualityOpacity {
  zero: number
  slope: number
  min: number
  max: number
}

export const MISMATCH_OPACITY_FIELDS = ['', 'baseQuality'] as const

export type MismatchOpacityField = (typeof MISMATCH_OPACITY_FIELDS)[number]

export const QUALITY_OPACITY_DOMAIN = [0, 50] as const
export const QUALITY_OPACITY_RANGE = [0, 1] as const

export const OPAQUE_MISMATCHES: QualityOpacity = {
  zero: 0,
  slope: 0,
  min: 1,
  max: 1,
}

/** `pileup.mismatches.encoding.opacity` as its slots read. */
export interface MismatchOpacitySetting {
  field: string
  scale: {
    domain: readonly string[]
    range: readonly string[]
    clamp: boolean
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function numberPair(
  list: readonly string[],
  fallback: readonly number[],
): [number, number] {
  const [a, b] = list.map(Number)
  return list.length === 2 && Number.isFinite(a) && Number.isFinite(b)
    ? [a!, b!]
    : [fallback[0]!, fallback[1]!]
}

export function qualityOpacityOf({
  field,
  scale,
}: MismatchOpacitySetting): QualityOpacity {
  if (field !== 'baseQuality') {
    return OPAQUE_MISMATCHES
  }
  const [d0, d1] = numberPair(scale.domain, QUALITY_OPACITY_DOMAIN)
  const [r0, r1] = numberPair(scale.range, QUALITY_OPACITY_RANGE)
  const slope = (r1 - r0) / (d1 - d0)
  if (slope === 0 || !Number.isFinite(slope)) {
    const constant = clamp01((r0 + r1) / 2)
    return { zero: 0, slope: 0, min: constant, max: constant }
  }
  return {
    zero: d0 - r0 / slope,
    slope,
    min: scale.clamp ? clamp01(Math.min(r0, r1)) : 0,
    max: scale.clamp ? clamp01(Math.max(r0, r1)) : 1,
  }
}

/** `opacity: 'baseQuality'` with the scale's defaults. */
export const DEFAULT_QUALITY_FADE = qualityOpacityOf({
  field: 'baseQuality',
  scale: {
    domain: QUALITY_OPACITY_DOMAIN.map(String),
    range: QUALITY_OPACITY_RANGE.map(String),
    clamp: true,
  },
})
