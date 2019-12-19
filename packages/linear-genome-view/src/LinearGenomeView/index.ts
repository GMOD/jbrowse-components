/* eslint-disable @typescript-eslint/no-explicit-any */
import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import { ElementId, Region, IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  clamp,
  getContainingView,
  getSession,
  parseLocString,
} from '@gmod/jbrowse-core/util'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { transaction } from 'mobx'
import { getParent, getSnapshot, types, cast } from 'mobx-state-tree'
import { BlockSet } from '../BasicTrack/util/blockTypes'
import calculateDynamicBlocks from '../BasicTrack/util/calculateDynamicBlocks'
import calculateStaticBlocks from '../BasicTrack/util/calculateStaticBlocks'

export { default as ReactComponent } from './components/LinearGenomeView'
export interface LGVMenuOption {
  title: string
  key: string
  callback: Function
  checked?: boolean
  isCheckbox: boolean
}
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
]

export const HEADER_BAR_HEIGHT = 50
export const SCALE_BAR_HEIGHT = 40

function constrainBpPerPx(newBpPerPx: number): number {
  // find the closest valid zoom level and return it
  // might consider reimplementing this later using a more efficient algorithm
  return validBpPerPx.sort(
    (a, b) => Math.abs(a - newBpPerPx) - Math.abs(b - newBpPerPx),
  )[0]
}

export function stateModelFactory(pluginManager: any) {
  return types
    .model('LinearGenomeView', {
      id: ElementId,
      type: types.literal('LinearGenomeView'),
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: types.array(Region),
      displayRegionsFromAssemblyName: types.maybe(types.string),
      displayName: types.maybe(types.string),
      reversed: false,
      // we use an array for the tracks because the tracks are displayed in a specific
      // order that we need to keep.
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      controlsWidth: 120,
      width: 800,
      // set this to true to hide the close, config, and tracksel buttons
      hideControls: false,
      hideHeader: false,
      hideCloseButton: false,
      trackSelectorType: types.optional(
        types.enumeration(['hierarchical']),
        'hierarchical',
      ),
      minimumBlockWidth: 20,
    })
    .volatile(() => ({
      draggingTrackId: undefined as undefined | string,
      error: undefined as undefined | Error,
    }))
    .views(self => ({
      get viewingRegionWidth() {
        return self.width - self.controlsWidth
      },
      get scaleBarHeight() {
        return SCALE_BAR_HEIGHT + 1 // 1px border
      },
      get headerHeight() {
        return self.hideHeader ? 0 : HEADER_BAR_HEIGHT + 1 // 1px border
      },
      get trackHeights() {
        return self.tracks.map(t => t.height).reduce((a, b) => a + b, 0)
      },
      get trackHeightsWithResizeHandles() {
        return this.trackHeights + self.tracks.length * 3
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
        this.displayedRegionsInOrder.forEach(region => {
          totalbp += region.end - region.start
        })
        return totalbp
      },

      get maxBpPerPx() {
        return constrainBpPerPx(this.totalBp / this.viewingRegionWidth)
      },

      get minBpPerPx() {
        return constrainBpPerPx(0)
      },

      get horizontallyFlipped() {
        return self.reversed
      },

      get displayedRegionsInOrder() {
        return self.reversed
          ? self.displayedRegions.slice().reverse()
          : self.displayedRegions
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
          horizontallyFlipped: this.horizontallyFlipped,
        }
      },

      bpToPx({ refName, coord }: { refName: string; coord: number }) {
        let offsetBp = 0
        const index = this.displayedRegionsInOrder.findIndex(r => {
          if (refName === r.refName && coord >= r.start && coord <= r.end) {
            offsetBp += coord - r.start
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
       * @returns {Array} of the displayed region that it lands in
       */
      pxToBp(px: number) {
        const bp = (self.offsetPx + px) * self.bpPerPx + 1
        let bpSoFar = 0
        let r = this.displayedRegionsInOrder[0]
        if (bp < 0) {
          return {
            ...r,
            offset: Math.round(bp),
            index: 0,
          }
        }
        for (
          let index = 0;
          index < this.displayedRegionsInOrder.length;
          index += 1
        ) {
          r = this.displayedRegionsInOrder[index]
          if (r.end - r.start + bpSoFar > bp && bpSoFar <= bp) {
            return { ...r, offset: Math.round(bp - bpSoFar), index }
          }
          bpSoFar += r.end - r.start
        }

        return {
          ...r,
          offset: Math.round(bp - bpSoFar),
          index: this.displayedRegionsInOrder.length,
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
          accum += self.tracks[i].height + 3 // +1px for trackresizehandle
        }
        return accum
      },
    }))
    .actions(self => ({
      setWidth(newWidth: number) {
        self.width = newWidth
      },

      setError(error: Error) {
        self.error = error
      },

      setDisplayName(name: string) {
        self.displayName = name
      },

      toggleHeader() {
        self.hideHeader = !self.hideHeader
      },

      horizontallyFlip() {
        self.reversed = !self.reversed
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

      setDisplayedRegions(regions: IRegion[], isFromAssemblyName = false) {
        try {
          self.displayedRegions = cast(regions)
          if (!isFromAssemblyName)
            this.setDisplayedRegionsFromAssemblyName(undefined)
        } catch (error) {
          console.error(error)
        }
      },

      setDisplayedRegionsFromAssemblyName(assemblyName: string | undefined) {
        self.displayRegionsFromAssemblyName = assemblyName
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

      zoomTo(newBpPerPx: number) {
        let bpPerPx = clamp(newBpPerPx, self.minBpPerPx, self.maxBpPerPx)
        bpPerPx = constrainBpPerPx(newBpPerPx)
        if (bpPerPx === self.bpPerPx) return
        const oldBpPerPx = self.bpPerPx
        self.bpPerPx = bpPerPx

        // tweak the offset so that the center of the view remains at the same coordinate
        const viewWidth = self.viewingRegionWidth
        self.offsetPx = Math.round(
          ((self.offsetPx + viewWidth / 2) * oldBpPerPx) / bpPerPx -
            viewWidth / 2,
        )
      },

      navToLocstring(locstring: string) {
        const parsed = parseLocString(locstring) as IRegion
        return this.navTo(parsed)
      },

      /*
       * navTo navigates to a simple refName:start..end type object as input
       * can handle if there are multiple displayedRegions from same chr
       * only navigates to a locstring if it is entirely within a displayedRegion
       *
       * @param {refName,start,end} is a proposed location to navigate to
       * returns true if navigation was successful, false if not
       */
      navTo({
        refName = '',
        start,
        end,
      }: {
        assemblyName?: string
        start?: number
        end?: number
        refName?: string
      }) {
        let s = start
        let e = end
        const index = self.displayedRegionsInOrder.findIndex(r => {
          if (refName === r.refName) {
            if (s === undefined) {
              s = r.start
            }
            if (e === undefined) {
              e = r.end
            }
            if (s >= r.start && e <= r.end) {
              return true
            }
          }
          return false
        })
        if (s === undefined) {
          return false
        }
        if (e === undefined) {
          return false
        }
        const f = self.displayedRegionsInOrder[index]
        if (index !== -1) {
          this.moveTo(
            { index, offset: s - f.start },
            { index, offset: e - f.start },
          )
          return true
        }
        return false
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
          const s = self.displayedRegionsInOrder[start.index]
          bpSoFar += s.end - start.offset
          if (end.index - start.index >= 2) {
            for (let i = start.index + 1; i < end.index; i += 1) {
              bpSoFar +=
                self.displayedRegionsInOrder[i].end -
                self.displayedRegionsInOrder[i].start
            }
          }
          bpSoFar += end.offset
        }
        let bpToStart = 0
        for (let i = 0; i < self.displayedRegionsInOrder.length; i += 1) {
          const region = self.displayedRegionsInOrder[i]
          if (start.index === i) {
            bpToStart += start.offset
            break
          } else {
            bpToStart += region.end - region.start
          }
        }
        self.bpPerPx = clamp(
          bpSoFar / self.width,
          self.minBpPerPx,
          self.maxBpPerPx,
        )
        self.offsetPx = bpToStart / self.bpPerPx
      },

      horizontalScroll(distance: number) {
        const oldOffsetPx = self.offsetPx
        // objectively determined to keep the linear genome on the main screen
        const leftPadding = 10
        const rightPadding = 30
        const maxOffset = self.displayedRegionsTotalPx - leftPadding
        const minOffset = -self.viewingRegionWidth + rightPadding
        // the scroll is clamped to keep the linear genome on the main screen
        const newOffsetPx = clamp(
          self.offsetPx + distance,
          minOffset,
          maxOffset,
        )
        self.offsetPx = newOffsetPx
        return newOffsetPx - oldOffsetPx
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
        self.bpPerPx = self.totalBp / self.viewingRegionWidth
        self.offsetPx = 0
      },

      setDraggingTrackId(idx?: string) {
        self.draggingTrackId = idx
      },
    }))
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
      let stringifiedCurrentlyCalculatedStaticBlocks = ''
      return {
        get menuOptions(): LGVMenuOption[] {
          return [
            {
              title: 'Horizontally flip',
              key: 'flip',
              callback: self.horizontallyFlip,
              checked: self.horizontallyFlipped,
              isCheckbox: true,
            },
            {
              title: 'Show all regions',
              key: 'showall',
              callback: self.showAllRegions,
              isCheckbox: false,
            },
            {
              title: self.hideHeader ? 'Show header' : 'Hide header',
              key: 'hide_header',
              callback: self.toggleHeader,
              isCheckbox: false,
            },
          ]
        },

        get staticBlocks() {
          const ret = calculateStaticBlocks(
            cast(self),
            self.horizontallyFlipped,
            1,
          )
          const sret = JSON.stringify(ret)
          if (stringifiedCurrentlyCalculatedStaticBlocks !== sret) {
            currentlyCalculatedStaticBlocks = ret
            stringifiedCurrentlyCalculatedStaticBlocks = sret
          }
          return currentlyCalculatedStaticBlocks as BlockSet
        },

        get dynamicBlocks() {
          return calculateDynamicBlocks(cast(self), self.horizontallyFlipped)
        },

        get assemblyNames() {
          const assemblyNames: string[] = []
          self.displayedRegions.forEach(displayedRegion => {
            if (!assemblyNames.includes(displayedRegion.assemblyName))
              assemblyNames.push(displayedRegion.assemblyName)
          })
          return assemblyNames
        },
      }
    })
    .postProcessSnapshot(self => {
      if (self.displayRegionsFromAssemblyName) {
        const { displayedRegions, ...rest } = self
        return rest
      }
      return self
    })
}
export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
