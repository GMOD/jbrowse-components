import { isJexl } from '../util/jexlStrings.ts'
import { slotWriteRefusal } from './configurationSlot.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { isConstantEntry, isSlotDefinitionEntry } from './schemaTypes.ts'

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

function refuseUndeclaredKeys(
  { name, definition, options }: ConfigurationSchemaMetadata,
  snapshot: unknown,
) {
  const id = options.explicitIdentifier
  const declared = [
    ...Object.keys(definition).filter(key => !isConstantEntry(definition[key])),
    ...(options.explicitlyTyped ? ['type'] : []),
    ...(id ? [id] : []),
  ]
  const unknown =
    typeof snapshot === 'string'
      ? [JSON.stringify(snapshot)]
      : Object.keys(snapshot ?? {}).filter(
          key => !declared.includes(key) && !COMMENT_KEY.test(key),
        )
  if (unknown.length > 0) {
    throw new Error(
      `${name} takes ${listed(declared)}, not ${unknown.join(', ')}`,
    )
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

const NUMBER_SLOT_TYPES = new Set(['number', 'integer', 'maybeNumber'])

/**
 * The bare value a schema's `shorthand` lifts: a number where the slot it
 * names holds one (`rules: [7.3]`), a string otherwise (`color: 'red'`).
 */
export function shorthandForm({
  definition,
  options,
}: ConfigurationSchemaMetadata): 'string' | 'number' | undefined {
  const { shorthand } = options
  const entry = shorthand === undefined ? undefined : definition[shorthand]
  return shorthand === undefined
    ? undefined
    : isSlotDefinitionEntry(entry) && NUMBER_SLOT_TYPES.has(entry.type)
      ? 'number'
      : 'string'
}

// ADR-146's reset, on the snapshot path: the member keeps its key, so a
// settings bag still resets it, and `create` reads `undefined` as the default
function nullMembersAsUnset(
  snapshot: Record<string, unknown>,
  storesNull: ReadonlySet<string>,
) {
  let out = snapshot
  for (const key in snapshot) {
    if (snapshot[key] === null && !storesNull.has(key)) {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
 * value, so a `closed` schema never meets it. Where two retired names lift
 * onto one member — a slot the entry spelt directly and the same slot inside a
 * retired `renderer` — the one declared first wins.
 */
export function liftRetiredSpellings(
  schema: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
) {
  const { retired } = schema.options
  return retired && isOwnSnapshot(schema, snapshot)
    ? applyRetiredSpellings(retired, snapshot)
    : snapshot
}

/**
 * `liftRetiredSpellings` over a map directly, for a schema whose own
 * `preProcessSnapshot` uncovers a retired name the pass above could not see —
 * one that arrives out of a legacy sub-config rather than off the entry.
 * Applying the same map twice costs nothing, since a lift deletes the name it
 * reads.
 */
export function applyRetiredSpellings(
  retired: Record<string, RetiredSpelling>,
  snapshot: Record<string, unknown>,
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
      out[name] = underWritten(out[name], value)
    }
  }
  return out
}

/**
 * What a schema does to every snapshot on its way in, whichever door it
 * arrives by (`create`, `applySnapshot`, `setSubschema`, a settings bag): a
 * bare string or number lifts into the declared `shorthand` slot, beside any
 * `shorthandWith` slots, and `null` into the empty object that clears it; a
 * `null` member reads as unset, except in a frozen-family slot, which stores
 * it; a `retired` spelling becomes the members that replaced it; a `closed`
 * schema refuses a key it does not declare, then the schema's
 * own `preProcessSnapshot` runs, and a `jexl:` callback in a slot declaring no
 * `contextVariable` is refused. A bare value the shorthand does not lift
 * passes through for MST to refuse.
 */
export function preProcessSnapshotWith(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
): Record<string, unknown> {
  const { shorthand, shorthandWith, closed, preProcessSnapshot } =
    schema.options
  const lifted =
    snapshot === null
      ? {}
      : shorthand !== undefined && typeof snapshot === shorthandForm(schema)
        ? { ...shorthandWith, [shorthand]: snapshot }
        : nullMembersAsUnset(
            snapshot as Record<string, unknown>,
            schema.storesNull,
          )
  const named = liftRetiredSpellings(schema, lifted)
  if (closed) {
    refuseUndeclaredKeys(schema, named)
  }
  const processed = preProcessSnapshot ? preProcessSnapshot(named) : named
  refuseCallbacks(schema, processed)
  return processed
}

/**
 * #api core/configuration
 * A snapshot as `type` admits it: the same lift and checks `type.create`
 * applies, so a dialog or a validator refuses exactly what a config file
 * cannot hold. Throws what the schema's `preProcessSnapshot` throws.
 */
export function preProcessConfigSnapshot(type: IAnyType, snapshot: unknown) {
  const schema = getConfigurationSchemaMetadata(type)
  return schema
    ? preProcessSnapshotWith(schema, snapshot)
    : (snapshot as Record<string, unknown>)
}
