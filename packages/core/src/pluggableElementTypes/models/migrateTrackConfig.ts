// Back-compat migration for track config snapshots. Kept out of
// baseTrackConfig.ts so the schema definition stays free of legacy-format
// handling.

import type PluginManager from '../../PluginManager'

// #region registry
interface DisplayConfigSnapshot {
  type?: string
  [key: string]: unknown
}
export interface TrackConfigSnapshot {
  displays?: DisplayConfigSnapshot[]
  [key: string]: unknown
}

// A data transform, not a component fold: each callback receives the previous
// callback's rewritten snapshot. The snapshot is already a defensive clone at
// both fire sites, so a callback may return a mutated `snap` as well as a new
// object.
declare module '../../PluginManager.ts' {
  interface ExtensionPointRegistry {
    'Core-preProcessTrackConfig': {
      args: TrackConfigSnapshot
      result: TrackConfigSnapshot
    }
  }
}
// #endregion

const isBareEntry = (entry: DisplayConfigSnapshot) =>
  Object.keys(entry).every(k => k === 'type' || k === 'displayId')

interface Migrated {
  entry: DisplayConfigSnapshot
  type?: string
  rank: number
}

/**
 * Loads each display entry a retired type names as the display it retired
 * into, and rewrites every entry's retired slot values, as each DisplayType's
 * `retiredTypes` and `retiredConfig` declare. Runs on the track config before
 * the `Core-preProcessTrackConfig` handlers, which read the current names, and
 * before the display union, which refuses a retired value where a schema's own
 * `preProcessSnapshot` never runs.
 *
 * Entries that collapse onto one type become one: an entry written for this
 * display beats one written for a retired type, a bare `{ type, displayId }`
 * stub yields to either, and among equals the first wins. The survivor takes
 * the first one's place and id, so the default display and the references a
 * session holds stay where they were.
 */
export function migrateRetiredDisplays(
  pluginManager: PluginManager,
  snap: TrackConfigSnapshot,
): TrackConfigSnapshot {
  const { displays, trackId } = snap
  if (!Array.isArray(displays) || displays.length === 0) {
    return snap
  }
  const elements = pluginManager.getDisplayElements()
  const byName = new Map(elements.map(d => [d.name, d]))
  const byRetiredName = new Map(
    elements.flatMap(d => d.retiredTypes.map(r => [r.type, { d, r }] as const)),
  )
  const migrated = displays.map((entry): Migrated => {
    const type = entry.type
    const retired = type === undefined ? undefined : byRetiredName.get(type)
    const display = retired?.d ?? (type ? byName.get(type) : undefined)
    if (!display) {
      return { entry, rank: 0 }
    }
    let next = entry
    if (retired) {
      const { displayId } = entry
      next = {
        ...(retired.r.migrate?.(entry) ?? entry),
        type: display.name,
        ...(displayId === undefined
          ? {}
          : {
              displayId:
                displayId === `${String(trackId)}-${type}`
                  ? `${String(trackId)}-${display.name}`
                  : displayId,
            }),
      }
    }
    next = display.retiredConfig?.(next) ?? next
    return {
      entry: next,
      type: display.name,
      rank: isBareEntry(entry) ? 1 : retired ? 2 : 3,
    }
  })
  if (
    migrated.every(
      (m, i) => m.entry === displays[i] && m.type === displays[i].type,
    ) &&
    new Set(migrated.map(m => m.type)).size === migrated.length
  ) {
    return snap
  }
  const winners = new Map<string, Migrated>()
  for (const m of migrated) {
    const best = m.type === undefined ? undefined : winners.get(m.type)
    if (m.type !== undefined && (!best || m.rank > best.rank)) {
      winners.set(m.type, m)
    }
  }
  const placed = new Set<string>()
  return {
    ...snap,
    displays: migrated.flatMap(m => {
      if (m.type === undefined) {
        return [m.entry]
      }
      if (placed.has(m.type)) {
        return []
      }
      placed.add(m.type)
      const winner = winners.get(m.type)!
      const displayId = m.entry.displayId ?? winner.entry.displayId
      return [
        winner === m || displayId === undefined
          ? winner.entry
          : { ...winner.entry, displayId },
      ]
    }),
  }
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
