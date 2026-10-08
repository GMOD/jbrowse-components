import type { Source } from '../util.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

/**
 * The rows the loaded data reports, in first-appearance order: the metadata
 * half of each region's payload, unioned by name across every loaded region.
 *
 * Unioned rather than read off the first region because a multi-source adapter
 * reports its full static list in every region while a plain fallback adapter
 * discovers sources per region — a source with no features where the first
 * fetch landed has to appear once a later region reveals it, and appending
 * keeps the rows a user already saw where they were.
 *
 * The feature arrays are dropped here and every other attribute kept: what a
 * row IS survives a refetch, and a samples table's columns are what the
 * sidebar colors and bands the rows by.
 */
export function sourcesFromRegionData(
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>,
): Source[] {
  const byName = new Map<string, Source>()
  for (const data of rpcDataMap.values()) {
    for (const {
      featurePositions: _positions,
      featureScores: _scores,
      featureMinScores: _minScores,
      featureMaxScores: _maxScores,
      numFeatures: _numFeatures,
      hasSummaryScores: _hasSummaryScores,
      ...source
    } of data.sources) {
      if (!byName.has(source.name)) {
        byName.set(source.name, source)
      }
    }
  }
  return [...byName.values()]
}

/** What the adapter's source listing warned of, once each. */
export function sourceWarnings(
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>,
): string[] {
  return [
    ...new Set([...rpcDataMap.values()].flatMap(data => data.warnings ?? [])),
  ]
}

/**
 * The grey a source with no color paints in beside dealt ones in one panel,
 * as ggplot's `na.value`: the default plot color would read as a dealt one.
 */
export const UNCOLORED_ROW = '#999'

/**
 * The color a source's marks paint in: its resolved `rowColor` where
 * `marksTakeRowColor`, else its own `color`, which a density row fades to.
 */
export function markColorOf(
  source: Pick<Source, 'color' | 'rowColor'>,
  marksTakeRowColor: boolean,
) {
  return marksTakeRowColor ? source.rowColor : source.color
}
