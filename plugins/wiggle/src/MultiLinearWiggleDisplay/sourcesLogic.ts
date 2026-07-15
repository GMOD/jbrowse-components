import { set1 as overlayColors } from '@jbrowse/core/ui/colors'
import { reconcileLayout } from '@jbrowse/tree-sidebar'

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

// Synthesized color for a source with no explicit color. Priority mirrors the
// buildSources doc-comment: group-derived color, then the overlay index palette
// (overlay mode only), then undefined so the renderer falls back to its default.
function synthesizeColor(
  s: Source,
  index: number,
  isOverlay: boolean,
  groupColors: Map<string, string>,
) {
  if (s.group !== undefined) {
    return groupColors.get(s.group)
  }
  return isOverlay ? paletteColor(index) : undefined
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
// Group colors apply in both row and overlay mode so samples from the same
// group always share a color. The overlay index palette fills remaining gaps
// only in overlay mode (existing behavior for tracks without groups).
export function buildSources(
  editableSources: Source[],
  subtreeFilter: readonly string[] | undefined,
  isOverlay: boolean,
): Source[] {
  const filter = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  const base = filter
    ? editableSources.filter(s => filter.has(s.name))
    : editableSources
  const groupColors = buildGroupColors(base)
  return base.map((s, i) => ({
    ...s,
    color: s.color ?? synthesizeColor(s, i, isOverlay, groupColors),
  }))
}
