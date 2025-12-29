import {
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import type { LinearHicDisplayModel } from './model'
import type { HicFlatbushItem } from '../HicRenderer/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  flatbush?: ArrayBufferLike
  items?: HicFlatbushItem[]
  maxScore?: number
  yScalar?: number
  width: number
  height: number
}

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
    const view = getContainingView(self) as LGV
    const { bpPerPx, dynamicBlocks } = view
    const regions = dynamicBlocks.contentBlocks

    if (!regions.length) {
      return
    }

    const { adapterConfig } = self
    const renderProps = self.renderProps()

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
      self.setLoading(true)

      const result = (await rpcManager.call(
        rpcSessionId,
        'CoreRender',
        {
          sessionId: rpcSessionId,
          rendererType: 'HicRenderer',
          regions: [...regions],
          adapterConfig,
          bpPerPx,
          stopToken,
          ...renderProps,
        },
        {
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        },
      )) as RenderResult

      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        self.setLastDrawnOffsetPx(Math.max(0, view.offsetPx))
      }
      // Store flatbush data for mouseover
      self.setFlatbushData(
        result.flatbush,
        result.items ?? [],
        result.maxScore ?? 0,
        result.yScalar ?? 1,
      )
    } catch (error) {
      if (!isAbortException(error)) {
        if (isAlive(self)) {
          self.setError(error)
        }
      }
    } finally {
      if (isAlive(self)) {
        self.setRenderingStopToken(undefined)
        self.setLoading(false)
      }
    }
  }

  addDisposer(
    self,
    autorun(
      () => {
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return
        }
        const { dynamicBlocks } = view
        const regions = dynamicBlocks.contentBlocks

        /* eslint-disable @typescript-eslint/no-unused-expressions */
        // access these to trigger autorun on changes
        self.resolution
        self.useLogScale
        self.colorScheme
        self.activeNormalization
        self.mode
        self.height
        /* eslint-enable @typescript-eslint/no-unused-expressions */

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

  addDisposer(
    self,
    autorun(
      () => {
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return
        }

        const canvas = self.ref
        const { renderingImageData } = self

        if (!canvas || !renderingImageData) {
          return
        }

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return
        }

        ctx.resetTransform()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(renderingImageData, 0, 0)
      },
      {
        name: 'LinearHicDisplayCanvas',
      },
    ),
  )
}
