import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { setupModificationsAutorun } from '../shared/setupModificationsAutorun.ts'
import { createAutorun } from '../util.ts'

import type { ModificationType, SortedBy } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function doAfterAttach(model: {
  autorunReady: boolean
  sortedBy?: SortedBy
  adapterConfig: AnyConfigurationModel
  rendererType: { name: string }
  sortReady: boolean
  currSortBpPerPx: number
  parentTrack: any
  adapterRenderProps: () => Record<string, unknown>
  renderingProps: () => Record<string, unknown>
  setCurrSortBpPerPx: (arg: number) => void
  setError: (arg: unknown) => void
  updateVisibleModifications: (arg: ModificationType[]) => void
  setSimplexModifications: (arg: string[]) => void
  setModificationsReady: (arg: boolean) => void
  setSortReady: (arg: boolean) => void
  setStatusMessage: (arg: string) => void
}) {
  createAutorun(
    model,
    async () => {
      if (!model.autorunReady) {
        return
      }
      const view = getContainingView(model) as LGV
      model.setCurrSortBpPerPx(view.bpPerPx)
    },
    {
      delay: 1000,
      name: 'CurrBpPerPx',
    },
  )
  createAutorun(
    model,
    async () => {
      if (!model.autorunReady) {
        return
      }
      const { rpcManager } = getSession(model)
      const view = getContainingView(model) as LGV
      const { sortedBy, adapterConfig, rendererType, sortReady } = model
      const { bpPerPx } = view

      if (sortedBy && (!sortReady || model.currSortBpPerPx === view.bpPerPx)) {
        const { pos, refName, assemblyName } = sortedBy
        // render just the sorted region first
        // @ts-expect-error
        await model.rendererType.renderInClient(rpcManager, {
          assemblyName,
          regions: [
            {
              start: pos,
              end: pos + 1,
              refName,
              assemblyName,
            },
          ],
          adapterConfig,
          rendererType: rendererType.name,
          sessionId: getRpcSessionId(model),
          trackInstanceId: getContainingTrack(model).id,
          timeout: 1_000_000,
          statusCallback: (arg: string) => {
            if (isAlive(model)) {
              model.setStatusMessage(arg)
            }
          },
          ...model.adapterRenderProps(),
          renderingProps: model.renderingProps(),
        })
      }
      if (isAlive(model)) {
        model.setCurrSortBpPerPx(bpPerPx)
        model.setSortReady(true)
      }
    },
    {
      delay: 1000,
      name: 'SortReads',
    },
  )

  setupModificationsAutorun(model, () => model.autorunReady)
}
