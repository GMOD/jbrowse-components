import { set1 as overlayColors } from '@jbrowse/core/ui/colors'

import type { EditableSource, Source, SourceInfo } from '../util.ts'

// Apply the overlay palette only to sources with no explicit color, in
// overlay mode. Explicit choice (user layout or adapter config) always wins,
// so the palette never overrides what the user picked.
export function pickColor(
  index: number,
  isOverlay: boolean,
  color: string | undefined,
) {
  return (
    color ??
    (isOverlay ? overlayColors[index % overlayColors.length] : undefined)
  )
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
  if (!layout.length) {
    return sourcesVolatile.map(s => ({ ...s, source: s.name }))
  }
  const adapterByName = new Map(sourcesVolatile.map(s => [s.name, s]))
  const laidOut = layout.flatMap(s => {
    const info = adapterByName.get(s.name)
    return info ? [{ ...info, ...s }] : []
  })
  const inLayout = new Set(layout.map(s => s.name))
  const appended = sourcesVolatile
    .filter(s => !inLayout.has(s.name))
    .map(s => ({ ...s, source: s.name }))
  return [...laidOut, ...appended]
}

// What the canvas/SVG renderers consume: editable sources after subtree
// filter, with overlay-palette synthesis filling unset colors. Palette index
// is the post-filter position, so the visible rows always get the most
// distinct hues (set1[0], set1[1], …) — see the re-index test.
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
