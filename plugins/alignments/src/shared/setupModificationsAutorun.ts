import { getContainingView } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { getUniqueModifications } from './getUniqueModifications'
import { createAutorun } from '../util'

import type { ModificationType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface ModificationsAutorunModel {
  adapterConfig: AnyConfigurationModel
  updateVisibleModifications: (arg: ModificationType[]) => void
  setSimplexModifications: (arg: string[]) => void
  setModificationsReady: (arg: boolean) => void
  setStatusMessage: (arg: string) => void
  effectiveRpcDriverName?: string
}

export function setupModificationsAutorun(
  model: ModificationsAutorunModel,
  isReady: () => boolean,
) {
  createAutorun(
    model,
    async () => {
      if (!isReady()) {
        return
      }
      const view = getContainingView(model) as LGV
      const { adapterConfig } = model
      const { staticBlocks } = view
      const { modifications, simplexModifications } =
        await getUniqueModifications({
          model,
          adapterConfig,
          blocks: staticBlocks,
        })
      if (isAlive(model)) {
        model.updateVisibleModifications(modifications)
        model.setSimplexModifications(simplexModifications)
        model.setModificationsReady(true)
      }
    },
    {
      delay: 1000,
      name: 'GetModInfo',
    },
  )
}
