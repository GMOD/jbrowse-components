import { types } from '@jbrowse/mobx-state-tree'

import { namedLDDisplayModel } from './shared.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LDTrackDisplay
 * Display for showing pre-computed LD data on an LDTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return namedLDDisplayModel('LDTrackDisplay', configSchema).props({
    type: types.literal('LDTrackDisplay'),
  })
}

export type LDTrackDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDTrackDisplayModel = Instance<LDTrackDisplayStateModel>
