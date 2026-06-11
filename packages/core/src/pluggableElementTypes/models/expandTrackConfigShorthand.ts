import { getConfigurationSchemaMetadata } from '../../configuration/schemaRegistry.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'

export interface DisplaySnapshot {
  type: string
  displayId?: string
  [key: string]: unknown
}

// Minimal structural shape of a registered track type — lets the pure helpers be
// exercised with plain fakes instead of a booted PluginManager.
interface DisplayTypeLike {
  name: string
  viewType: string
  configSchema: AnyConfigurationSchemaType
}
interface TrackTypeLike {
  configSchema: AnyConfigurationSchemaType
  displayTypes: DisplayTypeLike[]
}

export interface TrackDisplayInfo {
  /** config slot names defined on the track itself */
  trackSlots: Set<string>
  /** display type name → its config slot names */
  displaySlots: Map<string, Set<string>>
  /** view type name → its display type names, in registration order */
  viewToDisplays: Map<string, string[]>
  /** view type name → its curated shorthand abbreviation, when declared */
  viewAbbreviations: Map<string, string>
}

// Structural track keys that are never display overrides.
const RESERVED_TRACK_KEYS = new Set(['trackId', 'type', 'displays'])

function schemaSlotNames(schema: AnyConfigurationSchemaType) {
  const meta = getConfigurationSchemaMetadata(schema)
  return new Set(meta ? Object.keys(meta.definition) : [])
}

// 'LinearGenomeView' → 'lgv', 'CircularGenomeView' → 'cgv'
function acronym(name: string) {
  return (name.match(/[A-Z]/g) ?? []).join('').toLowerCase()
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Resolve a shorthand key to a view type by exact name, lowercased name, the
 * view's declared abbreviation, or its capital-letter acronym.
 */
export function matchViewKey(
  key: string,
  views: Iterable<{ name: string; abbreviation?: string }>,
) {
  for (const { name, abbreviation } of views) {
    if (
      key === name ||
      key === name.toLowerCase() ||
      key === abbreviation ||
      key === acronym(name)
    ) {
      return name
    }
  }
  return undefined
}

/**
 * Read the slot/view/display layout of a track type from its registered schemas.
 * `getViewAbbreviation` supplies each view's curated shorthand alias (the
 * orchestrator passes one backed by the PluginManager's view types).
 */
export function describeTrackDisplays(
  trackType: TrackTypeLike,
  getViewAbbreviation: (viewName: string) => string | undefined = () =>
    undefined,
): TrackDisplayInfo {
  const displaySlots = new Map<string, Set<string>>()
  const viewToDisplays = new Map<string, string[]>()
  const viewAbbreviations = new Map<string, string>()
  for (const d of trackType.displayTypes) {
    displaySlots.set(d.name, schemaSlotNames(d.configSchema))
    const arr = viewToDisplays.get(d.viewType) ?? []
    arr.push(d.name)
    viewToDisplays.set(d.viewType, arr)
    const abbreviation = getViewAbbreviation(d.viewType)
    if (abbreviation) {
      viewAbbreviations.set(d.viewType, abbreviation)
    }
  }
  return {
    trackSlots: schemaSlotNames(trackType.configSchema),
    displaySlots,
    viewToDisplays,
    viewAbbreviations,
  }
}

/**
 * Pure: scan a track snapshot's top-level keys and bucket the shorthand ones
 * into per-display-type override props. Recognizes two forms:
 *
 * - view-scoped object — `lgv: { color }` → primary display for that view
 * - flat display slot — `color: 'green'` → every display defining that slot
 *
 * Returns the overrides, the keys to strip from the top level, and any
 * unrecognized keys (typos) for the caller to surface.
 */
export function collectShorthandOverrides(
  snap: Record<string, unknown>,
  info: TrackDisplayInfo,
) {
  const overrides = new Map<string, Record<string, unknown>>()
  const consumed = new Set<string>()
  const unknownKeys: string[] = []
  function addOverride(name: string, props: Record<string, unknown>) {
    overrides.set(name, { ...overrides.get(name), ...props })
  }

  const views = [...info.viewToDisplays.keys()].map(name => ({
    name,
    abbreviation: info.viewAbbreviations.get(name),
  }))
  for (const [key, value] of Object.entries(snap)) {
    if (RESERVED_TRACK_KEYS.has(key) || info.trackSlots.has(key)) {
      continue
    }
    const viewType = matchViewKey(key, views)
    const primaryDisplay = viewType
      ? info.viewToDisplays.get(viewType)?.[0]
      : undefined
    const displaysWithSlot = [...info.displaySlots]
      .filter(([, slots]) => slots.has(key))
      .map(([name]) => name)

    if (primaryDisplay && isPlainObject(value)) {
      addOverride(primaryDisplay, value)
      consumed.add(key)
    } else if (displaysWithSlot.length) {
      for (const name of displaysWithSlot) {
        addOverride(name, { [key]: value })
      }
      consumed.add(key)
    } else {
      unknownKeys.push(key)
    }
  }
  return { overrides, consumed, unknownKeys }
}

/**
 * Pure: fold per-display override props into a `displays` array, creating an
 * entry (with a derived displayId) for any display type not already present.
 * Explicit entries in the existing array win over shorthand on conflict.
 */
export function mergeOverridesIntoDisplays(
  displays: DisplaySnapshot[],
  overrides: Map<string, Record<string, unknown>>,
  trackId: string,
): DisplaySnapshot[] {
  const seen = new Set<string>()
  const merged = displays.map(d => {
    seen.add(d.type)
    return { ...overrides.get(d.type), ...d }
  })
  for (const [name, props] of overrides) {
    if (!seen.has(name)) {
      merged.push({ type: name, displayId: `${trackId}-${name}`, ...props })
    }
  }
  return merged
}

/**
 * Expands track-config shorthand into the explicit `displays` array so users can
 * set display settings at the track level instead of nesting them in
 * `displays:[{type, ...}]` and remembering the display type name. Both shorthand
 * forms compose with an explicit `displays` array (explicit entries win).
 *
 * Runs inside `baseTrackConfig.preProcessSnapshot`, before display-stub
 * injection. Takes/returns the loosely-typed snapshot (as `evaluateExtensionPoint`
 * does) — the caller casts the result to its snapshot type for validation.
 */
export function expandTrackConfigShorthand(
  input: unknown,
  pluginManager: PluginManager,
): unknown {
  if (!isPlainObject(input)) {
    return input
  }
  const snap = input
  const type = typeof snap.type === 'string' ? snap.type : undefined
  const trackId = typeof snap.trackId === 'string' ? snap.trackId : undefined
  if (!type || !trackId || trackId === 'placeholderId') {
    return snap
  }
  // getTrackType throws on an unknown type; let downstream emit its detailed
  // "Unknown track type" error rather than masking it here.
  let trackType
  try {
    trackType = pluginManager.getTrackType(type)
  } catch {
    return snap
  }
  if (!trackType.displayTypes.length) {
    return snap
  }

  // getViewType throws on an unknown/unloaded view; treat that as "no
  // abbreviation" rather than failing the whole snapshot.
  function viewAbbreviation(viewName: string) {
    try {
      return pluginManager.getViewType(viewName).abbreviation
    } catch {
      return undefined
    }
  }
  const { overrides, consumed, unknownKeys } = collectShorthandOverrides(
    snap,
    describeTrackDisplays(trackType, viewAbbreviation),
  )
  for (const key of unknownKeys) {
    console.warn(
      `Track "${trackId}": ignoring unrecognized config key "${key}" (not a track slot, a display slot, or a view shorthand)`,
    )
  }
  if (!overrides.size) {
    return snap
  }

  const existing = Array.isArray(snap.displays)
    ? (snap.displays as DisplaySnapshot[])
    : []
  const result: Record<string, unknown> = {
    displays: mergeOverridesIntoDisplays(existing, overrides, trackId),
  }
  for (const [key, value] of Object.entries(snap)) {
    if (!consumed.has(key) && key !== 'displays') {
      result[key] = value
    }
  }
  return result
}
