import { set1 as overlayColors } from '@jbrowse/core/ui/colors'
import { filterRowsBySubtree } from '@jbrowse/tree-sidebar'

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
 * # The multi-wiggle color model
 *
 * This is the whole picture. Everything else about multi-wiggle color — the
 * legend's swatches, the Set Color dialog's columns, whether a score ramp is
 * drawable, what the sidebar stripe means — is downstream of this table, so
 * read it here rather than reassembling it from the call sites.
 *
 * A row carries **two color channels**, and there are **three modes**:
 *
 * | mode       | `color` paints          | identity lives in | palette fills   |
 * | ---------- | ----------------------- | ----------------- | --------------- |
 * | `overlay`  | the source's whole plot | `color`           | group, then row |
 * | `multirow` | the row's pos-side bars | `color`           | group only      |
 * | `density`  | the **score ramp**      | `labelColor`      | group only      |
 *
 * The one load-bearing fact, from which every special case below follows:
 * **in density `color` is not an identity, it is a scale.** Density paints a
 * row white at the bicolor pivot and saturates toward `color`, so a hue put
 * there to say "this row is population PUR" silently replaces the pos/neg
 * scale the track is read by — a diverging copy-number heatmap grouped by
 * population came out one hue per population with a shared blue for losses,
 * encoding nothing. So identity is displaced one channel over, to
 * `labelColor`, which the row-label sidebar paints and the ramp ignores.
 *
 * Three consequences, each of which used to be re-derived somewhere and get it
 * wrong:
 *
 * - the Set Color dialog edits `labelColor` in density (`SetColorDialog`);
 * - the color key reads `labelColor` in density (`buildLegendItems`)
 *   — reading `color` gave a grouped-but-uncolored cohort a key of identical
 *   `posColor` swatches naming groups that were on screen in four colors;
 *   and
 * - a score ramp is drawable only while NO source sets `color`, since one that
 *   does is painted on its own scale (`scoreRamp` on the model).
 *
 * `multirow` keeps the shared `negColor` on the negative side even when the row
 * has a color, so signed data still reads as bicolor; that split is the
 * renderer's and is settled (ADR-016, `buildSourceRenderData`).
 */
export type RowColorMode = 'overlay' | 'multirow' | 'density'

// Three modes but two booleans, because `multirowdensity` IS a multi-row
// rendering — so overlay and density are never both true. Collapsed once, here,
// so everything downstream branches on the mode itself and the impossible
// fourth combination has nowhere left to hide.
//
// Exported because the color key is downstream of this table too: `legendItems`
// takes the mode rather than the raw booleans, so which channel it reads and
// what an unset one falls back to are both read off the table above instead of
// restated against `isDensityMode`.
export function rowColorMode(
  isOverlay: boolean,
  isDensityMode: boolean,
): RowColorMode {
  if (isDensityMode) {
    return 'density'
  }
  return isOverlay ? 'overlay' : 'multirow'
}

// Palette color by position, wrapping modulo palette length.
function paletteColor(index: number) {
  return overlayColors[index % overlayColors.length]!
}

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
 * **One cursor hands out every entry**, which is what makes the two maps
 * disjoint by construction rather than by an offset someone has to check. They
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
function buildPaletteColors(sources: readonly Source[]): PaletteColors {
  let assigned = 0
  const groupColors = new Map<string, string>()
  const rowColors = new Map<string, string>()
  for (const s of sources) {
    if (s.group !== undefined && !groupColors.has(s.group)) {
      groupColors.set(s.group, paletteColor(assigned++))
    }
  }
  for (const s of sources) {
    if (s.group === undefined) {
      rowColors.set(s.name, paletteColor(assigned++))
    }
  }
  return { groupColors, rowColors }
}

// One case per row of the table above. A source's own colors always win — these
// only fill what it left unset — and an unfilled channel stays undefined so the
// renderer falls back to its own default.
//
// The density case falls back to the source's OWN `color` before the group
// palette because that color is what the ramp paints the row with: a per-cell
// store shipping `color: #8c564b` for its monocytes and grouping them as
// "Monocyte" drew a brown block beside a purple label, two palettes for one
// grouping. The label is the key to the rows, so it names the color the rows
// actually are; the group palette is for stores supplying no color at all.
//
// Density takes no `rowColors` entry, deliberately: a per-row palette on the
// label of a 4,390-row track is `set1` wrapping every nine rows, which reads as
// a grouping and is not one.
function synthesizeColors(
  s: Source,
  mode: RowColorMode,
  { groupColors, rowColors }: PaletteColors,
) {
  const groupColor =
    s.group === undefined ? undefined : groupColors.get(s.group)
  switch (mode) {
    case 'density': {
      return {
        color: s.color,
        labelColor: s.labelColor ?? s.color ?? groupColor,
      }
    }
    case 'overlay': {
      return {
        color: s.color ?? groupColor ?? rowColors.get(s.name),
        labelColor: s.labelColor,
      }
    }
    case 'multirow': {
      return {
        color: s.color ?? groupColor,
        labelColor: s.labelColor,
      }
    }
  }
}

// What the canvas/SVG renderers consume: the editable sources with their colors
// resolved per the table above, then narrowed to the focused subtree.
//
// **Synthesis runs over the full list and the filter applies after**, so a
// source's color is keyed to its position among all sources rather than among
// the survivors: focusing a clade hides rows without recoloring the ones it
// keeps, and the legend a user just read stays valid. This is the ordering
// `filterRowsBySubtree` documents as hide-only.
export function buildSources(
  editableSources: Source[],
  subtreeFilter: readonly string[] | undefined,
  isOverlay: boolean,
  isDensityMode: boolean,
): Source[] {
  const mode = rowColorMode(isOverlay, isDensityMode)
  const palette = buildPaletteColors(editableSources)
  return filterRowsBySubtree(
    editableSources.map(s => ({ ...s, ...synthesizeColors(s, mode, palette) })),
    subtreeFilter,
  )
}
