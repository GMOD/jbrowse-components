import { types } from '@jbrowse/mobx-state-tree'

import type { WebGLArcsDataResult } from '../RenderWebGLArcsDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export const ArcsSubModel = types
  .model('ArcsSubModel', {
    lineWidthSetting: types.maybe(types.number),
    drawInter: true,
    drawLongRange: true,
  })
  .volatile(() => ({
    rpcData: null as WebGLArcsDataResult | null,
  }))
  .views(self => ({
    get lineWidth(): number {
      return self.lineWidthSetting ?? 1
    },
  }))
  .actions(self => ({
    setRpcData(data: WebGLArcsDataResult | null) {
      self.rpcData = data
    },
    setLineWidth(width: number) {
      self.lineWidthSetting = width
    },
    setDrawInter(draw: boolean) {
      self.drawInter = draw
    },
    setDrawLongRange(draw: boolean) {
      self.drawLongRange = draw
    },
  }))

export type ArcsSubModelInstance = Instance<typeof ArcsSubModel>
