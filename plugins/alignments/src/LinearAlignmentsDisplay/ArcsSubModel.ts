import { types } from '@jbrowse/mobx-state-tree'

import type { ArcsDataResult } from '../RenderArcsDataRPC/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export type ArcColorByType =
  | 'insertSizeAndOrientation'
  | 'insertSize'
  | 'orientation'

export const arcColorByTypes = types.enumeration<ArcColorByType>(
  'ArcColorByType',
  ['insertSizeAndOrientation', 'insertSize', 'orientation'],
)

export const ArcsSubModel = types
  .model('ArcsSubModel', {
    lineWidthSetting: types.maybe(types.number),
    drawInter: true,
    drawLongRange: true,
    colorByType: types.optional(arcColorByTypes, 'insertSizeAndOrientation'),
  })
  .volatile(() => ({
    rpcDataMap: new Map<number, ArcsDataResult>(),
    // See dataVersion comment in MultiRegionDisplayMixin.
    dataVersion: 0,
  }))
  .views(self => ({
    get lineWidth(): number {
      return self.lineWidthSetting ?? 1
    },
  }))
  .actions(self => ({
    setRpcData(regionNumber: number, data: ArcsDataResult | null) {
      const next = new Map(self.rpcDataMap)
      if (data) {
        next.set(regionNumber, data)
      } else {
        next.delete(regionNumber)
      }
      self.rpcDataMap = next
      self.dataVersion++
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
    setColorByType(type: ArcColorByType) {
      self.colorByType = type
    },
  }))

export type ArcsSubModelInstance = Instance<typeof ArcsSubModel>
