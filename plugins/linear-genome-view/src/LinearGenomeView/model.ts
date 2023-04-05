import React, { lazy } from 'react'
import { getConf, AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { Region } from '@jbrowse/core/util/types'
import { ElementId, Region as MUIRegion } from '@jbrowse/core/util/types/mst'
import { MenuItem, ReturnToImportFormDialog } from '@jbrowse/core/ui'
import {
  assembleLocString,
  clamp,
  findLastIndex,
  getContainingView,
  getSession,
  isViewContainer,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  localStorageGetItem,
  measureText,
  parseLocString,
  springAnimate,
  sum,
} from '@jbrowse/core/util'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { BlockSet, BaseBlock } from '@jbrowse/core/util/blockTypes'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { when, transaction, autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getSnapshot,
  getRoot,
  resolveIdentifier,
  types,
  Instance,
} from 'mobx-state-tree'

import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { moveTo, pxToBp, bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { saveAs } from 'file-saver'
import clone from 'clone'
import PluginManager from '@jbrowse/core/PluginManager'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import LabelIcon from '@mui/icons-material/Label'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

// locals
import { renderToSvg } from './svgcomponents/SVGLinearGenomeView'

import ExportSvgDlg from './components/ExportSvgDialog'
import MiniControls from './components/MiniControls'
import Header from './components/Header'

// lazies
const SequenceSearchDialog = lazy(
  () => import('./components/SequenceSearchDialog'),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Wrapper?: React.FC<any>
  fontSize?: number
  rulerHeight?: number
  textHeight?: number
  paddingHeight?: number
  headerHeight?: number
  cytobandHeight?: number
  trackLabels?: string
  themeName?: string
}

function calculateVisibleLocStrings(contentBlocks: BaseBlock[]) {
  if (!contentBlocks.length) {
    return ''
  }
  const isSingleAssemblyName = contentBlocks.every(
    b => b.assemblyName === contentBlocks[0].assemblyName,
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

export const HEADER_BAR_HEIGHT = 48
export const HEADER_OVERVIEW_HEIGHT = 20
export const SCALE_BAR_HEIGHT = 17
export const RESIZE_HANDLE_HEIGHT = 3
export const INTER_REGION_PADDING_WIDTH = 2
export const SPACING = 7
export const WIDGET_HEIGHT = 32

/**
 * #stateModel LinearGenomeView
 */
export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      BaseViewModel,
      types.model('LinearGenomeView', {
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
        displayedRegions: types.array(MUIRegion),

        /**
         * #property
         * array of currently displayed tracks state models instances
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),

        /**
         * #property
         * array of currently displayed tracks state model's
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
         * how to display the track labels, can be "overlapping", "offset", or "hidden"
         */
        trackLabels: types.optional(
          types.string,
          () => localStorageGetItem('lgv-trackLabels') || 'overlapping',
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
         * show the "gridlines" in the track area
         */
        showGridlines: true,
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,
      minimumBlockWidth: 3,
      draggingTrackId: undefined as undefined | string,
      volatileError: undefined as undefined | Error,

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
      seqDialogDisplayed: false,
    }))
    .views(self => ({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      MiniControlsComponent(): React.FC<any> {
        return MiniControls
      },

      /**
       * #method
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      HeaderComponent(): React.FC<any> {
        return Header
      },

      /**
       * #getter
       */
      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        const { assemblyNames } = self
        return assemblyNames
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
      get isSearchDialogDisplayed() {
        return self.searchResults !== undefined
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
        return self.displayedRegions.reduce((a, b) => a + b.end - b.start, 0)
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
      get error() {
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
          highResolutionScaling: getConf(
            getSession(self),
            'highResolutionScaling',
          ),
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
    }))
    .actions(self => ({
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
      setError(error: Error | undefined) {
        self.volatileError = error
      },
      /**
       * #action
       */
      toggleHeader() {
        self.hideHeader = !self.hideHeader
      },
      /**
       * #action
       */
      toggleHeaderOverview() {
        self.hideHeaderOverview = !self.hideHeaderOverview
      },
      /**
       * #action
       */
      toggleNoTracksActive() {
        self.hideNoTracksActive = !self.hideNoTracksActive
      },
      /**
       * #action
       */
      toggleShowGridlines() {
        self.showGridlines = !self.showGridlines
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
       * sets offsets used in the get sequence dialog
       */
      setOffsets(left?: BpOffset, right?: BpOffset) {
        self.leftOffset = left
        self.rightOffset = right
      },

      /**
       * #action
       */
      setSearchResults(results?: BaseResult[], query?: string) {
        self.searchResults = results
        self.searchQuery = query
      },

      /**
       * #action
       */
      setGetSequenceDialogOpen(open: boolean) {
        self.seqDialogDisplayed = open
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
        const viewType = pluginManager.getViewType(self.type)
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
        transaction(() => t.forEach(t => self.tracks.remove(t)))
        return t.length
      },
    }))
    .actions(self => ({
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
        const track = getSnapshot(self.tracks[oldIndex])
        self.tracks.splice(oldIndex, 1)
        self.tracks.splice(newIndex, 0, track)
      },

      /**
       * #action
       */
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

      /**
       * #action
       */
      toggleTrack(trackId: string) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(trackId)
        // if none had that configuration, turn one on
        if (!hiddenCount) {
          self.showTrack(trackId)
        }
      },

      /**
       * #action
       */
      setTrackLabels(setting: 'overlapping' | 'offset' | 'hidden') {
        self.trackLabels = setting
      },

      /**
       * #action
       */
      toggleCenterLine() {
        self.showCenterLine = !self.showCenterLine
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
       * Retrieves the corresponding regions that were selected by the rubberband
       *
       * @param leftOffset - `object as {start, end, index, offset}`, offset = start of user drag
       * @param rightOffset - `object as {start, end, index, offset}`, offset = end of user drag
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
       * schedule something to be run after the next time displayedRegions is set
       */
      afterDisplayedRegionsSet(cb: Function) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html = await renderToSvg(self as any, opts)
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
        )
        cancelLastAnimation()
        cancelLastAnimation = cancelAnimation
        animate()
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
        cancelLastAnimation = cancelAnimation
        animate()
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
       * the cytoband is displayed to the right of the chromosome name,
       * and that offset is calculated manually with this method
       */
      get cytobandOffset() {
        return this.showCytobands
          ? measureText(self.displayedRegions[0].refName, 12) + 15
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
                ExportSvgDlg,
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
                onClick: self.toggleCenterLine,
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
                label: 'Show no tracks active button',
                type: 'checkbox',
                checked: !self.hideNoTracksActive,
                onClick: self.toggleNoTracksActive,
              },
              {
                label: 'Show guidelines',
                type: 'checkbox',
                checked: self.showGridlines,
                onClick: self.toggleShowGridlines,
              },
              ...(canShowCytobands
                ? [
                    {
                      label: 'Show ideogram',
                      type: 'checkbox' as const,
                      checked: self.showCytobands,
                      onClick: () => self.setShowCytobands(!showCytobands),
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
         * scroll to the right, old blocks to the left may be removed, and
         * new blocks may be instantiated on the right. tracks may use the
         * static blocks to render their data for the region represented by
         * the block
         */
        get staticBlocks() {
          const ret = calculateStaticBlocks(self)
          const sret = JSON.stringify(ret)
          if (stringifiedCurrentlyCalculatedStaticBlocks !== sret) {
            currentlyCalculatedStaticBlocks = ret
            stringifiedCurrentlyCalculatedStaticBlocks = sret
          }
          return currentlyCalculatedStaticBlocks as BlockSet
        },
        /**
         * #getter
         * dynamic blocks represent the exact coordinates of the currently
         * visible genome regions on the screen. they are similar to static
         * blocks, but statcic blocks can go offscreen while dynamic blocks
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
              } as BaseBlock),
          )
        },

        /**
         * #getter
         * a single "combo-locstring" representing all the regions visible
         * on the screen
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
            const { trackLabels, showCytobandsSetting, showCenterLine } = self
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('lgv-trackLabels', trackLabels)
              localStorage.setItem('lgv-showCytobands', s(showCytobandsSetting))
              localStorage.setItem('lgv-showCenterLine', s(showCenterLine))
            }
          }),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * offset is the base-pair-offset in the displayed region, index is the index of the
       * displayed region in the linear genome view
       *
       * @param start - object as `{start, end, offset, index}`
       * @param end - object as `{start, end, offset, index}`
       */
      moveTo(start?: BpOffset, end?: BpOffset) {
        moveTo(self, start, end)
      },

      /**
       * #action
       * navigate to the given locstring
       *
       * @param locString - e.g. "chr1:1-100"
       * @param optAssemblyName - (optional) the assembly name to use when navigating to the locstring
       */
      async navToLocString(locString: string, optAssemblyName?: string) {
        const { assemblyNames } = self
        const { assemblyManager } = getSession(self)
        const { isValidRefName } = assemblyManager
        await when(() => self.volatileWidth !== undefined)
        const assemblyName = optAssemblyName || assemblyNames[0]
        let parsedLocStrings
        const inputs = locString
          .split(/(\s+)/)
          .map(f => f.trim())
          .filter(f => !!f)

        if (assemblyName) {
          await assemblyManager.waitForAssembly(assemblyName)
        }

        // first try interpreting as a whitespace-separated sequence of
        // multiple locstrings
        try {
          parsedLocStrings = inputs.map(loc =>
            parseLocString(loc, ref => isValidRefName(ref, assemblyName)),
          )
        } catch (e) {
          // if this fails, try interpreting as a whitespace-separated refname,
          // start, end if start and end are integer inputs
          const [refName, start, end] = inputs
          if (
            `${e}`.match(/Unknown reference sequence/) &&
            Number.isInteger(+start) &&
            Number.isInteger(+end)
          ) {
            parsedLocStrings = [
              parseLocString(refName + ':' + start + '..' + end, ref =>
                isValidRefName(ref, assemblyName),
              ),
            ]
          } else {
            throw e
          }
        }

        const locations = await Promise.all(
          parsedLocStrings?.map(async region => {
            const asmName = region.assemblyName || assemblyName
            const asm = await assemblyManager.waitForAssembly(asmName)
            const { refName } = region
            if (!asm) {
              throw new Error(`assembly ${asmName} not found`)
            }
            const { regions } = asm
            if (!regions) {
              throw new Error(`regions not loaded yet for ${asmName}`)
            }
            const canonicalRefName = asm.getCanonicalRefName(region.refName)
            if (!canonicalRefName) {
              throw new Error(
                `Could not find refName ${refName} in ${asm.name}`,
              )
            }
            const parentRegion = regions.find(
              r => r.refName === canonicalRefName,
            )
            if (!parentRegion) {
              throw new Error(`Could not find refName ${refName} in ${asmName}`)
            }

            return {
              ...region,
              assemblyName: asmName,
              parentRegion,
            }
          }),
        )

        if (locations.length === 1) {
          const loc = locations[0]
          self.setDisplayedRegions([
            { reversed: loc.reversed, ...loc.parentRegion },
          ])
          const { start, end, parentRegion } = loc

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
       * and assemblyName. Can handle if there are multiple displayedRegions
       * from same refName. Only navigates to a location if it is entirely
       * within a displayedRegion. Navigates to the first matching location
       * encountered.
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
       */
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
            let idx = 0
            let start = 0
            let end = 0
            for (idx; idx < locations.length; idx++) {
              const location = locations[idx]
              const region = self.displayedRegions[index + idx]
              start = location.start || region.start
              end = location.end || region.end
              if (location.refName !== region.refName) {
                throw new Error(
                  `Entered location ${assembleLocString(
                    location,
                  )} does not match with displayed regions`,
                )
              }
            }
            idx -= 1
            const startDisplayedRegion = self.displayedRegions[index]
            const endDisplayedRegion = self.displayedRegions[index + idx]
            this.moveTo(
              {
                index,
                offset: startDisplayedRegion.reversed
                  ? startDisplayedRegion.end - e
                  : s - startDisplayedRegion.start,
              },
              {
                index: index + idx,
                offset: endDisplayedRegion.reversed
                  ? endDisplayedRegion.end - start
                  : end - endDisplayedRegion.start,
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
              const { leftOffset, rightOffset } = self
              self.moveTo(leftOffset, rightOffset)
            },
          },
          {
            label: 'Get sequence',
            icon: MenuOpenIcon,
            onClick: () => self.setGetSequenceDialogOpen(true),
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
       * scrolls the view to center on the given bp. if that is not in any
       * of the displayed regions, does nothing
       * @param coord - basepair at which you want to center the view
       * @param refName - refName of the displayedRegion you are centering at
       * @param regionNumber - index of the displayedRegion
       */
      centerAt(coord: number, refName: string, regionNumber: number) {
        const centerPx = this.bpToPx({
          refName,
          coord,
          regionNumber,
        })
        if (centerPx) {
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
