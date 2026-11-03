import { withImpliedField } from '@jbrowse/core/util/colorScale'

/**
 * `pileup.mismatches.encoding.opacity` folded into the four numbers
 * mismatch.slang's `qualityFade` reads: a base of quality `q` draws at
 * `clamp((q - zero) * slope, min, max)`. A constant is `min = max`, which
 * every quality clamps to.
 */
export interface QualityOpacity {
  zero: number
  slope: number
  min: number
  max: number
}

export const MISMATCH_OPACITY_FIELDS = ['baseQuality'] as const

export type MismatchOpacityField = (typeof MISMATCH_OPACITY_FIELDS)[number]

/** The field an opacity naming neither a field nor a constant fades by. */
export const MISMATCH_OPACITY_IMPLIED_FIELD: MismatchOpacityField =
  'baseQuality'

// IGV's thresholds: a real variant's bases (Q20+ on every platform) stay
// opaque, and the floor keeps a Q≤5 base visible and hoverable
export const QUALITY_OPACITY_DOMAIN = [5, 20] as const
export const QUALITY_OPACITY_RANGE = [0.1, 1] as const

export const OPAQUE_MISMATCHES: QualityOpacity = {
  zero: 0,
  slope: 0,
  min: 1,
  max: 1,
}

/** `pileup.mismatches.encoding.opacity` as its slots read. */
export interface MismatchOpacitySetting {
  value: number | undefined
  field: MismatchOpacityField | undefined
  scale: {
    domainMin: number
    domainMax: number
    range: readonly string[]
    clamp: boolean
  }
}

/** The setting with its implied field filled in, as it draws. */
export function resolvedMismatchOpacity(setting: MismatchOpacitySetting) {
  return withImpliedField(setting, MISMATCH_OPACITY_IMPLIED_FIELD)
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

function constantOpacity(value: number): QualityOpacity {
  const constant = clamp01(value)
  return { zero: 0, slope: 0, min: constant, max: constant }
}

/** A resolved setting (`resolvedMismatchOpacity`) as `qualityFade` reads it. */
export function qualityOpacityOf({
  value,
  field,
  scale,
}: MismatchOpacitySetting): QualityOpacity {
  if (field !== 'baseQuality') {
    return value === undefined ? OPAQUE_MISMATCHES : constantOpacity(value)
  }
  const [d0, d1] = numberPair(
    [scale.domainMin, scale.domainMax].map(String),
    QUALITY_OPACITY_DOMAIN,
  )
  const [r0, r1] = numberPair(scale.range, QUALITY_OPACITY_RANGE)
  const slope = (r1 - r0) / (d1 - d0)
  if (slope === 0 || !Number.isFinite(slope)) {
    return constantOpacity((r0 + r1) / 2)
  }
  return {
    zero: d0 - r0 / slope,
    slope,
    min: scale.clamp ? clamp01(Math.min(r0, r1)) : 0,
    max: scale.clamp ? clamp01(Math.max(r0, r1)) : 1,
  }
}

/** The opacity an unwritten `encoding.opacity` draws by. */
export const DEFAULT_QUALITY_FADE = qualityOpacityOf(
  resolvedMismatchOpacity({
    value: undefined,
    field: undefined,
    scale: {
      domainMin: QUALITY_OPACITY_DOMAIN[0],
      domainMax: QUALITY_OPACITY_DOMAIN[1],
      range: QUALITY_OPACITY_RANGE.map(String),
      clamp: true,
    },
  }),
)
