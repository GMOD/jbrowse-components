import { set1 as overlayColors } from '@jbrowse/core/ui/colors'
import { filterRowsBySubtree, reconcileLayout } from '@jbrowse/tree-sidebar'

import type { EditableSource, Source, SourceInfo } from '../util.ts'

// Overlay palette color for a row/group index, wrapping modulo palette length.
function paletteColor(index: number) {
  return overlayColors[index % overlayColors.length]!
}

// Treat raw adapter metadata as a Source by setting its `source` alias equal to
// `name` (see Source docs: name===source is the invariant callers rely on).
export function withSourceAlias(s: SourceInfo): EditableSource {
  return { ...s, source: s.name }
}

// Synthesized colors for a source that has not set them. Priority mirrors the
// buildSources doc-comment: group-derived color, then the overlay index palette
// (overlay mode only), then undefined so the renderer falls back to its default.
//
// Which channel a group's color lands in depends on the rendering, because the
// two modes spend `color` on different things. Everywhere but density, `color`
// is the source's identity. In density, `color` is the score ramp (white at the
// bicolor pivot, saturating toward `color`), so an identity hue there silently
// replaces the pos/neg scale the track is read by: a diverging copy-number
// heatmap grouped by population came out one hue per population with a shared
// blue for losses, which encodes nothing. There the group tints `labelColor`
// instead, which the row-label sidebar paints and the ramp ignores. This is the
// same split the Set Color dialog already makes by editing `labelColor` rather
// than `color` in density mode.
//
// In density the row label falls back to the source's OWN `color` before the
// group palette, because that color is what the ramp paints the row with: a
// per-cell store that ships `color: #8c564b` for its monocytes and groups them
// as "Monocyte" was drawing a brown block beside a purple label, two palettes
// for one grouping (set1 by group index against the store's own). The label is
// the key to the rows, so it has to name the color the rows actually are; the
// group palette is for stores that supply no color of their own.
function synthesizeColors(
  s: Source,
  index: number,
  isOverlay: boolean,
  isDensityMode: boolean,
  groupColors: Map<string, string>,
) {
  const groupColor =
    s.group === undefined ? undefined : groupColors.get(s.group)
  return isDensityMode
    ? { color: s.color, labelColor: s.labelColor ?? s.color ?? groupColor }
    : {
        color:
          s.color ??
          groupColor ??
          (isOverlay ? paletteColor(index) : undefined),
        labelColor: s.labelColor,
      }
}

// Build a group→color map in first-appearance order so every source in the
// same group shares a palette entry regardless of display mode. Empty when no
// source has a group.
function buildGroupColors(sources: readonly Source[]): Map<string, string> {
  const seen = new Set<string>()
  const order: string[] = []
  for (const s of sources) {
    if (s.group !== undefined && !seen.has(s.group)) {
      seen.add(s.group)
      order.push(s.group)
    }
  }
  return new Map(order.map((g, i) => [g, paletteColor(i)]))
}

// Merge adapter fields with the persisted layout, in layout order (or
// adapter order when no layout has been set yet). No subtree filter and no
// overlay-palette synthesis — this is what the edit dialog should see, so
// Submit only persists colors the user actually chose.
//
// Membership is reconciled against the current adapter sources: a saved layout
// is only an ordering/override hint, so entries whose source no longer exists
// are dropped and adapter sources the layout never saw (e.g. a subtrack added
// after the layout was saved) are appended in adapter order.
export function buildEditableSources(
  sourcesVolatile: SourceInfo[],
  layout: Source[],
): EditableSource[] {
  // Apply the `source` alias up front so the discovered rows are full
  // EditableSources; the persisted layout is a partial per-row override.
  return reconcileLayout(sourcesVolatile.map(withSourceAlias), layout)
}

// What the canvas/SVG renderers consume: editable sources after subtree
// filter, with color synthesis filling unset colors. Priority:
//   explicit user color > group-derived color > overlay index palette > undefined
// Group colors apply in every mode so samples from the same group always share
// a color, but in density they share it on the row label rather than the score
// ramp (see synthesizeColors). The overlay index palette fills remaining gaps
// only in overlay mode (existing behavior for tracks without groups).
//
// Synthesis runs over the full list and filterRowsBySubtree applies after, so a
// source's color is keyed to its position among all sources rather than among
// the survivors: focusing a clade in the tree hides rows without recoloring the
// ones it keeps, and the overlay legend a user just read stays valid. This is
// the ordering filterRowsBySubtree documents as hide-only.
export function buildSources(
  editableSources: Source[],
  subtreeFilter: readonly string[] | undefined,
  isOverlay: boolean,
  isDensityMode: boolean,
): Source[] {
  const groupColors = buildGroupColors(editableSources)
  return filterRowsBySubtree(
    editableSources.map((s, i) => ({
      ...s,
      ...synthesizeColors(s, i, isOverlay, isDensityMode, groupColors),
    })),
    subtreeFilter,
  )
}
