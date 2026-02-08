import { types } from '@jbrowse/mobx-state-tree'

import type { WebGLCloudDataResult } from '../RenderWebGLCloudDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export const CloudSubModel = types
  .model('CloudSubModel', {})
  .volatile(() => ({
    rpcDataMap: new Map<number, WebGLCloudDataResult>(),
    maxDistance: 10000,
  }))
  .views(self => ({
    /**
     * Backward-compat getter: returns first entry in rpcDataMap
     */
    get rpcData(): WebGLCloudDataResult | null {
      const iter = self.rpcDataMap.values().next()
      return iter.done ? null : iter.value
    },
  }))
  .actions(self => ({
    setRpcData(regionNumber: number, data: WebGLCloudDataResult | null) {
      const next = new Map(self.rpcDataMap)
      if (data) {
        next.set(regionNumber, data)
        self.maxDistance = data.maxDistance
      } else {
        next.delete(regionNumber)
      }
      self.rpcDataMap = next
    },
    clearAllRpcData() {
      self.rpcDataMap = new Map()
    },
  }))

export type CloudSubModelInstance = Instance<typeof CloudSubModel>
