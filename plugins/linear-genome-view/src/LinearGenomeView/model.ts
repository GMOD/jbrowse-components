import type React from 'react'
import { lazy } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  assembleLocString,
  clamp,
  findLast,
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  localStorageGetItem,
  localStorageSetItem,
  measureText,
  springAnimate,
  sum,
} from '@jbrowse/core/util'
import { moveTo, pxToBp, bpToPx } from '@jbrowse/core/util/Base1DUtils'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LabelIcon from '@mui/icons-material/Label'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import clone from 'clone'
import { saveAs } from 'file-saver'
import { when, transaction, autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getSnapshot,
  getRoot,
  resolveIdentifier,
  types,
  getParent,
} from 'mobx-state-tree'

import Header from './components/Header'
import MiniControls from './components/MiniControls'
import { generateLocations, parseLocStrings } from './util'
import { handleSelectedRegion } from '../searchUtils'
import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  INTER_REGION_PADDING_WIDTH,
  RESIZE_HANDLE_HEIGHT,
  SCALE_BAR_HEIGHT,
} from './consts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ParsedLocString } from '@jbrowse/core/util'
import type { BlockSet, BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { Region as IRegion, Region } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

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
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  paddingHeight?: number
  headerHeight?: number
  cytobandHeight?: number
  trackLabels?: string
  themeName?: string
}

export interface HighlightType {
  start: number
  end: number
  assemblyName: string
  refName: string
}

function calculateVisibleLocStrings(contentBlocks: BaseBlock[]) {
  if (!contentBlocks.length) {
    return ''
  }
  const isSingleAssemblyName = contentBlocks.every(
    b => b.assemblyName === contentBlocks[0]!.assemblyName,
  )
  const locs = contentBlocks.map(block =>
    assembleLocString({
      ...block,
      start: Math.round(block.start),
      end: Math.round(block.end),
      assemblyName: isSingleAssemblyName ? undefined : block.assemblyName,
    }),
  )
  return locs.join(' ')
}

export interface NavLocation {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

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
        displayedRegions: types.optional(types.frozen<IRegion[]>(), []),

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
          Boolean(
            JSON.parse(localStorageGetItem('lgv-showCenterLine') || 'false'),
          ),
        ),

        /**
         * #property
         * show the "cytobands" in the overview scale bar
         */
        showCytobandsSetting: types.optional(types.boolean, () =>
          Boolean(
            JSON.parse(localStorageGetItem('lgv-showCytobands') || 'true'),
          ),
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
          Boolean(JSON.parse(localStorageGetItem('lgv-colorByCDS') || 'false')),
        ),

        /**
         * #property
         * color by CDS
         */
        showTrackOutlines: types.optional(types.boolean, () =>
          Boolean(
            JSON.parse(localStorageGetItem('lgv-showTrackOutlines') || 'true'),
          ),
        ),
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,
      minimumBlockWidth: 3,
      draggingTrackId: undefined as undefined | string,
      volatileError: undefined as unknown,

      // array of callbacks to run after the next set of the displayedRegions,
      // which is basically like an onLoad
      afterDisplayedRegionsSetCallbacks: [] as (() => void)[],
      scaleFactor: 1,
      trackRefs: {} as Record<string, HTMLDivElement>,
      coarseDynamicBlocks: [] as BaseBlock[],
      coarseTotalBp: 0,
      leftOffset: undefined as undefined | BpOffset,
      rightOffset: undefined as undefined | BpOffset,
    }))
    .views(self => ({
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
        return [
          ...new Set(self.displayedRegions.map(region => region.assemblyName)),
        ]
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      scaleBarDisplayPrefix() {
        return getParent<any>(self, 2).type === 'LinearSyntenyView'
          ? self.assemblyNames[0]
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
        const { assemblyNames } = self
        return assemblyNames.every(a => assemblyManager.get(a)?.initialized)
      },

      /**
       * #getter
       */
      get initialized() {
        return self.volatileWidth !== undefined && this.assembliesInitialized
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
      get scaleBarHeight() {
        return SCALE_BAR_HEIGHT + RESIZE_HANDLE_HEIGHT
      },

      /**
       * #getter
       */
      get headerHeight() {
        if (self.hideHeader) {
          return 0
        }
        if (self.hideHeaderOverview) {
          return HEADER_BAR_HEIGHT
        }
        return HEADER_BAR_HEIGHT + HEADER_OVERVIEW_HEIGHT
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
          this.scaleBarHeight
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
        return self.volatileError || this.assemblyErrors
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
       * #method
       */
      getTrack(id: string) {
        return self.tracks.find(t => t.configuration.trackId === id)
      },

      /**
       * #method
       */
      rankSearchResults(results: BaseResult[]) {
        // order of rank
        const openTrackIds = new Set(
          self.tracks.map(track => track.configuration.trackId),
        )
        for (const result of results) {
          if (openTrackIds.has(result.trackId)) {
            result.updateScore(result.getScore() + 1)
          }
        }
        return results
      },

      /**
       * #method
       * modifies view menu action onClick to apply to all tracks of same type
       */
      rewriteOnClicks(trackType: string, viewMenuActions: MenuItem[]) {
        viewMenuActions.forEach(action => {
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
      /**
       * #getter
       */
      get trackTypeActions() {
        const allActions = new Map<string, MenuItem[]>()
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
        this.scrollTo(
          Math.round(
            ((self.offsetPx + offset) * oldBpPerPx) / newBpPerPx -
              (centerAtOffset ? self.width / 2 : offset),
          ),
        )
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
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const conf = resolveIdentifier(schema, getRoot(self), trackId)
        if (!conf) {
          throw new Error(`Could not resolve identifier "${trackId}"`)
        }
        const trackType = pluginManager.getTrackType(conf?.type)
        if (!trackType) {
          throw new Error(`Unknown track type ${conf.type}`)
        }
        const viewType = pluginManager.getViewType(self.type)!
        const supportedDisplays = new Set(
          viewType.displayTypes.map(d => d.name),
        )
        const displayConf = conf.displays.find((d: AnyConfigurationModel) =>
          supportedDisplays.has(d.type),
        )
        if (!displayConf) {
          throw new Error(
            `Could not find a compatible display for view type ${self.type}`,
          )
        }

        const t = self.tracks.filter(t => t.configuration === conf)
        if (t.length === 0) {
          const track = trackType.stateModel.create({
            ...initialSnapshot,
            type: conf.type,
            configuration: conf,
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
        }
        return t[0]
      },
      /**
       * #action
       */
      hideTrack(trackId: string) {
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const conf = resolveIdentifier(schema, getRoot(self), trackId)
        const t = self.tracks.filter(t => t.configuration === conf)
        transaction(() => {
          t.forEach(t => self.tracks.remove(t))
        })
        return t.length
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      moveTrackDown(id: string) {
        const idx = self.tracks.findIndex(v => v.id === id)
        if (idx === -1) {
          return
        }

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
        const idx = self.tracks.findIndex(track => track.id === id)
        self.tracks = cast([
          self.tracks[idx],
          ...self.tracks.filter(track => track.id !== id),
        ])
      },
      /**
       * #action
       */
      moveTrackToBottom(id: string) {
        const idx = self.tracks.findIndex(track => track.id === id)
        self.tracks = cast([
          ...self.tracks.filter(track => track.id !== id),
          self.tracks[idx],
        ])
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
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(trackId)
        // if none had that configuration, turn one on
        if (!hiddenCount) {
          self.showTrack(trackId)
          return true
        }
        return false
      },

      /**
       * #action
       */
      setTrackLabels(setting: 'overlapping' | 'offset' | 'hidden') {
        localStorage.setItem('lgv-trackLabels', setting)
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
          ...region,
          start: Math.floor(region.start),
          end: Math.ceil(region.end),
        }))
      },

      /**
       * #action
       * schedule something to be run after the next time displayedRegions is
       * set
       */
      afterDisplayedRegionsSet(cb: () => void) {
        self.afterDisplayedRegionsSetCallbacks.push(cb)
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
        const centerBp = self.totalBp / 2
        const centerPx = centerBp / self.bpPerPx
        self.scrollTo(Math.round(centerPx - self.width / 2))
      },

      /**
       * #action
       */
      showAllRegions() {
        self.zoomTo(self.maxBpPerPx)
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
        const assembly = assemblyManager.get(assemblyName!)
        if (assembly) {
          const { regions } = assembly
          if (regions) {
            this.setDisplayedRegions(regions)
            self.zoomTo(self.maxBpPerPx)
            this.center()
          }
        }
      },

      /**
       * #action
       */
      setDraggingTrackId(idx?: string) {
        self.draggingTrackId = idx
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
        // mobx-state-tree snapshot
        self.scrollTo(0)
        self.zoomTo(10)
      },

      /**
       * #method
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } = await import(
          './svgcomponents/SVGLinearGenomeView'
        )
        const html = await renderToSvg(self as LinearGenomeViewModel, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, opts.filename || 'image.svg')
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
        const { canShowCytobands, showCytobands } = self
        const session = getSession(self)
        const menuItems: MenuItem[] = [
          {
            label: 'Return to import form',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
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
                    getSession(self).queueDialog(handleClose => [
                      SequenceSearchDialog,
                      { model: self, handleClose },
                    ])
                  },
                },
              ]
            : []),
          {
            label: 'Export SVG',
            icon: PhotoCameraIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ExportSvgDialog,
                { model: self, handleClose },
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
            label: 'Color by CDS',
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
            value.forEach(action => menuItems.push(action))
          }
        }

        return menuItems
      },
    }))
    .views(self => {
      let currentlyCalculatedStaticBlocks: BlockSet | undefined
      let stringifiedCurrentlyCalculatedStaticBlocks = ''
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
          const ret = calculateStaticBlocks(self)
          const sret = JSON.stringify(ret)
          if (stringifiedCurrentlyCalculatedStaticBlocks !== sret) {
            currentlyCalculatedStaticBlocks = ret
            stringifiedCurrentlyCalculatedStaticBlocks = sret
          }
          return currentlyCalculatedStaticBlocks!
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

        addDisposer(
          self,
          autorun(() => {
            const s = (s: unknown) => JSON.stringify(s)
            const { showCytobandsSetting, showCenterLine, colorByCDS } = self
            localStorageSetItem('lgv-showCytobands', s(showCytobandsSetting))
            localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
            localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
          }),
        )
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
      async navToLocString(input: string, optAssemblyName?: string) {
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
       * Similar to `navToLocString`, but accepts parsed location objects
       * instead of strings. Will try to perform `setDisplayedRegions` if
       * changing regions
       */
      async navToLocations(
        parsedLocStrings: ParsedLocString[],
        assemblyName?: string,
      ) {
        const { assemblyManager } = getSession(self)
        await when(() => self.volatileWidth !== undefined)

        const locations = await generateLocations(
          parsedLocStrings,
          assemblyManager,
          assemblyName,
        )

        if (locations.length === 1) {
          const loc = locations[0]!
          const { reversed, parentRegion, start, end } = loc
          self.setDisplayedRegions([{ reversed, ...parentRegion }])

          this.navTo({
            ...loc,
            start: clamp(start ?? 0, 0, parentRegion.end),
            end: clamp(end ?? parentRegion.end, 0, parentRegion.end),
          })
        } else {
          self.setDisplayedRegions(
            // @ts-expect-error
            locations.map(r => (r.start === undefined ? r.parentRegion : r)),
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
        const f1 = locations.at(0)
        const f2 = locations.at(-1)
        if (!f1 || !f2) {
          return
        }
        const a = self.assemblyNames[0]!
        const { assemblyManager } = getSession(self)
        const assembly1 = assemblyManager.get(f1.assemblyName || a)
        const assembly2 = assemblyManager.get(f2.assemblyName || a)
        const ref1 = assembly1?.getCanonicalRefName(f1.refName) || f1.refName
        const ref2 = assembly2?.getCanonicalRefName(f2.refName) || f2.refName
        const r1 = self.displayedRegions.find(r => r.refName === ref1)
        const r2 = findLast(self.displayedRegions, r => r.refName === ref2)
        if (!r1) {
          throw new Error(`could not find a region with refName "${ref1}"`)
        }
        if (!r2) {
          throw new Error(`could not find a region with refName "${ref2}"`)
        }

        const s1 = f1.start === undefined ? r1.start : f1.start
        const e1 = f1.end === undefined ? r1.end : f1.end
        const s2 = f2.start === undefined ? r2.start : f2.start
        const e2 = f2.end === undefined ? r2.end : f2.end

        const index = self.displayedRegions.findIndex(
          r =>
            ref1 === r.refName &&
            s1 >= r.start &&
            s1 <= r.end &&
            e1 <= r.end &&
            e1 >= r.start,
        )

        const index2 = self.displayedRegions.findIndex(
          r =>
            ref2 === r.refName &&
            s2 >= r.start &&
            s2 <= r.end &&
            e2 <= r.end &&
            e2 >= r.start,
        )

        if (index === -1 || index2 === -1) {
          throw new Error(
            `could not find a region that contained "${locations.map(l =>
              assembleLocString(l),
            )}"`,
          )
        }

        const sd = self.displayedRegions[index]!
        const ed = self.displayedRegions[index2]!

        this.moveTo(
          {
            index,
            offset: sd.reversed ? sd.end - e1 : s1 - sd.start,
          },
          {
            index: index2,
            offset: ed.reversed ? ed.end - s2 : e2 - ed.start,
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

                { model: self as any, handleClose },
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
            } else if (e.code === 'ArrowUp' && self.scaleFactor === 1) {
              e.preventDefault()
              self.zoom(self.bpPerPx / 2)
            } else if (e.code === 'ArrowDown' && self.scaleFactor === 1) {
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
}

export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>

export {
  default as ReactComponent,
  default as LinearGenomeView,
} from './components/LinearGenomeView'

export { default as RefNameAutocomplete } from './components/RefNameAutocomplete'
export { default as SearchBox } from './components/SearchBox'
export { default as ZoomControls } from './components/ZoomControls'

export { renderToSvg } from './svgcomponents/SVGLinearGenomeView'
