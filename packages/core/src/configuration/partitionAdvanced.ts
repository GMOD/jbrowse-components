import { isPlainObject } from '../util/objectUtils.ts'
import { getConfigurationSchemaDefinition } from './schemaRegistry.ts'
import { isConfigurationModel, isSlotDefinitionEntry } from './schemaTypes.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'

// wider than the config editor's toggle, which reads only `advanced`: a callback
// is editable there, and only jexl noise to a reader of the About dialog
function foldsIntoAdvancedCard(def: ConfigSlotDefinition) {
  return !!def.advanced || !!def.contextVariable?.length
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
      const side = foldsIntoAdvancedCard(def) ? advanced : rest
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
