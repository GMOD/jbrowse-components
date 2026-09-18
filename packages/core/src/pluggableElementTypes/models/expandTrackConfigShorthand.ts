import { getConfigurationSchemaMetadata } from '../../configuration/schemaRegistry.ts'
import { slotValueRefusal } from '../../configuration/slotFacade.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'

export interface DisplaySnapshot {
  type: string
  displayId?: string
  [key: string]: unknown
}

function declares(schema: AnyConfigurationSchemaType, key: string) {
  return !!getConfigurationSchemaMetadata(schema)?.definition[key]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Route each shorthand `displayDefaults: {...}` setting to the display types
 * whose slot of that name takes its value, so slot names disambiguate across
 * displays (`color` → LinearVariantDisplay, `strokeColor` →
 * ChordVariantDisplay) and so do the values: `displayMode: 'compact'` on a
 * FeatureTrack reaches the feature display and not the arc display, whose
 * `displayMode` is `arcs | semicircles`. A key no display declares is an `unknownKeys`
 * entry, and one every declaring display refuses a `refused` entry carrying
 * each display's reason.
 */
export function collectDisplayOverrides(
  displaySettings: Record<string, unknown>,
  displaySchemas: ReadonlyMap<string, AnyConfigurationSchemaType>,
) {
  const overrides = new Map<string, Record<string, unknown>>()
  const unknownKeys: string[] = []
  const refused: { key: string; reasons: string[] }[] = []
  for (const [key, value] of Object.entries(displaySettings)) {
    const verdicts = [...displaySchemas]
      .filter(([, schema]) => declares(schema, key))
      .map(([name, schema]) => ({
        name,
        refusal: slotValueRefusal(schema, key, value),
      }))
    const targets = verdicts.filter(v => v.refusal === undefined)
    if (verdicts.length === 0) {
      unknownKeys.push(key)
    } else if (targets.length === 0) {
      refused.push({
        key,
        reasons: verdicts.map(v => `${v.name}: ${v.refusal}`),
      })
    }
    for (const { name } of targets) {
      overrides.set(name, { ...overrides.get(name), [key]: value })
    }
  }
  return { overrides, unknownKeys, refused }
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
 * each setting to the display type(s) whose slot takes it, folding them into
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

  const { overrides, unknownKeys, refused } = collectDisplayOverrides(
    shorthand,
    new Map(trackType.displayTypes.map(d => [d.name, d.configSchema])),
  )
  for (const key of unknownKeys) {
    console.warn(
      `Track "${trackId}": display setting "${key}" is not a slot on any display of a ${type}`,
    )
  }
  if (refused.length > 0) {
    throw new Error(
      refused
        .map(
          ({ key, reasons }) =>
            `Track "${trackId}": no display of a ${type} takes displayDefaults.${key} (${reasons.join('; ')})`,
        )
        .join('\n'),
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
