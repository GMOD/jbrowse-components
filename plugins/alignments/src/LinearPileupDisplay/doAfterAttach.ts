import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from 'mobx-state-tree'

import { getUniqueModifications } from '../shared/getUniqueModifications'
import { createAutorun } from '../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ModificationType, SortedBy } from '../shared/types'

type LGV = LinearGenomeViewModel

export function doAfterAttach(model: {
  autorunReady: boolean
  sortedBy?: SortedBy
  adapterConfig: any
  rendererType: { name: string }
  sortReady: boolean
  currSortBpPerPx: number
  parentTrack: any
  setCurrSortBpPerPx: (arg: number) => void
  setError: (arg: unknown) => void
  renderPropsPre: () => Record<string, unknown>
  updateVisibleModifications: (arg: ModificationType[]) => void
  setModificationsReady: (arg: boolean) => void
  setSortReady: (arg: boolean) => void
}) {
  createAutorun(
    model,
    async () => {
      const view = getContainingView(model) as LGV
      if (!model.autorunReady) {
        return
      }

      model.setCurrSortBpPerPx(view.bpPerPx)
    },
    { delay: 1000 },
  )
  createAutorun(
    model,
    async () => {
      const { rpcManager } = getSession(model)
      const view = getContainingView(model) as LGV
      if (!model.autorunReady) {
        return
      }

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
          layoutId: view.id,
          timeout: 1_000_000,
          ...model.renderPropsPre(),
        })
      }
      if (isAlive(model)) {
        model.setCurrSortBpPerPx(bpPerPx)
        model.setSortReady(true)
      }
    },
    { delay: 1000 },
  )

  createAutorun(
    model,
    async () => {
      if (!model.autorunReady) {
        return
      }
      const { staticBlocks } = getContainingView(model) as LGV
      const vals = await getUniqueModifications({
        self: model,
        adapterConfig: getConf(model.parentTrack, 'adapter'),
        blocks: staticBlocks,
      })
      if (isAlive(model)) {
        model.updateVisibleModifications(vals)
        model.setModificationsReady(true)
      }
    },
    { delay: 1000 },
  )
}
