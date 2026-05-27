import { set1 as overlayColors } from '@jbrowse/core/ui/colors'

import type { Source, SourceInfo } from '../util.ts'

// Apply the overlay palette only to sources with no explicit color, in
// overlay mode. Explicit choice (user layout or adapter config) always wins,
// so the palette never overrides what the user picked.
export function pickColor(
  index: number,
  isOverlay: boolean,
  color: string | undefined,
) {
  if (color) {
    return color
  }
  return isOverlay ? overlayColors[index % overlayColors.length] : undefined
}

// Merge adapter fields with the persisted layout, in layout order (or
// adapter order when no layout has been set yet). No subtree filter and no
// overlay-palette synthesis — this is what the edit dialog should see, so
// Submit only persists colors the user actually chose.
export function buildEditableSources(
  sourcesVolatile: SourceInfo[],
  layout: Source[],
): Source[] {
  const adapterByName = new Map(sourcesVolatile.map(s => [s.name, s]))
  const base = layout.length ? layout : sourcesVolatile
  return base.map(s => ({
    source: s.name,
    ...adapterByName.get(s.name),
    ...s,
  }))
}

// What the canvas/SVG renderers consume: editable sources after subtree
// filter, with overlay-palette synthesis filling unset colors.
export function buildSources(
  editableSources: Source[],
  subtreeFilter: readonly string[] | undefined,
  isOverlay: boolean,
): Source[] {
  const filter = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  const base = filter
    ? editableSources.filter(s => filter.has(s.name))
    : editableSources
  return base.map((s, i) => ({
    ...s,
    color: pickColor(i, isOverlay, s.color),
  }))
}
