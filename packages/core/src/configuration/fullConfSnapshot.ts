import {
  getSnapshot,
  isArrayType,
  isMapType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaDefinition } from './schemaRegistry.ts'
import {
  isConfigurationModel,
  isConfigurationSchemaType,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'

import type { AnyConfigurationModel } from './types.ts'

/**
 * Plain-object snapshot of a configuration model including ALL values, even
 * defaults. Unlike `getSnapshot()`, which strips a slot sitting at its default
 * via `types.stripDefault`, this returns every slot's current value, so the
 * result is a self-contained config object an RPC worker can read with no
 * schema. JEXL callback slots keep their raw `"jexl:..."` string for the worker
 * to evaluate per-feature.
 *
 * Note: only handles slots and direct sub-configuration models. Arrays or maps
 * of sub-schemas are silently dropped — nothing has needed them.
 */
export function fullConfSnapshot(confObject: AnyConfigurationModel) {
  const result: Record<string, unknown> = {}
  const table = getConfigurationSchemaDefinition(confObject)
  for (const [key, def] of Object.entries(table ?? {})) {
    const v = confObject[key]
    if (isSlotDefinitionEntry(def)) {
      // jexl callback strings pass through raw for per-feature evaluation in
      // the worker.
      result[key] = isStateTreeNode(v) ? getSnapshot(v) : v
    } else if (
      isConfigurationSchemaType(def) &&
      !isArrayType(def) &&
      !isMapType(def) &&
      isConfigurationModel(v)
    ) {
      // a direct sub-configuration recurses. Arrays/maps of sub-schemas are
      // dropped: their MST node also reports as a config model, but the
      // array/map type carries no registered slot table, so recursing would
      // emit a meaningless `{}` (a type-confusion hazard for a consumer
      // expecting the array). Constants are skipped entirely.
      result[key] = fullConfSnapshot(v)
    }
  }
  return result
}
