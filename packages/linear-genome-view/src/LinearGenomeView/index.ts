import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import BaseViewModel from '@gmod/jbrowse-core/BaseViewModel'
import { Region } from '@gmod/jbrowse-core/util/types'
import {
  ElementId,
  Region as MUIRegion,
} from '@gmod/jbrowse-core/util/types/mst'
import { MenuOption } from '@gmod/jbrowse-core/ui'
import {
  clamp,
  getContainingView,
  getSession,
  isViewContainer,
  parseLocStringAndConvertToInterbase,
  springAnimate,
  isSessionModelWithDrawerWidgets,
} from '@gmod/jbrowse-core/util'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { transaction } from 'mobx'
import { getSnapshot, types, cast, Instance } from 'mobx-state-tree'

import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import clone from 'clone'
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

export const HEADER_BAR_HEIGHT = 48
export const HEADER_OVERVIEW_HEIGHT = 20
export const SCALE_BAR_HEIGHT = 17
export const RESIZE_HANDLE_HEIGHT = 3

export function stateModelFactory(pluginManager: PluginManager) {
  const model = types
    .model('LinearGenomeView', {
      id: ElementId,
      type: types.literal('LinearGenomeView'),
      offsetPx: 0,
      bpPerPx: 1,
      displayedRegions: types.array(MUIRegion),
      // we use an array for the tracks because the tracks are displayed in a specific
      // order that we need to keep.
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      hideHeader: false,
      hideHeaderOverview: false,
      trackSelectorType: types.optional(
        types.enumeration(['hierarchical']),
        'hierarchical',
      ),
      minimumBlockWidth: 20,
      showTrackLabels: true,
      showCenterLine: false,
    })
    .volatile(() => ({
      width: 800,
      draggingTrackId: undefined as undefined | string,
      error: undefined as undefined | Error,

      // array of callbacks to run after the next set of the displayedRegions,
      // which is basically like an onLoad
      afterDisplayedRegionsSetCallbacks: [] as Function[],
      scaleFactor: 1,
    }))
    .views(self => ({
      get initialized() {
        return self.displayedRegions.length > 0
      },
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

      get maxBpPerPx() {
        return this.totalBp / 1000
      },

      get minBpPerPx() {
        return 1 / 50
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
       * @param px - px in the view area, return value is the displayed regions
       * @returns BpOffset of the displayed region that it lands in
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

      // modifies view menu action onClick to apply to all tracks of same type
      rewriteOnClicks(trackType: string, viewMenuActions: MenuOption[]) {
        viewMenuActions.forEach((action: MenuOption) => {
          // go to lowest level menu
          if ('subMenu' in action) {
            // @ts-ignore
            this.rewriteOnClicks(trackType, action.subMenu)
          }
          if ('onClick' in action) {
            const holdOnClick = action.onClick
            action.onClick = (...args: unknown[]) => {
              self.tracks.forEach(track => {
                if (track.type === trackType) {
                  // @ts-ignore
                  holdOnClick.apply(track, [track, ...args])
                }
              })
            }
          }
        })
      },

      get trackTypeActions() {
        const allActions: Map<string, MenuOption[]> = new Map()
        self.tracks.forEach(track => {
          const trackInMap = allActions.get(track.type)
          if (!trackInMap) {
            const viewMenuActions = clone(track.viewMenuActions)
            // @ts-ignore
            this.rewriteOnClicks(track.type, viewMenuActions)
            allActions.set(track.type, viewMenuActions)
          }
        })

        return allActions
      },

      get centerLineInfo() {
        const centerLineInfo = self.displayedRegions.length
          ? this.pxToBp(self.width / 2)
          : undefined
        return centerLineInfo
      },
    }))
    .actions(self => ({
      setWidth(newWidth: number) {
        self.width = newWidth
      },

      setError(error: Error | undefined) {
        self.error = error
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

      showTrack(configuration: AnyConfigurationModel, initialSnapshot = {}) {
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

      hideTrack(configuration: AnyConfigurationModel) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },
    }))
    .actions(self => ({
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
        const parent = getContainingView(self)
        if (parent) {
          // I am embedded in a some other view
          if (isViewContainer(parent)) parent.removeView(self)
        } else {
          // I am part of a session
          getSession(self).removeView(self)
        }
      },

      toggleTrack(configuration: AnyConfigurationModel) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) self.showTrack(configuration)
      },

      toggleTrackLabels() {
        self.showTrackLabels = !self.showTrackLabels
      },

      toggleCenterLine() {
        self.showCenterLine = !self.showCenterLine
      },

      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        this.zoomTo(self.bpPerPx)
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithDrawerWidgets(session)) {
            const selector = session.addDrawerWidget(
              'HierarchicalTrackSelectorDrawerWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            session.showDrawerWidget(selector)
            return selector
          }
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
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

      navToLocString(locString: string) {
        const session = getSession(self)
        const { isValidRefName } = session.assemblyManager
        this.navTo(
          parseLocStringAndConvertToInterbase(locString, isValidRefName),
        )
      },

      /**
       * navTo navigates to a simple refName:start..end type object as input.
       * can handle if there are multiple displayedRegions from same chr.
       * only navigates to a locString if it is entirely within a
       * displayedRegion.
       *
       * @param location - a proposed
       * location to navigate to
       * throws an error if navigation was unsuccessful
       */
      navTo(query: {
        refName: string
        start?: number
        end?: number
        assemblyName?: string
      }) {
        let { refName } = query
        const { start, end, assemblyName } = query
        if (start !== undefined && end !== undefined && start > end) {
          throw new Error(`start "${start + 1}" is greater than end "${end}"`)
        }
        const session = getSession(self)
        const assembly = session.assemblyManager.get(
          assemblyName || self.assemblyNames[0],
        )
        if (assembly) {
          const canonicalRefName = assembly.getCanonicalRefName(refName)
          if (canonicalRefName) {
            refName = canonicalRefName
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
          { index, offset: f.reversed ? f.end - e : s - f.start },
          { index, offset: f.reversed ? f.end - s : e - f.start },
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
            bpToStart / self.bpPerPx -
              (self.width - bpSoFar / self.bpPerPx) / 2,
          )
        } else {
          self.offsetPx = Math.round(bpToStart / self.bpPerPx)
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
       * @param bp -
       * @param refName -
       */
      centerAt(/* bp, refName */) {
        /* TODO */
      },

      setNewView(bpPerPx: number, offsetPx: number) {
        self.bpPerPx = bpPerPx
        self.offsetPx = offsetPx
      },

      showAllRegions() {
        self.bpPerPx = self.totalBp / self.width
        self.offsetPx = 0
      },

      setDraggingTrackId(idx?: string) {
        self.draggingTrackId = idx
      },

      setScaleFactor(factor: number) {
        self.scaleFactor = factor
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
    .actions(self => {
      let cancelLastAnimation = () => {}

      function zoom(targetBpPerPx: number) {
        self.zoomTo(self.bpPerPx)
        if (
          // already zoomed all the way in
          self.bpPerPx === self.minBpPerPx ||
          // already zoomed all the way out
          self.bpPerPx === self.maxBpPerPx
        ) {
          return
        }
        const factor = self.bpPerPx / targetBpPerPx
        const [animate, cancelAnimation] = springAnimate(
          1,
          factor,
          self.setScaleFactor,
          () => {
            self.zoomTo(targetBpPerPx)
            self.setScaleFactor(1)
          },
        )
        cancelLastAnimation()
        cancelLastAnimation = cancelAnimation
        animate()
      }

      return { zoom }
    })
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
      let stringifiedCurrentlyCalculatedStaticBlocks = ''
      return {
        get menuOptions(): MenuOption[] {
          const session = getSession(self)
          const menuOptions: MenuOption[] = [
            {
              label: 'Open track selector',
              onClick: self.activateTrackSelector,
              icon: 'line_style',
              disabled:
                isSessionModelWithDrawerWidgets(session) &&
                session.visibleDrawerWidget &&
                session.visibleDrawerWidget.id ===
                  'hierarchicalTrackSelector' &&
                // @ts-ignore
                session.visibleDrawerWidget.view.id === self.id,
            },
            {
              label: 'Horizontally flip',
              icon: 'sync_alt',
              onClick: self.horizontallyFlip,
            },
            {
              label: 'Show all regions',
              icon: 'visibility',
              onClick: self.showAllRegions,
            },
            {
              label: 'Show header',
              icon: 'visibility',
              type: 'checkbox',
              checked: !self.hideHeader,
              onClick: self.toggleHeader,
            },
            {
              label: 'Show header overview',
              icon: 'visibility',
              type: 'checkbox',
              checked: !self.hideHeaderOverview,
              onClick: self.toggleHeaderOverview,
              disabled: self.hideHeader,
            },
            {
              label: 'Show track labels',
              icon: 'visibility',
              type: 'checkbox',
              checked: self.showTrackLabels,
              onClick: self.toggleTrackLabels,
            },
            {
              label: 'Show center line',
              icon: 'visibility',
              type: 'checkbox',
              checked: self.showCenterLine,
              onClick: self.toggleCenterLine,
            },
          ]

          // add track's view level menu options
          for (const [key, value] of self.trackTypeActions.entries()) {
            if (value.length) {
              menuOptions.push(
                { type: 'divider' },
                { type: 'subHeader', label: key },
              )
              value.forEach(action => {
                menuOptions.push(action)
              })
            }
          }

          return menuOptions
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

  return types.compose(BaseViewModel, model)
}
export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>
