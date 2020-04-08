/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import { ElementId, Region, IRegion } from '@gmod/jbrowse-core/mst-types'
import { MenuOptions } from '@gmod/jbrowse-core/ui'
import {
  clamp,
  getContainingView,
  getSession,
  parseLocStringAndConvertToInterbase,
  springAnimate,
} from '@gmod/jbrowse-core/util'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { transaction } from 'mobx'
import { getParent, getSnapshot, getRoot, types, cast } from 'mobx-state-tree'

import { BlockSet } from '../BasicTrack/util/blockTypes'
import calculateDynamicBlocks from '../BasicTrack/util/calculateDynamicBlocks'
import calculateStaticBlocks from '../BasicTrack/util/calculateStaticBlocks'

export { default as ReactComponent } from './components/LinearGenomeView'

interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}
const validBpPerPx = [
  1 / 50,
  1 / 20,
  1 / 10,
  1 / 5,
  1 / 2,
  1,
  2,
  5,
  10,
  20,
  50,
  100,
  200,
  500,
  1000,
  2000,
  5000,
  10000,
  20000,
  50000,
  100000,
  200000,
  500000,
  1000000,
  2000000,
  5000000,
  10000000,
].sort((a, b) => a - b)

export const HEADER_BAR_HEIGHT = 48
export const HEADER_OVERVIEW_HEIGHT = 20
export const SCALE_BAR_HEIGHT = 17
export const RESIZE_HANDLE_HEIGHT = 3

export function stateModelFactory(pluginManager: any) {
  return types
    .model('LinearGenomeView', {
      id: ElementId,
      type: types.literal('LinearGenomeView'),
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: types.array(Region),
      displayName: types.maybe(types.string),
      // we use an array for the tracks because the tracks are displayed in a specific
      // order that we need to keep.
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      width: 800,
      hideHeader: false,
      hideHeaderOverview: false,
      trackSelectorType: types.optional(
        types.enumeration(['hierarchical']),
        'hierarchical',
      ),
      minimumBlockWidth: 20,
      showCenterLine: false,
    })
    .volatile(() => ({
      draggingTrackId: undefined as undefined | string,
      error: undefined as undefined | Error,

      // array of callbacks to run after the next set of the displayedRegions,
      // which is basically like an onLoad
      afterDisplayedRegionsSetCallbacks: [] as Function[],
    }))
    .views(self => ({
      get scaleBarHeight() {
        return SCALE_BAR_HEIGHT + RESIZE_HANDLE_HEIGHT
      },
      get headerHeight() {
        if (self.hideHeader) {
          return 0
        }
        if (self.hideHeaderOverview) {
          return HEADER_BAR_HEIGHT
        }
        return HEADER_BAR_HEIGHT + HEADER_OVERVIEW_HEIGHT
      },
      get trackHeights() {
        return self.tracks.map(t => t.height).reduce((a, b) => a + b, 0)
      },
      get trackHeightsWithResizeHandles() {
        return this.trackHeights + self.tracks.length * RESIZE_HANDLE_HEIGHT
      },
      get height() {
        return (
          this.trackHeightsWithResizeHandles +
          this.headerHeight +
          this.scaleBarHeight
        )
      },
      get totalBp() {
        let totalbp = 0
        self.displayedRegions.forEach(region => {
          totalbp += region.end - region.start
        })
        return totalbp
      },

      get zoomLevels() {
        const zoomLevels = validBpPerPx.filter(
          val => val <= this.totalBp / self.width && val >= 0,
        )
        if (!zoomLevels.length) {
          zoomLevels.push(validBpPerPx[0])
        }
        return zoomLevels
      },

      get maxBpPerPx() {
        return this.zoomLevels[this.zoomLevels.length - 1]
      },

      get minBpPerPx() {
        return this.zoomLevels[0]
      },

      constrainBpPerPx(newBpPerPx: number): number {
        // find the closest valid zoom level and return it
        // might consider reimplementing this later using a more efficient algorithm
        return this.zoomLevels
          .slice()
          .sort(
            (a, b) => Math.abs(a - newBpPerPx) - Math.abs(b - newBpPerPx),
          )[0]
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

      get displayedRegionsTotalPx() {
        return this.totalBp / self.bpPerPx
      },

      get renderProps() {
        return {
          ...getParentRenderProps(self),
          bpPerPx: self.bpPerPx,
          highResolutionScaling: getConf(
            getSession(self),
            'highResolutionScaling',
          ),
        }
      },
      get assemblyNames() {
        const assemblyNames: string[] = []
        self.displayedRegions.forEach(displayedRegion => {
          if (!assemblyNames.includes(displayedRegion.assemblyName))
            assemblyNames.push(displayedRegion.assemblyName)
        })
        return assemblyNames
      },

      bpToPx({ refName, coord }: { refName: string; coord: number }) {
        let offsetBp = 0

        const index = self.displayedRegions.findIndex(r => {
          if (refName === r.refName && coord >= r.start && coord <= r.end) {
            offsetBp += r.reversed ? r.end - coord : coord - r.start
            return true
          }
          offsetBp += r.end - r.start
          return false
        })
        const foundRegion = self.displayedRegions[index]
        if (foundRegion) {
          return {
            index,
            offsetPx: Math.round(offsetBp / self.bpPerPx),
          }
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
          index: self.displayedRegions.length,
        }
      },

      getTrack(id: string) {
        return self.tracks.find(t => t.configuration.trackId === id)
      },

      getTrackPos(trackId: string) {
        const idx = self.tracks.findIndex(
          t => t.configuration.trackId === trackId,
        )
        let accum = 0
        for (let i = 0; i < idx; i += 1) {
          accum += self.tracks[i].height + RESIZE_HANDLE_HEIGHT
        }
        return accum
      },
      get centerLinePosition() {
        const centerLinePosition = self.displayedRegions.length
          ? this.pxToBp(self.width / 2)
          : undefined
        return centerLinePosition
      },
    }))
    .actions(self => ({
      setWidth(newWidth: number) {
        self.width = newWidth
      },

      setError(error: Error | undefined) {
        self.error = error
      },

      setDisplayName(name: string) {
        self.displayName = name
      },

      toggleHeader() {
        self.hideHeader = !self.hideHeader
      },

      toggleHeaderOverview() {
        self.hideHeaderOverview = !self.hideHeaderOverview
      },

      horizontallyFlip() {
        self.displayedRegions = cast(
          self.displayedRegions
            .slice()
            .reverse()
            .map(region => ({ ...region, reversed: !region.reversed })),
        )
        self.offsetPx = self.totalBp / self.bpPerPx - self.offsetPx - self.width
      },

      showTrack(configuration: any, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) throw new Error('track configuration has no `type` listed')
        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)
        if (!trackType) throw new Error(`unknown track type ${type}`)
        const track = trackType.stateModel.create({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
        self.tracks.push(track)
      },

      hideTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },

      moveTrack(movingTrackId: string, targetTrackId: string) {
        const oldIndex = self.tracks.findIndex(
          track => track.id === movingTrackId,
        )
        if (oldIndex === -1)
          throw new Error(`Track ID ${movingTrackId} not found`)
        const newIndex = self.tracks.findIndex(
          track => track.id === targetTrackId,
        )
        if (newIndex === -1)
          throw new Error(`Track ID ${targetTrackId} not found`)
        const track = getSnapshot(self.tracks[oldIndex])
        self.tracks.splice(oldIndex, 1)
        self.tracks.splice(newIndex, 0, track)
      },

      closeView() {
        const parent = getContainingView(self) as any
        if (parent) {
          // I am embedded in a higher order view
          parent.removeView(self)
        } else {
          // I am part of a session
          getParent(self, 2).removeView(self)
        }
      },

      toggleTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) this.showTrack(configuration)
      },

      toggleCenterLine() {
        self.showCenterLine = !self.showCenterLine
      },

      setDisplayedRegions(regions: IRegion[]) {
        self.displayedRegions = cast(regions)
        this.zoomTo(self.bpPerPx)
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session: any = getSession(self)
          const selector = session.addDrawerWidget(
            'HierarchicalTrackSelectorDrawerWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showDrawerWidget(selector)
          return selector
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      zoom(levels: number) {
        this.zoomTo(self.bpPerPx)
        if (
          // no zoom
          levels === 0 ||
          // already zoomed all the way in
          (levels > 0 && self.bpPerPx === self.minBpPerPx) ||
          // already zoomed all the way out
          (levels < 0 && self.bpPerPx === self.maxBpPerPx)
        ) {
          return
        }
        const currentIndex = self.zoomLevels.findIndex(
          zoomLevel => zoomLevel === self.bpPerPx,
        )
        const targetIndex = clamp(
          currentIndex - levels,
          0,
          self.zoomLevels.length - 1,
        )
        const targetBpPerPx = self.zoomLevels[targetIndex]
        this.zoomTo(targetBpPerPx)
      },

      zoomTo(newBpPerPx: number, constrain = true) {
        let bpPerPx = newBpPerPx
        if (constrain) {
          bpPerPx = self.constrainBpPerPx(newBpPerPx)
        }
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

      async navToLocString(locString: string) {
        await this.navTo(parseLocStringAndConvertToInterbase(locString))
      },

      /**
       * navTo navigates to a simple refName:start..end type object as input.
       * can handle if there are multiple displayedRegions from same chr.
       * only navigates to a locString if it is entirely within a
       * displayedRegion.
       *
       * @param {refName,start?,end?,assemblyName?} location - a proposed
       * location to navigate to
       * throws an error if navigation was unsuccessful
       */
      async navTo(query: {
        refName: string
        start?: number
        end?: number
        assemblyName?: string
      }) {
        let { refName } = query
        const { start, end, assemblyName } = query
        if (refName) {
          try {
            const root = getRoot(self)
            const canonicalRefName = await root.jbrowse.getCanonicalRefName(
              refName,
              assemblyName || self.assemblyNames[0],
            )
            if (canonicalRefName) {
              refName = canonicalRefName
            }
          } catch (error) {
            console.warn(
              `wasn't able to look up canonical ref name for ${refName}`,
              error,
            )
          }
        }

        let s = start
        let e = end
        let refNameMatched = false

        // get the proper displayedRegion that is relevant for the nav command
        // assumes that a single displayedRegion will satisfy the query
        // TODO: may not necessarily be true?
        const index = self.displayedRegions.findIndex(r => {
          if (refName === r.refName) {
            refNameMatched = true
            if (s === undefined) {
              s = r.start
            }
            if (e === undefined) {
              e = r.end
            }
            if (s >= r.start && s <= r.end && e <= r.end && e >= r.start) {
              return true
            }
            s = start
            e = end
          }
          return false
        })
        if (!refNameMatched) {
          throw new Error(`could not find a region with refName "${refName}"`)
        }
        if (s !== undefined && e === undefined) {
          throw new Error(`could not find a region that contained ${s + 1}`)
        }
        if (s === undefined) {
          throw new Error(
            `could not find a region with refName "${refName}" that contained an end position ${e}`,
          )
        }
        if (e === undefined) {
          throw new Error(
            `could not find a region with refName "${refName}" that contained a start position ${s}`,
          )
        }
        if (index === -1) {
          throw new Error(
            `could not find a region that completely contained "${refName}:${
              start !== undefined ? start + 1 : start
            }..${end}"`,
          )
        }
        const f = self.displayedRegions[index]
        this.moveTo(
          { index, offset: s - f.start },
          { index, offset: e - f.start },
        )
      },

      // schedule something to be run after the next time displayedRegions is set
      afterDisplayedRegionsSet(cb: Function) {
        self.afterDisplayedRegionsSetCallbacks.push(cb)
      },

      /**
       * offset is the base-pair-offset in the displayed region, index is the index of the
       * displayed region in the linear genome view
       *
       * @param {object} start object as {start, end, offset, index}
       * @param {object} end object as {start, end, offset, index}
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
        self.bpPerPx = self.constrainBpPerPx(bpSoFar / self.width)
        const viewWidth = self.width
        if (viewWidth > bpSoFar / self.bpPerPx) {
          self.offsetPx = Math.round(
            (bpToStart - 1) / self.bpPerPx -
              (viewWidth - bpSoFar / self.bpPerPx) / 2,
          )
        } else {
          self.offsetPx = Math.round((bpToStart - 1) / self.bpPerPx)
        }
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

      scrollTo(offsetPx: number) {
        const newOffsetPx = clamp(offsetPx, self.minOffset, self.maxOffset)
        self.offsetPx = newOffsetPx
      },

      /**
       * scrolls the view to center on the given bp. if that is not in any
       * of the displayed regions, does nothing
       * @param {number} bp
       * @param {string} refName
       */
      centerAt(/* bp, refName */) {
        /* TODO */
      },

      setNewView(bpPerPx: number, offsetPx: number) {
        self.bpPerPx = bpPerPx
        self.offsetPx = offsetPx
      },

      showAllRegions() {
        self.bpPerPx = self.constrainBpPerPx(self.totalBp / self.width)
        self.offsetPx = 0
      },

      setDraggingTrackId(idx?: string) {
        self.draggingTrackId = idx
      },
    }))
    .actions(self => {
      let cancelLastAnimation = () => {}

      function slide(viewWidths: number) {
        const [animate, cancelAnimation] = springAnimate(
          self.offsetPx,
          self.offsetPx + self.width * viewWidths,
          self.scrollTo,
        )
        cancelLastAnimation()
        cancelLastAnimation = cancelAnimation
        animate()
      }

      return { slide }
    })
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
      let stringifiedCurrentlyCalculatedStaticBlocks = ''
      return {
        get menuOptions(): MenuOptions[] {
          const session: any = getSession(self)
          return [
            {
              label: 'Open track selector',
              onClick: self.activateTrackSelector,
              disabled:
                session.visibleDrawerWidget &&
                session.visibleDrawerWidget.id ===
                  'hierarchicalTrackSelector' &&
                session.visibleDrawerWidget.view.id === self.id,
            },
            {
              label: 'Horizontally flip',
              onClick: self.horizontallyFlip,
            },
            {
              label: 'Show all regions',
              onClick: self.showAllRegions,
            },
            {
              label: 'Show header',
              type: 'checkbox',
              checked: !self.hideHeader,
              onClick: self.toggleHeader,
            },
            {
              label: 'Show header overview',
              type: 'checkbox',
              checked: !self.hideHeaderOverview,
              onClick: self.toggleHeaderOverview,
              disabled: self.hideHeader,
            },
            {
              label: 'Show Center Line',
              type: 'checkbox',
              checked: self.showCenterLine,
              onClick: self.toggleCenterLine,
            },
          ]
        },

        get staticBlocks() {
          const ret = calculateStaticBlocks(cast(self), 1)
          const sret = JSON.stringify(ret)
          if (stringifiedCurrentlyCalculatedStaticBlocks !== sret) {
            currentlyCalculatedStaticBlocks = ret
            stringifiedCurrentlyCalculatedStaticBlocks = sret
          }
          return currentlyCalculatedStaticBlocks as BlockSet
        },

        get dynamicBlocks() {
          return calculateDynamicBlocks(cast(self))
        },
      }
    })
}
export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
