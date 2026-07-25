import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import sharedModelFactory from './shared.ts'

import type { SharedLDModel } from './shared.ts'

// The shared variant display harness wired for the LD display. `SharedLDModel`
// has no `type` literal of its own (the two concrete LD displays add it), so the
// harness registers it under one.
export function createTestEnvironment() {
  const configSchema = ConfigurationSchema(
    'LDDisplay',
    { height: { type: 'number', defaultValue: 400 } },
    { baseConfiguration: sharedLDConfigFactory(), explicitlyTyped: true },
  )
  return createDisplayTestEnvironment<SharedLDModel>({
    displayName: 'LDDisplay',
    configSchema,
    stateModel: sharedModelFactory(configSchema)
      .named('LDDisplay')
      .props({ type: types.literal('LDDisplay') }),
  })
}
