// Back-compat migration for track config snapshots. Kept out of
// baseTrackConfig.ts so the schema definition stays free of legacy-format
// handling.

export interface LegacyDisplaySnapshot {
  type: string
  displayId?: string
  renderer?: { type: string; height?: unknown; [key: string]: unknown }
  [key: string]: unknown
}

// The GPU rewrite removed the per-display `renderer` sub-config (which carried
// color/height/etc.). Old configs still nest those values under `renderer`, so
// lift the renderer's props up onto the display, with `renderer.height`
// becoming the display's `featureHeight`. Also injects the `${trackId}-${type}`
// displayId fallback for displays that predate the identifier.
export function liftLegacyRendererConfig(
  d: LegacyDisplaySnapshot,
  trackId: string,
) {
  const displayId = d.displayId ?? `${trackId}-${d.type}`
  const { renderer, ...rest } = d
  if (renderer) {
    const {
      type: _rendererType,
      height: rendererHeight,
      ...rendererProps
    } = renderer
    return {
      ...rendererProps,
      ...(rendererHeight !== undefined
        ? { featureHeight: rendererHeight }
        : undefined),
      ...rest,
      displayId,
    }
  } else {
    return { ...rest, displayId }
  }
}
