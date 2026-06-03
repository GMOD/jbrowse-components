// Pre-flatten LinearArcDisplay configs nested the arc style slots under an
// `ArcRenderer` renderer, back when the display rendered server-side via blocks.
// This hoists those slots onto the display config and drops the renderer.
// `renderer.height` becomes `arcHeight` so it doesn't collide with the base
// track `height` slot.
const HOISTED_SLOTS = new Set([
  'color',
  'thickness',
  'label',
  'caption',
  'displayMode',
])

export function migrateLegacyArcRendererConfig(
  snap: Record<string, unknown>,
): Record<string, unknown> {
  const { renderer, ...rest } = snap
  if (renderer && typeof renderer === 'object') {
    const hoisted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(renderer)) {
      if (key === 'height') {
        hoisted.arcHeight = value
      } else if (HOISTED_SLOTS.has(key)) {
        hoisted[key] = value
      }
    }
    return { ...rest, ...hoisted }
  } else {
    return snap
  }
}

// Back-compat for the display state model: the explicit display-mode field was
// renamed from the bare `displayMode` to `displayModeOverride`.
export function migrateArcSnapshot(snap: Record<string, unknown> | undefined) {
  if (
    snap?.displayMode !== undefined &&
    snap.displayModeOverride === undefined
  ) {
    const { displayMode, ...rest } = snap
    return { ...rest, displayModeOverride: displayMode }
  }
  return snap
}
