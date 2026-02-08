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
    rpcDataMap: new Map<number, WebGLArcsDataResult>(),
  }))
  .views(self => ({
    get lineWidth(): number {
      return self.lineWidthSetting ?? 1
    },

    /**
     * Backward-compat getter: returns first entry in rpcDataMap
     */
    get rpcData(): WebGLArcsDataResult | null {
      const iter = self.rpcDataMap.values().next()
      return iter.done ? null : iter.value
    },
  }))
  .actions(self => ({
    setRpcData(regionNumber: number, data: WebGLArcsDataResult | null) {
      const next = new Map(self.rpcDataMap)
      if (data) {
        next.set(regionNumber, data)
      } else {
        next.delete(regionNumber)
      }
      self.rpcDataMap = next
    },
    clearAllRpcData() {
      self.rpcDataMap = new Map()
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
