import { keptRows } from '@jbrowse/tree-sidebar'

import type { Source } from '../util.ts'
import type { IdentityChannel } from '@jbrowse/tree-sidebar'
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
    for (const {
      name,
      color,
      labelColor,
      label,
      group,
      baseUri,
    } of data.sources) {
      if (!byName.has(name)) {
        byName.set(name, { name, color, labelColor, label, group, baseUri })
      }
    }
  }
  return [...byName.values()]
}

/**
 * # What a row's two colour channels are for
 *
 * A row carries `color`, which the plot paints it in, and `labelColor`, which
 * the row-label sidebar paints beside it. Which of them carries the row's
 * resolved colour (`resolvedRowColors`) is the `identityChannel`: the plot
 * while `rowColorPaintsMarks` or the sources share one box, which has no
 * label, and the label once a score gradient or a declared `color` paints a
 * row each.
 *
 * **In density, `color` is a scale rather than an identity.** Density paints a
 * row white at the cut and saturates towards `color`, so a hue set there to
 * mark "this row is population PUR" replaces the pos/neg scale the track is
 * read by. Identity is displaced one channel over, to `labelColor`, which the
 * ramp ignores, and `color` keeps the source's own.
 */

// What the canvas/SVG renderers consume: the editable sources with each one's
// resolved colour on its identity channel, then narrowed to the focus. The
// colours are resolved over the full list, so focusing a clade hides rows
// without recolouring the ones it keeps.
export function buildSources(
  editableSources: Source[],
  kept: readonly string[] | undefined,
  colors: ReadonlyMap<string, string>,
  channel: IdentityChannel,
): Source[] {
  return keptRows(
    editableSources.map(s =>
      channel === 'color'
        ? { ...s, color: colors.get(s.name) }
        : { ...s, labelColor: colors.get(s.name) ?? s.labelColor },
    ),
    kept,
  )
}
