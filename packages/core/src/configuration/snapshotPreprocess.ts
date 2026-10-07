import { isJexl } from '../util/jexlStrings.ts'
import { isPlainObject } from '../util/objectUtils.ts'
import { slotWriteRefusal } from './configurationSlot.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { bareFormOf, isConstantEntry, shorthandTargets } from './schemaTypes.ts'

import type { RetiredSpelling } from './configurationSchema.ts'
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
  const bare = snapshot !== undefined && typeof snapshot !== 'object'
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
    const key = `${name} ${unknown.join(' ')}`
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
 * statement — so a retired flag lifting into `scales.y` lands beside a
 * `scales.y` the snapshot writes. The old key goes whether or not it carried a
 * value, so a `closed` schema never meets it, and a member a lift produces
 * that no slot takes goes with it: a v4 `renderer` block carried settings
 * the display has no slot for, and they were dropped then too. Where two
 * retired names lift onto one member — a slot the entry spelt directly and
 * the same slot inside a retired `renderer` — the one declared first wins.
 */
export function liftRetiredSpellings(
  schema: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
) {
  const { retired } = schema.options
  if (!retired || !isOwnSnapshot(schema, snapshot)) {
    return snapshot
  }
  const declared = new Set(declaredKeys(schema))
  return applyRetiredSpellings(retired, snapshot, name => declared.has(name))
}

/**
 * `liftRetiredSpellings` over a map directly, for a lift that uncovers a
 * retired name one level down, as a v4 `renderer` block carries a `color1`.
 * Applying the same map twice costs nothing, since a lift deletes the name it
 * reads. `takes` says which lifted members land; every one does unless given.
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
    const lifted = retired[key]!(snapshot[key])
    for (const [name, value] of Object.entries(lifted)) {
      if (takes(name)) {
        out[name] = underWritten(out[name], value)
      }
    }
  }
  return out
}

/**
 * What a schema does to every snapshot on its way in, whichever door it
 * arrives by (`create`, `applySnapshot`, `setSubschema`, a settings bag): a
 * bare string or number lifts into the `shorthand` slot taking its form, beside any
 * `shorthandWith` slots, and `null` into the empty object that clears it; a
 * `null` member reads as unset; a `retired` spelling becomes the members that
 * replaced it; the schema's own `preProcessSnapshot` runs, which is where a
 * track folds `displayDefaults` into its displays; then a `closed` schema
 * names a key it does not declare on the console, or refuses it inside
 * `refusingUndeclaredKeys`, unless the caller is a settings bag that routes
 * an undeclared key itself (`routesUndeclared`); it refuses a bare value no
 * shorthand lifted on every door, and so is a `jexl:` callback in a slot
 * declaring no `contextVariable`.
 */
export function preProcessSnapshotWith(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
  { routesUndeclared = false } = {},
): Record<string, unknown> {
  const { shorthandWith, closed, preProcessSnapshot } = schema.options
  const form = bareFormOf(snapshot)
  const target = form && shorthandTargets(schema)[form]
  const lifted =
    snapshot === null
      ? {}
      : target !== undefined
        ? { ...shorthandWith, [target]: snapshot }
        : nullMembersAsUnset(snapshot as Record<string, unknown>)
  const named = liftRetiredSpellings(schema, lifted)
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
 * config half of an entry that carries its owner's keys beside one, as a
 * `MultiWiggleAdapter` subadapter carries its row's `name` and `color`.
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
 * #api core/configuration
 * A snapshot as a write to `type` admits it: the lift and checks `setConf`
 * applies, so a dialog or a validator refuses what an edit cannot hold, an
 * undeclared key included. Throws what the schema's `preProcessSnapshot`
 * throws.
 */
export function preProcessConfigSnapshot(type: IAnyType, snapshot: unknown) {
  const schema = getConfigurationSchemaMetadata(type)
  return schema
    ? refusingUndeclaredKeys(() => preProcessSnapshotWith(schema, snapshot))
    : (snapshot as Record<string, unknown>)
}
