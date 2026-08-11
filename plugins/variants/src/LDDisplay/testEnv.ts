import { types } from '@jbrowse/mobx-state-tree'

import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import ldDisplayConfigSchema from './configSchemaVariant.ts'
import sharedModelFactory from './shared.ts'

import type { SharedLDModel } from './shared.ts'

// The shared variant display harness wired for the LD display. `SharedLDModel`
// has no `type` literal of its own (the two concrete LD displays add it), so the
// harness registers it under one.
//
// The production schema, not a hand-built copy of it. The copy here restated
// `height: 400` — the one slot the concrete schemas used to add — so it was a
// second declaration of a value only `index.ts` was authoritative for, free to
// drift the moment either moved.
export function createTestEnvironment() {
  const configSchema = ldDisplayConfigSchema()
  return createDisplayTestEnvironment<SharedLDModel>({
    displayName: 'LDDisplay',
    configSchema,
    stateModel: sharedModelFactory(configSchema)
      .named('LDDisplay')
      .props({ type: types.literal('LDDisplay') }),
  })
}
