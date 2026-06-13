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

// Build a group→color map in first-appearance order so every source in the
// same group shares a palette entry regardless of display mode.
function buildGroupColors(sources: readonly Source[]): Map<string, string> {
  const seen = new Set<string>()
  const order: string[] = []
  for (const s of sources) {
    if (s.group !== undefined && !seen.has(s.group)) {
      seen.add(s.group)
      order.push(s.group)
    }
  }
  return new Map(
    order.map((g, i) => [g, overlayColors[i % overlayColors.length]!]),
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
  const groupColors = base.some(s => s.group !== undefined)
    ? buildGroupColors(base)
    : undefined
  return base.map((s, i) => ({
    ...s,
    color:
      s.color !== undefined
        ? s.color
        : s.group !== undefined
          ? groupColors!.get(s.group)
          : isOverlay
            ? overlayColors[i % overlayColors.length]
            : undefined,
  }))
}
