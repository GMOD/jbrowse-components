/**
 * @module
 * Recognizing configuration schemas and classifying the entries in one. These
 * predicates are the single source of truth for both questions — shared by
 * schema construction, every reader, and the config editor — so "is this a
 * config schema?" and "what kind of entry is this?" have one answer everywhere.
 */
import {
  asArrayType,
  asMapType,
  getType,
  getUnionSubtypes,
  isStateTreeNode,
  isType,
  isUnionType,
} from '@jbrowse/mobx-state-tree'

import {
  getConfigurationSchemaMetadata,
  isRegisteredConfigurationSchema,
} from './schemaRegistry.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { ConfigurationSchemaMetadata } from './schemaRegistry.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from './types.ts'

/**
 * The names an explicitly typed union's members answer to, each the name its
 * schema was given, read through whatever wraps the union — a pluggable
 * union's `snapshotProcessor`, a `maybe`, a `types.late`. A member that is
 * itself a union contributes its own; a member with no type of its own throws.
 */
export function getTypeNamesFromExplicitlyTypedUnion(
  maybeUnionType: unknown,
): string[] {
  if (!isType(maybeUnionType) || !isUnionType(maybeUnionType)) {
    return []
  }
  return getUnionSubtypes(maybeUnionType).flatMap(member => {
    const meta = getConfigurationSchemaMetadata(member)
    if (meta?.options.explicitlyTyped) {
      return [meta.name]
    }
    if (isUnionType(member)) {
      return getTypeNamesFromExplicitlyTypedUnion(member)
    }
    // the branch a `maybe`-like union adds so the slot can be absent
    if (member.name === 'undefined') {
      return []
    }
    throw new Error(`invalid config schema type ${member.name}`)
  })
}

/** The type `ConfigurationSchema()` built, by any handle on it (`schemaRegistry.ts`). */
export function isBareConfigurationSchemaType(
  thing: unknown,
): thing is AnyConfigurationSchemaType {
  return isType(thing) && isRegisteredConfigurationSchema(thing)
}

/** A schema, or a union, array or map of them. */
export function isConfigurationSchemaType(
  thing: unknown,
): thing is AnyConfigurationSchemaType {
  if (!isType(thing)) {
    return false
  }
  if (isBareConfigurationSchemaType(thing)) {
    return true
  }
  if (isUnionType(thing)) {
    return getUnionSubtypes(thing).every(
      t => isConfigurationSchemaType(t) || t.name === 'undefined',
    )
  }
  const collection = asArrayType(thing) ?? asMapType(thing)
  return !!collection && isConfigurationSchemaType(collection.getChildType())
}

/**
 * A configuration schema definition maps each key to exactly one of three kinds
 * of entry:
 *
 *  - constant   → a bare string/number (becomes a volatile instance constant)
 *  - slot       → a ConfigSlotDefinition object (has a `type` field, not a type)
 *  - sub-schema → an MST configuration-schema type, see isConfigurationSchemaType
 */
export function isConstantEntry(def: unknown): def is string | number {
  return typeof def === 'string' || typeof def === 'number'
}

export function isSlotDefinitionEntry(
  def: unknown,
): def is ConfigSlotDefinition {
  return (
    typeof def === 'object' && def !== null && !isType(def) && 'type' in def
  )
}

export function isConfigurationModel(
  thing: unknown,
): thing is AnyConfigurationModel {
  return isStateTreeNode(thing) && isConfigurationSchemaType(getType(thing))
}

const NUMBER_SLOT_TYPES = new Set(['number', 'integer', 'maybeNumber'])

/** A bare value a schema's `shorthand` lifts. */
export type ShorthandForm = 'string' | 'number'

/**
 * The slot a bare value of each form lifts into, off a `shorthand` option:
 * each slot it names takes the form its own type holds, a number where it
 * holds one (`rules: [7.3]`) and a string otherwise (`color: 'red'`), so a
 * width naming `value` and `field` reads `size: 3` as the one and
 * `size: 'score'` as the other.
 */
export function shorthandTargetsOf(
  definition: Record<string, unknown>,
  shorthand: string | readonly string[] | undefined,
): Partial<Record<ShorthandForm, string>> {
  const slots =
    shorthand === undefined
      ? []
      : typeof shorthand === 'string'
        ? [shorthand]
        : shorthand
  return Object.fromEntries(
    slots.map(slot => {
      const entry = definition[slot]
      return [
        isSlotDefinitionEntry(entry) && NUMBER_SLOT_TYPES.has(entry.type)
          ? 'number'
          : 'string',
        slot,
      ]
    }),
  )
}

/** The shorthand form of a bare value, or undefined for any other value. */
export function bareFormOf(value: unknown): ShorthandForm | undefined {
  return typeof value === 'string'
    ? 'string'
    : typeof value === 'number'
      ? 'number'
      : undefined
}

/** {@link shorthandTargetsOf} a registered schema. */
export function shorthandTargets({
  definition,
  options,
}: ConfigurationSchemaMetadata) {
  return shorthandTargetsOf(definition, options.shorthand)
}
