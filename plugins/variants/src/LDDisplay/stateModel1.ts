import { types } from '@jbrowse/mobx-state-tree'

import sharedModelFactory from './shared.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LDDisplay
 * Display for showing LD computed from VCF genotypes on a VariantTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return sharedModelFactory(configSchema)
    .named('LDDisplay')
    .props({
      /**
       * #property
       */
      type: types.literal('LDDisplay'),
    })
}

export type LDDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDDisplayModel = Instance<LDDisplayStateModel>
