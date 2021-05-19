import { types, cast, getSnapshot, Instance } from 'mobx-state-tree'
import { clamp } from './index'
import { Feature } from './simpleFeature'
import { Region } from './types/mst'
import { Region as IRegion } from './types'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'

export interface BpOffset {
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
    interRegionPaddingWidth: types.optional(types.number, 0),
    minimumBlockWidth: types.optional(types.number, 0),
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
    get totalBp() {
      return self.displayedRegions
        .map(a => a.end - a.start)
        .reduce((a, b) => a + b, 0)
    },

    /**
     * calculates the Px at which coord is found.
     *
     * @param refName - string, refName of region
     * @param coord - number, bp to be translated to Px
     * @param regionNumber - number, index of displayedRegion in displayedRegions array
     */
    bpToPx({
      refName,
      coord,
      regionNumber,
    }: {
      refName: string
      coord: number
      regionNumber?: number
    }) {
      let offsetBp = 0

      const interRegionPaddingBp = self.interRegionPaddingWidth * self.bpPerPx
      const minimumBlockBp = self.minimumBlockWidth * self.bpPerPx
      const index = self.displayedRegions.findIndex((region, idx) => {
        const len = region.end - region.start
        if (
          refName === region.refName &&
          coord >= region.start &&
          coord <= region.end
        ) {
          if (regionNumber ? regionNumber === idx : true) {
            offsetBp += region.reversed
              ? region.end - coord
              : coord - region.start
            return true
          }
        }

        // add the interRegionPaddingWidth if the boundary is in the screen
        // e.g. offset>0 && offset<width
        if (
          region.end - region.start > minimumBlockBp &&
          offsetBp / self.bpPerPx > 0 &&
          offsetBp / self.bpPerPx < this.width
        ) {
          offsetBp += len + interRegionPaddingBp
        } else {
          offsetBp += len
        }
        return false
      })

      const foundRegion = self.displayedRegions[index]
      if (foundRegion) {
        return Math.round(offsetBp / self.bpPerPx)
      }

      return undefined
    },

    pxToBp(px: number) {
      let bpSoFar = 0
      const bp = (self.offsetPx + px) * self.bpPerPx
      const n = self.displayedRegions.length
      if (bp < 0) {
        const region = self.displayedRegions[0]
        const offset = bp
        return {
          ...getSnapshot(region),
          oob: true,
          coord: region.reversed
            ? Math.floor(region.end - offset) + 1
            : Math.floor(region.start + offset) + 1,
          offset,
          index: 0,
        }
      }

      const interRegionPaddingBp = self.interRegionPaddingWidth * self.bpPerPx
      const minimumBlockBp = self.minimumBlockWidth * self.bpPerPx

      for (let index = 0; index < self.displayedRegions.length; index += 1) {
        const region = self.displayedRegions[index]
        const len = region.end - region.start
        const offset = bp - bpSoFar
        if (len + bpSoFar > bp && bpSoFar <= bp) {
          return {
            ...getSnapshot(region),
            oob: false,
            offset,
            coord: region.reversed
              ? Math.floor(region.end - offset) + 1
              : Math.floor(region.start + offset) + 1,
            index,
          }
        }

        // add the interRegionPaddingWidth if the boundary is in the screen
        // e.g. offset>0 && offset<width
        if (
          region.end - region.start > minimumBlockBp &&
          offset / self.bpPerPx > 0 &&
          offset / self.bpPerPx < this.width
        ) {
          bpSoFar += len + interRegionPaddingBp
        } else {
          bpSoFar += len
        }
      }

      if (bp >= bpSoFar) {
        const region = self.displayedRegions[n - 1]
        const len = region.end - region.start
        const offset = bp - bpSoFar + len
        return {
          ...getSnapshot(region),
          oob: true,
          offset,
          coord: region.reversed
            ? Math.floor(region.end - offset) + 1
            : Math.floor(region.start + offset) + 1,
          index: n - 1,
        }
      }
      return {
        coord: 0,
        index: 0,
        start: 0,
        refName: '',
        oob: true,
        assemblyName: '',
        offset: 0,
        reversed: false,
      }
    },
  }))
  .views(self => ({
    get dynamicBlocks() {
      return calculateDynamicBlocks(self)
    },
    get staticBlocks() {
      return calculateStaticBlocks(self)
    },
    get currBp() {
      return this.dynamicBlocks
        .map(a => a.end - a.start)
        .reduce((a, b) => a + b, 0)
    },
  }))
  .actions(self => ({
    setFeatures(features: Feature[]) {
      self.features = features
    },

    zoomToDisplayedRegions(
      leftPx: BpOffset | undefined,
      rightPx: BpOffset | undefined,
    ) {
      if (leftPx === undefined || rightPx === undefined) {
        return
      }

      const singleRefSeq =
        leftPx.refName === rightPx.refName && leftPx.index === rightPx.index
      // zooming into one displayed Region
      if (
        (singleRefSeq && rightPx.offset < leftPx.offset) ||
        leftPx.index > rightPx.index
      ) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      const startOffset = {
        start: leftPx.start,
        end: leftPx.end,
        index: leftPx.index,
        offset: leftPx.offset,
      }
      const endOffset = {
        start: rightPx.start,
        end: rightPx.end,
        index: rightPx.index,
        offset: rightPx.offset,
      }
      if (startOffset && endOffset) {
        this.moveTo(startOffset, endOffset)
      } else {
        throw new Error('regions not found')
      }
    },

    // this makes a zoomed out view that shows all displayedRegions
    // that makes the overview bar square with the scale bar
    showAllRegions() {
      self.bpPerPx = self.totalBp / self.width
      self.offsetPx = 0
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
        bpSoFar += s.end - s.start - start.offset
        if (end.index - start.index >= 2) {
          for (let i = start.index + 1; i < end.index; i += 1) {
            bpSoFar +=
              self.displayedRegions[i].end - self.displayedRegions[i].start
          }
        }
        bpSoFar += end.offset
      }
      this.zoomTo(
        bpSoFar /
          (self.width -
            self.interRegionPaddingWidth * (end.index - start.index)),
      )

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
      self.offsetPx =
        Math.round(bpToStart / self.bpPerPx) +
        self.interRegionPaddingWidth * start.index
    },

    zoomOut() {
      this.zoomTo(self.bpPerPx * 2)
    },

    zoomIn() {
      this.zoomTo(self.bpPerPx / 2)
    },

    zoomTo(newBpPerPx: number, offset = self.width / 2) {
      const bpPerPx = newBpPerPx
      if (bpPerPx === self.bpPerPx) {
        return
      }
      const oldBpPerPx = self.bpPerPx
      self.bpPerPx = bpPerPx

      // tweak the offset so that the center of the view remains at the same coordinate
      self.offsetPx = clamp(
        Math.round(((self.offsetPx + offset) * oldBpPerPx) / bpPerPx - offset),
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
