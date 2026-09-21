import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  identifierName,
  isConstantEntry,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'

import type { ConfigurationSchemaMetadata } from './schemaRegistry.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

// the keys a config file may annotate any object with, as the JSON schema's
// `patternProperties` admits them
const COMMENT_KEY = /^_+comment/

function listed(keys: readonly string[]) {
  return keys.length > 1
    ? `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}`
    : (keys[0] ?? 'nothing')
}

function refuseUndeclaredKeys(
  { name, definition, options }: ConfigurationSchemaMetadata,
  snapshot: unknown,
) {
  const id = identifierName(options)
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

/**
 * What a schema does to every snapshot on its way in, whichever door it
 * arrives by (`create`, `applySnapshot`, `setSubschema`, a settings bag): a
 * bare string or number lifts into the declared `shorthand` slot and `null`
 * into the empty object that clears it, a `closed` schema refuses a key it
 * does not declare, then the schema's own `preProcessSnapshot` runs. A bare
 * value the shorthand does not lift passes through for MST to refuse.
 */
export function preProcessSnapshotWith(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
): Record<string, unknown> {
  const { shorthand, closed, preProcessSnapshot } = schema.options
  const lifted =
    snapshot === null
      ? {}
      : shorthand !== undefined && typeof snapshot === shorthandForm(schema)
        ? { [shorthand]: snapshot }
        : (snapshot as Record<string, unknown>)
  if (closed) {
    refuseUndeclaredKeys(schema, lifted)
  }
  return preProcessSnapshot ? preProcessSnapshot(lifted) : lifted
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
