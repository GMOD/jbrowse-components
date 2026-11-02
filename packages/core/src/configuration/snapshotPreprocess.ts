import {
  getParent,
  getPathParts,
  getType,
  hasParent,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { isJexl } from '../util/jexlStrings.ts'
import { isPlainObject } from '../util/objectUtils.ts'
import {
  belowMinimumNotice,
  isBelowMinimum,
  minimumRefusal,
  slotDefinitionRefusal,
  slotWriteRefusal,
} from './configurationSlot.ts'
import { refusalProblems, withoutPath } from './requirements.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  bareFormOf,
  isBareConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
  shorthandTargets,
} from './schemaTypes.ts'

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

/**
 * #api core/configuration
 * What a schema's own `preProcessSnapshot` does with a value it refuses that
 * no declared rule can name: a write throws `notice`, and a config loading
 * names it once on the console and loads without it.
 */
export function refuseOnWrite(notice: string) {
  if (writes > 0) {
    throw new Error(notice)
  }
  if (!warned.has(notice)) {
    warned.add(notice)
    console.warn(`${notice}: loading without it`)
  }
}

function joinPath(at: string, key: string) {
  return at ? `${at}.${key}` : key
}

/**
 * The dotted path from the typed entry holding a live config node (its
 * display or track) to the node: `rows` for a display's rows, `""` for the
 * entry itself, and undefined for a node with no typed entry above it.
 */
export function configPathOf(node: unknown): string | undefined {
  const meta = isStateTreeNode(node)
    ? getConfigurationSchemaMetadata(getType(node))
    : undefined
  const parentPath =
    meta && !meta.options.explicitlyTyped && hasParent(node)
      ? configPathOf(getParent(node))
      : undefined
  return meta?.options.explicitlyTyped
    ? ''
    : parentPath === undefined
      ? undefined
      : joinPath(parentPath, getPathParts(node).at(-1) ?? '')
}

/** The dotted path from a live node's typed entry to its member `key`. */
export function memberPathOf(node: unknown, key: string) {
  const at = configPathOf(node)
  return at === undefined ? undefined : joinPath(at, key)
}

/**
 * What a notice calls the slot `key` of the schema `name` at `at`: its path
 * inside a typed entry, as `rows.step`, else `Schema.key`.
 */
export function slotLabel(name: string, key: string, at: string | undefined) {
  return at ? joinPath(at, key) : `${name}.${key}`
}

/**
 * A `misnamed` word's target: the dotted path to write, or the paths where
 * the word could mean either (`rowColor`: `rows.colors` pins a row,
 * `rows.color` colors by an attribute).
 */
export type MisnamedTarget = string | readonly string[]

export type Misnamed = Readonly<Record<string, MisnamedTarget>>

/** The paths a `misnamed` target names. */
export function misnamedPaths(target: MisnamedTarget): readonly string[] {
  return typeof target === 'string' ? [target] : target
}

/**
 * Whether `members` walks `schema`'s sub-schemas to a member each declares:
 * `rows`, `step` on a display whose rows declare a step.
 */
export function declaresMemberPath(
  schema: ConfigurationSchemaMetadata | undefined,
  members: readonly string[],
): boolean {
  const [head, ...rest] = members
  const entry =
    head !== undefined && schema && Object.hasOwn(schema.definition, head)
      ? schema.definition[head]
      : undefined
  return (
    entry !== undefined &&
    !isConstantEntry(entry) &&
    (rest.length === 0 ||
      (isBareConfigurationSchemaType(entry) &&
        declaresMemberPath(getConfigurationSchemaMetadata(entry), rest)))
  )
}

/** A dotted path as the nested objects a config writes: `rows: { step }`. */
export function nestedSpelling(path: string): string {
  const [head, ...rest] = path.split('.')
  return rest.length > 0
    ? `${head}: { ${nestedSpelling(rest.join('.'))} }`
    : `${head}`
}

/**
 * A key a config wrote dotted, `"rows.step"`, where `schema` declares that
 * path: one key, never a path, so it means nothing until written nested.
 */
export function isDottedMemberPath(
  schema: ConfigurationSchemaMetadata | undefined,
  key: string,
) {
  return key.includes('.') && declaresMemberPath(schema, key.split('.'))
}

/**
 * What a notice calls the targets of `unknown`, from a schema at `at`: a
 * `misnamed` word's dotted path, and a dotted key `schema` declares as the
 * nested objects to write, each from the typed entry where the path is known,
 * else from the schema itself. Empty where neither answers a key.
 */
export function misnamedPointer(
  misnamed: Misnamed = {},
  unknown: readonly string[],
  at = '',
  schema?: ConfigurationSchemaMetadata,
) {
  const pointed = unknown.flatMap(key => {
    const targets = Object.hasOwn(misnamed, key)
      ? misnamedPaths(misnamed[key]!).map(path => joinPath(at, path))
      : isDottedMemberPath(schema, key)
        ? [nestedSpelling(joinPath(at, key))]
        : []
    const paths = targets.join(' or ')
    return targets.length === 0
      ? []
      : [unknown.length > 1 ? `${paths} for ${key}` : paths]
  })
  return pointed.length > 0 ? ` — did you mean ${listed(pointed)}?` : ''
}

function checkUndeclaredKeys(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
  at: string | undefined,
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
    const meaning = options.description ? ` — ${options.description}` : ''
    if (bare || writes > 0) {
      throw new Error(
        `${name} takes ${listed(declared)}, not ${unknown.join(', ')}${misnamedPointer(options.misnamed, unknown, at, schema)}${meaning}`,
      )
    }
    const key = `${name} ${unknown.toSorted().join(' ')}`
    if (!warned.has(key)) {
      warned.add(key)
      const id = (snapshot as Record<string, unknown>)[
        options.explicitIdentifier ?? ''
      ]
      console.warn(
        `${name}${typeof id === 'string' ? ` "${id}"` : ''} does not declare ${listed(unknown)}: loading without it${misnamedPointer(options.misnamed, unknown, at, schema)}${meaning}`,
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

// A config loading a number at or below a slot's `exclusiveMinimum` names it
// once and loads the default; a write refuses it.
function boundedMembers(
  { name, bounded }: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
  at: string | undefined,
) {
  let out = snapshot
  for (const [key, definition] of bounded) {
    const value = snapshot[key]
    if (isBelowMinimum(definition, value)) {
      const slot = slotLabel(name, key, at)
      if (writes > 0) {
        throw new Error(minimumRefusal(slot, definition, value))
      }
      const notice = belowMinimumNotice(slot, definition, value)
      if (!warned.has(notice)) {
        warned.add(notice)
        console.warn(
          `${notice}: loading the default, ${JSON.stringify(definition.defaultValue)}`,
        )
      }
      out = out === snapshot ? { ...snapshot } : out
      out[key] = undefined
    }
  }
  return out
}

function isStringMap(value: unknown) {
  return (
    isPlainObject(value) &&
    Object.values(value).every(entry => typeof entry === 'string')
  )
}

// A config loading a `stringMap` slot something other than a map of strings,
// as `rows.labels: false` for `rows.axis.labels`, names it once with the
// slot's meaning and loads the default; a map with some entries no string,
// as `{ HG002: 'red', HG003: null }` from R's NA, keeps its string entries and
// names the rest. A write refuses either.
function misshapenMaps(
  { name, definition }: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
  at: string | undefined,
) {
  let out = snapshot
  for (const key in snapshot) {
    const entry = Object.hasOwn(definition, key) ? definition[key] : undefined
    const value = snapshot[key]
    if (
      isSlotDefinitionEntry(entry) &&
      entry.type === 'stringMap' &&
      value !== undefined &&
      value !== null &&
      !isStringMap(value)
    ) {
      const notice = slotDefinitionRefusal(
        slotLabel(name, key, at),
        entry,
        value,
      )
      if (writes > 0) {
        throw new Error(notice)
      }
      const kept = isPlainObject(value)
        ? Object.fromEntries(
            Object.entries(value).filter(([, v]) => typeof v === 'string'),
          )
        : undefined
      const loading = isPlainObject(value)
        ? `loading without ${listed(
            Object.keys(value).filter(k => typeof value[k] !== 'string'),
          )}`
        : 'loading the default'
      if (!warned.has(notice)) {
        warned.add(notice)
        console.warn(`${notice}: ${loading}`)
      }
      out = out === snapshot ? { ...snapshot } : out
      out[key] = kept
    }
  }
  return out
}

/** What a notice says of a `refuses` entry `snapshot` breaks at `at`. */
export function refusalNotice(
  name: string,
  at: string | undefined,
  { slot, message }: { slot: string; message: string },
) {
  return `${slotLabel(name, slot, at)}: ${message}`
}

// A config loading a value a schema's `refuses` entry refuses names it once
// and loads without it; a write refuses it.
function refusedMembers(
  schema: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
  at: string | undefined,
) {
  let out = snapshot
  for (const problem of refusalProblems(schema, snapshot)) {
    const notice = refusalNotice(schema.name, at, problem)
    if (writes > 0) {
      throw new Error(notice)
    }
    if (!warned.has(notice)) {
      warned.add(notice)
      console.warn(`${notice}: loading without it`)
    }
    out = withoutPath(out, problem.slot.split('.'))
  }
  return out
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
  const spellings = Object.fromEntries(
    Object.entries(retired).filter(([name]) => !declared.has(name)),
  )
  return Object.keys(spellings).some(key => key in snapshot)
    ? applyRetiredSpellings(
        spellings,
        membersInCanonicalSpelling(schema, snapshot),
        name => declared.has(name),
      )
    : snapshot
}

/**
 * #api core/configuration
 * A settings bag as its schema spells it, at every depth of the sub-schemas
 * it declares: a bare value as the object its `shorthand` lifts it into, and
 * a `retired` spelling as the members that replaced it. Two bags combine
 * member by member only in this form; merged raw, a bare `mark: "line"`
 * replaces a whole `mark` object where it meant its `type`. The bag itself,
 * by identity, when it already spells everything so.
 */
export function canonicalSpelling(
  schema: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
) {
  return liftRetiredSpellings(
    schema,
    membersInCanonicalSpelling(schema, snapshot),
  )
}

// A member written in its shorthand, `filter: ['jexl:…']` or `encoding: { y:
// 'maxScore' }`, as the object it lifts into, so a retired spelling lifting
// into the same member lands beside it rather than under a value it cannot
// merge with.
function membersInCanonicalSpelling(
  { definition }: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown>,
) {
  let out = snapshot
  for (const [key, value] of Object.entries(snapshot)) {
    const member = Object.hasOwn(definition, key) ? definition[key] : undefined
    const meta = isBareConfigurationSchemaType(member)
      ? getConfigurationSchemaMetadata(member)
      : undefined
    if (meta) {
      const lifted = liftShorthand(meta, value)
      const next = isPlainObject(lifted)
        ? canonicalSpelling(meta, lifted)
        : lifted
      if (next !== value) {
        out = out === snapshot ? { ...snapshot } : out
        out[key] = next
      }
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
 * declaring no `contextVariable`. A number at or below a slot's
 * `exclusiveMinimum` is named and loads the default, or is refused on a
 * write; a settings bag leaves it to the member write that refuses it.
 */
export function preProcessSnapshotWith(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
  {
    routesUndeclared = false,
    at: givenAt,
  }: { routesUndeclared?: boolean; at?: string } = {},
): Record<string, unknown> {
  const { closed, preProcessSnapshot, explicitlyTyped } = schema.options
  const at = givenAt ?? (explicitlyTyped ? '' : undefined)
  const bare = liftShorthand(schema, snapshot)
  const lifted =
    snapshot === null
      ? {}
      : bare !== snapshot
        ? (bare as Record<string, unknown>)
        : (snapshot as Record<string, unknown>)
  const named = nullMembersAsUnset(liftRetiredSpellings(schema, lifted))
  const custom = preProcessSnapshot ? preProcessSnapshot(named) : named
  const own = isOwnSnapshot(schema, custom)
  if (closed && !routesUndeclared && own) {
    checkUndeclaredKeys(schema, custom, at)
  }
  refuseCallbacks(schema, custom)
  return routesUndeclared || !own
    ? custom
    : refusedMembers(
        schema,
        boundedMembers(schema, misshapenMaps(schema, custom, at), at),
        at,
      )
}

/**
 * `type.create(snapshot)` with the schema's own lift and checks run first at
 * `at`, the path a write knows from the live tree and the snapshot does not,
 * so a refusal names `rows.step` rather than `RowsWithStep.step`.
 */
export function createAtPath(
  type: IAnyType,
  snapshot: unknown,
  at: string | undefined,
) {
  const schema = getConfigurationSchemaMetadata(type)
  if (schema) {
    preProcessSnapshotWith(schema, snapshot, { at })
  }
  const created: unknown = type.create(snapshot)
  return created
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
