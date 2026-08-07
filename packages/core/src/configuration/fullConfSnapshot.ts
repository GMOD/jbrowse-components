import {
  getSnapshot,
  isArrayType,
  isMapType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { promotableSlotNames } from './promotableSlots.ts'
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
 * **Why this isn't exported from `@jbrowse/core/configuration`.** It was
 * (as `getConfSnapshot`), and being reachable was the hazard. A promotable slot
 * resolves against the session at read time, so snapshotting one raw ships the
 * bare `undefined` inherit sentinel to a worker with no session to resolve it
 * against — and every display in the repo now has promotable slots. The public
 * form used to defend itself by *throwing* on such a config, which meant the
 * obvious spelling in a new `rpcProps()` failed at runtime, on the first fetch,
 * in whichever product exercised that display. Off the barrel, the same mistake
 * is an unresolved import: it can't be written at all, and
 * `getConfigSnapshotWithPromotables(display)` is the one way across the boundary.
 * So this is the shared walker those resolvers are built on, not an entry point.
 *
 * The nested-schema guard below is the part of that defense still worth
 * enforcing at runtime, since no import can express it.
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
      assertNoPromotableSlots(v)
      result[key] = fullConfSnapshot(v)
    }
  }
  return result
}

// A promotable slot is only ever resolvable at a config's own top level — the
// resolver walks that one slot table (`promotableSlotNames` / `getSlotDefinition`)
// and never descends. So one declared inside a *nested* schema would resolve
// nowhere and serialize as its bare inherit sentinel, with no import to get wrong
// and no symptom until a worker read the sentinel. Fail at the snapshot instead.
function assertNoPromotableSlots(confObject: AnyConfigurationModel) {
  const promotable = promotableSlotNames(confObject)
  if (promotable.size > 0) {
    throw new Error(
      `nested config schema declares promotable slots (${[...promotable].join(', ')}): the cascade only resolves a display config's own top-level slots, so these would serialize as the bare inherit sentinel. Declare them on the display's own schema instead.`,
    )
  }
}
