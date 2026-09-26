import { getConfigurationSchemaMetadata } from '../../configuration/schemaRegistry.ts'
import { slotValueRefusal } from '../../configuration/slotFacade.ts'
import { isPlainObject } from '../../util/objectUtils.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'

export interface DisplaySnapshot {
  type: string
  displayId?: string
  [key: string]: unknown
}

/**
 * What one display would do with a shorthand setting: the members it would
 * write, or why it will not take it. `undefined` means the display has no
 * member of that name and no retired spelling of one, so it is not a candidate
 * and the key is not its business.
 */
function verdictOf(
  schema: AnyConfigurationSchemaType,
  key: string,
  value: unknown,
) {
  const meta = getConfigurationSchemaMetadata(schema)
  const retired = meta?.options.retired?.[key]
  if (typeof retired === 'string') {
    return { refusal: `\`${key}\` is ${retired}` }
  }
  const members = retired
    ? retired(value)
    : meta?.definition[key]
      ? { [key]: value }
      : undefined
  // A lift answering nothing has not placed the value — a `colorBy` naming a
  // scheme this display never had, a `renderer` holding none of the props it
  // retired. That is the `unknownKeys` report, not a silent write of nothing.
  if (!members || Object.keys(members).length === 0) {
    return undefined
  }
  const refusal = Object.entries(members)
    .map(([name, member]) => slotValueRefusal(schema, name, member))
    .find(reason => reason !== undefined)
  return refusal === undefined ? { members } : { refusal }
}

/**
 * Route each shorthand `displayDefaults: {...}` setting to the display types
 * whose member of that name takes its value: `color: 'red'` reaches every
 * display with a colour, `color: { field: 'type' }` only those whose colour
 * maps a field, and a spelling a display retired reaches that display as the
 * members it became. A key no display knows is an `unknownKeys` entry, and one
 * every display that knows it refuses a `refused` entry carrying each reason.
 */
export function collectDisplayOverrides(
  displaySettings: Record<string, unknown>,
  displaySchemas: ReadonlyMap<string, AnyConfigurationSchemaType>,
) {
  // Seeded in the track type's own display order, which `mergeOverridesIntoDisplays`
  // appends a created entry in: a track's first display is the one it opens
  // with, and a shorthand setting only one display takes must not promote it.
  const overrides = new Map<string, Record<string, unknown>>()
  const unknownKeys: string[] = []
  const refused: { key: string; reasons: string[] }[] = []
  for (const [key, value] of Object.entries(displaySettings)) {
    const verdicts = [...displaySchemas].flatMap(([name, schema]) => {
      const verdict = verdictOf(schema, key, value)
      return verdict ? [{ name, ...verdict }] : []
    })
    const targets = verdicts.filter(v => v.members)
    if (verdicts.length === 0) {
      unknownKeys.push(key)
    } else if (targets.length === 0) {
      refused.push({
        key,
        reasons: verdicts.map(v => `${v.name}: ${v.refusal}`),
      })
    }
    for (const { name, members } of targets) {
      overrides.set(name, { ...overrides.get(name), ...members })
    }
  }
  return {
    overrides: new Map(
      [...displaySchemas.keys()]
        .filter(name => overrides.has(name))
        .map(name => [name, overrides.get(name)!]),
    ),
    unknownKeys,
    refused,
  }
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
