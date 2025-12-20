import { isAlive } from '@jbrowse/mobx-state-tree'

import {
  createRPCRenderFunction,
  setupCanvasRenderingAutorun,
} from '../shared/createRPCRenderingSetup'
import { createAutorun } from '../util'

import type { LinearReadArcsDisplayModel } from './model'

export function doAfterAttachRPC(self: LinearReadArcsDisplayModel) {
  const performRender = createRPCRenderFunction({
    self,
    rpcMethodName: 'RenderLinearReadArcsDisplay',
    getRPCParams: () => ({
      filterBy: self.filterBy,
      colorBy: self.colorBy,
      drawInter: self.drawInter,
      drawLongRange: self.drawLongRange,
      lineWidth: self.lineWidthSetting,
      jitter: self.jitterVal,
      height: self.height,
    }),
    onResult: () => {},
  })

  createAutorun(
    self,
    async () => {
      if (!isAlive(self)) {
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender()
    },
    {
      delay: 1000,
      name: 'PerformRender',
    },
  )

  setupCanvasRenderingAutorun(self)
}
