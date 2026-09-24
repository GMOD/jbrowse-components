import {
  getSnapshot,
  getType,
  isArrayType,
  isMapType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  isConfigurationSchemaType,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'

import type { AnyConfigurationModel } from './types.ts'

// a sub-schema member: one node, or an array or map of them, entry by entry
function subConfSnapshot(member: unknown): unknown {
  if (!isStateTreeNode(member)) {
    return member
  }
  const type = getType(member)
  if (isArrayType(type)) {
    return (member as AnyConfigurationModel[]).map(fullConfSnapshot)
  }
  if (isMapType(type)) {
    return Object.fromEntries(
      [...(member as Map<string, AnyConfigurationModel>).entries()].map(
        ([key, node]) => [key, fullConfSnapshot(node)],
      ),
    )
  }
  return fullConfSnapshot(member as AnyConfigurationModel)
}

/**
 * Plain-object snapshot of a configuration model including ALL values, even
 * defaults. Unlike `getSnapshot()`, which strips a slot sitting at its default
 * via `types.stripDefault`, this returns every slot's current value, so the
 * result is a self-contained config object an RPC worker can read with no
 * schema. JEXL callback slots keep their raw `"jexl:..."` string for the worker
 * to evaluate per-feature. A sub-schema recurses, and so does each entry of an
 * array or map of them; an explicitly typed schema carries its `type`, which
 * is what tells the entries of a union list apart. Constants are the editor's
 * and are left out.
 */
export function fullConfSnapshot(
  confObject: AnyConfigurationModel,
): Record<string, unknown> {
  const meta = getConfigurationSchemaMetadata(getType(confObject))
  const result: Record<string, unknown> = meta?.options.explicitlyTyped
    ? { type: confObject.type }
    : {}
  for (const [key, def] of Object.entries(meta?.definition ?? {})) {
    const member = confObject[key]
    if (isSlotDefinitionEntry(def)) {
      result[key] = isStateTreeNode(member) ? getSnapshot(member) : member
    } else if (isConfigurationSchemaType(def) && member !== undefined) {
      result[key] = subConfSnapshot(member)
    }
  }
  return result
}
