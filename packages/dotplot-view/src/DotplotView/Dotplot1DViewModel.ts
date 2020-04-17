import { clamp } from '@gmod/jbrowse-core/util'
import { Region, IRegion } from '@gmod/jbrowse-core/mst-types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { types, Instance } from 'mobx-state-tree'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const { cast, types: jbrequiredTypes } = jbrequire('mobx-state-tree')

  return (jbrequiredTypes as Instance<typeof types>)
    .model('Dotplot1DView', {
      displayedRegions: types.array(Region),
      bpPerPx: types.number,
      offsetPx: types.number,
      horizontallyFlipped: false,
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
      get width() {
        /* this is replaced by usage of this model */
        return 800
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
        return calculateDynamicBlocks(cast(self))
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
      bpToPx(refName: string, coord: number) {
        let offsetBp = 0

        const index = self.displayedRegions.findIndex(r => {
          if (refName === r.refName && coord >= r.start && coord <= r.end) {
            offsetBp += self.horizontallyFlipped
              ? r.end - coord
              : coord - r.start
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
      zoomInButton() {
        this.zoomTo(self.bpPerPx / 1.4)
      },

      zoomOutButton() {
        this.zoomTo(self.bpPerPx * 1.4)
      },
      zoomTo(newBpPerPx: number, offset: number = self.width / 2) {
        const bpPerPx = newBpPerPx
        if (bpPerPx === self.bpPerPx) return
        const oldBpPerPx = self.bpPerPx
        self.bpPerPx = bpPerPx
        self.offsetPx = Math.round(
          ((self.offsetPx + offset) * oldBpPerPx) / bpPerPx - offset,
        )
      },
      horizontalScroll(distance: number) {
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
        const viewWidth = self.width
        if (viewWidth > bpSoFar / self.bpPerPx) {
          self.offsetPx = Math.round(
            bpToStart / self.bpPerPx - (viewWidth - bpSoFar / self.bpPerPx) / 2,
          )
        } else {
          self.offsetPx = Math.round(bpToStart / self.bpPerPx)
        }
      },
    }))
}

export type Dotplot1DViewStateModel = ReturnType<typeof stateModelFactory>
export type Dotplot1DViewModel = Instance<Dotplot1DViewStateModel>
