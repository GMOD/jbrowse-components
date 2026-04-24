import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import type { ArcsDataResult } from '../shared/computeArcsFromPileupData.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export type ArcColorByType =
  | 'insertSizeAndOrientation'
  | 'insertSize'
  | 'orientation'
  | 'samplot'

export const arcColorByTypes = types.enumeration<ArcColorByType>(
  'ArcColorByType',
  ['insertSizeAndOrientation', 'insertSize', 'orientation', 'samplot'],
)

export const ArcsSubModel = types
  .model('ArcsSubModel', {
    lineWidthSetting: types.maybe(types.number),
    drawInter: true,
    drawLongRange: true,
    colorByType: types.optional(arcColorByTypes, 'insertSizeAndOrientation'),
    pairedArcsDown: true,
  })
  .volatile(() => ({
    rpcDataMap: observable.map<number, ArcsDataResult>(),
  }))
  .views(self => ({
    get lineWidth(): number {
      return self.lineWidthSetting ?? 1
    },
  }))
  .actions(self => ({
    setRpcData(displayedRegionIndex: number, data: ArcsDataResult | null) {
      if (data) {
        self.rpcDataMap.set(displayedRegionIndex, data)
      } else {
        self.rpcDataMap.delete(displayedRegionIndex)
      }
    },
    clearAllRpcData() {
      self.rpcDataMap.clear()
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
    setArcsDown(flag: boolean) {
      self.pairedArcsDown = flag
    },
  }))

export type ArcsSubModelInstance = Instance<typeof ArcsSubModel>
