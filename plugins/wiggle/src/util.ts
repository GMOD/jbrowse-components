import type { SourceInfo, WiggleFeatureArrays } from '@jbrowse/wiggle-core'

export {
  autoscaleDomainFromStats,
  computeAutoscaleDomain,
  computeScoreExtent,
  computeScoreStats,
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

// A row of a multi-wiggle display, which is exactly the metadata its adapter
// reported — so this is `SourceInfo`, not a widened copy of it.
//
// It used to carry a second required field, `source`, always set equal to
// `name`. That came from the adapter side, where `source` is a real and
// different thing: BigWigAdapter's `source` config slot is what a subtrack is
// *named by*, `MultiWiggleAdapter` disambiguates colliding ones, and every
// feature is stamped with it. The display type mirrored the word and then had
// to keep the two in lockstep, which is what `name === source` was: an
// invariant standing in for a field that carried no information. Nothing ever
// read it — not the tree sidebar (its helpers constrain on `{ name: string }`),
// not clustering, not the legends, not the colour dialog — and every sibling
// row display (variants, MAF, canvas's multi-row) declares its row type without
// it. `layout` is `types.frozen`, so a saved session that still has the key
// loads unchanged and simply carries a field no one asks for.
export type Source = SourceInfo

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
// `start`/`end` is a 0-based half-open interval: the feature's own for
// single-wiggle and multi-wiggle row mode, and just the cursor base
// (`[bp, bp + 1)`) in overlay mode, since sources with differing bin widths share
// no single feature interval. `rows` holds one entry for single/row mode and
// one-per-source in overlay mode.
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

// Bucket features by their `source` field, for the adapters that carry several
// sources in one file (bedMethyl, a bedGraph with a source column) and are used
// directly as a MultiQuantitativeTrack's adapter.
//
// A feature with no source lands under `''`, not under the `"undefined"` a bare
// `${f.get('source')}` key produces — that string reached the UI as a real
// subtrack name, so a plain bedGraph pointed at a MultiQuantitativeTrack showed
// `undefined: 5` in its tooltip. Empty rather than a placeholder word because
// every consumer already treats a falsy source as unnamed: the tooltip drops the
// `name: ` prefix and the row label renders nothing.
//
// Shared by the render executor and the clustering score matrix so the two
// agree on what an un-annotated feature is called — they key their outputs off
// the same source list.
//
// A Map, not the plain object `groupBy` returns, because a source name here is
// arbitrary data out of a file's column. Keys stay insertion-ordered whatever
// they look like — a plain object hoists integer-like names, so samples named
// "1", "2", "10" were discovered in numeric order rather than the file's — and a
// name colliding with Object.prototype (`constructor`, `toString`) is a real
// bucket rather than an inherited function.
export function groupFeaturesBySource<
  T extends { get: (key: string) => unknown },
>(features: T[]) {
  const groups = new Map<string, T[]>()
  for (const f of features) {
    const source = f.get('source')
    const key = source === undefined || source === null ? '' : `${source}`
    const group = groups.get(key)
    if (group) {
      group.push(f)
    } else {
      groups.set(key, [f])
    }
  }
  return groups
}

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

// Fresh per call, never a shared constant: these buffers are handed to
// postMessage as transferables, and transferring detaches them.
function emptySide() {
  return { positions: new Uint32Array(0), scores: new Float32Array(0) }
}

// The features on one side of the pivot, copied out in order. Only called when
// both sides are non-empty — a one-sided split aliases the full arrays instead.
function splitSide(
  featurePositions: Uint32Array,
  featureScores: Float32Array,
  count: number,
  sideCount: number,
  bicolorPivot: number,
  keepPos: boolean,
) {
  const positions = new Uint32Array(sideCount * 2)
  const sideScores = new Float32Array(sideCount)
  let j = 0
  for (let i = 0; i < count; i++) {
    const score = featureScores[i]!
    if (score >= bicolorPivot === keepPos) {
      positions[j * 2] = featurePositions[i * 2]!
      positions[j * 2 + 1] = featurePositions[i * 2 + 1]!
      sideScores[j] = score
      j++
    }
  }
  return { positions, scores: sideScores }
}

// Adapter arrays -> the render-side layout: absolute positions, scores, the
// min/max summary bands, and the pivot-split pos/neg arrays the 'avg' render
// path draws from.
//
// Arrays are aliased, not copied, wherever a copy would be identical: no
// summary data means min/max === score, and an all-positive (or all-negative)
// window means one side's arrays === the full arrays. Aliasing is safe because
// every consumer only reads, and structured clone preserves the sharing across
// the worker boundary (collectWiggleTransferables dedupes the buffers). This
// matters at scale: a typical all-positive coverage source used to allocate,
// fill, and transfer three full copies of its positions.
export function processFeaturesFromArrays(
  raw: RawFeatureArrays,
  bicolorPivot: number,
  useBicolor = true,
): WiggleFeatureArrays {
  const { starts, ends, scores, minScores, maxScores, count } = raw
  const featurePositions = new Uint32Array(count * 2)
  const featureScores = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    featurePositions[i * 2] = starts[i]!
    featurePositions[i * 2 + 1] = ends[i]!
    featureScores[i] = scores[i]!
  }

  let featureMinScores = featureScores
  let featureMaxScores = featureScores
  let hasSummaryScores = false
  if (minScores !== undefined || maxScores !== undefined) {
    const mins = new Float32Array(count)
    const maxs = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const score = featureScores[i]!
      const minScore = minScores ? (minScores[i] ?? score) : score
      const maxScore = maxScores ? (maxScores[i] ?? score) : score
      mins[i] = minScore
      maxs[i] = maxScore
      if (minScore !== score || maxScore !== score) {
        hasSummaryScores = true
      }
    }
    // Kept only when they actually diverge. An adapter can hand back summary
    // arrays that never do (every bin one base wide, or a fallback adapter that
    // fills them unconditionally), and holding onto the copies then spends two
    // extra buffers on the postMessage transfer for values already sitting in
    // `featureScores` — the same aliasing the pos/neg split below applies.
    if (hasSummaryScores) {
      featureMinScores = mins
      featureMaxScores = maxs
    }
  }

  // Counted with the same `>= pivot` predicate splitSide partitions on, so a
  // NaN score (never >=, never <) lands on the same side in both.
  let posCount = count
  if (useBicolor) {
    posCount = 0
    for (let i = 0; i < count; i++) {
      if (featureScores[i]! >= bicolorPivot) {
        posCount++
      }
    }
  }
  const negCount = count - posCount
  const pos =
    negCount === 0
      ? { positions: featurePositions, scores: featureScores }
      : posCount === 0
        ? emptySide()
        : splitSide(
            featurePositions,
            featureScores,
            count,
            posCount,
            bicolorPivot,
            true,
          )
  const neg =
    posCount === 0
      ? { positions: featurePositions, scores: featureScores }
      : negCount === 0
        ? emptySide()
        : splitSide(
            featurePositions,
            featureScores,
            count,
            negCount,
            bicolorPivot,
            false,
          )

  return {
    featurePositions,
    featureScores,
    featureMinScores,
    featureMaxScores,
    numFeatures: count,
    hasSummaryScores,
    posFeaturePositions: pos.positions,
    posFeatureScores: pos.scores,
    posNumFeatures: posCount,
    negFeaturePositions: neg.positions,
    negFeatureScores: neg.scores,
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
  // Most adapters on this path (bedGraph, bedMethyl) carry no summary data at
  // all. Reporting `undefined` there rather than two arrays that duplicate
  // `scores` is what lets processFeaturesFromArrays alias instead of
  // materializing, so it's worth one cheap pre-pass over already-built feature
  // objects: the alternative costs two more arrays per source per region, and
  // transfers them.
  const hasSummary = features.some(f => f.get('summary'))
  const minScores = hasSummary ? new Float32Array(n) : undefined
  const maxScores = hasSummary ? new Float32Array(n) : undefined

  for (const [i, feature] of features.entries()) {
    starts[i] = feature.get('start') as number
    ends[i] = feature.get('end') as number
    const score = (feature.get('score') as number | undefined) ?? 0
    scores[i] = score
    if (minScores && maxScores) {
      const summary = feature.get('summary')
      minScores[i] = summary
        ? ((feature.get('minScore') as number | undefined) ?? score)
        : score
      maxScores[i] = summary
        ? ((feature.get('maxScore') as number | undefined) ?? score)
        : score
    }
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
  const s = n.toPrecision(3)
  // Only the fractional padding toPrecision adds is noise; guard on the decimal
  // point because toPrecision can round UP out of the fractional form entirely —
  // 99.95 comes back as "100", where an unguarded trailing-zero strip eats two
  // significant digits and reports the score as 1.
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}
