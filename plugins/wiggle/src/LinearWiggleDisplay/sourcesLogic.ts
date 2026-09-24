import { set1 } from '@jbrowse/core/ui/colors'
import { keptRows, orderRowsByDomain } from '@jbrowse/tree-sidebar'

import type { Source } from '../util.ts'
import type { RowColorDeal } from '@jbrowse/tree-sidebar'
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
 * identity is the whole of what varies, and it varies with one thing: whether
 * a score gradient paints — density always, and bars or points under a
 * declared `linear` or `log` colour, whose table ignores `color` outright.
 *
 * **In density, `color` is a scale rather than an identity.** Density paints a
 * row white at the cut and saturates towards `color`, so a hue set there to
 * mark "this row is population PUR" replaces the pos/neg scale the track is
 * read by — a diverging copy-number heatmap grouped by population came out one
 * hue per population with a shared blue for losses, encoding nothing. Identity
 * is displaced one channel over, to `labelColor`, which the ramp ignores. The
 * colour dialog edits `labelColor` there, the key reads it, and density's
 * white-fade ramp is drawable only while no source sets `color`.
 *
 * Whether a source with no colour of its own takes a palette entry is the
 * colour object's question, not this file's: `color: { field: 'source' }`
 * hands one out, from its `range` and then the default palette, and anything
 * else leaves the row on the display's own colours.
 */

/** The order and colours a categorical scale over `source` hands out. */
export interface SourcePalette {
  domain: readonly string[]
  range: readonly string[]
}

/**
 * What the row palette deals over `rows`, the full (pre-filter) sources in
 * their current arrangement: one cursor over a colour per source's `range` and
 * then `set1`, the groups first in the order they first appear, then, for a
 * colour per source, the ungrouped rows its `domain` lists ahead of the rest.
 * A grouped row takes its group's colour. Under a score gradient only the
 * groups deal: a per-row palette on the label of a 4,390-row track is `set1`
 * wrapping every nine rows, which reads as a grouping and is not one.
 *
 * **One cursor** keeps a group and an ungrouped row off one colour: dealt as
 * two sequences from 0, the first group and the first ungrouped row took
 * `set1[0]` alike, in the plot and in the legend naming them.
 */
export function sourceColorDeal(
  rows: Source[],
  palette: SourcePalette | undefined,
  gradientPaints: boolean,
): RowColorDeal<Source> {
  const perSource = palette !== undefined && !gradientPaints
  return {
    order: [
      ...rows.flatMap(s => (s.group === undefined ? [] : [s.group])),
      ...(perSource
        ? orderRowsByDomain(
            rows.filter(s => s.group === undefined),
            palette.domain,
          ).map(s => s.name)
        : []),
    ],
    valueOf: s => s.group ?? (perSource ? s.name : undefined),
    domain: [],
    range: palette?.range ?? [],
    palette: set1,
  }
}

// A source's own colors win — the palette only fills what it left unset —
// save under a colour by an attribute, which the reader asked for over them.
// An unfilled channel stays undefined so the renderer falls back to its own
// default.
//
// Under a gradient `labelColor` falls back to the source's OWN `color` before the
// group palette because that color is what the ramp paints the row with: a
// per-cell store shipping `color: #8c564b` for its monocytes and grouping them
// as "Monocyte" drew a brown block beside a purple label, two palettes for one
// grouping. The label is the key to the rows, so it names the color the rows
// actually are; the group palette is for stores supplying no color at all.
function synthesizeColors(
  s: Source,
  gradientPaints: boolean,
  dealt: string | undefined,
  paletteLeads: boolean,
) {
  const own = gradientPaints ? (s.labelColor ?? s.color) : s.color
  const identity = paletteLeads ? (dealt ?? own) : (own ?? dealt)
  return gradientPaints
    ? { color: s.color, labelColor: identity }
    : { color: identity, labelColor: s.labelColor }
}

// What the canvas/SVG renderers consume: the editable sources with their colors
// resolved per the table above, then narrowed to the focus. `dealt` is the
// row palette's colour for each source, by name (`sourceColorDeal`).
//
// **The palette is dealt over the full list and the focus applies after**, so
// focusing a clade hides rows without recoloring the ones it keeps, and the
// legend a user just read stays valid. This is the ordering
// `filterRowsBySubtree` documents as hide-only.
export function buildSources(
  editableSources: Source[],
  kept: readonly string[] | undefined,
  dealt: ReadonlyMap<string, string>,
  gradientPaints: boolean,
  paletteLeads = false,
): Source[] {
  return keptRows(
    editableSources.map(s => ({
      ...s,
      ...synthesizeColors(s, gradientPaints, dealt.get(s.name), paletteLeads),
    })),
    kept,
  )
}
