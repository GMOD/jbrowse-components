import { types } from '@jbrowse/mobx-state-tree'

import { namedLDDisplayModel } from './shared.ts'

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
  return namedLDDisplayModel('LDDisplay', configSchema).props({
    type: types.literal('LDDisplay'),
  })
}

export type LDDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDDisplayModel = Instance<LDDisplayStateModel>
