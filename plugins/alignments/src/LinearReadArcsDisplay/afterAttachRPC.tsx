import { isAlive } from '@jbrowse/mobx-state-tree'

import {
  createRPCRenderFunction,
  setupCanvasRenderingAutorun,
} from '../shared/createRPCRenderingSetup.ts'
import { createAutorun } from '../util.ts'

import type { LinearReadArcsDisplayModel } from './model.ts'

export function doAfterAttachRPC(self: LinearReadArcsDisplayModel) {
  const performRender = createRPCRenderFunction({
    self,
    rpcMethodName: 'RenderLinearReadArcsDisplay',
    getRPCParams: () => self.renderProps(),
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
