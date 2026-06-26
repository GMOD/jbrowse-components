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
  configSchema: AnyConfigurationSchemaType
}
interface TrackTypeLike {
  displayTypes: DisplayTypeLike[]
}

function schemaSlotNames(schema: AnyConfigurationSchemaType) {
  const meta = getConfigurationSchemaMetadata(schema)
  return new Set(meta ? Object.keys(meta.definition) : [])
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** display type name → its config slot names, for one track type. */
export function trackDisplaySlots(trackType: TrackTypeLike) {
  const displaySlots = new Map<string, Set<string>>()
  for (const d of trackType.displayTypes) {
    displaySlots.set(d.name, schemaSlotNames(d.configSchema))
  }
  return displaySlots
}

/**
 * Pure: route each shorthand `displayDefaults: {...}` setting to the display
 * types that define it. A setting goes to every display type whose config schema
 * has that slot, so slot names disambiguate across displays on their own (e.g.
 * `color` → LinearVariantDisplay, `strokeColor` → ChordVariantDisplay). Keys no
 * display defines are returned as `unknownKeys` for the caller to surface.
 */
export function collectDisplayOverrides(
  displaySettings: Record<string, unknown>,
  displaySlots: Map<string, Set<string>>,
) {
  const overrides = new Map<string, Record<string, unknown>>()
  const unknownKeys: string[] = []
  for (const [key, value] of Object.entries(displaySettings)) {
    const targets = [...displaySlots]
      .filter(([, slots]) => slots.has(key))
      .map(([name]) => name)
    if (targets.length) {
      for (const name of targets) {
        overrides.set(name, { ...overrides.get(name), [key]: value })
      }
    } else {
      unknownKeys.push(key)
    }
  }
  return { overrides, unknownKeys }
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
 * Expands the shorthand `displayDefaults` **object** into the explicit `displays`
 * **array**, so users can set display settings without naming the display type
 * or nesting in `displays:[{type,...}]`. `displayDefaults:{color:'green'}` routes
 * each setting to the display type(s) that define that slot, folding them into
 * whatever `displays` array the track already has (explicit entries win).
 *
 * `displayDefaults` is kept separate from `displays` (rather than overloading
 * `displays` by shape) so a config using it still loads in a JBrowse version
 * that predates the feature — the unknown key is ignored, instead of crashing
 * when the array-typed `displays` slot receives an object.
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
  // `rest` is the snapshot without the consumed shorthand key, so the expanded
  // result never carries `displayDefaults` forward.
  const { displayDefaults: shorthand, ...rest } = input
  const snap = input
  const type = typeof snap.type === 'string' ? snap.type : undefined
  const trackId = typeof snap.trackId === 'string' ? snap.trackId : undefined
  if (
    !isPlainObject(shorthand) ||
    !type ||
    !trackId ||
    trackId === 'placeholderId'
  ) {
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

  const { overrides, unknownKeys } = collectDisplayOverrides(
    shorthand,
    trackDisplaySlots(trackType),
  )
  for (const key of unknownKeys) {
    console.warn(
      `Track "${trackId}": display setting "${key}" is not a slot on any display of a ${type}`,
    )
  }

  const displays = Array.isArray(rest.displays)
    ? (rest.displays as DisplaySnapshot[])
    : []
  return {
    ...rest,
    displays: mergeOverridesIntoDisplays(displays, overrides, trackId),
  }
}
