import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, getEnv, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearHicDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  width: number
  height: number
}

export function doAfterAttach(self: LinearHicDisplayModel) {
  const performRender = async () => {
    const view = getContainingView(self) as LGV

    if (
      !view.initialized ||
      self.error ||
      !self.statsReadyAndRegionNotTooLarge
    ) {
      return
    }

    const { bpPerPx, dynamicBlocks } = view
    const regions = dynamicBlocks.contentBlocks
    if (regions.length === 0) {
      return
    }

    const region = regions[0]!
    const {
      resolution,
      useLogScale,
      colorScheme,
      activeNormalization,
      mode,
      height,
      adapterConfig,
      rendererType,
    } = self

    const config = rendererType.configSchema.create(
      {
        ...getConf(self, 'renderer'),
        ...(colorScheme ? { color: 'jexl:interpolate(count,scale)' } : {}),
      },
      getEnv(self),
    )

    try {
      const session = getSession(self)
      const { rpcManager } = session

      const previousToken = self.renderingStopToken
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
          regions: [region],
          adapterConfig,
          config,
          bpPerPx,
          resolution,
          useLogScale,
          colorScheme,
          normalization: activeNormalization,
          displayHeight: mode === 'adjust' ? height : undefined,
          highResolutionScaling: 2,
          stopToken,
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
        self.setLastDrawnOffsetPx(view.offsetPx)
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
      async () => {
        const view = getContainingView(self) as LGV
        // Access reactive properties to ensure autorun triggers on changes
        const {
          resolution,
          useLogScale,
          colorScheme,
          activeNormalization,
          mode,
          height,
        } = self
        const { bpPerPx, dynamicBlocks } = view
        void resolution
        void useLogScale
        void colorScheme
        void activeNormalization
        void mode
        void height
        void bpPerPx
        void dynamicBlocks.contentBlocks

        try {
          await performRender()
        } catch (e) {
          if (isAlive(self)) {
            self.setError(e)
          }
        }
      },
      { delay: 1000, name: 'LinearHicDisplayRender' },
    ),
  )

  addDisposer(
    self,
    autorun(
      () => {
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
