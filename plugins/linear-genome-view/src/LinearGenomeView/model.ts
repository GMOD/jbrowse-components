import type React from 'react'
import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  assembleLocString,
  clamp,
  findLast,
  getBpDisplayStr,
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageSetItem,
  measureText,
  parseLocString,
  springAnimate,
  sum,
} from '@jbrowse/core/util'
import { bpToPx, moveTo, pxToBp } from '@jbrowse/core/util/Base1DUtils'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import {
  getParentRenderProps,
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  addDisposer,
  cast,
  getParent,
  getSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import { isSessionWithMultipleViews } from '@jbrowse/product-core'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LabelIcon from '@mui/icons-material/Label'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import { autorun, when } from 'mobx'

import { handleSelectedRegion } from '../searchUtils'
import Header from './components/Header'
import MiniControls from './components/MiniControls'
import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  INTER_REGION_PADDING_WIDTH,
  RESIZE_HANDLE_HEIGHT,
  SCALE_BAR_HEIGHT,
} from './consts'
import {
  calculateVisibleLocStrings,
  generateLocations,
  parseLocStrings,
} from './util'

import type {
  BpOffset,
  ExportSvgOptions,
  HighlightType,
  InitState,
  NavLocation,
} from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ParsedLocString } from '@jbrowse/core/util'
import type { BaseBlock, BlockSet } from '@jbrowse/core/util/blockTypes'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

// lazies
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
const SequenceSearchDialog = lazy(
  () => import('./components/SequenceSearchDialog'),
)
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))
const GetSequenceDialog = lazy(() => import('./components/GetSequenceDialog'))
const SearchResultsDialog = lazy(
  () => import('./components/SearchResultsDialog'),
)

/**
 * #stateModel LinearGenomeView
 * #category view
 *
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearGenomeView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,

        /**
         * #property
         * this is a string instead of the const literal 'LinearGenomeView' to
         * reduce some typescripting strictness, but you should pass the string
         * 'LinearGenomeView' to the model explicitly
         */
        type: types.literal('LinearGenomeView') as unknown as string,

        /**
         * #property
         * corresponds roughly to the horizontal scroll of the LGV
         */
        offsetPx: 0,

        /**
         * #property
         * corresponds roughly to the zoom level, base-pairs per pixel
         */
        bpPerPx: 1,

        /**
         * #property
         * currently displayed regions, can be a single chromosome, arbitrary
         * subsections, or the entire  set of chromosomes in the genome, but it not
         * advised to use the entire set of chromosomes if your assembly is very
         * fragmented
         */
        displayedRegions: types.optional(types.frozen<Region[]>(), []),

        /**
         * #property
         * array of currently displayed tracks state models instances
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),

        /**
         * #property
         */
        hideHeader: false,

        /**
         * #property
         */
        hideHeaderOverview: false,

        /**
         * #property
         */
        hideNoTracksActive: false,

        /**
         * #property
         */
        trackSelectorType: types.optional(
          types.enumeration(['hierarchical']),
          'hierarchical',
        ),
        /**
         * #property
         * show the "center line"
         */
        showCenterLine: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCenterLine', false),
        ),

        /**
         * #property
         * show the "cytobands" in the overview scale bar
         */
        showCytobandsSetting: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCytobands', true),
        ),

        /**
         * #property
         * how to display the track labels, can be "overlapping", "offset", or
         * "hidden", or empty string "" (which results in conf being used). see
         * LinearGenomeViewPlugin
         * https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for
         * how conf is used
         */
        trackLabels: types.optional(
          types.string,
          () => localStorageGetItem('lgv-trackLabels') || '',
        ),

        /**
         * #property
         * show the "gridlines" in the track area
         */
        showGridlines: true,

        /**
         * #property
         * highlights on the LGV from the URL parameters
         */
        highlight: types.optional(
          types.array(types.frozen<HighlightType>()),
          [],
        ),

        /**
         * #property
         * color by CDS
         */
        colorByCDS: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-colorByCDS', false),
        ),

        /**
         * #property
         * show the track outlines
         */
        showTrackOutlines: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showTrackOutlines', true),
        ),
        /**
         * #property
         * this is a non-serialized property that can be used for loading the
         * linear genome view via session snapshots
         * example:
         * ```json
         * {
         *   loc: "chr1:1,000,000-2,000,000"
         *   assembly: "hg19"
         *   tracks: ["genes", "variants"]
         * }
         * ```
         */
        init: types.frozen<InitState | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      volatileWidth: undefined as number | undefined,
      /**
       * #volatile
       */
      minimumBlockWidth: 3,
      /**
       * #volatile
       */
      draggingTrackId: undefined as undefined | string,
      /**
       * #volatile
       */
      lastTrackDragY: undefined as undefined | number,
      /**
       * #volatile
       */
      volatileError: undefined as unknown,

      /**
       * #volatile
       */
      scaleFactor: 1,
      /**
       * #volatile
       */
      trackRefs: {} as Record<string, HTMLDivElement>,
      /**
       * #volatile
       */
      coarseDynamicBlocks: [] as BaseBlock[],
      /**
       * #volatile
       */
      coarseTotalBp: 0,
      /**
       * #volatile
       */
      leftOffset: undefined as undefined | BpOffset,
      /**
       * #volatile
       */
      rightOffset: undefined as undefined | BpOffset,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get pinnedTracks() {
        return self.tracks.filter(t => t.pinned)
      },
      /**
       * #getter
       */
      get unpinnedTracks() {
        return self.tracks.filter(t => !t.pinned)
      },
      /**
       * #getter
       * this is the effective value of the track labels setting, incorporating
       * both the config and view state. use this instead of view.trackLabels
       */
      get trackLabelsSetting() {
        const sessionSetting = getConf(getSession(self), [
          'LinearGenomeViewPlugin',
          'trackLabels',
        ])
        return self.trackLabels || sessionSetting
      },
      /**
       * #getter
       */
      get width(): number {
        if (self.volatileWidth === undefined) {
          throw new Error(
            'width undefined, make sure to check for model.initialized',
          )
        }
        return self.volatileWidth
      },
      /**
       * #getter
       */
      get interRegionPaddingWidth() {
        return INTER_REGION_PADDING_WIDTH
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
      get assemblyDisplayNames() {
        const { assemblyManager } = getSession(self)
        return this.assemblyNames.map(
          a => assemblyManager.get(a)?.displayName ?? a,
        )
      },
      /**
       * #getter
       * checking if lgv is a 'top-level' view is used for toggling pin track
       * capability, sticky positioning
       */
      get isTopLevelView() {
        return getSession(self).views.some(r => r.id === self.id)
      },
      /**
       * #getter
       * only uses sticky view headers when it is a 'top-level' view and
       * session allows it
       */
      get stickyViewHeaders() {
        const session = getSession(self)
        return isSessionWithMultipleViews(session)
          ? this.isTopLevelView && session.stickyViewHeaders
          : false
      },

      /**
       * #getter
       */
      get rubberbandTop() {
        let pinnedTracksTop = 0
        if (this.stickyViewHeaders) {
          pinnedTracksTop = VIEW_HEADER_HEIGHT
          if (!self.hideHeader) {
            pinnedTracksTop += HEADER_BAR_HEIGHT
            if (!self.hideHeaderOverview) {
              pinnedTracksTop += HEADER_OVERVIEW_HEIGHT
            }
          }
        }
        return pinnedTracksTop
      },

      get pinnedTracksTop() {
        return this.rubberbandTop + SCALE_BAR_HEIGHT
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      scalebarDisplayPrefix() {
        return getParent<any>(self, 2).type === 'LinearSyntenyView'
          ? self.assemblyDisplayNames[0]
          : ''
      },
      /**
       * #method
       */

      MiniControlsComponent(): React.FC<any> {
        return MiniControls
      },

      /**
       * #method
       */

      HeaderComponent(): React.FC<any> {
        return Header
      },

      /**
       * #getter
       */
      get assembliesNotFound() {
        const { assemblyManager } = getSession(self)
        const r0 = self.assemblyNames
          .map(a => (!assemblyManager.get(a) ? a : undefined))
          .filter(f => !!f)
          .join(',')
        return r0 ? `Assemblies ${r0} not found` : undefined
      },

      /**
       * #getter
       */
      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames
          .map(a => assemblyManager.get(a)?.error)
          .filter(f => !!f)
          .join(', ')
      },

      /**
       * #getter
       */
      get assembliesInitialized() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames.every(
          a => assemblyManager.get(a)?.initialized,
        )
      },

      /**
       * #getter
       */
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        // if init is set, wait for that assembly to have regions loaded
        if (self.init) {
          const { assemblyManager } = getSession(self)
          const asm = assemblyManager.get(self.init.assembly)
          return !!(asm?.initialized && asm.regions)
        }
        return this.assembliesInitialized
      },

      /**
       * #getter
       */
      get hasDisplayedRegions() {
        return self.displayedRegions.length > 0
      },

      /**
       * #getter
       */
      get loadingMessage() {
        return this.showLoading ? 'Loading' : undefined
      },

      /**
       * #getter
       */
      get hasSomethingToShow() {
        return this.hasDisplayedRegions || !!self.init
      },

      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return !this.initialized && !this.error && this.hasSomethingToShow
      },

      /**
       * #getter
       * Whether to show the import form
       */
      get showImportForm() {
        return !this.hasSomethingToShow || !!this.error
      },

      /**
       * #getter
       */
      get scalebarHeight() {
        return SCALE_BAR_HEIGHT + RESIZE_HANDLE_HEIGHT
      },

      /**
       * #getter
       */
      get headerHeight() {
        if (self.hideHeader) {
          return 0
        } else if (self.hideHeaderOverview) {
          return HEADER_BAR_HEIGHT
        } else {
          return HEADER_BAR_HEIGHT + HEADER_OVERVIEW_HEIGHT
        }
      },

      /**
       * #getter
       */
      get trackHeights() {
        return sum(self.tracks.map(t => t.displays[0].height))
      },

      /**
       * #getter
       */
      get trackHeightsWithResizeHandles() {
        return this.trackHeights + self.tracks.length * RESIZE_HANDLE_HEIGHT
      },

      /**
       * #getter
       */
      get height() {
        return (
          this.trackHeightsWithResizeHandles +
          this.headerHeight +
          this.scalebarHeight
        )
      },

      /**
       * #getter
       */
      get totalBp() {
        return sum(self.displayedRegions.map(r => r.end - r.start))
      },

      /**
       * #getter
       */
      get maxBpPerPx() {
        return this.totalBp / (self.width * 0.9)
      },

      /**
       * #getter
       */
      get minBpPerPx() {
        return 1 / 50
      },

      /**
       * #getter
       */
      get error(): unknown {
        return (
          self.volatileError || this.assemblyErrors || this.assembliesNotFound
        )
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
        return -self.width + rightPadding
      },

      /**
       * #getter
       */
      get displayedRegionsTotalPx() {
        return this.totalBp / self.bpPerPx
      },

      /**
       * #method
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          bpPerPx: self.bpPerPx,
          colorByCDS: self.colorByCDS,
        }
      },

      /**
       * #method
       */
      searchScope(assemblyName: string) {
        return {
          assemblyName,
          includeAggregateIndexes: true,
          tracks: self.tracks,
        }
      },

      /**
       * #getter
       */
      get trackMap() {
        const map = new Map()
        for (const track of self.tracks) {
          map.set(track.configuration.trackId, track)
        }
        return map
      },

      /**
       * #method
       */
      getTrack(id: string) {
        return this.trackMap.get(id)
      },

      /**
       * #method
       * does nothing currently
       */
      rankSearchResults(results: BaseResult[]) {
        return results
      },

      /**
       * #method
       * modifies view menu action onClick to apply to all tracks of same type
       */
      rewriteOnClicks(trackType: string, viewMenuActions: MenuItem[]) {
        for (const action of viewMenuActions) {
          // go to lowest level menu
          if ('subMenu' in action) {
            this.rewriteOnClicks(trackType, action.subMenu)
          }
          if ('onClick' in action) {
            const holdOnClick = action.onClick
            action.onClick = (...args: unknown[]) => {
              for (const track of self.tracks) {
                if (track.type === trackType) {
                  holdOnClick.apply(track, [track, ...args])
                }
              }
            }
          }
        }
      },
      /**
       * #getter
       */
      get trackTypeActions() {
        const allActions = new Map<string, MenuItem[]>()
        for (const track of self.tracks) {
          const trackInMap = allActions.get(track.type)
          if (!trackInMap) {
            const viewMenuActions = structuredClone(track.viewMenuActions)
            this.rewriteOnClicks(track.type, viewMenuActions)
            allActions.set(track.type, viewMenuActions)
          }
        }

        return allActions
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowTrackOutlines(arg: boolean) {
        self.showTrackOutlines = arg
      },
      /**
       * #action
       */
      setColorByCDS(flag: boolean) {
        self.colorByCDS = flag
      },
      /**
       * #action
       */
      setShowCytobands(flag: boolean) {
        self.showCytobandsSetting = flag
      },
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.volatileWidth = newWidth
      },
      /**
       * #action
       */
      setError(error: unknown) {
        self.volatileError = error
      },
      /**
       * #action
       */
      setHideHeader(b: boolean) {
        self.hideHeader = b
      },
      /**
       * #action
       */
      setHideHeaderOverview(b: boolean) {
        self.hideHeaderOverview = b
      },
      /**
       * #action
       */
      setHideNoTracksActive(b: boolean) {
        self.hideNoTracksActive = b
      },
      /**
       * #action
       */
      setShowGridlines(b: boolean) {
        self.showGridlines = b
      },
      /**
       * #action
       */
      addToHighlights(highlight: HighlightType) {
        self.highlight.push(highlight)
      },
      /**
       * #action
       */
      setHighlight(highlight?: HighlightType[]) {
        self.highlight = cast(highlight)
      },
      /**
       * #action
       */
      removeHighlight(highlight: HighlightType) {
        self.highlight.remove(highlight)
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
      zoomTo(bpPerPx: number, offset = self.width / 2, centerAtOffset = false) {
        const newBpPerPx = clamp(bpPerPx, self.minBpPerPx, self.maxBpPerPx)
        if (newBpPerPx === self.bpPerPx) {
          return newBpPerPx
        }
        const oldBpPerPx = self.bpPerPx

        if (Math.abs(oldBpPerPx - newBpPerPx) < 0.000001) {
          console.warn('zoomTo bpPerPx rounding error')
          return oldBpPerPx
        }
        self.bpPerPx = newBpPerPx

        // tweak the offset so that the center of the view remains at the same
        // coordinate
        const newOffsetPx = Math.round(
          ((self.offsetPx + offset) * oldBpPerPx) / newBpPerPx -
            (centerAtOffset ? self.width / 2 : offset),
        )
        this.scrollTo(newOffsetPx)
        return newBpPerPx
      },

      /**
       * #action
       * sets offsets of rubberband, used in the get sequence dialog can call
       * view.getSelectedRegions(view.leftOffset,view.rightOffset) to compute
       * the selected regions from the offsets
       */
      setOffsets(left?: BpOffset, right?: BpOffset) {
        self.leftOffset = left
        self.rightOffset = right
      },

      /**
       * #action
       */
      setSearchResults(
        searchResults: BaseResult[],
        searchQuery: string,
        assemblyName?: string,
      ) {
        getSession(self).queueDialog(handleClose => [
          SearchResultsDialog,
          {
            model: self as LinearGenomeViewModel,
            searchResults,
            searchQuery,
            handleClose,
            assemblyName,
          },
        ])
      },

      /**
       * #action
       */
      setNewView(bpPerPx: number, offsetPx: number) {
        this.zoomTo(bpPerPx)
        this.scrollTo(offsetPx)
      },

      /**
       * #action
       */
      horizontallyFlip() {
        self.displayedRegions = cast(
          [...self.displayedRegions]
            .reverse()
            .map(region => ({ ...region, reversed: !region.reversed })),
        )
        this.scrollTo(self.totalBp / self.bpPerPx - self.offsetPx - self.width)
      },

      /**
       * #action
       */
      showTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
      ) {
        return showTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
        )
      },
      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      moveTrackDown(id: string) {
        const idx = self.tracks.findIndex(v => v.id === id)
        if (idx !== -1 && idx < self.tracks.length - 1) {
          self.tracks.splice(idx, 2, self.tracks[idx + 1], self.tracks[idx])
        }
      },
      /**
       * #action
       */
      moveTrackUp(id: string) {
        const idx = self.tracks.findIndex(track => track.id === id)
        if (idx > 0) {
          self.tracks.splice(idx - 1, 2, self.tracks[idx], self.tracks[idx - 1])
        }
      },
      /**
       * #action
       */
      moveTrackToTop(id: string) {
        const track = self.tracks.find(track => track.id === id)
        if (track) {
          self.tracks = cast([track, ...self.tracks.filter(t => t.id !== id)])
        }
      },
      /**
       * #action
       */
      moveTrackToBottom(id: string) {
        const track = self.tracks.find(track => track.id === id)
        if (track) {
          self.tracks = cast([...self.tracks.filter(t => t.id !== id), track])
        }
      },
      /**
       * #action
       */
      moveTrack(movingId: string, targetId: string) {
        const oldIndex = self.tracks.findIndex(track => track.id === movingId)
        if (oldIndex === -1) {
          throw new Error(`Track ID ${movingId} not found`)
        }
        const newIndex = self.tracks.findIndex(track => track.id === targetId)
        if (newIndex === -1) {
          throw new Error(`Track ID ${targetId} not found`)
        }

        const tracks = self.tracks.filter((_, idx) => idx !== oldIndex)
        tracks.splice(newIndex, 0, self.tracks[oldIndex])
        self.tracks = cast(tracks)
      },

      /**
       * #action
       */
      toggleTrack(trackId: string) {
        toggleTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      setTrackLabels(setting: 'overlapping' | 'offset' | 'hidden') {
        localStorageSetItem('lgv-trackLabels', setting)
        self.trackLabels = setting
      },

      /**
       * #action
       */
      setShowCenterLine(b: boolean) {
        self.showCenterLine = b
      },

      /**
       * #action
       */
      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        self.zoomTo(self.bpPerPx)
      },

      /**
       * #action
       */
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

      /**
       * #method
       * Helper method for the fetchSequence.
       * Retrieves the corresponding regions that were selected by the
       * rubberband
       *
       * @param leftOffset - `object as {start, end, index, offset}`, offset = start
       * of user drag
       * @param rightOffset - `object as {start, end, index, offset}`,
       * offset = end of user drag
       * @returns array of Region[]
       */
      getSelectedRegions(leftOffset?: BpOffset, rightOffset?: BpOffset) {
        const snap = getSnapshot(self)
        const simView = Base1DView.create({
          ...snap,
          interRegionPaddingWidth: self.interRegionPaddingWidth,
        })

        simView.setVolatileWidth(self.width)
        simView.moveTo(leftOffset, rightOffset)

        return simView.dynamicBlocks.contentBlocks.map(region => ({
          assemblyName: region.assemblyName,
          refName: region.refName,
          start: Math.floor(region.start),
          end: Math.ceil(region.end),
        }))
      },

      /**
       * #action
       */
      horizontalScroll(distance: number) {
        const oldOffsetPx = self.offsetPx
        // newOffsetPx is the actual offset after the scroll is clamped
        const newOffsetPx = self.scrollTo(self.offsetPx + distance)
        return newOffsetPx - oldOffsetPx
      },

      /**
       * #action
       */
      center() {
        // Calculate total content width including inter-region padding
        const numPaddings = Math.max(0, self.displayedRegions.length - 1)
        const totalPaddingPx = numPaddings * self.interRegionPaddingWidth
        const totalContentPx = self.totalBp / self.bpPerPx + totalPaddingPx
        const centerPx = totalContentPx / 2
        const targetOffsetPx = Math.round(centerPx - self.width / 2)
        self.scrollTo(targetOffsetPx)
      },

      /**
       * #action
       */
      showAllRegions() {
        // Set zoom to show all regions, then center the view
        self.bpPerPx = clamp(self.maxBpPerPx, self.minBpPerPx, self.maxBpPerPx)
        this.center()
      },

      /**
       * #action
       */
      showAllRegionsInAssembly(assemblyName?: string) {
        const session = getSession(self)
        const { assemblyManager } = session
        if (!assemblyName) {
          const names = new Set(self.displayedRegions.map(r => r.assemblyName))
          if (names.size > 1) {
            session.notify(
              `Can't perform operation with multiple assemblies currently`,
            )
            return
          }
          ;[assemblyName] = [...names]
        }
        const regions = assemblyManager.get(assemblyName!)?.regions
        if (!regions) {
          return
        }
        this.setDisplayedRegions(regions)
        self.zoomTo(self.maxBpPerPx)
        this.center()
      },

      /**
       * #action
       */
      setDraggingTrackId(idx?: string) {
        self.draggingTrackId = idx
        if (idx === undefined) {
          self.lastTrackDragY = undefined
        }
      },

      /**
       * #action
       */
      setLastTrackDragY(y: number) {
        self.lastTrackDragY = y
      },

      /**
       * #action
       */
      setScaleFactor(factor: number) {
        self.scaleFactor = factor
      },

      /**
       * #action
       * this "clears the view" and makes the view return to the import form
       */
      clearView() {
        this.setDisplayedRegions([])
        self.tracks.clear()
        // it is necessary to run these after setting displayed regions empty
        // or else model.offsetPx gets set to Infinity and breaks
        // @jbrowse/mobx-state-tree snapshot
        self.scrollTo(0)
        self.zoomTo(10)
      },

      /**
       * #action
       */
      setInit(arg?: InitState) {
        self.init = arg
      },

      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearGenomeView')
        const html = await renderToSvg(self as LinearGenomeViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')

        saveAs(
          new Blob([html], { type: 'image/svg+xml' }),
          opts.filename || 'image.svg',
        )
      },
    }))
    .actions(self => {
      let cancelLastAnimation = () => {}

      /**
       * #action
       * perform animated slide
       */
      function slide(viewWidths: number) {
        const [animate, cancelAnimation] = springAnimate(
          self.offsetPx,
          self.offsetPx + self.width * viewWidths,
          self.scrollTo,
          undefined,
          undefined,
          200,
        )
        cancelLastAnimation()
        cancelLastAnimation = cancelAnimation!
        animate!()
      }

      return { slide }
    })
    .actions(self => {
      let cancelLastAnimation = () => {}

      /**
       * #action
       * perform animated zoom
       */
      function zoom(targetBpPerPx: number) {
        cancelLastAnimation()
        self.setScaleFactor(1)
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
        cancelLastAnimation = cancelAnimation!
        animate!()
      }

      return { zoom }
    })
    .views(self => ({
      /**
       * #getter
       */
      get canShowCytobands() {
        return self.displayedRegions.length === 1 && this.anyCytobandsExist
      },
      /**
       * #getter
       */
      get showCytobands() {
        return this.canShowCytobands && self.showCytobandsSetting
      },
      /**
       * #getter
       */
      get anyCytobandsExist() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames.some(
          a => assemblyManager.get(a)?.cytobands?.length,
        )
      },
      /**
       * #getter
       * the cytoband is displayed to the right of the chromosome name, and
       * that offset is calculated manually with this method
       */
      get cytobandOffset() {
        return this.showCytobands
          ? measureText(self.displayedRegions[0]?.refName || '', 12) + 15
          : 0
      },
    }))
    .views(self => ({
      /**
       * #method
       * return the view menu items
       */
      menuItems(): MenuItem[] {
        if (!self.hasDisplayedRegions) {
          return []
        }
        const { canShowCytobands, showCytobands } = self
        const session = getSession(self)
        const menuItems: MenuItem[] = [
          {
            label: 'Return to import form',
            onClick: () => {
              session.queueDialog(handleClose => [
                ReturnToImportFormDialog,
                { model: self, handleClose },
              ])
            },
            icon: FolderOpenIcon,
          },
          ...(isSessionWithAddTracks(session)
            ? [
                {
                  label: 'Sequence search',
                  icon: SearchIcon,
                  onClick: () => {
                    session.queueDialog(handleClose => [
                      SequenceSearchDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
              ]
            : []),
          {
            label: 'Export SVG',
            icon: PhotoCameraIcon,
            onClick: () => {
              session.queueDialog(handleClose => [
                ExportSvgDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
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
            label: 'Color by CDS and draw amino acids',
            type: 'checkbox',
            checked: self.colorByCDS,
            icon: PaletteIcon,
            onClick: () => {
              self.setColorByCDS(!self.colorByCDS)
            },
          },
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              {
                label: 'Show all regions in assembly',
                onClick: self.showAllRegionsInAssembly,
              },
              {
                label: 'Show center line',
                type: 'checkbox',
                checked: self.showCenterLine,
                onClick: () => {
                  self.setShowCenterLine(!self.showCenterLine)
                },
              },
              {
                label: 'Show header',
                type: 'checkbox',
                checked: !self.hideHeader,
                onClick: () => {
                  self.setHideHeader(!self.hideHeader)
                },
              },

              {
                label: 'Show track outlines',
                type: 'checkbox',
                checked: self.showTrackOutlines,
                onClick: () => {
                  self.setShowTrackOutlines(!self.showTrackOutlines)
                },
              },
              {
                label: 'Show header overview',
                type: 'checkbox',
                checked: !self.hideHeaderOverview,
                onClick: () => {
                  self.setHideHeaderOverview(!self.hideHeaderOverview)
                },
                disabled: self.hideHeader,
              },
              {
                label: 'Show no tracks active button',
                type: 'checkbox',
                checked: !self.hideNoTracksActive,
                onClick: () => {
                  self.setHideNoTracksActive(!self.hideNoTracksActive)
                },
              },
              {
                label: 'Show guidelines',
                type: 'checkbox',
                checked: self.showGridlines,
                onClick: () => {
                  self.setShowGridlines(!self.showGridlines)
                },
              },
              ...(canShowCytobands
                ? [
                    {
                      label: 'Show ideogram',
                      type: 'checkbox' as const,
                      checked: self.showCytobands,
                      onClick: () => {
                        self.setShowCytobands(!showCytobands)
                      },
                    },
                  ]
                : []),
            ],
          },
          {
            label: 'Track labels',
            icon: LabelIcon,
            subMenu: [
              {
                label: 'Overlapping',
                icon: VisibilityIcon,
                type: 'radio',
                checked: self.trackLabelsSetting === 'overlapping',
                onClick: () => {
                  self.setTrackLabels('overlapping')
                },
              },
              {
                label: 'Offset',
                icon: VisibilityIcon,
                type: 'radio',
                checked: self.trackLabelsSetting === 'offset',
                onClick: () => {
                  self.setTrackLabels('offset')
                },
              },
              {
                label: 'Hidden',
                icon: VisibilityIcon,
                type: 'radio',
                checked: self.trackLabelsSetting === 'hidden',
                onClick: () => {
                  self.setTrackLabels('hidden')
                },
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
            for (const action of value) {
              menuItems.push(action)
            }
          }
        }

        return menuItems
      },
    }))
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
      let currentBlockKeys: string | undefined
      return {
        /**
         * #getter
         * static blocks are an important concept jbrowse uses to avoid
         * re-rendering when you scroll to the side. when you horizontally
         * scroll to the right, old blocks to the left may be removed, and new
         * blocks may be instantiated on the right. tracks may use the static
         * blocks to render their data for the region represented by the block
         */
        get staticBlocks() {
          const newBlocks = calculateStaticBlocks(self)
          const newKeys = newBlocks.blocks.map(b => b.key).join(',')
          if (
            currentlyCalculatedStaticBlocks === undefined ||
            currentBlockKeys !== newKeys
          ) {
            currentlyCalculatedStaticBlocks = newBlocks
            currentBlockKeys = newKeys
            return currentlyCalculatedStaticBlocks
          } else {
            return currentlyCalculatedStaticBlocks
          }
        },
        /**
         * #getter
         * dynamic blocks represent the exact coordinates of the currently
         * visible genome regions on the screen. they are similar to static
         * blocks, but static blocks can go offscreen while dynamic blocks
         * represent exactly what is on screen
         */
        get dynamicBlocks() {
          return calculateDynamicBlocks(self)
        },
        /**
         * #getter
         * rounded dynamic blocks are dynamic blocks without fractions of bp
         */
        get roundedDynamicBlocks() {
          return this.dynamicBlocks.contentBlocks.map(
            block =>
              ({
                // eslint-disable-next-line @typescript-eslint/no-misused-spread
                ...block,
                start: Math.floor(block.start),
                end: Math.ceil(block.end),
              }) as BaseBlock,
          )
        },

        /**
         * #getter
         * a single "combo-locstring" representing all the regions visible on
         * the screen
         */
        get visibleLocStrings() {
          return calculateVisibleLocStrings(this.dynamicBlocks.contentBlocks)
        },

        /**
         * #getter
         * same as visibleLocStrings, but only updated every 300ms
         */
        get coarseVisibleLocStrings() {
          return calculateVisibleLocStrings(self.coarseDynamicBlocks)
        },

        /**
         * #getter
         */
        get coarseTotalBpDisplayStr() {
          return getBpDisplayStr(self.coarseTotalBp)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setCoarseDynamicBlocks(blocks: BlockSet) {
        self.coarseDynamicBlocks = blocks.contentBlocks
        self.coarseTotalBp = blocks.totalBp
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

      /**
       * #action
       * Navigate to the given locstring, will change displayed regions if
       * needed, and wait for assemblies to be initialized
       *
       * @param input - e.g. "chr1:1-100", "chr1:1-100 chr2:1-100", "chr 1 100"
       * @param optAssemblyName - (optional) the assembly name to use when
       * navigating to the locstring
       */
      async navToLocString(
        input: string,
        optAssemblyName?: string,
        grow?: number,
      ) {
        const { assemblyNames } = self
        const { assemblyManager } = getSession(self)
        const assemblyName = optAssemblyName || assemblyNames[0]!
        if (assemblyName) {
          await assemblyManager.waitForAssembly(assemblyName)
        }

        return this.navToLocations(
          parseLocStrings(input, assemblyName, (ref, asm) =>
            assemblyManager.isValidRefName(ref, asm),
          ),
          assemblyName,
          grow,
        )
      },

      /**
       * #action
       * Performs a text index search, and navigates to it immediately if a
       * single result is returned. Will pop up a search dialog if multiple
       * results are returned
       */
      async navToSearchString({
        input,
        assembly,
      }: {
        input: string
        assembly: Assembly
      }) {
        await handleSelectedRegion({
          input,
          assembly,
          model: self as LinearGenomeViewModel,
        })
      },

      /**
       * #action
       * Similar to `navToLocString`, but accepts a parsed location object
       * instead of a locstring. Will try to perform `setDisplayedRegions` if
       * changing regions
       */
      async navToLocation(
        parsedLocString: ParsedLocString,
        assemblyName?: string,
        grow?: number,
      ) {
        return this.navToLocations([parsedLocString], assemblyName, grow)
      },

      /**
       * #action
       * Similar to `navToLocString`, but accepts a list of parsed location
       * objects instead of a locstring. Will try to perform
       * `setDisplayedRegions` if changing regions
       */
      async navToLocations(
        regions: ParsedLocString[],
        assemblyName?: string,
        grow?: number,
      ) {
        const { assemblyManager } = getSession(self)
        await when(() => self.volatileWidth !== undefined)

        // Generate locations from the parsed regions
        const locations = await generateLocations({
          regions,
          assemblyManager,
          assemblyName,
          grow,
        })

        // Handle single location case
        if (locations.length === 1) {
          const location = locations[0]!
          const { reversed, parentRegion, start, end } = location

          // Set the displayed region based on the parent region
          self.setDisplayedRegions([
            {
              reversed,
              ...parentRegion,
            },
          ])

          // Navigate to the specific coordinates within the region
          this.navTo({
            ...location,
            start: clamp(start ?? 0, 0, parentRegion.end),
            end: clamp(end ?? parentRegion.end, 0, parentRegion.end),
          })
        }
        // Handle multiple locations case
        else {
          self.setDisplayedRegions(
            locations.map(location => {
              const { start, end } = location
              return start === undefined || end === undefined
                ? location.parentRegion
                : {
                    ...location,
                    start,
                    end,
                  }
            }),
          )
          self.showAllRegions()
        }
      },

      /**
       * #action
       * Navigate to a location based on its refName and optionally start, end,
       * and assemblyName. Will not try to change displayed regions, use
       * `navToLocations` instead. Only navigates to a location if it is
       * entirely within a displayedRegion. Navigates to the first matching
       * location encountered.
       *
       * Throws an error if navigation was unsuccessful
       *
       * @param query - a proposed location to navigate to
       */
      navTo(query: NavLocation) {
        this.navToMultiple([query])
      },

      /**
       * #action
       * Navigate to a location based on its refName and optionally start, end,
       * and assemblyName. Will not try to change displayed regions, use
       * navToLocations instead. Only navigates to a location if it is entirely
       * within a displayedRegion. Navigates to the first matching location
       * encountered.
       *
       * Throws an error if navigation was unsuccessful
       *
       * @param locations - proposed location to navigate to
       */
      navToMultiple(locations: NavLocation[]) {
        if (
          locations.some(
            l =>
              l.start !== undefined && l.end !== undefined && l.start > l.end,
          )
        ) {
          throw new Error('found start greater than end')
        }

        const firstLocation = locations.at(0)
        const lastLocation = locations.at(-1)
        if (!firstLocation || !lastLocation) {
          return
        }

        // Get assembly information
        const defaultAssemblyName = self.assemblyNames[0]!
        const { assemblyManager } = getSession(self)

        // Process first location
        const firstAssembly = assemblyManager.get(
          firstLocation.assemblyName || defaultAssemblyName,
        )
        const firstRefName =
          firstAssembly?.getCanonicalRefName(firstLocation.refName) ||
          firstLocation.refName
        const firstRegion = self.displayedRegions.find(
          r => r.refName === firstRefName,
        )

        // Process last location
        const lastAssembly = assemblyManager.get(
          lastLocation.assemblyName || defaultAssemblyName,
        )
        const lastRefName =
          lastAssembly?.getCanonicalRefName(lastLocation.refName) ||
          lastLocation.refName
        const lastRegion = findLast(
          self.displayedRegions,
          r => r.refName === lastRefName,
        )

        // Validate regions exist
        if (!firstRegion) {
          throw new Error(
            `could not find a region with refName "${firstRefName}"`,
          )
        }
        if (!lastRegion) {
          throw new Error(
            `could not find a region with refName "${lastRefName}"`,
          )
        }

        // Calculate coordinates, using region bounds if not specified
        const firstStart =
          firstLocation.start === undefined
            ? firstRegion.start
            : firstLocation.start
        const firstEnd =
          firstLocation.end === undefined ? firstRegion.end : firstLocation.end
        const lastStart =
          lastLocation.start === undefined
            ? lastRegion.start
            : lastLocation.start
        const lastEnd =
          lastLocation.end === undefined ? lastRegion.end : lastLocation.end

        // Find region indices that contain our locations
        const firstIndex = self.displayedRegions.findIndex(
          r =>
            firstRefName === r.refName &&
            firstStart >= r.start &&
            firstStart <= r.end &&
            firstEnd <= r.end &&
            firstEnd >= r.start,
        )

        const lastIndex = self.displayedRegions.findIndex(
          r =>
            lastRefName === r.refName &&
            lastStart >= r.start &&
            lastStart <= r.end &&
            lastEnd <= r.end &&
            lastEnd >= r.start,
        )

        if (firstIndex === -1 || lastIndex === -1) {
          throw new Error(
            `could not find a region that contained "${locations.map(l =>
              assembleLocString(l),
            )}"`,
          )
        }

        const startDisplayedRegion = self.displayedRegions[firstIndex]!
        const endDisplayedRegion = self.displayedRegions[lastIndex]!

        // Calculate offsets, accounting for reversed regions
        const startOffset = startDisplayedRegion.reversed
          ? startDisplayedRegion.end - firstEnd
          : firstStart - startDisplayedRegion.start

        const endOffset = endDisplayedRegion.reversed
          ? endDisplayedRegion.end - lastStart
          : lastEnd - endDisplayedRegion.start

        this.moveTo(
          {
            index: firstIndex,
            offset: startOffset,
          },
          {
            index: lastIndex,
            offset: endOffset,
          },
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      rubberBandMenuItems(): MenuItem[] {
        return [
          {
            label: 'Zoom to region',
            icon: ZoomInIcon,
            onClick: () => {
              self.moveTo(self.leftOffset, self.rightOffset)
            },
          },
          {
            label: 'Get sequence',
            icon: MenuOpenIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                GetSequenceDialog,

                { model: self, handleClose },
              ])
            },
          },
        ]
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
        return bpToPx({ refName, coord, regionNumber, self })
      },

      /**
       * #method
       * scrolls the view to center on the given bp. if that is not in any of
       * the displayed regions, does nothing
       *
       * @param coord - basepair at which you want to center the view
       * @param refName - refName of the displayedRegion you are centering at
       * @param regionNumber - index of the displayedRegion
       */
      centerAt(coord: number, refName: string, regionNumber?: number) {
        const centerPx = this.bpToPx({
          refName,
          coord,
          regionNumber,
        })
        if (centerPx !== undefined) {
          self.scrollTo(Math.round(centerPx.offsetPx - self.width / 2))
        }
      },

      /**
       * #method
       */
      pxToBp(px: number) {
        return pxToBp(self, px)
      },

      /**
       * #getter
       */
      get centerLineInfo() {
        return self.displayedRegions.length > 0
          ? this.pxToBp(self.width / 2)
          : undefined
      },

      get visibleRegions() {
        return self.dynamicBlocks.contentBlocks
      },
    }))
    .actions(self => ({
      afterCreate() {
        function handler(e: KeyboardEvent) {
          const session = getSession(self)
          if (session.focusedViewId === self.id && (e.ctrlKey || e.metaKey)) {
            if (e.code === 'ArrowLeft') {
              e.preventDefault()
              self.slide(-0.9)
            } else if (e.code === 'ArrowRight') {
              e.preventDefault()
              self.slide(0.9)
            } else if (e.code === 'ArrowUp') {
              e.preventDefault()
              self.zoom(self.bpPerPx / 2)
            } else if (e.code === 'ArrowDown') {
              e.preventDefault()
              self.zoom(self.bpPerPx * 2)
            }
          }
        }
        document.addEventListener('keydown', handler)
        addDisposer(self, () => {
          document.removeEventListener('keydown', handler)
        })
      },

      afterAttach() {
        addDisposer(
          self,
          autorun(
            function initAutorun() {
              const { init, initialized } = self
              if (!initialized) {
                return
              }
              if (init) {
                const session = getSession(self)
                const { assemblyManager } = session

                if (init.loc) {
                  self
                    .navToLocString(init.loc, init.assembly)
                    .catch((e: unknown) => {
                      console.error(init, e)
                      session.notifyError(`${e}`, e)
                    })
                } else {
                  self.showAllRegionsInAssembly(init.assembly)
                }

                if (init.tracks) {
                  const idsNotFound = [] as string[]
                  for (const t of init.tracks) {
                    try {
                      self.showTrack(t)
                    } catch (e) {
                      if (/Could not resolve identifier/.exec(`${e}`)) {
                        idsNotFound.push(t)
                      } else {
                        throw e
                      }
                    }
                  }
                  if (idsNotFound.length) {
                    session.notifyError(
                      `Could not resolve identifiers: ${idsNotFound.join(',')}`,
                      new Error(
                        `Could not resolve identifiers: ${idsNotFound.join(',')}`,
                      ),
                    )
                  }
                }

                if (init.tracklist) {
                  self.activateTrackSelector()
                }

                if (init.nav !== undefined) {
                  self.setHideHeader(!init.nav)
                }

                if (init.highlight) {
                  for (const h of init.highlight) {
                    const p = parseLocString(h, refName =>
                      assemblyManager.isValidRefName(refName, init.assembly),
                    )
                    const { start, end } = p
                    if (start !== undefined && end !== undefined) {
                      self.addToHighlights({
                        ...p,
                        start,
                        end,
                        assemblyName: init.assembly,
                      })
                    }
                  }
                }

                // clear init state
                self.setInit(undefined)
              }
            },
            { name: 'LGVInit' },
          ),
        )
        addDisposer(
          self,
          autorun(
            function coarseDynamicBlocksAutorun() {
              if (self.initialized) {
                self.setCoarseDynamicBlocks(self.dynamicBlocks)
              }
            },
            { delay: 500, name: 'LGVCoarseDynamicBlocks' },
          ),
        )

        addDisposer(
          self,
          autorun(
            function localStorageAutorun() {
              const s = (s: unknown) => JSON.stringify(s)
              const {
                showCytobandsSetting,
                showCenterLine,
                colorByCDS,
                showTrackOutlines,
              } = self
              localStorageSetItem('lgv-showCytobands', s(showCytobandsSetting))
              localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
              localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
              localStorageSetItem('lgv-showTrackOutlines', s(showTrackOutlines))
            },
            { name: 'LGVLocalStorage' },
          ),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { highlight, ...rest } = snap
      return {
        highlight:
          Array.isArray(highlight) || highlight === undefined
            ? highlight
            : [highlight],
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        offsetPx,
        bpPerPx,
        hideHeader,
        hideHeaderOverview,
        hideNoTracksActive,
        showGridlines,
        trackSelectorType,
        displayedRegions,
        highlight,
        showCenterLine,
        showCytobandsSetting,
        trackLabels,
        colorByCDS,
        showTrackOutlines,
        ...rest
      } = snap as Omit<typeof snap, symbol>

      return {
        ...rest,
        // only include non-default values
        ...(offsetPx ? { offsetPx } : {}),
        ...(bpPerPx !== 1 ? { bpPerPx } : {}),
        ...(hideHeader ? { hideHeader } : {}),
        ...(hideHeaderOverview ? { hideHeaderOverview } : {}),
        ...(hideNoTracksActive ? { hideNoTracksActive } : {}),
        ...(!showGridlines ? { showGridlines } : {}),
        ...(trackSelectorType !== 'hierarchical' ? { trackSelectorType } : {}),
        ...(displayedRegions.length ? { displayedRegions } : {}),
        ...(highlight.length ? { highlight } : {}),
        ...(showCenterLine ? { showCenterLine } : {}),
        ...(!showCytobandsSetting ? { showCytobandsSetting } : {}),
        ...(trackLabels ? { trackLabels } : {}),
        ...(colorByCDS ? { colorByCDS } : {}),
        ...(!showTrackOutlines ? { showTrackOutlines } : {}),
      } as typeof snap
    })
}

export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>

export {
  default as LinearGenomeView,
  default as ReactComponent,
} from './components/LinearGenomeView'

export { default as RefNameAutocomplete } from './components/RefNameAutocomplete'
export { default as SearchBox } from './components/SearchBox'

export { renderToSvg } from './svgcomponents/SVGLinearGenomeView'
