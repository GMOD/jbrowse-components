import { types } from '@jbrowse/mobx-state-tree'

import type { Sample } from '../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface HoverHighlight {
  refName: string
  start: number
  end: number
  assemblyName: string
}

export function stateModelFactory() {
  return types
    .model('MafSequenceWidget', {
      id: types.identifier,
      type: types.literal('MafSequenceWidget'),
      adapterConfig: types.frozen<AnyConfigurationModel | undefined>(undefined),
      samples: types.frozen<Sample[] | undefined>(undefined),
      regions: types.frozen<
        | {
            refName: string
            start: number
            end: number
            assemblyName: string
          }[]
        | undefined
      >(undefined),
      connectedViewId: types.maybe(types.string),
    })
    .volatile(() => ({
      hoverHighlight: undefined as HoverHighlight | undefined,
    }))
    .actions(self => ({
      setHoverHighlight(highlight: HoverHighlight | undefined) {
        self.hoverHighlight = highlight
      },
    }))
}

export type MafSequenceWidgetStateModel = ReturnType<typeof stateModelFactory>
export type MafSequenceWidgetModel = Instance<MafSequenceWidgetStateModel>
