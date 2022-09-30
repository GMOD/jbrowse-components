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
  measureText,
  parseLocString,
  springAnimate,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { BlockSet, BaseBlock } from '@jbrowse/core/util/blockTypes'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { transaction, autorun } from 'mobx'
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
import { renderToSvg } from './components/LinearGenomeViewSvg'
import RefNameAutocomplete from './components/RefNameAutocomplete'
import SearchBox from './components/SearchBox'
import ExportSvgDlg from './components/ExportSvgDialog'
import MiniControls from './components/MiniControls'
import Header from './components/Header'
import ZoomControls from './components/ZoomControls'
import LinearGenomeView from './components/LinearGenomeView'

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

function localStorageGetItem(item: string) {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(item)
    : undefined
}

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
        hideNoTracksActive: false,
        trackSelectorType: types.optional(
          types.enumeration(['hierarchical']),
          'hierarchical',
        ),
        trackLabels: types.optional(
          types.string,
          () => localStorageGetItem('lgv-trackLabels') || 'overlapping',
        ),
        showCenterLine: types.optional(types.boolean, () => {
          const setting = localStorageGetItem('lgv-showCenterLine')
          return setting !== undefined && setting !== null ? !!+setting : false
        }),
        showCytobandsSetting: types.optional(types.boolean, () => {
          const setting = localStorageGetItem('lgv-showCytobands')
          return setting !== undefined && setting !== null ? !!+setting : true
        }),
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
      get width(): number {
        if (self.volatileWidth === undefined) {
          throw new Error(
            'width undefined, make sure to check for model.initialized',
          )
        }
        return self.volatileWidth
      },
      get interRegionPaddingWidth() {
        return INTER_REGION_PADDING_WIDTH
      },

      get assemblyNames() {
        return [
          ...new Set(self.displayedRegions.map(region => region.assemblyName)),
        ]
      },
    }))
    .views(self => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      MiniControlsComponent(): React.FC<any> {
        return MiniControls
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      HeaderComponent(): React.FC<any> {
        return Header
      },

      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        const { assemblyNames } = self
        return assemblyNames
          .map(a => assemblyManager.get(a)?.error)
          .filter(f => !!f)
          .join(', ')
      },

      get assembliesInitialized() {
        const { assemblyManager } = getSession(self)
        const { assemblyNames } = self
        return assemblyNames.every(a => assemblyManager.get(a)?.initialized)
      },
      get initialized() {
        return self.volatileWidth !== undefined && this.assembliesInitialized
      },
      get hasDisplayedRegions() {
        return self.displayedRegions.length > 0
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
      get totalBp() {
        return self.displayedRegions.reduce((a, b) => a + b.end - b.start, 0)
      },

      get maxBpPerPx() {
        return this.totalBp / (self.width * 0.9)
      },

      get minBpPerPx() {
        return 1 / 50
      },

      get error() {
        return self.volatileError || this.assemblyErrors
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

      searchScope(assemblyName: string) {
        return {
          assemblyName,
          includeAggregateIndexes: true,
          tracks: self.tracks,
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
          if (openTrackIds.includes(result.trackId)) {
            result.updateScore(result.getScore() + 1)
          }
        })
        return results
      },

      // modifies view menu action onClick to apply to all tracks of same type
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
      setShowCytobands(flag: boolean) {
        self.showCytobandsSetting = flag
        localStorage.setItem('lgv-showCytobands', `${+flag}`)
      },
      setWidth(newWidth: number) {
        self.volatileWidth = newWidth
      },
      setError(error: Error | undefined) {
        self.volatileError = error
      },

      toggleHeader() {
        self.hideHeader = !self.hideHeader
      },

      toggleHeaderOverview() {
        self.hideHeaderOverview = !self.hideHeaderOverview
      },
      toggleNoTracksActive() {
        self.hideNoTracksActive = !self.hideNoTracksActive
      },
      toggleShowGridlines() {
        self.showGridlines = !self.showGridlines
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

      setOffsets(left?: BpOffset, right?: BpOffset) {
        // sets offsets used in the get sequence dialog
        self.leftOffset = left
        self.rightOffset = right
      },

      setSearchResults(results?: BaseResult[], query?: string) {
        self.searchResults = results
        self.searchQuery = query
      },

      setGetSequenceDialogOpen(open: boolean) {
        self.seqDialogDisplayed = open
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
        const supportedDisplays = viewType.displayTypes.map(d => d.name)
        const displayConf = conf.displays.find((d: AnyConfigurationModel) =>
          supportedDisplays.includes(d.type),
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

      hideTrack(trackId: string) {
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const conf = resolveIdentifier(schema, getRoot(self), trackId)
        const t = self.tracks.filter(t => t.configuration === conf)
        transaction(() => t.forEach(t => self.tracks.remove(t)))
        return t.length
      },
    }))
    .actions(self => ({
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
        localStorage.setItem('lgv-trackLabels', setting)
      },

      toggleCenterLine() {
        self.showCenterLine = !self.showCenterLine
        localStorage.setItem('lgv-showCenterLine', `${+self.showCenterLine}`)
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

      /**
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

      // schedule something to be run after the next time displayedRegions is set
      afterDisplayedRegionsSet(cb: Function) {
        self.afterDisplayedRegionsSetCallbacks.push(cb)
      },

      horizontalScroll(distance: number) {
        const oldOffsetPx = self.offsetPx
        // newOffsetPx is the actual offset after the scroll is clamped
        const newOffsetPx = self.scrollTo(self.offsetPx + distance)
        return newOffsetPx - oldOffsetPx
      },

      center() {
        const centerBp = self.totalBp / 2
        const centerPx = centerBp / self.bpPerPx
        self.scrollTo(Math.round(centerPx - self.width / 2))
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
      // this "clears the view" and makes the view return to the import form
      clearView() {
        this.setDisplayedRegions([])
        self.tracks.clear()
        // it is necessary to run these after setting displayed regions empty
        // or else model.offsetPx gets set to Infinity and breaks
        // mobx-state-tree snapshot
        self.scrollTo(0)
        self.zoomTo(10)
      },
      async exportSvg(opts: ExportSvgOptions = {}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html = await renderToSvg(self as any, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, opts.filename || 'image.svg')
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
    .views(self => ({
      get canShowCytobands() {
        return self.displayedRegions.length === 1 && this.anyCytobandsExist
      },
      get showCytobands() {
        return this.canShowCytobands && self.showCytobandsSetting
      },
      get anyCytobandsExist() {
        const { assemblyManager } = getSession(self)
        const { assemblyNames } = self
        return assemblyNames.some(
          asm => assemblyManager.get(asm)?.cytobands?.length,
        )
      },

      get cytobandOffset() {
        return this.showCytobands
          ? measureText(self.displayedRegions[0].refName, 12) + 15
          : 0
      },
    }))
    .views(self => ({
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
          { type: 'divider' },
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
            label: 'Show no tracks active button',
            icon: VisibilityIcon,
            type: 'checkbox',
            checked: !self.hideNoTracksActive,
            onClick: self.toggleNoTracksActive,
          },
          {
            label: 'Show guidelines',
            icon: VisibilityIcon,
            type: 'checkbox',
            checked: self.showGridlines,
            onClick: self.toggleShowGridlines,
          },
          ...(canShowCytobands
            ? [
                {
                  label: 'Show ideogram',
                  icon: VisibilityIcon,
                  type: 'checkbox' as const,
                  checked: self.showCytobands,
                  onClick: () => self.setShowCytobands(!showCytobands),
                },
              ]
            : []),
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

      navToLocString(locString: string, optAssemblyName?: string) {
        const { assemblyNames } = self
        const { assemblyManager } = getSession(self)
        const { isValidRefName } = assemblyManager
        const assemblyName = optAssemblyName || assemblyNames[0]
        let parsedLocStrings
        const inputs = locString
          .split(/(\s+)/)
          .map(f => f.trim())
          .filter(f => !!f)

        // first try interpreting as a whitespace-separated sequence of
        // multiple locstrings
        try {
          parsedLocStrings = inputs.map(l =>
            parseLocString(l, ref => isValidRefName(ref, assemblyName)),
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

        const locations = parsedLocStrings?.map(region => {
          const asmName = region.assemblyName || assemblyName
          const asm = assemblyManager.get(asmName)
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
            throw new Error(`Could not find refName ${refName} in ${asm.name}`)
          }
          const parentRegion = regions.find(
            region => region.refName === canonicalRefName,
          )
          if (!parentRegion) {
            throw new Error(`Could not find refName ${refName} in ${asmName}`)
          }

          return {
            ...region,
            assemblyName: asmName,
            parentRegion,
          }
        })

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
            // @ts-ignore
            locations.map(r => (r.start === undefined ? r.parentRegion : r)),
          )
          self.showAllRegions()
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
    }))
    .views(self => ({
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

      pxToBp(px: number) {
        return pxToBp(self, px)
      },

      get centerLineInfo() {
        return self.displayedRegions.length
          ? this.pxToBp(self.width / 2)
          : undefined
      },
    }))
}

export {
  renderToSvg,
  RefNameAutocomplete,
  SearchBox,
  ZoomControls,
  LinearGenomeView,
}
export type LinearGenomeViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearGenomeViewModel = Instance<LinearGenomeViewStateModel>
export { default as ReactComponent } from './components/LinearGenomeView'
