import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import type { LinearHicDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  width: number
  height: number
}

export function doAfterAttach(self: LinearHicDisplayModel) {
  // Fetch available normalizations
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const { rpcManager } = getSession(self)
      const track = getContainingTrack(self)
      const adapterConfig = getConf(track, 'adapter')
      const { norms } = (await rpcManager.call(
        getConf(track, 'trackId'),
        'CoreGetInfo',
        {
          adapterConfig,
        },
      )) as { norms?: string[] }
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

      const previousToken = untracked(() => self.renderingStopToken)
      if (previousToken) {
        stopStopToken(previousToken)
      }

      const stopToken = createStopToken()
      self.setRenderingStopToken(stopToken)
      self.setLoading(true)

      const result = (await rpcManager.call(
        self.id,
        'CoreRender',
        {
          sessionId: session.id,
          rendererType: 'HicRenderer',
          regions: [...regions],
          adapterConfig,
          bpPerPx,
          highResolutionScaling: 2,
          stopToken,
          ...renderProps,
        },
        {
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setMessage(msg)
            }
          },
        },
      )) as RenderResult

      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        self.setLastDrawnOffsetPx(Math.max(0, view.offsetPx))
      }

      self.setLastDrawnBpPerPx(bpPerPx)
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
        const {
          resolution,
          useLogScale,
          colorScheme,
          activeNormalization,
          mode,
          height,
          statsReadyAndRegionNotTooLarge,
        } = self
        const { dynamicBlocks, initialized } = view
        const regions = dynamicBlocks.contentBlocks

        // access these to trigger autorun on changes
        void resolution
        void useLogScale
        void colorScheme
        void activeNormalization
        void mode
        void height

        if (
          !initialized ||
          untracked(() => self.error) ||
          !statsReadyAndRegionNotTooLarge ||
          !regions.length
        ) {
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        performRender()
      },
      { delay: 1000, name: 'LinearHicDisplayRender' },
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
      { name: 'LinearHicDisplayCanvas' },
    ),
  )
}
