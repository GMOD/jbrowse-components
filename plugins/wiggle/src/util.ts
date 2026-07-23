import type { SourceInfo, WiggleFeatureArrays } from '@jbrowse/wiggle-core'

export {
  computeAutoscaleDomain,
  computeScoreExtent,
  domainFromStats,
  getEffectiveScores,
  getNiceDomain,
  getOrigin,
  getScale,
  makeScoreNormalizer,
  toP,
} from '@jbrowse/wiggle-core'
export type {
  Dataset,
  FeatureArrays,
  ScaleOpts,
  ScoreStats,
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureArrays,
  WiggleSourceData,
} from '@jbrowse/wiggle-core'

export { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

// Rendering-type tables live in renderingTypes.ts (import-free) so non-UI
// consumers can pull the menu labels without loading the wiggle-core barrel;
// re-exported here so existing `../util.ts` importers are unaffected.
export {
  MULTI_WIGGLE_RENDERING_GROUPS,
  MULTI_WIGGLE_RENDERING_TYPES,
  WIGGLE_RENDERINGS,
  WIGGLE_RENDERING_TYPES,
} from './renderingTypes.ts'

// Default colors used by wiggle config schema. The negative color is a clean,
// saturated red rather than a muted coral so that at high density (many thin
// overlapping bars, e.g. a zoomed-out phyloP track) the negative side still
// reads as red instead of muddying toward brown.
export const WIGGLE_POS_COLOR_DEFAULT = '#0068d1'
export const WIGGLE_NEG_COLOR_DEFAULT = '#e01e26'

// There was confusion about whether source or name was required, and effort to
// remove one or the other was thwarted. Adapters like BigWigAdapter, even in
// the BigWigAdapter configSchema.ts, use a 'source' field though, while the
// word 'name' still allowed in the config too. To solve, we made name===source.
export interface Source {
  baseUri?: string
  name: string
  source: string
  color?: string
  // Tint for this source's row-label box in the sidebar (multirow modes). Kept
  // independent of `color` so density tracks can be color-coded by identity
  // without changing the score→color ramp.
  labelColor?: string
  group?: string
}

export interface EditableSource extends Source, SourceInfo {}

// One score entry shown in a wiggle tooltip. `source`/`color` are populated
// only for multi-wiggle (single-wiggle has no per-source identity). The summary
// variant carries min/max together so consumers narrow on `summary` alone.
export type WiggleTooltipRow = {
  source?: string
  color?: string
  score: number
} & (
  | { summary?: false }
  | { summary: true; minScore: number; maxScore: number }
)

// Feature(s) hovered under the mouse, shared by single- and multi-wiggle.
// `start`/`end` is the feature interval for single-wiggle and multi-wiggle row
// mode; in overlay mode it collapses to the cursor bp, since sources with
// differing bin widths share no single interval. `rows` holds one entry for
// single/row mode and one-per-source in overlay mode.
export interface WiggleFeatureUnderMouse {
  refName: string
  start: number
  end: number
  rows: WiggleTooltipRow[]
}

// Single-source synthetic name for LinearWiggleDisplay's worker output. Multi
// uses real source names; single just needs a stable label so it fits the
// shared { sources: [...] } shape.
export const SINGLE_WIGGLE_SOURCE_NAME = 'default'

// Raw per-feature typed arrays returned by adapters' fast path. Display-side
// concerns (bicolor pos/neg split) happen in processFeaturesFromArrays at the
// executor, not here — keeps adapters out of UI policy decisions.
export interface RawFeatureArrays {
  starts: Int32Array
  ends: Int32Array
  scores: Float32Array
  minScores: Float32Array | undefined
  maxScores: Float32Array | undefined
  count: number
}

export function processFeaturesFromArrays(
  raw: RawFeatureArrays,
  bicolorPivot: number,
  useBicolor = true,
): WiggleFeatureArrays {
  const { starts, ends, scores, minScores, maxScores, count } = raw
  const featurePositions = new Uint32Array(count * 2)
  const featureScores = new Float32Array(count)
  const featureMinScores = new Float32Array(count)
  const featureMaxScores = new Float32Array(count)
  const posFeaturePositionsBuf = new Uint32Array(count * 2)
  const posFeatureScoresBuf = new Float32Array(count)
  const negFeaturePositionsBuf = new Uint32Array(count * 2)
  const negFeatureScoresBuf = new Float32Array(count)
  let posCount = 0
  let negCount = 0
  let hasSummaryScores = false

  for (let i = 0; i < count; i++) {
    const score = scores[i]!
    const startPos = starts[i]! | 0
    const endPos = ends[i]! | 0
    featurePositions[i * 2] = startPos
    featurePositions[i * 2 + 1] = endPos
    featureScores[i] = score
    const minScore = minScores ? (minScores[i] ?? score) : score
    const maxScore = maxScores ? (maxScores[i] ?? score) : score
    featureMinScores[i] = minScore
    featureMaxScores[i] = maxScore
    if (minScore !== score || maxScore !== score) {
      hasSummaryScores = true
    }

    if (!useBicolor || score >= bicolorPivot) {
      posFeaturePositionsBuf[posCount * 2] = startPos
      posFeaturePositionsBuf[posCount * 2 + 1] = endPos
      posFeatureScoresBuf[posCount] = score
      posCount++
    } else {
      negFeaturePositionsBuf[negCount * 2] = startPos
      negFeaturePositionsBuf[negCount * 2 + 1] = endPos
      negFeatureScoresBuf[negCount] = score
      negCount++
    }
  }

  return {
    featurePositions,
    featureScores,
    featureMinScores,
    featureMaxScores,
    numFeatures: count,
    hasSummaryScores,
    posFeaturePositions: posFeaturePositionsBuf.subarray(0, posCount * 2),
    posFeatureScores: posFeatureScoresBuf.subarray(0, posCount),
    posNumFeatures: posCount,
    negFeaturePositions: negFeaturePositionsBuf.subarray(0, negCount * 2),
    negFeatureScores: negFeatureScoresBuf.subarray(0, negCount),
    negNumFeatures: negCount,
  }
}

export function featuresToRaw(
  features: { get: (key: string) => unknown }[],
): RawFeatureArrays {
  const n = features.length
  const starts = new Int32Array(n)
  const ends = new Int32Array(n)
  const scores = new Float32Array(n)
  const minScores = new Float32Array(n)
  const maxScores = new Float32Array(n)

  for (const [i, feature] of features.entries()) {
    starts[i] = feature.get('start') as number
    ends[i] = feature.get('end') as number
    const score = (feature.get('score') as number | undefined) ?? 0
    scores[i] = score
    const summary = feature.get('summary')
    minScores[i] = summary
      ? ((feature.get('minScore') as number | undefined) ?? score)
      : score
    maxScores[i] = summary
      ? ((feature.get('maxScore') as number | undefined) ?? score)
      : score
  }

  return { starts, ends, scores, minScores, maxScores, count: n }
}

// Widen each Canvas2D bar slightly past its true pixel span so adjacent
// histogram bars overlap by a fraction of a pixel instead of leaving thin
// anti-aliased gaps between them. The GPU shader intentionally does NOT apply
// this — it relies on its own min-clip-width floor (minClipW in wiggle.slang),
// so the two backends' bar *widths* differ by sub-pixel amounts by design.
//
// Only the width, though: which edge the bar is anchored on is shared, and both
// backends anchor the bin's start (`spanLeft` here, `extendToMinWidthX` in the
// shader). Anchoring the leftmost edge instead would shift every sub-floor bin
// on a reversed block by up to WIGGLE_MIN_PX — an actual mismatch, not this
// deliberate sub-pixel one.
export const WIGGLE_FUDGE_FACTOR = 0.8

export const WIGGLE_MIN_PX = 1.5

// Shared by MultiWiggleAdapter (bigWigs shorthand entries) and the multiwiggle
// add-track drop zone, so a dropped file and a pasted URL with the same
// basename derive the same display name.
export function getFilename(uriOrName: string) {
  const filename = uriOrName.slice(uriOrName.lastIndexOf('/') + 1)
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx !== -1 ? filename.slice(0, dotIdx) : filename
}

export function formatScore(n: number) {
  if (n === 0) {
    return '0'
  }
  if (Math.abs(n) >= 100) {
    return n.toFixed(0)
  }
  return n.toPrecision(3).replace(/\.?0+$/, '')
}
