import {
  mergeConfSettings,
  writesWholeAt,
} from '../../configuration/getConf.ts'
import { getConfigurationSchemaMetadata } from '../../configuration/schemaRegistry.ts'
import { isBareConfigurationSchemaType } from '../../configuration/schemaTypes.ts'
import { slotValueRefusal } from '../../configuration/slotFacade.ts'
import { membersDeclaredBy } from '../../configuration/snapshotPreprocess.ts'
import { isPlainObject } from '../../util/objectUtils.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'

export interface DisplaySnapshot {
  type: string
  displayId?: string
  [key: string]: unknown
}

/**
 * The members of `value` a display's namespace slot `key` declares, or
 * undefined where the slot is no namespace or `value` no object: a namespace
 * takes those members and leaves the rest to its sibling displays.
 */
function namespaceMembers(
  schema: AnyConfigurationSchemaType,
  key: string,
  value: unknown,
) {
  const meta = getConfigurationSchemaMetadata(schema)
  const entry = meta?.definition[key]
  return isBareConfigurationSchemaType(entry) &&
    !writesWholeAt(schema, [key]) &&
    isPlainObject(value)
    ? membersDeclaredBy(entry, value)
    : undefined
}

/**
 * What one display would do with a shorthand setting: the members it would
 * write, or why it will not take it, and for a namespace the members of the
 * value it declares. `undefined` means the display has no member of that name
 * and no retired spelling of one, so it is not a candidate and the key is not
 * its business.
 */
function verdictOf(
  schema: AnyConfigurationSchemaType,
  key: string,
  value: unknown,
) {
  const meta = getConfigurationSchemaMetadata(schema)
  const retired = meta?.options.retired?.[key]
  const declares = retired ? undefined : namespaceMembers(schema, key, value)
  if (declares?.length === 0) {
    return { declares }
  }
  const placed =
    declares && isPlainObject(value)
      ? Object.fromEntries(declares.map(member => [member, value[member]]))
      : value
  let members
  try {
    members = retired
      ? retired(value)
      : meta?.definition[key]
        ? { [key]: placed }
        : undefined
  } catch (e) {
    return { refusal: e instanceof Error ? e.message : String(e) }
  }
  // A lift answering nothing has not placed the value — a `colorBy` naming a
  // scheme this display never had, a `renderer` holding none of the props it
  // retired. That is the `unknownKeys` report, not a silent write of nothing.
  if (!members || Object.keys(members).length === 0) {
    return undefined
  }
  const refusal = Object.entries(members)
    .map(([name, member]) => slotValueRefusal(schema, name, member))
    .find(reason => reason !== undefined)
  return refusal === undefined ? { members, declares } : { refusal, declares }
}

/**
 * Route each shorthand `displayDefaults: {...}` setting to the display types
 * whose member of that name takes its value: `color: 'red'` reaches every
 * display with a color, `color: { field: 'type' }` only those whose color
 * maps a field, and a spelling a display retired reaches that display as the
 * members it became. A namespace's object splits by member, so each display
 * gets the members its namespace declares. `reached` names the displays each
 * key went to. A key, or a namespace member, no display knows is an
 * `unknownKeys` entry, and one every display that knows it refuses a
 * `refused` entry carrying each reason.
 */
export function collectDisplayOverrides(
  displaySettings: Record<string, unknown>,
  displaySchemas: ReadonlyMap<string, AnyConfigurationSchemaType>,
) {
  const overrides = new Map<string, Record<string, unknown>>()
  const reached = new Map<string, string[]>()
  const unknownKeys: string[] = []
  const refused: { key: string; reasons: string[] }[] = []
  for (const [key, value] of Object.entries(displaySettings)) {
    const verdicts = [...displaySchemas].flatMap(([name, schema]) => {
      const verdict = verdictOf(schema, key, value)
      return verdict ? [{ name, ...verdict }] : []
    })
    const targets = verdicts.filter(v => v.members)
    const refusals = verdicts.filter(v => v.refusal !== undefined)
    const split = verdicts.filter(v => v.declares)
    if (verdicts.length === 0) {
      unknownKeys.push(key)
    } else if (targets.length === 0 && refusals.length > 0) {
      refused.push({
        key,
        reasons: refusals.map(v => `${v.name}: ${v.refusal}`),
      })
    }
    if (
      isPlainObject(value) &&
      split.length > 0 &&
      !targets.some(t => !t.declares)
    ) {
      unknownKeys.push(
        ...Object.keys(value)
          .filter(member => !split.some(v => v.declares?.includes(member)))
          .map(member => `${key}.${member}`),
      )
    }
    for (const { name, members } of targets) {
      overrides.set(
        name,
        mergeConfSettings(
          displaySchemas.get(name),
          overrides.get(name) ?? {},
          members ?? {},
        ),
      )
    }
    reached.set(
      key,
      targets.map(t => t.name),
    )
  }
  return { overrides, reached, unknownKeys, refused }
}

/**
 * Fold per-display override props into the entries a `displays` array already
 * has; explicit props win, member by member inside a namespace such as an
 * alignments band. A display with no entry gets none: a setting never adds a
 * display to a track.
 */
export function mergeOverridesIntoDisplays(
  displays: DisplaySnapshot[],
  overrides: Map<string, Record<string, unknown>>,
  displaySchemas: ReadonlyMap<string, AnyConfigurationSchemaType>,
): DisplaySnapshot[] {
  return displays.map(
    d =>
      mergeConfSettings(
        displaySchemas.get(d.type),
        overrides.get(d.type) ?? {},
        d,
      ) as DisplaySnapshot,
  )
}

/**
 * Expands the shorthand `displayDefaults` **object** into the explicit `displays`
 * **array**, so users can set display settings without naming the display type
 * or nesting in `displays:[{type,...}]`. `displayDefaults:{color:'green'}` routes
 * each setting to the display type(s) whose slot takes it, folding them into
 * the entries the `displays` array has (explicit props win). A key whose every
 * taker is missing from the array, a display the track's adapter cannot feed,
 * is reported rather than giving the track that display.
 *
 * `displayDefaults` is kept separate from `displays` (rather than overloading
 * `displays` by shape) so a config using it still loads in a JBrowse version
 * that predates the feature — the unknown key is ignored, instead of crashing
 * when the array-typed `displays` slot receives an object.
 *
 * Runs inside `baseTrackConfig.preProcessSnapshot`, after display-stub
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

  const displaySchemas = new Map(
    trackType.displayTypes.map(d => [d.name, d.configSchema]),
  )
  const { overrides, reached, unknownKeys, refused } = collectDisplayOverrides(
    shorthand,
    displaySchemas,
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
  const listed = new Set(displays.map(d => d.type))
  for (const [key, names] of reached) {
    if (names.length > 0 && !names.some(name => listed.has(name))) {
      console.warn(
        `Track "${trackId}": displayDefaults.${key} reaches only ${names.join(', ')}, which its adapter cannot feed`,
      )
    }
  }
  return {
    ...rest,
    displays: mergeOverridesIntoDisplays(displays, overrides, displaySchemas),
  }
}
