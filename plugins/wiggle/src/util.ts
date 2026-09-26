import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import { MIN_FILL_WIDTH_PX } from '@jbrowse/wiggle-core/renderingBackendTypes'

import type { Feature } from '@jbrowse/core/util'
import type { SourceInfo, WiggleFeatureArrays } from '@jbrowse/wiggle-core'

export { WIGGLE_RENDERINGS, WIGGLE_RENDERING_TYPES } from './renderingTypes.ts'

export {
  WIGGLE_NEG_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
} from './colorDefaults.ts'

// A row of the wiggle display: exactly the metadata its adapter reported.
export type Source = SourceInfo

// One score entry shown in a wiggle tooltip. `source`/`color` are populated
// only where a source is named. The summary
// variant carries min/max together so consumers narrow on `summary` alone.
export type WiggleTooltipRow = {
  source?: string
  color?: string
  score: number
} & (
  | { summary?: false }
  | { summary: true; minScore: number; maxScore: number }
)

// Feature(s) hovered under the mouse. `start`/`end` is a 0-based half-open
// interval: the feature's own where cursor y picks one row, and just the cursor
// base (`[bp, bp + 1)`) where several sources share one plot, since sources with
// differing bin widths share no single feature interval. `rows` holds one entry
// per row read.
export interface WiggleHoveredFeature {
  refName: string
  start: number
  end: number
  rows: WiggleTooltipRow[]
}

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

// Raw per-feature typed arrays returned by adapters' fast path.
export interface RawFeatureArrays {
  starts: Int32Array | Uint32Array
  ends: Int32Array | Uint32Array
  scores: Float32Array
  minScores: Float32Array | undefined
  maxScores: Float32Array | undefined
  count: number
}

// Adapter arrays -> the render-side layout: absolute positions, scores and the
// min/max summary bands. Min/max are aliased onto the scores where no feature
// is a summary, which is safe because every consumer only reads and structured
// clone preserves the sharing across the worker boundary
// (collectWiggleTransferables dedupes the buffers).
export function processFeaturesFromArrays(
  raw: RawFeatureArrays,
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
    // `featureScores`.
    if (hasSummaryScores) {
      featureMinScores = mins
      featureMaxScores = maxs
    }
  }

  return {
    featurePositions,
    featureScores,
    featureMinScores,
    featureMaxScores,
    numFeatures: count,
    hasSummaryScores,
  }
}

// Undefined when no feature is a summary, so `processFeaturesFromArrays`
// aliases min/max onto the scores rather than shipping two copies.
function summaryChannels(
  features: readonly Feature[],
  featureIndex: Uint32Array,
  scores: Float32Array,
) {
  if (!features.some(f => f.get('summary'))) {
    return { minScores: undefined, maxScores: undefined }
  }
  const n = featureIndex.length
  const minScores = new Float32Array(n)
  const maxScores = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const f = features[featureIndex[i]!]!
    const score = scores[i]!
    const summary = f.get('summary')
    minScores[i] = summary
      ? ((f.get('minScore') as number | undefined) ?? score)
      : score
    maxScores[i] = summary
      ? ((f.get('maxScore') as number | undefined) ?? score)
      : score
  }
  return { minScores, maxScores }
}

// The score lane and nothing else: wiggle draws from arrays and never hovers
// through the encoder, so the hit index — most of the encoder's cost after
// the walk — is declined.
export function featuresToRaw(
  features: readonly Feature[],
  scoreField = 'score',
): RawFeatureArrays {
  const { x, x2, y, featureIndex, count } = encodeFeatures(
    features,
    { y: f => Number(f.get(scoreField) ?? 0) },
    ['y'],
  )
  return {
    starts: x,
    ends: x2,
    scores: y,
    ...summaryChannels(features, featureIndex, y),
    count,
  }
}

// wiggle.slang's own `MIN_FILL_WIDTH_PX` (adr-051), under this module's name.
export const WIGGLE_MIN_PX = MIN_FILL_WIDTH_PX

// Shared by MultiWiggleAdapter (bigWigs shorthand entries) and the multiwiggle
// add-track drop zone, so a dropped file and a pasted URL with the same
// basename derive the same display name.
//
// Query and fragment come off before the extension does. They are part of the
// URL, not the name, and they routinely carry dots of their own — a presigned S3
// link or a `?v=1.2` cache-buster left `sample.bw?v=1` as the subtrack label,
// since the last dot in the whole string sat inside the query. It has to happen
// before the basename too, because a presigned query carries slashes of its own.
//
// Only for something that is actually a URL, which is what the scheme test is
// for. The other half of the callers pass a bare `File.name` or a localPath,
// and `#` is a legal filename character on every platform this runs on. There
// the whole string is the name: `sample#2.bw` is a file called `sample#2`, not
// a file called `sample` with a fragment.
//
// Two or more characters before the colon, so a Windows drive letter is not
// read as a scheme. `C:\data\sample#2.bw` is a localPath, and one-letter
// schemes do not exist in practice.
export function getFilename(uriOrName: string) {
  const path = /^[a-z][a-z\d+.-]+:/i.test(uriOrName)
    ? uriOrName.split(/[?#]/, 1)[0]!
    : uriOrName
  const filename = path.slice(path.lastIndexOf('/') + 1)
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx !== -1 ? filename.slice(0, dotIdx) : filename
}

export { formatScore } from '@jbrowse/core/util/numericUtils'
