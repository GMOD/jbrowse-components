import { getConfigurationSchemaDefinition } from './schemaRegistry.ts'
import { isConfigurationModel, isSlotDefinitionEntry } from './schemaTypes.ts'

import type { AnyConfigurationModel } from './types.ts'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Splits a config snapshot in two: the slots a schema flags `advanced` or gives
 * a `contextVariable` (a `jexl:` callback), and everything else. A sub-schema
 * member splits member by member and appears on a side only if something landed
 * there. A key the schema does not define as a slot (`trackId`, a typed
 * schema's `type`, an array of sub-schemas) stays with the rest.
 */
export function partitionAdvanced(
  node: AnyConfigurationModel,
  snapshot: Record<string, unknown>,
) {
  const definition = getConfigurationSchemaDefinition(node)
  const rest: Record<string, unknown> = {}
  const advanced: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(snapshot)) {
    const def = definition?.[key]
    if (isSlotDefinitionEntry(def)) {
      const side = def.advanced || def.contextVariable ? advanced : rest
      side[key] = value
      continue
    }
    const child = node[key]
    if (isPlainObject(value) && isConfigurationModel(child)) {
      const split = partitionAdvanced(child, value)
      if (Object.keys(split.rest).length) {
        rest[key] = split.rest
      }
      if (Object.keys(split.advanced).length) {
        advanced[key] = split.advanced
      }
    } else {
      rest[key] = value
    }
  }
  return { rest, advanced }
}
