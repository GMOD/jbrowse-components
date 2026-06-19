// Back-compat migration for track config snapshots. Kept out of
// baseTrackConfig.ts so the schema definition stays free of legacy-format
// handling.

import type PluginManager from '../../PluginManager'

interface DisplayConfigSnapshot {
  type?: string
  [key: string]: unknown
}
interface TrackConfigSnapshot {
  displays?: DisplayConfigSnapshot[]
  [key: string]: unknown
}

// Registers a back-compat migration for a display's CONFIG snapshot that runs
// BEFORE the display `types.union` validates it.
//
// Use this — NOT a config-schema `preProcessSnapshot` — whenever the migration
// rewrites the VALUE of an existing constrained slot (enum rename, type narrow).
// A config-schema `preProcessSnapshot` does not run during union validation
// (the union tests the raw snapshot), so the union rejects the legacy value
// first and the migration never fires. A slot add/remove/rename, where the old
// data becomes an unknown extra prop, does NOT need this — the union ignores
// unknown props, so a config-schema `preProcessSnapshot` is fine there.
//
// Pass every type name the display answers to (canonical + aliases); this runs
// before alias normalization. `migrate` must be idempotent (it also fires via
// the config-schema `preProcessSnapshot` on a direct create).
export function addDisplayConfigMigration(
  pluginManager: PluginManager,
  displayTypes: string[],
  migrate: (displaySnap: Record<string, unknown>) => Record<string, unknown>,
) {
  const match = new Set(displayTypes)
  const matches = (d: DisplayConfigSnapshot) =>
    typeof d.type === 'string' && match.has(d.type)
  pluginManager.addToExtensionPoint<TrackConfigSnapshot>(
    'Core-preProcessTrackConfig',
    snap => {
      const { displays } = snap
      return Array.isArray(displays) && displays.some(matches)
        ? {
            ...snap,
            displays: displays.map(d => (matches(d) ? migrate(d) : d)),
          }
        : snap
    },
  )
}

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
