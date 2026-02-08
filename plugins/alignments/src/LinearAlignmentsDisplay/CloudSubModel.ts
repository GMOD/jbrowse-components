import { types } from '@jbrowse/mobx-state-tree'

import type { WebGLCloudDataResult } from '../RenderWebGLCloudDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export const CloudSubModel = types
  .model('CloudSubModel', {})
  .volatile(() => ({
    rpcData: null as WebGLCloudDataResult | null,
    maxDistance: 10000,
  }))
  .actions(self => ({
    setRpcData(data: WebGLCloudDataResult | null) {
      self.rpcData = data
      if (data) {
        self.maxDistance = data.maxDistance
      }
    },
  }))

export type CloudSubModelInstance = Instance<typeof CloudSubModel>
