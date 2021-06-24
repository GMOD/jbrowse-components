import { getConf } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { Region } from '@jbrowse/core/util/types'
import { ElementId, Region as MUIRegion } from '@jbrowse/core/util/types/mst'
import { MenuItem } from '@jbrowse/core/ui'
import {
  assembleLocString,
  clamp,
  findLastIndex,
  getContainingView,
  getSession,
  isViewContainer,
  parseLocString,
  springAnimate,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { BlockSet, BaseBlock } from '@jbrowse/core/util/blockTypes'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
// misc
import { transaction, autorun } from 'mobx'
import {
  getSnapshot,
  types,
  cast,
  Instance,
  getRoot,
  resolveIdentifier,
  addDisposer,
} from 'mobx-state-tree'

import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import PluginManager from '@jbrowse/core/PluginManager'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import SyncAltIcon from '@material-ui/icons/SyncAlt'
import VisibilityIcon from '@material-ui/icons/Visibility'
import LabelIcon from '@material-ui/icons/Label'
import FolderOpenIcon from '@material-ui/icons/FolderOpen'
import clone from 'clone'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { saveAs } from 'file-saver'
import { renderToSvg } from './components/LinearGenomeView'
import ExportSvgDlg from './components/ExportSvgDialog'
import ReturnToImportFormDlg from './components/ReturnToImportFormDialog'

export { default as ReactComponent } from './components/LinearGenomeView'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
  coord?: number
  reversed?: boolean
  assemblyName?: string
  oob?: boolean
}

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
}

function calculateVisibleLocStrings(contentBlocks: BaseBlock[]) {
  if (!contentBlocks.length) {
    return ''
  }
  const isSingleAssemblyName = contentBlocks.every(
    block => block.assemblyName === contentBlocks[0].assemblyName,
  )
  const locs = contentBlocks.map(block =>
    assembleLocString({
      ...block,
      start: Math.round(block.start),
      end: Math.round(block.end),
      assemblyName: isSingleAssemblyName ? undefined : block.assemblyName,
    }),
  )
  return locs.join(';')
}

export interface NavLocation {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export const HEADER_BAR_HEIGHT = 48
export const HEADER_OVERVIEW_HEIGHT = 20
export const SCALE_BAR_HEIGHT = 17
export const RESIZE_HANDLE_HEIGHT = 3
export const INTER_REGION_PADDING_WIDTH = 2

export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      BaseViewModel,
      types.model('LinearGenomeView', {
        id: ElementId,
        type: types.literal('LinearGenomeView'),
        offsetPx: 0,
        bpPerPx: 1,
        displayedRegions: types.array(MUIRegion),

        // we use an array for the tracks because the tracks are displayed in a
        // specific order that we need to keep.
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        hideHeader: false,
        hideHeaderOverview: false,
        trackSelectorType: types.optional(
          types.enumeration(['hierarchical']),
          'hierarchical',
        ),
        trackLabels: 'overlapping' as 'overlapping' | 'hidden' | 'offset',
        showCenterLine: false,
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,
      minimumBlockWidth: 3,
      draggingTrackId: undefined as undefined | string,
      error: undefined as undefined | Error,

      // array of callbacks to run after the next set of the displayedRegions,
      // which is basically like an onLoad
      afterDisplayedRegionsSetCallbacks: [] as Function[],
      scaleFactor: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trackRefs: {} as { [key: string]: any },
      coarseDynamicBlocks: [] as BaseBlock[],
      coarseTotalBp: 0,
      leftOffset: undefined as undefined | BpOffset,
      rightOffset: undefined as undefined | BpOffset,
      searchResults: undefined as undefined | BaseResult[],
      searchQuery: undefined as undefined | string,
    }))
    .views(self => ({
      get width(): number {
        if (self.volatileWidth === undefined) {
          throw new Error(
            'width undefined, make sure to check for model.initialized',
          )
        }
        return self.volatileWidth
      },
    }))
    .views(self => ({
      get initialized() {
        const { assemblyManager } = getSession(self)

        // if the assemblyManager is tracking a given assembly name, wait for
        // it to be loaded. this is done by looking in the assemblyManager's
        // assembly list, and then waiting on it's initialized state which is
        // updated later
        const assembliesInitialized = this.assemblyNames.every(assemblyName => {
          if (
            assemblyManager.assemblyList
              ?.map(asm => asm.name)
              .includes(assemblyName)
          ) {
            return (assemblyManager.get(assemblyName) || {}).initialized
          }
          return true
        })

        return self.volatileWidth !== undefined && assembliesInitialized
      },
      get hasDisplayedRegions() {
        return self.displayedRegions.length > 0
      },
      get isSeqDialogDisplayed() {
        return self.leftOffset && self.rightOffset
      },
      get isSearchDialogDisplayed() {
        return self.searchResults !== undefined
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
        return self.tracks
          .map(t => t.displays[0].height)
          .reduce((a, b) => a + b, 0)
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
      get interRegionPaddingWidth() {
        return INTER_REGION_PADDING_WIDTH
      },
      get totalBp() {
        let totalbp = 0
        self.displayedRegions.forEach(region => {
          totalbp += region.end - region.start
        })
        return totalbp
      },

      get maxBpPerPx() {
        return this.totalBp / (self.width * 0.9)
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
        return [
          ...new Set(self.displayedRegions.map(region => region.assemblyName)),
        ]
      },
      searchScope(assemblyName: string) {
        return {
          assemblyName,
          includeAggregateIndexes: true,
          tracks: self.tracks,
        }
      },

      /**
       * @param refName - refName of the displayedRegion
       * @param coord - coordinate at the displayed Region
       * @param regionNumber - optional param used as identifier when
       * there are multiple displayedRegions with the same refName
       * @returns offsetPx of the displayed region that it lands in
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

        const interRegionPaddingBp = this.interRegionPaddingWidth * self.bpPerPx
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
          // e.g. offset>=0 && offset<width
          if (
            len > minimumBlockBp &&
            offsetBp / self.bpPerPx >= 0 &&
            offsetBp / self.bpPerPx < self.width
          ) {
            offsetBp += len + interRegionPaddingBp
          } else {
            offsetBp += len
          }
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

        const interRegionPaddingBp = this.interRegionPaddingWidth * self.bpPerPx
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
            offset / self.bpPerPx < self.width
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
          refName: '',
          oob: true,
          assemblyName: '',
          offset: 0,
          start: 0,
          end: 0,
          reversed: false,
        }
      },

      getTrack(id: string) {
        return self.tracks.find(t => t.configuration.trackId === id)
      },

      rankSearchResults(results: BaseResult[]) {
        // order of rank
        const openTrackIds = self.tracks.map(
          track => track.configuration.trackId,
        )
        results.forEach(result => {
          if (openTrackIds !== []) {
            if (openTrackIds.includes(result.trackId)) {
              result.updateScore(result.getScore() + 1)
            }
          }
        })
        return results
      },

      // modifies view menu action onClick to apply to all tracks of same type
      rewriteOnClicks(trackType: string, viewMenuActions: MenuItem[]) {
        viewMenuActions.forEach((action: MenuItem) => {
          // go to lowest level menu
          if ('subMenu' in action) {
            this.rewriteOnClicks(trackType, action.subMenu)
          }
          if ('onClick' in action) {
            const holdOnClick = action.onClick
            action.onClick = (...args: unknown[]) => {
              self.tracks.forEach(track => {
                if (track.type === trackType) {
                  holdOnClick.apply(track, [track, ...args])
                }
              })
            }
          }
        })
      },

      get trackTypeActions() {
        const allActions: Map<string, MenuItem[]> = new Map()
        self.tracks.forEach(track => {
          const trackInMap = allActions.get(track.type)
          if (!trackInMap) {
            const viewMenuActions = clone(track.viewMenuActions)
            this.rewriteOnClicks(track.type, viewMenuActions)
            allActions.set(track.type, viewMenuActions)
          }
        })

        return allActions
      },

      get centerLineInfo() {
        return self.displayedRegions.length
          ? this.pxToBp(self.width / 2)
          : undefined
      },
    }))
    .actions(self => ({
      setWidth(newWidth: number) {
        self.volatileWidth = newWidth
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

      scrollTo(offsetPx: number) {
        const newOffsetPx = clamp(offsetPx, self.minOffset, self.maxOffset)
        self.offsetPx = newOffsetPx
        return newOffsetPx
      },

      zoomTo(bpPerPx: number) {
        const newBpPerPx = clamp(bpPerPx, self.minBpPerPx, self.maxBpPerPx)
        if (newBpPerPx === self.bpPerPx) {
          return newBpPerPx
        }
        const oldBpPerPx = self.bpPerPx
        self.bpPerPx = newBpPerPx

        if (Math.abs(oldBpPerPx - newBpPerPx) < 0.000001) {
          console.warn('zoomTo bpPerPx rounding error')
          return oldBpPerPx
        }

        // tweak the offset so that the center of the view remains at the same coordinate
        const viewWidth = self.width
        this.scrollTo(
          Math.round(
            ((self.offsetPx + viewWidth / 2) * oldBpPerPx) / newBpPerPx -
              viewWidth / 2,
          ),
        )
        return newBpPerPx
      },

      setOffsets(left: undefined | BpOffset, right: undefined | BpOffset) {
        // sets offsets used in the get sequence dialog
        self.leftOffset = left
        self.rightOffset = right
      },

      setSearchResults(
        results: BaseResult[] | undefined,
        query: string | undefined,
      ) {
        self.searchResults = results
        self.searchQuery = query
      },

      setNewView(bpPerPx: number, offsetPx: number) {
        this.zoomTo(bpPerPx)
        this.scrollTo(offsetPx)
      },

      horizontallyFlip() {
        self.displayedRegions = cast(
          self.displayedRegions
            .slice()
            .reverse()
            .map(region => ({ ...region, reversed: !region.reversed })),
        )
        this.scrollTo(self.totalBp / self.bpPerPx - self.offsetPx - self.width)
      },

      showTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
      ) {
        const trackConfigSchema = pluginManager.pluggableConfigSchemaType(
          'track',
        )
        const configuration = resolveIdentifier(
          trackConfigSchema,
          getRoot(self),
          trackId,
        )
        const trackType = pluginManager.getTrackType(configuration.type)
        if (!trackType) {
          throw new Error(`unknown track type ${configuration.type}`)
        }
        const viewType = pluginManager.getViewType(self.type)
        const supportedDisplays = viewType.displayTypes.map(
          displayType => displayType.name,
        )
        const displayConf = configuration.displays.find(
          (d: AnyConfigurationModel) => supportedDisplays.includes(d.type),
        )
        if (!displayConf) {
          throw new Error(
            `could not find a compatible display for view type ${self.type}`,
          )
        }
        const track = trackType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
          displays: [
            {
              type: displayConf.type,
              configuration: displayConf,
              ...displayInitialSnapshot,
            },
          ],
        })
        self.tracks.push(track)
        return track
      },

      hideTrack(trackId: string) {
        const trackConfigSchema = pluginManager.pluggableConfigSchemaType(
          'track',
        )
        const configuration = resolveIdentifier(
          trackConfigSchema,
          getRoot(self),
          trackId,
        )
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
        if (oldIndex === -1) {
          throw new Error(`Track ID ${movingTrackId} not found`)
        }
        const newIndex = self.tracks.findIndex(
          track => track.id === targetTrackId,
        )
        if (newIndex === -1) {
          throw new Error(`Track ID ${targetTrackId} not found`)
        }
        const track = getSnapshot(self.tracks[oldIndex])
        self.tracks.splice(oldIndex, 1)
        self.tracks.splice(newIndex, 0, track)
      },

      closeView() {
        const parent = getContainingView(self)
        if (parent) {
          // I am embedded in a some other view
          if (isViewContainer(parent)) {
            parent.removeView(self)
          }
        } else {
          // I am part of a session
          getSession(self).removeView(self)
        }
      },

      toggleTrack(trackId: string) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(trackId)
        // if none had that configuration, turn one on
        if (!hiddenCount) {
          self.showTrack(trackId)
        }
      },

      setTrackLabels(setting: 'overlapping' | 'offset' | 'hidden') {
        self.trackLabels = setting
      },

      toggleCenterLine() {
        self.showCenterLine = !self.showCenterLine
      },

      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        self.zoomTo(self.bpPerPx)
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            session.showWidget(selector)
            return selector
          }
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },
      navToLocString(locString: string, optAssemblyName?: string) {
        const { assemblyManager } = getSession(self)
        const { isValidRefName } = assemblyManager
        const locStrings = locString.split(';')
        if (self.displayedRegions.length > 1) {
          const locations = locStrings.map(ls =>
            parseLocString(ls, isValidRefName),
          )
          this.navToMultiple(locations)
          return
        }
        let assemblyName = optAssemblyName
        let defaultRefName = ''
        if (self.displayedRegions.length !== 0) {
          // defaults
          assemblyName = self.displayedRegions[0].assemblyName
          defaultRefName = self.displayedRegions[0].refName
        }
        let assembly = assemblyName && assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly ${assemblyName}`)
        }
        let { regions } = assembly
        if (!regions) {
          throw new Error(`Regions for assembly ${assemblyName} not yet loaded`)
        }
        if (locStrings.length > 1) {
          throw new Error(
            'Navigating to multiple locations is not allowed when viewing a whole chromosome',
          )
        }
        const parsedLocString = parseLocString(locStrings[0], refName =>
          isValidRefName(refName, assemblyName),
        )
        let changedAssembly = false
        if (
          parsedLocString.assemblyName &&
          parsedLocString.assemblyName !== assemblyName
        ) {
          const newAssembly = assemblyManager.get(parsedLocString.assemblyName)
          if (!newAssembly) {
            throw new Error(
              `Could not find assembly ${parsedLocString.assemblyName}`,
            )
          }
          assembly = newAssembly
          changedAssembly = true
          const newRegions = newAssembly.regions
          if (!newRegions) {
            throw new Error(
              `Regions for assembly ${parsedLocString.assemblyName} not yet loaded`,
            )
          }
          regions = newRegions
        }
        const canonicalRefName = assembly.getCanonicalRefName(
          parsedLocString.refName,
        )

        if (!canonicalRefName) {
          throw new Error(
            `Could not find refName ${parsedLocString.refName} in ${assembly.name}`,
          )
        }
        if (changedAssembly || canonicalRefName !== defaultRefName) {
          const newDisplayedRegion = regions.find(
            region => region.refName === canonicalRefName,
          )
          if (newDisplayedRegion) {
            this.setDisplayedRegions([newDisplayedRegion])
          } else {
            throw new Error(
              `Could not find refName ${parsedLocString.refName} in ${assembly.name}`,
            )
          }
        }
        const displayedRegion = regions.find(
          region => region.refName === canonicalRefName,
        )
        if (displayedRegion) {
          const start = clamp(
            parsedLocString?.start ?? 0,
            0,
            displayedRegion.end,
          )
          const end = clamp(
            parsedLocString?.end ?? displayedRegion.end,
            0,
            displayedRegion.end,
          )

          this.navTo({
            ...parsedLocString,
            start,
            end,
          })
        }
      },

      /**
       * Navigate to a location based on its refName and optionally start, end,
       * and assemblyName. Can handle if there are multiple displayedRegions
       * from same refName. Only navigates to a location if it is entirely
       * within a displayedRegion. Navigates to the first matching location
       * encountered.
       *
       * Throws an error if navigation was unsuccessful
       *
       * @param location - a proposed location to navigate to
       */
      navTo(query: NavLocation) {
        this.navToMultiple([query])
      },

      navToMultiple(locations: NavLocation[]) {
        const firstLocation = locations[0]
        let { refName } = firstLocation
        const {
          start,
          end,
          assemblyName = self.assemblyNames[0],
        } = firstLocation

        if (start !== undefined && end !== undefined && start > end) {
          throw new Error(`start "${start + 1}" is greater than end "${end}"`)
        }
        const session = getSession(self)
        const { assemblyManager } = session
        const assembly = assemblyManager.get(assemblyName)
        if (assembly) {
          const canonicalRefName = assembly.getCanonicalRefName(refName)
          if (canonicalRefName) {
            refName = canonicalRefName
          }
        }
        let s = start
        let e = end
        let refNameMatched = false
        const predicate = (r: Region) => {
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
        }

        const lastIndex = findLastIndex(self.displayedRegions, predicate)
        let index
        while (index !== lastIndex) {
          try {
            const previousIndex: number | undefined = index
            index = self.displayedRegions
              .slice(previousIndex === undefined ? 0 : previousIndex + 1)
              .findIndex(predicate)
            if (previousIndex !== undefined) {
              index += previousIndex + 1
            }
            if (!refNameMatched) {
              throw new Error(
                `could not find a region with refName "${refName}"`,
              )
            }
            if (s === undefined) {
              throw new Error(
                `could not find a region with refName "${refName}" that contained an end position ${e}`,
              )
            }
            if (e === undefined) {
              throw new Error(
                `could not find a region with refName "${refName}" that contained a start position ${
                  s + 1
                }`,
              )
            }
            if (index === -1) {
              throw new Error(
                `could not find a region that completely contained "${assembleLocString(
                  firstLocation,
                )}"`,
              )
            }
            if (locations.length === 1) {
              const f = self.displayedRegions[index]
              this.moveTo(
                { index, offset: f.reversed ? f.end - e : s - f.start },
                { index, offset: f.reversed ? f.end - s : e - f.start },
              )
              return
            }
            let locationIndex = 0
            let locationStart = 0
            let locationEnd = 0
            for (
              locationIndex;
              locationIndex < locations.length;
              locationIndex++
            ) {
              const location = locations[locationIndex]
              const region = self.displayedRegions[index + locationIndex]
              locationStart = location.start || region.start
              locationEnd = location.end || region.end
              if (location.refName !== region.refName) {
                throw new Error(
                  `Entered location ${assembleLocString(
                    location,
                  )} does not match with displayed regions`,
                )
              }
              if (locationIndex > 0) {
                // does it reach the left side?
                const matchesLeft = region.reversed
                  ? locationEnd === region.end
                  : locationStart === region.start
                if (!matchesLeft) {
                  throw new Error(
                    `${
                      region.reversed ? 'End' : 'Start'
                    } of region ${assembleLocString(
                      location,
                    )} should be ${(region.reversed
                      ? region.end
                      : region.start + 1
                    ).toLocaleString('en-US')}, but it is not`,
                  )
                }
              }
              const isLast = locationIndex === locations.length - 1
              if (!isLast) {
                // does it reach the right side?
                const matchesRight = region.reversed
                  ? locationStart === region.start
                  : locationEnd === region.end
                if (!matchesRight) {
                  throw new Error(
                    `${
                      region.reversed ? 'Start' : 'End'
                    } of region ${assembleLocString(
                      location,
                    )} should be ${(region.reversed
                      ? region.start + 1
                      : region.end
                    ).toLocaleString('en-US')}, but it is not`,
                  )
                }
              }
            }
            locationIndex -= 1
            const startDisplayedRegion = self.displayedRegions[index]
            const endDisplayedRegion =
              self.displayedRegions[index + locationIndex]
            this.moveTo(
              {
                index,
                offset: startDisplayedRegion.reversed
                  ? startDisplayedRegion.end - e
                  : s - startDisplayedRegion.start,
              },
              {
                index: index + locationIndex,
                offset: endDisplayedRegion.reversed
                  ? endDisplayedRegion.end - locationStart
                  : locationEnd - endDisplayedRegion.start,
              },
            )
            return
          } catch (error) {
            if (index === lastIndex) {
              throw error
            }
          }
        }
      },

      /**
       * Navigate to a location based on user clicking and dragging on the
       * overview scale bar to select a region to zoom into.
       * Can handle if there are multiple displayedRegions from same refName.
       * Only navigates to a location if it is entirely within a displayedRegion.
       *
       * @param leftPx- `object as {start, end, index, offset}`, offset = start of user drag
       * @param rightPx- `object as {start, end, index, offset}`, offset = end of user drag
       */
      zoomToDisplayedRegions(leftPx: BpOffset, rightPx: BpOffset) {
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
          const session = getSession(self)
          session.notify('No regions found to navigate to', 'warning')
        }
      },
      /**
       * Helper method for the fetchSequence.
       * Retrieves the corresponding regions that were selected by the rubberband
       *
       * @param leftOffset - `object as {start, end, index, offset}`, offset = start of user drag
       * @param rightOffset - `object as {start, end, index, offset}`, offset = end of user drag
       * @returns array of Region[]
       */
      getSelectedRegions(
        leftOffset: BpOffset | undefined,
        rightOffset: BpOffset | undefined,
      ) {
        const simView = Base1DView.create({
          ...getSnapshot(self),
          interRegionPaddingWidth: self.interRegionPaddingWidth,
        })

        simView.setVolatileWidth(self.width)
        simView.zoomToDisplayedRegions(leftOffset, rightOffset)

        return simView.dynamicBlocks.contentBlocks.map(region => {
          return {
            ...region,
            start: Math.floor(region.start),
            end: Math.ceil(region.end),
          }
        })
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
          bpSoFar += s.end - s.start - start.offset
          if (end.index - start.index >= 2) {
            for (let i = start.index + 1; i < end.index; i += 1) {
              bpSoFar +=
                self.displayedRegions[i].end - self.displayedRegions[i].start
            }
          }
          bpSoFar += end.offset
        }
        const targetBpPerPx =
          bpSoFar /
          (self.width -
            self.interRegionPaddingWidth * (end.index - start.index))
        const newBpPerPx = self.zoomTo(targetBpPerPx)
        // If our target bpPerPx was smaller than the allowed minBpPerPx, adjust
        // the scroll so the requested range is in the middle of the screen
        let extraBp = 0
        if (targetBpPerPx < newBpPerPx) {
          extraBp = ((newBpPerPx - targetBpPerPx) * self.width) / 2
        }

        let bpToStart = -extraBp
        for (let i = 0; i < self.displayedRegions.length; i += 1) {
          const region = self.displayedRegions[i]
          if (start.index === i) {
            bpToStart += start.offset
            break
          } else {
            bpToStart += region.end - region.start
          }
        }
        self.scrollTo(
          Math.round(bpToStart / self.bpPerPx) +
            self.interRegionPaddingWidth * start.index,
        )
      },

      horizontalScroll(distance: number) {
        const oldOffsetPx = self.offsetPx
        // newOffsetPx is the actual offset after the scroll is clamped
        const newOffsetPx = self.scrollTo(self.offsetPx + distance)
        return newOffsetPx - oldOffsetPx
      },

      /**
       * scrolls the view to center on the given bp. if that is not in any
       * of the displayed regions, does nothing
       * @param bp - basepair at which you want to center the view
       * @param refName - refName of the displayedRegion you are centering at
       * @param regionIndex - index of the displayedRegion
       */
      centerAt(bp: number, refName: string, regionIndex: number) {
        const centerPx = self.bpToPx({
          refName,
          coord: bp,
          regionNumber: regionIndex,
        })
        if (centerPx) {
          self.scrollTo(Math.round(centerPx.offsetPx - self.width / 2))
        }
      },

      center() {
        const centerBp = self.totalBp / 2
        self.scrollTo(Math.round(centerBp / self.bpPerPx - self.width / 2))
      },

      showAllRegions() {
        self.zoomTo(self.maxBpPerPx)
        this.center()
      },

      showAllRegionsInAssembly(assemblyName?: string) {
        const session = getSession(self)
        const { assemblyManager } = session
        if (!assemblyName) {
          const assemblyNames = [
            ...new Set(
              self.displayedRegions.map(region => region.assemblyName),
            ),
          ]
          if (assemblyNames.length > 1) {
            session.notify(
              `Can't perform this with multiple assemblies currently`,
            )
            return
          }

          ;[assemblyName] = assemblyNames
        }
        const assembly = assemblyManager.get(assemblyName)
        if (assembly) {
          const { regions } = assembly
          if (regions) {
            this.setDisplayedRegions(regions)
            self.zoomTo(self.maxBpPerPx)
            this.center()
          }
        }
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
          (targetBpPerPx < self.bpPerPx && self.bpPerPx === self.minBpPerPx) ||
          // already zoomed all the way out
          (targetBpPerPx > self.bpPerPx && self.bpPerPx === self.maxBpPerPx)
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
        get menuItems(): MenuItem[] {
          const menuItems: MenuItem[] = [
            {
              label: 'Return to import form',
              onClick: () => {
                getSession(self).setDialogComponent(ReturnToImportFormDlg, {
                  model: self,
                })
              },
              icon: FolderOpenIcon,
            },
            {
              label: 'Export SVG',
              onClick: () => {
                getSession(self).setDialogComponent(ExportSvgDlg, {
                  model: self,
                })
              },
            },
            {
              label: 'Open track selector',
              onClick: self.activateTrackSelector,
              icon: TrackSelectorIcon,
            },
            {
              label: 'Horizontally flip',
              icon: SyncAltIcon,
              onClick: self.horizontallyFlip,
            },
            {
              label: 'Show all regions in assembly',
              icon: VisibilityIcon,
              onClick: self.showAllRegionsInAssembly,
            },
            {
              label: 'Show center line',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showCenterLine,
              onClick: self.toggleCenterLine,
            },
            { type: 'divider' },
            {
              label: 'Show header',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: !self.hideHeader,
              onClick: self.toggleHeader,
            },
            {
              label: 'Show header overview',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: !self.hideHeaderOverview,
              onClick: self.toggleHeaderOverview,
              disabled: self.hideHeader,
            },
            {
              label: 'Track labels',
              icon: LabelIcon,
              subMenu: [
                {
                  label: 'Overlapping',
                  icon: VisibilityIcon,
                  type: 'radio',
                  checked: self.trackLabels === 'overlapping',
                  onClick: () => self.setTrackLabels('overlapping'),
                },
                {
                  label: 'Offset',
                  icon: VisibilityIcon,
                  type: 'radio',
                  checked: self.trackLabels === 'offset',
                  onClick: () => self.setTrackLabels('offset'),
                },
                {
                  label: 'Hidden',
                  icon: VisibilityIcon,
                  type: 'radio',
                  checked: self.trackLabels === 'hidden',
                  onClick: () => self.setTrackLabels('hidden'),
                },
              ],
            },
          ]

          // add track's view level menu options
          for (const [key, value] of self.trackTypeActions.entries()) {
            if (value.length) {
              menuItems.push(
                { type: 'divider' },
                { type: 'subHeader', label: key },
              )
              value.forEach(action => {
                menuItems.push(action)
              })
            }
          }

          return menuItems
        },

        get staticBlocks() {
          const ret = calculateStaticBlocks(self)
          const sret = JSON.stringify(ret)
          if (stringifiedCurrentlyCalculatedStaticBlocks !== sret) {
            currentlyCalculatedStaticBlocks = ret
            stringifiedCurrentlyCalculatedStaticBlocks = sret
          }
          return currentlyCalculatedStaticBlocks as BlockSet
        },

        get dynamicBlocks() {
          return calculateDynamicBlocks(self)
        },

        get roundedDynamicBlocks() {
          return this.dynamicBlocks.contentBlocks.map(block => {
            return {
              ...block,
              start: Math.floor(block.start),
              end: Math.ceil(block.end),
            }
          })
        },
        get visibleLocStrings() {
          return calculateVisibleLocStrings(this.dynamicBlocks.contentBlocks)
        },
        get coarseVisibleLocStrings() {
          return calculateVisibleLocStrings(self.coarseDynamicBlocks)
        },
      }
    })
    .actions(self => ({
      // this "clears the view" and makes the view return to the import form
      clearView() {
        self.setDisplayedRegions([])
        self.tracks.clear()
        // it is necessary to run these after setting displayed regions empty
        // or else model.offsetPx gets set to Infinity and breaks
        // mobx-state-tree snapshot
        self.scrollTo(0)
        self.zoomTo(10)
      },
      setCoarseDynamicBlocks(blocks: BlockSet) {
        self.coarseDynamicBlocks = blocks.contentBlocks
        self.coarseTotalBp = blocks.totalBp
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (self.initialized) {
                this.setCoarseDynamicBlocks(self.dynamicBlocks)
              }
            },
            { delay: 150 },
          ),
        )
      },
    }))
    .actions(self => ({
      async exportSvg(opts: ExportSvgOptions = {}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html = await renderToSvg(self as any, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, 'image.svg')
      },
    }))
}

export { renderToSvg }
export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>
