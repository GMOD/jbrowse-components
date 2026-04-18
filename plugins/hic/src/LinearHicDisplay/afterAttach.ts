import {
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import type { LinearHicDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function doAfterAttach(self: LinearHicDisplayModel) {
  // Fetch available normalizations

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const { rpcManager } = getSession(self)
      const rpcSessionId = getRpcSessionId(self)
      const { norms } = (await rpcManager.call(rpcSessionId, 'CoreGetInfo', {
        adapterConfig: self.adapterConfig,
      })) as { norms?: string[] }
      if (isAlive(self) && norms) {
        self.setAvailableNormalizations(norms)
      }
    } catch (e) {
      console.error(e)
      if (isAlive(self)) {
        getSession(self).notifyError(`${e}`, e)
      }
    }
  })()

  const performRender = async () => {
    if (self.isMinimized) {
      return
    }
    const view = getContainingView(self) as LGV
    const { bpPerPx, dynamicBlocks } = view
    const regions = dynamicBlocks.contentBlocks

    if (!regions.length) {
      return
    }

    const { adapterConfig } = self

    try {
      const session = getSession(self)
      const { rpcManager } = session
      const rpcSessionId = getRpcSessionId(self)

      const previousToken = untracked(() => self.renderingStopToken)
      if (previousToken) {
        stopStopToken(previousToken)
      }

      const stopToken = createStopToken()
      self.setRenderingStopToken(stopToken)

      const result = await rpcManager.call(
        rpcSessionId,
        'RenderHicData',
        {
          adapterConfig,
          regions: [...regions],
          bpPerPx,
          ...self.rpcProps,
          stopToken,
        },
        {
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        },
      )

      self.setRpcData(result)
      self.setLastDrawnOffsetPx(view.offsetPx)
      self.setLastDrawnBpPerPx(view.bpPerPx)
    } catch (error) {
      if (!isAbortException(error)) {
        console.error(error)
        if (isAlive(self)) {
          self.setError(error)
        }
      }
    } finally {
      if (isAlive(self)) {
        self.setRenderingStopToken(undefined)
      }
    }
  }

  addDisposer(
    self,
    autorun(
      () => {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return
        }
        const { dynamicBlocks } = view
        const regions = dynamicBlocks.contentBlocks

        // Single tracked read — rpcProps IS the full RPC payload, so any
        // field change refires this autorun.
        void self.rpcProps

        if (untracked(() => self.error) || !regions.length) {
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        performRender()
      },
      {
        delay: 1000,
        name: 'LinearHicDisplayRender',
      },
    ),
  )
}
