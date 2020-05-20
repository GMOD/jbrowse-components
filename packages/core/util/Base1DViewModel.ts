import { types, cast, Instance } from 'mobx-state-tree'
import { clamp } from './index'
import { Feature } from './simpleFeature'
import { Region } from './types/mst'
import { Region as IRegion } from './types'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

const Base1DView = types
  .model('Base1DView', {
    displayedRegions: types.array(Region),
    bpPerPx: 0,
    offsetPx: 0,
  })
  .volatile(() => ({
    features: undefined as undefined | Feature[],
    volatileWidth: 0,
  }))
  .actions(self => ({
    setDisplayedRegions(regions: IRegion[]) {
      self.displayedRegions = cast(regions)
    },
    setBpPerPx(val: number) {
      self.bpPerPx = val
    },
    setVolatileWidth(width: number) {
      self.volatileWidth = width
    },
  }))
  .views(self => ({
    get width() {
      return self.volatileWidth
    },

    get displayedRegionsMap() {
      return Object.fromEntries(
        self.displayedRegions.map(region => {
          return [region.refName, region.offsetPx]
        }),
      )
    },

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
      return -this.width + rightPadding
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
          offsetBp += coord - r.start
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

    /**
     * offset is the base-pair-offset in the displayed region, index is the index of the
     * displayed region in the linear genome view
     *
     * @param start - object as `{start, end, offset, index}`
     * @param end - object as `{start, end, offset, index}`
     */
    moveTo(start: BpOffset, end: BpOffset) {
      // find locations in the modellist
      let bpSoFar = 0
      if (start.index === end.index) {
        bpSoFar += end.offset - start.offset
      } else {
        const s = self.displayedRegions[start.index]
        bpSoFar += (s.reversed ? s.start : s.end) - start.offset
        if (end.index - start.index >= 2) {
          for (let i = start.index + 1; i < end.index; i += 1) {
            bpSoFar +=
              self.displayedRegions[i].end - self.displayedRegions[i].start
          }
        }
        bpSoFar += end.offset
      }
      let bpToStart = 0
      for (let i = 0; i < self.displayedRegions.length; i += 1) {
        const region = self.displayedRegions[i]
        if (start.index === i) {
          bpToStart += start.offset
          break
        } else {
          bpToStart += region.end - region.start
        }
      }
      self.bpPerPx = bpSoFar / self.width
      if (self.width > bpSoFar / self.bpPerPx) {
        self.offsetPx = Math.round(
          bpToStart / self.bpPerPx - (self.width - bpSoFar / self.bpPerPx) / 2,
        )
      } else {
        self.offsetPx = Math.round(bpToStart / self.bpPerPx)
      }
    },
    zoomOut() {
      this.zoomTo(self.bpPerPx * 2)
    },
    zoomIn() {
      this.zoomTo(self.bpPerPx / 2)
    },
    zoomTo(newBpPerPx: number) {
      const bpPerPx = newBpPerPx
      if (bpPerPx === self.bpPerPx) return
      const oldBpPerPx = self.bpPerPx
      self.bpPerPx = bpPerPx

      // tweak the offset so that the center of the view remains at the same coordinate
      const viewWidth = self.width
      self.offsetPx = clamp(
        Math.round(
          ((self.offsetPx + viewWidth / 2) * oldBpPerPx) / bpPerPx -
            viewWidth / 2,
        ),
        self.minOffset,
        self.maxOffset,
      )
    },
    scroll(distance: number) {
      const oldOffsetPx = self.offsetPx
      // the scroll is clamped to keep the linear genome on the main screen
      const newOffsetPx = clamp(
        self.offsetPx + distance,
        self.minOffset,
        self.maxOffset,
      )
      self.offsetPx = newOffsetPx
      return newOffsetPx - oldOffsetPx
    },
  }))

export type Base1DViewStateModel = typeof Base1DView
export type Base1DViewModel = Instance<Base1DViewStateModel>

export default Base1DView
