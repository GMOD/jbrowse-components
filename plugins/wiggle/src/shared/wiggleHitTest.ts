// Resolving what the cursor is over: a bp from a screen x, a feature from a
// bp, and the tooltip/feature-widget payloads built from the hit. Shared by
// single-wiggle and multi-wiggle so hover, the cursor guides and
// click-to-select can't disagree about what is under the pointer.
import type { WiggleHoveredFeature, WiggleTooltipRow } from '../util.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import type { WiggleSourceData } from '@jbrowse/wiggle-core'

// Binary search for the feature at a given base-pair offset.
// featurePositions is sorted by start (featurePositions[i*2]), so we find the
// rightmost feature whose start <= bpOffset, then confirm bpOffset < its end.
export function findFeatureAtBp(
  featurePositions: Uint32Array,
  numFeatures: number,
  bpOffset: number,
) {
  let lo = 0
  let hi = numFeatures - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (featurePositions[mid * 2]! <= bpOffset) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (found === -1) {
    return -1
  }
  return bpOffset < featurePositions[found * 2 + 1]! ? found : -1
}

// Spread-friendly helper: returns `{ summary, minScore, maxScore }` when the
// feature is a real summary (min/max diverge from score) and the user isn't
// asking for plain 'avg'. Otherwise returns `{}` so the tooltip omits those
// fields. Used by both single- and multi-wiggle hit handlers.
function summaryFields(
  score: number,
  minScore: number | undefined,
  maxScore: number | undefined,
  summaryScoreMode: string,
): { summary: true; minScore: number; maxScore: number } | { summary?: false } {
  return summaryScoreMode !== 'avg' &&
    minScore !== undefined &&
    maxScore !== undefined &&
    (minScore !== score || maxScore !== score)
    ? { summary: true, minScore, maxScore }
    : {}
}

// Build a tooltip row from a source's typed arrays at index `i`. `name`/`color`
// are set for multi-wiggle and omitted for single-wiggle.
export function makeTooltipRow(
  source: WiggleSourceData,
  i: number,
  summaryScoreMode: string,
  name?: string,
  color?: string,
): WiggleTooltipRow {
  const score = source.featureScores[i]!
  return {
    source: name,
    color,
    score,
    ...summaryFields(
      score,
      source.featureMinScores[i],
      source.featureMaxScores[i],
      summaryScoreMode,
    ),
  }
}

// Feature-widget payload for a clicked wiggle hit, shared by single- and
// multi-wiggle. Single-wiggle has one unnamed row keyed as `score`; multi has
// one entry per source name.
export function wiggleFeatureWidgetData(
  feat: WiggleHoveredFeature,
): SimpleFeatureSerialized {
  return {
    uniqueId: `wiggle-${feat.refName}-${feat.start}-${feat.end}`,
    refName: feat.refName,
    start: feat.start,
    end: feat.end,
    sources: Object.fromEntries(
      feat.rows.map(r => [r.source ?? 'score', r.score]),
    ),
  }
}

// Single-row hit: the feature interval at `bp` in one source plus its one row.
// Used by single-wiggle and multi-wiggle row mode (overlay mode collects many
// rows and uses the cursor bp instead, so it builds its result directly).
export function findSourceHit(
  source: WiggleSourceData,
  bp: number,
  refName: string,
  summaryScoreMode: string,
  name?: string,
  color?: string,
): WiggleHoveredFeature | undefined {
  const { featurePositions, numFeatures } = source
  const i = findFeatureAtBp(featurePositions, numFeatures, bp)
  return i === -1
    ? undefined
    : {
        refName,
        start: featurePositions[i * 2]!,
        end: featurePositions[i * 2 + 1]!,
        rows: [makeTooltipRow(source, i, summaryScoreMode, name, color)],
      }
}

export interface MouseRegion {
  refName: string
  screenStartPx: number
  screenEndPx: number
  start: number
  end: number
  reversed?: boolean
  displayedRegionIndex: number
}

// The 0-based base under a fractional position through a region.
//
// Counts bases from the region's left screen edge and flips for `reversed`,
// rather than flooring a flipped continuous coordinate. Two reasons:
//   - `floor`, not `round`. Rounding snaps to the nearest base *boundary*, so it
//     reports the next base across the right half of every base's pixels — an
//     off-by-one tooltip on base-resolution data at high zoom.
//   - flooring a *decreasing* coordinate (the `reversed` case) is itself off by
//     one at exact base boundaries, which at high zoom land on integer pixels
//     constantly. Indexing from the left keeps both orientations exact.
// `frac < 1` holds (screenEndPx is exclusive), so the index stays within the
// region; the clamp is float-rounding insurance only.
function baseAtFraction(region: MouseRegion, frac: number) {
  const { start, end, reversed } = region
  const span = end - start
  const index = Math.min(span - 1, Math.max(0, Math.floor(frac * span)))
  return reversed ? end - 1 - index : start + index
}

// Maps a screen x coordinate to the region containing it, the per-region data
// keyed by displayedRegionIndex, and the absolute genomic bp under the cursor.
// Returns undefined if x is outside any region or no data is loaded.
export function hitTestMouse<R extends MouseRegion, D>(
  regions: R[],
  rpcDataMap: ReadonlyMap<number, D>,
  offsetX: number,
) {
  const region = regions.find(
    r => offsetX >= r.screenStartPx && offsetX < r.screenEndPx,
  )
  if (!region) {
    return undefined
  }
  const data = rpcDataMap.get(region.displayedRegionIndex)
  if (!data) {
    return undefined
  }
  const blockWidth = region.screenEndPx - region.screenStartPx
  const frac = (offsetX - region.screenStartPx) / blockWidth
  return { region, data, bp: baseAtFraction(region, frac) }
}
