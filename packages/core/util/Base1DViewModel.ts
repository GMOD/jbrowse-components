import { types, cast, Instance } from 'mobx-state-tree'
import { Feature } from './simpleFeature'
import { Region } from './types/mst'
import { Region as IRegion } from './types'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

const Base1DView = types
  .model('Base1DView', {
    displayedRegions: types.array(Region),
    bpPerPx: 0,
    offsetPx: 0,
    horizontallyFlipped: false,
    width: 0,
  })
  .volatile(() => ({
    features: undefined as undefined | Feature[],
  }))
  .actions(self => ({
    setDisplayedRegions(regions: IRegion[]) {
      self.displayedRegions = cast(regions)
    },
    setBpPerPx(val: number) {
      self.bpPerPx = val
    },
  }))
  .views(self => ({
    get displayedRegionsTotalPx() {
      return this.totalBp / self.bpPerPx
    },

    get maxOffset() {
      // objectively determined to keep the linear genome on the main screen
      const leftPadding = 10
      return this.displayedRegionsTotalPx - leftPadding
    },

    get minOffset() {
      // objectively determined to keep the linear genome on the main screen
      const rightPadding = 30
      return -self.width + rightPadding
    },
    get dynamicBlocks() {
      return calculateDynamicBlocks(self)
    },
    get staticBlocks() {
      return calculateStaticBlocks(cast(self))
    },
    get totalBp() {
      return self.displayedRegions
        .map(a => a.end - a.start)
        .reduce((a, b) => a + b, 0)
    },
    get currBp() {
      return this.dynamicBlocks
        .map(a => a.end - a.start)
        .reduce((a, b) => a + b, 0)
    },
    bpToPx({ refName, coord }: { refName: string; coord: number }) {
      let offsetBp = 0

      const index = self.displayedRegions.findIndex(r => {
        if (refName === r.refName && coord >= r.start && coord <= r.end) {
          offsetBp += self.horizontallyFlipped ? r.end - coord : coord - r.start
          return true
        }
        offsetBp += r.end - r.start
        return false
      })
      const foundRegion = self.displayedRegions[index]
      if (foundRegion) {
        return Math.round(offsetBp / self.bpPerPx)
      }
      return undefined
    },

    /**
     *
     * @param {number} px px in the view area, return value is the displayed regions
     * @returns {BpOffset} of the displayed region that it lands in
     */
    pxToBp(px: number) {
      const bp = (self.offsetPx + px) * self.bpPerPx
      let bpSoFar = 0
      let r = self.displayedRegions[0]
      if (bp < 0) {
        return {
          ...r,
          offset: bp,
          index: 0,
        }
      }
      for (let index = 0; index < self.displayedRegions.length; index += 1) {
        r = self.displayedRegions[index]
        if (r.end - r.start + bpSoFar > bp && bpSoFar <= bp) {
          return { ...r, offset: bp - bpSoFar, index }
        }
        bpSoFar += r.end - r.start
      }

      return {
        ...r,
        offset: bp - bpSoFar,
        index: self.displayedRegions.length - 1,
      }
    },
  }))
  .actions(self => ({
    setFeatures(features: Feature[]) {
      self.features = features
    },
  }))

export type Base1DViewStateModel = typeof Base1DView
export type Base1DViewModel = Instance<Base1DViewStateModel>

export default Base1DView
