import { types, cast } from 'mobx-state-tree'
import { moveTo, pxToBp, bpToPx } from './Base1DUtils'
import calculateDynamicBlocks from './calculateDynamicBlocks'
import calculateStaticBlocks from './calculateStaticBlocks'
import { clamp, sum } from './index'
import { ElementId } from './types/mst'
import type { BpOffset } from './Base1DUtils'
import type { Feature } from './simpleFeature'
import type { Region as IRegion } from './types'
import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel Base1DView
 * used in non-lgv view representations of a 1d view e.g. the two axes of the
 * dotplot use this
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const Base1DView = types
  .model('Base1DView', {
    /**
     * #property
     */
    id: ElementId,
    /**
     * #property
     */
    displayedRegions: types.optional(types.frozen<IRegion[]>(), []),
    /**
     * #property
     */
    bpPerPx: 0,
    /**
     * #property
     */
    offsetPx: 0,
    /**
     * #property
     */
    interRegionPaddingWidth: types.optional(types.number, 0),
    /**
     * #property
     */
    minimumBlockWidth: types.optional(types.number, 0),
  })
  .volatile(() => ({
    features: undefined as undefined | Feature[],
    volatileWidth: 0,
  }))
  .actions(self => ({
    /**
     * #action
     */
    setDisplayedRegions(regions: IRegion[]) {
      self.displayedRegions = cast(regions)
    },
    /**
     * #action
     */
    setBpPerPx(val: number) {
      self.bpPerPx = val
    },
    /**
     * #action
     */
    setVolatileWidth(width: number) {
      self.volatileWidth = width
    },
  }))
  .views(self => ({
    /**
     * #getter
     */
    get width() {
      return self.volatileWidth
    },
    /**
     * #getter
     */
    get assemblyNames() {
      return [...new Set(self.displayedRegions.map(r => r.assemblyName))]
    },
    /**
     * #getter
     */
    get displayedRegionsTotalPx() {
      return this.totalBp / self.bpPerPx
    },

    /**
     * #getter
     */
    get maxOffset() {
      // objectively determined to keep the linear genome on the main screen
      const leftPadding = 10
      return this.displayedRegionsTotalPx - leftPadding
    },

    /**
     * #getter
     */
    get minOffset() {
      // objectively determined to keep the linear genome on the main screen
      const rightPadding = 30
      return -this.width + rightPadding
    },

    /**
     * #getter
     */
    get totalBp() {
      return sum(self.displayedRegions.map(a => a.end - a.start))
    },
  }))
  .views(self => ({
    /**
     * #getter
     */
    get dynamicBlocks() {
      return calculateDynamicBlocks(self)
    },

    /**
     * #getter
     */
    get staticBlocks() {
      return calculateStaticBlocks(self)
    },

    /**
     * #getter
     */
    get currBp() {
      return sum(this.dynamicBlocks.map(a => a.end - a.start))
    },
  }))
  .views(self => ({
    /**
     * #method
     */
    pxToBp(px: number) {
      return pxToBp(self, px)
    },

    /**
     * #method
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
      return bpToPx({ refName, coord, regionNumber, self })?.offsetPx
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setFeatures(features: Feature[]) {
      self.features = features
    },

    /**
     * #action
     * this makes a zoomed out view that shows all displayedRegions that makes
     * the overview bar square with the scale bar
     */
    showAllRegions() {
      self.bpPerPx = self.totalBp / self.width
      self.offsetPx = 0
    },

    /**
     * #action
     */
    zoomOut() {
      this.zoomTo(self.bpPerPx * 2)
    },

    /**
     * #action
     */
    zoomIn() {
      this.zoomTo(self.bpPerPx / 2)
    },

    /**
     * #action
     */
    zoomTo(bpPerPx: number, offset = self.width / 2) {
      const newBpPerPx = clamp(
        bpPerPx,
        'minBpPerPx' in self ? (self.minBpPerPx as number) : 0,
        'maxBpPerPx' in self
          ? (self.maxBpPerPx as number)
          : Number.POSITIVE_INFINITY,
      )

      const oldBpPerPx = self.bpPerPx
      if (Math.abs(oldBpPerPx - newBpPerPx) < 0.000001) {
        return oldBpPerPx
      }

      self.bpPerPx = newBpPerPx

      // tweak the offset so that the center of the view remains at the same
      // coordinate
      self.offsetPx = clamp(
        Math.round(
          ((self.offsetPx + offset) * oldBpPerPx) / newBpPerPx - offset,
        ),
        self.minOffset,
        self.maxOffset,
      )
      return self.bpPerPx
    },

    /**
     * #action
     */
    scrollTo(offsetPx: number) {
      const newOffsetPx = clamp(offsetPx, self.minOffset, self.maxOffset)
      self.offsetPx = newOffsetPx
      return newOffsetPx
    },
    /**
     * #action
     */
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

    /**
     * #action
     * note: the scroll is clamped to keep the view on the main screen
     */
    scroll(distance: number) {
      const oldOffsetPx = self.offsetPx
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
     * #action
     * offset is the base-pair-offset in the displayed region, index is the
     * index of the displayed region in the linear genome view
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
