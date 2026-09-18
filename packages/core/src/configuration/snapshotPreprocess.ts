import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { isConstantEntry } from './schemaTypes.ts'

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
  { name, definition }: ConfigurationSchemaMetadata,
  snapshot: Record<string, unknown> | undefined,
) {
  const declared = Object.keys(definition).filter(
    key => !isConstantEntry(definition[key]),
  )
  const unknown = Object.keys(snapshot ?? {}).filter(
    key => !declared.includes(key) && !COMMENT_KEY.test(key),
  )
  if (unknown.length > 0) {
    throw new Error(
      `${name} takes ${listed(declared)}, not ${unknown.join(', ')}`,
    )
  }
}

/**
 * What a schema does to every snapshot on its way in, whichever door it
 * arrives by (`create`, `applySnapshot`, `setSubschema`, a settings bag): a
 * bare string lifts into the declared `shorthand` slot and `null` into the
 * empty object that clears it, a `closed` schema refuses a key it does not
 * declare, then the schema's own `preProcessSnapshot` runs.
 */
export function preProcessSnapshotWith(
  schema: ConfigurationSchemaMetadata,
  snapshot: unknown,
): Record<string, unknown> {
  const { shorthand, closed, preProcessSnapshot } = schema.options
  const lifted =
    snapshot === null
      ? {}
      : shorthand !== undefined && typeof snapshot === 'string'
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
