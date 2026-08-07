import { getType } from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaDefinition } from './schemaRegistry.ts'
import { isSlotDefinitionEntry } from './schemaTypes.ts'

import type { AnyConfigurationModel } from './types.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

// The `promotable` slot names of one config schema (includes slots inherited via
// baseConfiguration — merged into the table at construction), cached by MST type
// since a schema's slot table is fixed.
//
// Only the functions that genuinely *enumerate* promotable slots call this — the
// worker-payload resolver, the badge diff, "clear every default", and
// `assertNoPromotableSlots`. It is deliberately NOT on any read path:
// `getConf` used to consult it on all ~1300 config reads in the repo to decide
// whether to cascade, which cost a `getType` per read (measured at ~60% overhead
// over `readConfObject`) to serve the ~15 promotable ones. `resolveConf` names
// the cascade at the call site instead, so there is nothing to look up.
//
// Its own module, and a leaf one, because `ui/promotablePinCoverage.ts` wants
// the slot names and nothing else: reaching them through a module that also held
// `readConfObject` pulled jexl and the whole read path into the ui graph. See the
// note on that export in `ui/index.ts`.
const promotableSlotsByType = new WeakMap<IAnyType, Set<string>>()

export function promotableSlotNames(
  config: AnyConfigurationModel,
): ReadonlySet<string> {
  const type = getType(config)
  const cached = promotableSlotsByType.get(type)
  if (cached) {
    return cached
  }
  const names = new Set<string>()
  const table = getConfigurationSchemaDefinition(config)
  for (const [name, def] of Object.entries(table ?? {})) {
    if (isSlotDefinitionEntry(def) && def.promotedBase !== undefined) {
      names.add(name)
    }
  }
  promotableSlotsByType.set(type, names)
  return names
}
