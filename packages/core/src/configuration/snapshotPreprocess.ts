import { isJexl } from '../util/jexlStrings.ts'
import { isPlainObject } from '../util/objectUtils.ts'
import { slotWriteRefusal } from './configurationSlot.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  bareFormOf,
  isBareConfigurationSchemaType,
  isConstantEntry,
  shorthandTargets,
} from './schemaTypes.ts'

import type { RetiredMembers, RetiredSpelling } from './configurationSchema.ts'
import type { ConfigurationSchemaMetadata } from './schemaRegistry.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

// the keys a config file may annotate any object with, as the JSON schema's
// `patternProperties` admits them
const COMMENT_KEY = /^_+comment/

export function listed(keys: readonly string[]) {
  return keys.length > 1
    ? `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}`
    : (keys[0] ?? 'nothing')
}

function declaredKeys({ definition, options }: ConfigurationSchemaMetadata) {
  const id = options.explicitIdentifier
  return [
    ...Object.keys(definition).filter(key => !isConstantEntry(definition[key])),
    ...(options.explicitlyTyped ? ['type'] : []),
    ...(id ? [id] : []),
  ]
}

const warned = new Set<string>()

let writes = 0

/**
 * #api core/configuration
 * Runs `write` as a write: a `closed` schema created inside it refuses a key
 * it does not declare, at any depth, where a config loading only names the
 * key on the console. `setConf`, a settings bag and a plot draft write this
 * way, so a typo in an edit is an error and a config written for another
 * version still draws.
 */
export function refusingUndeclaredKeys<T>(write: () => T) {
  writes++
  try {
    return write()
  } finally {
    writes--
  }
}

function checkUndeclaredKeys(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
) {
  const { name, options } = schema
  const declared = declaredKeys(schema)
  const bare =
    snapshot !== undefined &&
    (typeof snapshot !== 'object' || Array.isArray(snapshot))
  const unknown = bare
    ? [JSON.stringify(snapshot)]
    : Object.keys(snapshot ?? {}).filter(
        key => !declared.includes(key) && !COMMENT_KEY.test(key),
      )
  if (unknown.length > 0) {
    if (bare || writes > 0) {
      throw new Error(
        `${name} takes ${listed(declared)}, not ${unknown.join(', ')}`,
      )
    }
    const key = `${name} ${unknown.toSorted().join(' ')}`
    if (!warned.has(key)) {
      warned.add(key)
      const id = (snapshot as Record<string, unknown>)[
        options.explicitIdentifier ?? ''
      ]
      console.warn(
        `${name}${typeof id === 'string' ? ` "${id}"` : ''} does not declare ${listed(unknown)}: loading without it`,
      )
    }
  }
}

// Checked here as well as by each slot's MST type because this runs on every
// create, where MST's own check is off in a build that has not enabled it
function refuseCallbacks(
  { name, takesNoCallback }: ConfigurationSchemaMetadata,
  snapshot: unknown,
) {
  if (typeof snapshot === 'object' && snapshot !== null) {
    for (const key in snapshot) {
      const type = takesNoCallback.get(key)
      const value: unknown = (snapshot as Record<string, unknown>)[key]
      if (type !== undefined && isJexl(value)) {
        throw new Error(slotWriteRefusal(`${name}.${key}`, type, value))
      }
    }
  }
}

// ADR-146's reset, on the snapshot path: the member keeps its key, so a
// settings bag still resets it, and `create` reads `undefined` as the default.
// A frozen slot resets too, since its readers take the default's shape and
// `setSlot` already resets it; storing the null put one past them.
function nullMembersAsUnset(snapshot: Record<string, unknown>) {
  let out = snapshot
  for (const key in snapshot) {
    if (snapshot[key] === null) {
      out = out === snapshot ? { ...snapshot } : out
      out[key] = undefined
    }
  }
  return out
}

/**
 * A schema reads its own entry alone. A `displays` union runs every member's
 * preprocessor over every entry while it works out which display an entry is,
 * so an entry naming another type is left as it was, and one naming no type is
 * a bag headed here.
 */
function isOwnSnapshot(
  { name, options }: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
) {
  return (
    !options.explicitlyTyped ||
    snapshot.type === undefined ||
    snapshot.type === name
  )
}

// `lifted` under `written`: what the snapshot spells wins, member by member
// where both are objects.
function underWritten(written: unknown, lifted: unknown): unknown {
  if (written === undefined) {
    return lifted
  }
  if (isPlainObject(written) && isPlainObject(lifted)) {
    const out = { ...written }
    for (const [key, value] of Object.entries(lifted)) {
      out[key] = underWritten(written[key], value)
    }
    return out
  }
  return written
}

/**
 * The snapshot with each spelling `retired` names rewritten: a lift's members
 * take the old key's place, and what the snapshot already spells wins, member
 * by member inside an object, since writing the current name is the stronger
 * statement — so a retired flag lifting into `encoding.y` lands beside an
 * `encoding.y` the snapshot writes. The old key goes whether or not it carried a
 * value, so a `closed` schema never meets it, and a member a lift produces
 * that no slot takes goes with it: a v4 `renderer` block carried settings
 * the display has no slot for, and they were dropped then too. Where two
 * retired names lift onto one member — a slot the entry spelt directly and
 * the same slot inside a retired `renderer` — the one declared first wins.
 * A retired name the schema itself declares is that slot, not a spelling,
 * so a list shared across displays leaves it alone where one still takes it.
 * Then each namespace's `retiredMembers` lift, handed `base` for a stored
 * delta.
 */
export function liftRetiredSpellings(
  schema: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
  base?: Record<string, unknown>,
) {
  const { retired, retiredMembers } = schema.options
  if ((!retired && !retiredMembers) || !isOwnSnapshot(schema, snapshot)) {
    return snapshot
  }
  const declared = new Set(declaredKeys(schema))
  const spellings = Object.fromEntries(
    Object.entries(retired ?? {}).filter(([name]) => !declared.has(name)),
  )
  const named = Object.keys(spellings).some(key => key in snapshot)
    ? applyRetiredSpellings(
        spellings,
        withMemberShorthandsLifted(schema, snapshot),
        name => declared.has(name),
      )
    : snapshot
  return retiredMembers
    ? liftRetiredMembers(schema.definition, retiredMembers, named, base)
    : named
}

function namespaceDeclares(member: unknown) {
  return new Set(
    isBareConfigurationSchemaType(member)
      ? declaredKeys(getConfigurationSchemaMetadata(member)!)
      : [],
  )
}

function liftRetiredMembers(
  definition: ConfigurationSchemaMetadata['definition'],
  retiredMembers: Record<string, RetiredMembers>,
  snapshot: Record<string, unknown>,
  base: Record<string, unknown> | undefined,
) {
  let out = snapshot
  for (const [namespace, { names: retired, lift }] of Object.entries(
    retiredMembers,
  )) {
    const declared = namespaceDeclares(definition[namespace])
    const names = retired.filter(name => !declared.has(name))
    const value = out[namespace]
    if (
      isPlainObject(value) &&
      names.some(name => Object.hasOwn(value, name))
    ) {
      const kept = { ...value }
      const values: Record<string, unknown> = {}
      for (const name of names) {
        if (value[name] !== undefined) {
          values[name] = value[name]
        }
        delete kept[name]
      }
      const written = { ...out, [namespace]: kept }
      out =
        Object.keys(values).length > 0
          ? overWritten(written, lift(values, written, base))
          : written
    }
  }
  return out
}

function overWritten(
  written: Record<string, unknown>,
  lifted: Record<string, unknown>,
) {
  const out = { ...written }
  for (const [key, value] of Object.entries(lifted)) {
    const prior = out[key]
    out[key] =
      isPlainObject(prior) && isPlainObject(value)
        ? overWritten(prior, value)
        : value
  }
  return out
}

// A member written in its shorthand, `filter: ['jexl:…']` or `encoding: { y:
// 'maxScore' }`, as the object it lifts into, so a retired spelling lifting
// into the same member lands beside it rather than under a value it cannot
// merge with.
function withMemberShorthandsLifted(
  { definition }: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
) {
  const out = { ...snapshot }
  for (const [key, value] of Object.entries(snapshot)) {
    const member = Object.hasOwn(definition, key) ? definition[key] : undefined
    const meta = isBareConfigurationSchemaType(member)
      ? getConfigurationSchemaMetadata(member)
      : undefined
    if (meta) {
      const lifted = liftShorthand(meta, value)
      out[key] = isPlainObject(lifted)
        ? withMemberShorthandsLifted(meta, lifted)
        : lifted
    }
  }
  return out
}

function asReset(lifted: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(lifted).map(([key, value]) => [
      key,
      isPlainObject(value) ? asReset(value) : null,
    ]),
  )
}

/**
 * `liftRetiredSpellings` over a map directly, for a lift that uncovers a
 * retired name one level down, as a v4 `renderer` block carries a `color1`.
 * Applying the same map twice costs nothing, since a lift deletes the name it
 * reads. `takes` says which lifted members land; every one does unless given.
 * A retired name written `null` resets each member its lift of `null` names,
 * as `null` on the current name would.
 */
export function applyRetiredSpellings(
  retired: Record<string, RetiredSpelling>,
  snapshot: Record<string, unknown>,
  takes: (name: string) => boolean = () => true,
) {
  const present = Object.keys(retired).filter(key => key in snapshot)
  if (present.length === 0) {
    return snapshot
  }
  const out = { ...snapshot }
  for (const key of present) {
    delete out[key]
  }
  for (const key of present.filter(key => snapshot[key] !== undefined)) {
    const value = snapshot[key]
    const lifted =
      value === null ? asReset(retired[key]!(null)) : retired[key]!(value)
    for (const [name, value] of Object.entries(lifted)) {
      if (takes(name)) {
        out[name] = underWritten(out[name], value)
      }
    }
  }
  return out
}

/**
 * A bare string, number or list as the members a schema's `shorthand` lifts
 * it into, beside any `shorthandWith` slots; any other value as it came.
 */
export function liftShorthand(
  schema: ConfigurationSchemaMetadata,
  value: unknown,
) {
  const form = bareFormOf(value)
  const target = form && shorthandTargets(schema)[form]
  return target === undefined
    ? value
    : { ...schema.options.shorthandWith, [target]: value }
}

/**
 * What a schema does to every snapshot on its way in, whichever door it
 * arrives by (`create`, `applySnapshot`, `setSubschema`, a settings bag): a
 * bare value lifts into the `shorthand` slot taking its form
 * (`liftShorthand`), and `null` into the empty object that clears it; a
 * `null` member reads as unset; a `retired` spelling becomes the members that
 * replaced it; the schema's own `preProcessSnapshot` runs, which is where a
 * track folds `displayDefaults` into its displays; then a `closed` schema
 * names a key it does not declare on the console, or refuses it inside
 * `refusingUndeclaredKeys`, unless the caller is a settings bag that routes
 * an undeclared key itself (`routesUndeclared`); it refuses a bare value no
 * shorthand lifted on every door, and so is a `jexl:` callback in a slot
 * declaring no `contextVariable`. A bag written over a live config passes
 * that config's snapshot as `base`, for the `retiredMembers` lifts.
 */
export function preProcessSnapshotWith(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
  {
    routesUndeclared = false,
    base,
  }: { routesUndeclared?: boolean; base?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const { closed, preProcessSnapshot } = schema.options
  const bare = liftShorthand(schema, snapshot)
  const lifted =
    snapshot === null
      ? {}
      : bare !== snapshot
        ? (bare as Record<string, unknown>)
        : (snapshot as Record<string, unknown>)
  const named = nullMembersAsUnset(liftRetiredSpellings(schema, lifted, base))
  const processed = preProcessSnapshot ? preProcessSnapshot(named) : named
  if (closed && !routesUndeclared && isOwnSnapshot(schema, processed)) {
    checkUndeclaredKeys(schema, processed)
  }
  refuseCallbacks(schema, processed)
  return processed
}

/**
 * #api core/configuration
 * A snapshot as `type` lifts it, without the keys it does not declare: the
 * config half of an entry that also holds its owner's keys, as a
 * `MultiWiggleAdapter` subadapter holds its row's `name` and `color`.
 */
export function declaredSnapshot(
  type: IAnyType,
  snapshot: Record<string, unknown>,
) {
  const schema = getConfigurationSchemaMetadata(type)
  if (!schema) {
    return snapshot
  }
  const declared = new Set(declaredKeys(schema))
  return Object.fromEntries(
    Object.entries(
      preProcessSnapshotWith(schema, snapshot, { routesUndeclared: true }),
    ).filter(([key]) => declared.has(key)),
  )
}

/**
 * The keys of `snapshot` that `type` declares, by any spelling it lifts, plus
 * comment keys. A key whose lift throws counts as declared, so the write
 * reports the throw.
 */
export function membersDeclaredBy(
  type: IAnyType,
  snapshot: Record<string, unknown>,
) {
  return Object.keys(snapshot).filter(key => {
    if (COMMENT_KEY.test(key)) {
      return true
    }
    try {
      return (
        Object.keys(declaredSnapshot(type, { [key]: snapshot[key] })).length > 0
      )
    } catch {
      return true
    }
  })
}

/**
 * #api core/configuration
 * A snapshot as a write to `type` admits it: the lift and checks `setConf`
 * applies, so a dialog or a validator rejects what an edit would reject, an
 * undeclared key included. Throws what the schema's `preProcessSnapshot`
 * throws.
 */
export function preProcessConfigSnapshot(type: IAnyType, snapshot: unknown) {
  const schema = getConfigurationSchemaMetadata(type)
  return schema
    ? refusingUndeclaredKeys(() => preProcessSnapshotWith(schema, snapshot))
    : (snapshot as Record<string, unknown>)
}
