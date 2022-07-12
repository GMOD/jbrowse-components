import { types, cast, Instance } from 'mobx-state-tree'
import { clamp } from './index'
import { Feature } from './simpleFeature'
import { Region, ElementId } from './types/mst'
import { Region as IRegion } from './types'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'
import { moveTo, pxToBp, bpToPx, BpOffset } from './Base1DUtils'

const Base1DView = types
  .model('Base1DView', {
    id: ElementId,
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
    get assemblyNames() {
      return [
        ...new Set(self.displayedRegions.map(region => region.assemblyName)),
      ]
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
  .views(self => ({
    pxToBp(px: number) {
      return pxToBp(self, px)
    },
    bpToPx({
      refName,
      coord,
      regionNumber,
    }: {
      refName: string
      coord: number
      regionNumber?: number
    }) {
      return bpToPx({ refName, coord, regionNumber, self })?.offsetPx
    },
  }))
  .actions(self => ({
    setFeatures(features: Feature[]) {
      self.features = features
    },

    // this makes a zoomed out view that shows all displayedRegions
    // that makes the overview bar square with the scale bar
    showAllRegions() {
      self.bpPerPx = self.totalBp / self.width
      self.offsetPx = 0
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
        return self.bpPerPx
      }
      const oldBpPerPx = self.bpPerPx
      self.bpPerPx = bpPerPx

      // tweak the offset so that the center of the view remains at the same coordinate
      self.offsetPx = clamp(
        Math.round(((self.offsetPx + offset) * oldBpPerPx) / bpPerPx - offset),
        self.minOffset,
        self.maxOffset,
      )
      return self.bpPerPx
    },

    scrollTo(offsetPx: number) {
      const newOffsetPx = clamp(offsetPx, self.minOffset, self.maxOffset)
      self.offsetPx = newOffsetPx
      return newOffsetPx
    },
    centerAt(coord: number, refName: string | undefined, regionNumber: number) {
      if (!refName) {
        return
      }
      const centerPx = self.bpToPx({
        refName,
        coord,
        regionNumber,
      })
      if (centerPx) {
        this.scrollTo(Math.round(centerPx - self.width / 2))
      }
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
  .actions(self => ({
    /**
     * offset is the base-pair-offset in the displayed region, index is the index of the
     * displayed region in the linear genome view
     *
     * @param start - object as `{start, end, offset, index}`
     * @param end - object as `{start, end, offset, index}`
     */
    moveTo(start?: BpOffset, end?: BpOffset) {
      moveTo(self, start, end)
    },
  }))

export type Base1DViewStateModel = typeof Base1DView
export type Base1DViewModel = Instance<Base1DViewStateModel>

export default Base1DView
