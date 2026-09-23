import { set1 as overlayColors } from '@jbrowse/core/ui/colors'
import { isCssColor } from '@jbrowse/core/util/cssColorParse'
import { keptRows, orderRowsByDomain } from '@jbrowse/tree-sidebar'

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

const DEFAULT_PALETTE: SourcePalette = { domain: [], range: [] }

interface PaletteColors {
  // by group name — shared by every source in the group, in every mode
  groupColors: Map<string, string>
  // by source name — overlay only, where rows collapse onto one plot and a row
  // with no color of its own is indistinguishable from its neighbours
  rowColors: Map<string, string>
}

/**
 * The palette entries a track's rows and groups draw from, in first-appearance
 * order over the full (pre-filter) source list.
 *
 * **One cursor hands out every entry**, the `range` a colour per source lists
 * and then the default palette past its end, so the two maps are disjoint by
 * construction, with no offset for anyone to check. They
 * were built as two independent 0-based sequences — groups by group order, rows
 * by source index — and a track that mixes grouped and ungrouped subadapters
 * therefore gave `set1[0]` to both the first group and the first ungrouped row:
 * two different things one color, in the plot and in the legend naming it.
 *
 * Groups are assigned first so the pure cases are byte-identical to the two
 * sequences this replaced: an all-grouped track never reaches the row loop, and
 * an all-ungrouped one starts the cursor at 0, where index-among-ungrouped is
 * exactly the source index it always was.
 */
function buildPaletteColors(
  sources: Source[],
  { domain, range }: SourcePalette,
): PaletteColors {
  const entry = (index: number) =>
    range[index] ??
    overlayColors[(index - range.length) % overlayColors.length]!
  let assigned = 0
  const groupColors = new Map<string, string>()
  const rowColors = new Map<string, string>()
  for (const s of sources) {
    if (s.group !== undefined && !groupColors.has(s.group)) {
      groupColors.set(s.group, entry(assigned++))
    }
  }
  const ungrouped = sources.filter(s => s.group === undefined)
  for (const s of orderRowsByDomain(ungrouped, domain)) {
    rowColors.set(s.name, entry(assigned++))
  }
  return { groupColors, rowColors }
}

// A source's own colors always win — these only fill what it left unset — and
// an unfilled channel stays undefined so the renderer falls back to its own
// default.
//
// Under a gradient `labelColor` falls back to the source's OWN `color` before the
// group palette because that color is what the ramp paints the row with: a
// per-cell store shipping `color: #8c564b` for its monocytes and grouping them
// as "Monocyte" drew a brown block beside a purple label, two palettes for one
// grouping. The label is the key to the rows, so it names the color the rows
// actually are; the group palette is for stores supplying no color at all.
//
// A gradient takes no `rowColors` entry, deliberately: a per-row palette on the
// label of a 4,390-row track is `set1` wrapping every nine rows, which reads as
// a grouping and is not one.
function synthesizeColors(
  s: Source,
  perSource: boolean,
  gradientPaints: boolean,
  { groupColors, rowColors }: PaletteColors,
) {
  const groupColor =
    s.group === undefined ? undefined : groupColors.get(s.group)
  if (gradientPaints) {
    return {
      color: s.color,
      labelColor: s.labelColor ?? s.color ?? groupColor,
    }
  }
  return {
    color:
      s.color ?? groupColor ?? (perSource ? rowColors.get(s.name) : undefined),
    labelColor: s.labelColor,
  }
}

// What the canvas/SVG renderers consume: the editable sources with their colors
// resolved per the table above, then narrowed to the focus. `palette` is what
// a colour per source hands out, undefined where the colour is not one.
//
// **Synthesis runs over the full list and the focus applies after**, so a
// source's color is keyed to its position among all sources rather than among
// the survivors: focusing a clade hides rows without recoloring the ones it
// keeps, and the legend a user just read stays valid. This is the ordering
// `filterRowsBySubtree` documents as hide-only.
export function buildSources(
  editableSources: Source[],
  kept: readonly string[] | undefined,
  palette: SourcePalette | undefined,
  gradientPaints: boolean,
): Source[] {
  const colors = buildPaletteColors(editableSources, palette ?? DEFAULT_PALETTE)
  return keptRows(
    editableSources.map(s => ({
      ...s,
      ...synthesizeColors(s, palette !== undefined, gradientPaints, colors),
    })),
    kept,
  )
}

/**
 * The channel a reader's colour for a row lands on: the label tint where the
 * rows are labelled and a gradient has the plot, the plot colour otherwise —
 * in one shared box there is no label to tint, so the colour goes to the plot
 * whatever the gradient.
 */
function identityChannel({
  gradientPaints,
  rowLayout,
}: {
  gradientPaints: boolean
  rowLayout: boolean
}) {
  return gradientPaints && rowLayout ? 'labelColor' : 'color'
}

/**
 * The adapter's rows in the reader's arrangement: `domain` leading, a label
 * from `labels` over the adapter's, and a `rowColors` entry on the channel a
 * row's identity paints through — `labelColor` under a gradient, `color`
 * otherwise, the same rule `synthesizeColors` reads by. Hands back `discovered`
 * itself when nothing is arranged, so an identity-keyed consumer sees no
 * change.
 */
export function arrangeSources(
  discovered: Source[],
  {
    domain,
    labels,
    rowColors,
    gradientPaints,
    rowLayout,
  }: {
    domain: readonly string[]
    labels: Readonly<Record<string, string>>
    rowColors: ReadonlyMap<string, string>
    gradientPaints: boolean
    rowLayout: boolean
  },
): Source[] {
  const ordered = orderRowsByDomain(discovered, domain)
  if (rowColors.size === 0 && Object.keys(labels).length === 0) {
    return ordered
  }
  const channel = identityChannel({ gradientPaints, rowLayout })
  return ordered.map(s => {
    const label = labels[s.name]
    const color = rowColors.get(s.name)
    return {
      ...s,
      ...(label === undefined ? {} : { label }),
      ...(color === undefined ? {} : { [channel]: color }),
    }
  })
}

/**
 * What the arrangement dialog's rows say beyond what the adapter supplied: a
 * label or a colour on the mode's identity channel that differs from the
 * discovered row's. The whole of `rows.labels` and `rowColor`, rebuilt, so an
 * edit cleared in the dialog is cleared in the config. The colour pairs keep
 * `baseOrder`, the config's own `rowColor.domain`, ahead of any new name, so a
 * reorder that changes no colour writes the config's pairs back unchanged. A
 * string the painters cannot parse is left out rather than stored.
 */
export function rowEditsOf(
  rows: readonly Source[],
  discovered: readonly Source[],
  {
    gradientPaints,
    rowLayout,
    baseOrder,
  }: {
    gradientPaints: boolean
    rowLayout: boolean
    baseOrder: readonly string[]
  },
) {
  const byName = new Map(discovered.map(s => [s.name, s]))
  const channel = identityChannel({ gradientPaints, rowLayout })
  const labels: Record<string, string> = {}
  const colors = new Map<string, string>()
  for (const row of rows) {
    const base = byName.get(row.name)
    if (row.label !== undefined && row.label !== base?.label) {
      labels[row.name] = row.label
    }
    const color = row[channel]
    if (color !== undefined && color !== base?.[channel] && isCssColor(color)) {
      colors.set(row.name, color)
    }
  }
  const domain = [
    ...baseOrder.filter(name => colors.has(name)),
    ...[...colors.keys()].filter(name => !baseOrder.includes(name)),
  ]
  return {
    labels,
    rowColor: { domain, range: domain.map(name => colors.get(name)!) },
  }
}
