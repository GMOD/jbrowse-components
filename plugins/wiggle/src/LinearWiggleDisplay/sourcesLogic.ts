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
 * The feature arrays are dropped here: what a row IS survives a refetch, and
 * everything downstream of this (the layout merge, clustering, the color
 * dialog) is metadata.
 */
export function sourcesFromRegionData(
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>,
): Source[] {
  const byName = new Map<string, Source>()
  for (const data of rpcDataMap.values()) {
    for (const { name, color, label, group, baseUri } of data.sources) {
      if (!byName.has(name)) {
        byName.set(name, { name, color, label, group, baseUri })
      }
    }
  }
  return [...byName.values()]
}

/**
 * The grey a source with no colour paints in beside dealt ones in one panel,
 * as ggplot's `na.value`: the default plot colour would read as a dealt one.
 */
export const UNCOLORED_ROW = '#999'

/**
 * The colour a source's marks paint in: its resolved `rowColor` where
 * `marksTakeRowColor`, else its own `color`, which a density row fades to.
 */
export function markColorOf(
  source: Pick<Source, 'color' | 'rowColor'>,
  marksTakeRowColor: boolean,
) {
  return marksTakeRowColor ? source.rowColor : source.color
}
