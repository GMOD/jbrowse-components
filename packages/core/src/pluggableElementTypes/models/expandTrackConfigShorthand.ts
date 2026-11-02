import {
  mergeConfSettings,
  writesByMember,
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

// A sub-schema a bag writes member by member, rather than whole
function isNamespace(entry: unknown): entry is AnyConfigurationSchemaType {
  return isBareConfigurationSchemaType(entry) && writesByMember(entry)
}

// The dotted paths into `value` the namespace `entry` declares, at any depth:
// a member that is itself a namespace, written with members, takes only the
// members it declares, so
// `rows.axis.grid` reaches the displays whose axis has a grid and
// `rows.axis.tree` every display with a tree.
function declaredPaths(
  entry: AnyConfigurationSchemaType,
  value: Record<string, unknown>,
): string[] {
  const definition = getConfigurationSchemaMetadata(entry)?.definition ?? {}
  return membersDeclaredBy(entry, value).flatMap(member => {
    const sub = definition[member]
    const memberValue = value[member]
    return isNamespace(sub) &&
      isPlainObject(memberValue) &&
      Object.keys(memberValue).length > 0
      ? declaredPaths(sub, memberValue).map(path => `${member}.${path}`)
      : [member]
  })
}

// `value` cut down to `paths`
function picked(
  value: Record<string, unknown>,
  paths: readonly string[],
): Record<string, unknown> {
  const heads = [...new Set(paths.map(path => path.split('.')[0]!))]
  return Object.fromEntries(
    heads.map(head => {
      const inner = paths
        .filter(path => path.startsWith(`${head}.`))
        .map(path => path.slice(head.length + 1))
      const memberValue = value[head]
      return [
        head,
        inner.length > 0 && isPlainObject(memberValue)
          ? picked(memberValue, inner)
          : memberValue,
      ]
    }),
  )
}

// Every path to a leaf of `value`, a list or a scalar
function leafPaths(value: Record<string, unknown>): string[] {
  return Object.entries(value).flatMap(([member, memberValue]) =>
    isPlainObject(memberValue) && Object.keys(memberValue).length > 0
      ? leafPaths(memberValue).map(path => `${member}.${path}`)
      : [member],
  )
}

/**
 * The paths into `value` a display's namespace slot `key` declares, at any
 * depth, or undefined where the slot is no namespace or `value` no object: a
 * namespace takes those and leaves the rest to its sibling displays.
 */
function namespaceMembers(
  schema: AnyConfigurationSchemaType,
  key: string,
  value: unknown,
) {
  const entry = getConfigurationSchemaMetadata(schema)?.definition[key]
  return isNamespace(entry) && isPlainObject(value)
    ? declaredPaths(entry, value)
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
    declares && isPlainObject(value) ? picked(value, declares) : value
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
      const declared = split.flatMap(v => v.declares ?? [])
      unknownKeys.push(
        ...leafPaths(value)
          .filter(
            leaf =>
              !declared.some(
                path => leaf === path || leaf.startsWith(`${path}.`),
              ),
          )
          .map(leaf => `${key}.${leaf}`),
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

// The path the `misnamed` of the sub-schema holding a dotted key's last member
// names for it, from the display: `rowHeight` to `rows.step`, and
// `rows.height` too.
function misnamedTargetOf(schema: AnyConfigurationSchemaType, key: string) {
  const members = key.split('.')
  const last = members.pop() ?? ''
  let meta = getConfigurationSchemaMetadata(schema)
  for (const member of members) {
    const entry = meta?.definition[member]
    meta =
      entry !== undefined && isBareConfigurationSchemaType(entry)
        ? getConfigurationSchemaMetadata(entry)
        : undefined
  }
  const target = meta?.options.misnamed?.[last]
  return target === undefined ? undefined : [...members, target].join('.')
}

/**
 * What a `displayDefaults` key no display takes points at, where a candidate
 * display's `misnamed` names it: ` — did you mean rows.step?`.
 */
export function misnamedPointerOf(
  key: string,
  displaySchemas: ReadonlyMap<string, AnyConfigurationSchemaType>,
) {
  const targets = [
    ...new Set(
      [...displaySchemas.values()].flatMap(schema => {
        const target = misnamedTargetOf(schema, key)
        return target === undefined ? [] : [target]
      }),
    ),
  ]
  return targets.length > 0 ? ` — did you mean ${targets.join(' or ')}?` : ''
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
 * the entries the `displays` array has (explicit props win). A `type` naming
 * one of the track's displays routes every setting to that display alone. A key whose every
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

  const { type: only, ...settings } = shorthand
  const offered = trackType.displayTypes.map(d => d.name)
  if (only !== undefined && !offered.includes(only as string)) {
    throw new Error(
      `Track "${trackId}": displayDefaults.type ${JSON.stringify(only)} is not a display of a ${type}, which offers ${offered.join(', ')}`,
    )
  }
  const displaySchemas = new Map(
    trackType.displayTypes
      .filter(d => only === undefined || d.name === only)
      .map(d => [d.name, d.configSchema]),
  )
  const { overrides, reached, unknownKeys, refused } = collectDisplayOverrides(
    settings,
    displaySchemas,
  )
  for (const key of unknownKeys) {
    console.warn(
      `Track "${trackId}": display setting "${key}" is not a slot on any display of a ${type}${misnamedPointerOf(key, displaySchemas)}`,
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
