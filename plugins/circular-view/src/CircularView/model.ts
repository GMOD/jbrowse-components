import type React from 'react'
import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { autorun } from 'mobx'

import { calculateStaticSlices, sliceIsVisible } from './slices'
import { viewportVisibleSection } from './viewportVisibleRegion'

import type { SliceRegion } from './slices'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))

export interface CircularViewInit {
  assembly: string
  tracks?: string[]
}
export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  themeName?: string
}

/**
 * #stateModel CircularView
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function stateModelFactory(pluginManager: PluginManager) {
  const minHeight = 40
  const minWidth = 100
  const defaultHeight = 400
  return types
    .compose(
      'CircularView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        type: types.literal('CircularView'),
        /**
         * #property
         * similar to offsetPx in linear genome view
         */
        offsetRadians: -Math.PI / 2,
        /**
         * #property
         */
        bpPerPx: 200,
        /**
         * #property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),

        /**
         * #property
         */
        hideVerticalResizeHandle: false,
        /**
         * #property
         */
        hideTrackSelectorButton: false,
        /**
         * #property
         */
        lockedFitToWindow: true,
        /**
         * #property
         */
        disableImportForm: false,

        /**
         * #property
         */
        height: types.optional(types.number, defaultHeight),
        /*
         * #property
         */
        displayedRegions: types.optional(types.frozen<Region[]>(), []),
        /**
         * #property
         */
        scrollX: 0,
        /**
         * #property
         */
        scrollY: 0,

        /**
         * #property
         */
        minimumRadiusPx: 25,
        /**
         * #property
         */
        spacingPx: 10,
        /**
         * #property
         */
        paddingPx: 80,
        /**
         * #property
         */
        lockedPaddingPx: 100,
        /**
         * #property
         */
        minVisibleWidth: 6,
        /**
         * #property
         */
        minimumBlockWidth: 20,
        /**
         * #property
         */
        trackSelectorType: 'hierarchical',
        /**
         * #property
         * used for initializing the view from a session snapshot
         */
        init: types.frozen<CircularViewInit | undefined>(),
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,
      error: undefined as unknown,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get width() {
        if (self.volatileWidth === undefined) {
          throw new Error(
            'wait for view to be initialized first before accessing width',
          )
        }
        return self.volatileWidth
      },

      /**
       * #getter
       */
      get visibleSection() {
        const { scrollX, scrollY, width, height } = self
        return viewportVisibleSection(
          [scrollX, scrollX + width, scrollY, scrollY + height],
          this.centerXY,
          this.radiusPx,
        )
      },
      /**
       * #getter
       */
      get circumferencePx() {
        let elidedBp = 0

        for (const r of this.elidedRegions) {
          elidedBp += r.widthBp
        }
        return (
          elidedBp / self.bpPerPx + self.spacingPx * this.elidedRegions.length
        )
      },
      /**
       * #getter
       */
      get radiusPx() {
        return this.circumferencePx / (2 * Math.PI)
      },
      /**
       * #getter
       */
      get bpPerRadian() {
        return self.bpPerPx * this.radiusPx
      },
      /**
       * #getter
       */
      get pxPerRadian() {
        return this.radiusPx
      },
      /**
       * #getter
       */
      get centerXY(): [number, number] {
        return [this.radiusPx + self.paddingPx, this.radiusPx + self.paddingPx]
      },
      /**
       * #getter
       */
      get totalBp() {
        let total = 0
        for (const region of self.displayedRegions) {
          total += region.end - region.start
        }
        return total
      },
      /**
       * #getter
       */
      get maximumRadiusPx() {
        return self.lockedFitToWindow
          ? Math.min(self.width, self.height) / 2 - self.lockedPaddingPx
          : 1000000
      },
      /**
       * #getter
       */
      get maxBpPerPx() {
        const minCircumferencePx = 2 * Math.PI * self.minimumRadiusPx
        return this.totalBp / minCircumferencePx
      },
      /**
       * #getter
       */
      get minBpPerPx() {
        // min depends on window dimensions, clamp between old min(0.01) and max
        const maxCircumferencePx = 2 * Math.PI * this.maximumRadiusPx
        return clamp(
          this.totalBp / maxCircumferencePx,
          0.0000000001,
          this.maxBpPerPx,
        )
      },
      /**
       * #getter
       */
      get atMaxBpPerPx() {
        return self.bpPerPx >= this.maxBpPerPx
      },
      /**
       * #getter
       */
      get atMinBpPerPx() {
        return self.bpPerPx <= this.minBpPerPx
      },
      /**
       * #getter
       */
      get tooSmallToLock() {
        return this.minBpPerPx <= 0.0000000001
      },
      /**
       * #getter
       */
      get figureDimensions(): [number, number] {
        return [
          this.radiusPx * 2 + 2 * self.paddingPx,
          this.radiusPx * 2 + 2 * self.paddingPx,
        ]
      },
      /**
       * #getter
       */
      get figureWidth() {
        return this.figureDimensions[0]
      },
      /**
       * #getter
       */
      get figureHeight() {
        return this.figureDimensions[1]
      },
      /**
       * #getter
       * this is displayedRegions, post-processed to elide regions that are too
       * small to see reasonably
       */
      get elidedRegions() {
        const visible: SliceRegion[] = []
        for (const region of self.displayedRegions) {
          const widthBp = region.end - region.start
          const widthPx = widthBp / self.bpPerPx
          if (widthPx < self.minVisibleWidth) {
            // too small to see, collapse into a single elision region
            const lastVisible = visible.at(-1)
            if (lastVisible?.elided) {
              lastVisible.regions.push({ ...region })
              lastVisible.widthBp += widthBp
            } else {
              visible.push({
                elided: true,
                widthBp,
                regions: [{ ...region }],
              })
            }
          } else {
            // big enough to see, display it
            visible.push({ ...region, widthBp, elided: false })
          }
        }

        // remove any single-region elisions
        for (let i = 0; i < visible.length; i += 1) {
          const v = visible[i]!
          if (v.elided && v.regions.length === 1) {
            visible[i] = { ...v, ...v.regions[0]!, elided: false }
          }
        }
        return visible
      },
      /**
       * #getter
       */
      get assemblyNames() {
        const assemblyNames: string[] = []
        for (const displayedRegion of self.displayedRegions) {
          if (!assemblyNames.includes(displayedRegion.assemblyName)) {
            assemblyNames.push(displayedRegion.assemblyName)
          }
        }
        return assemblyNames
      },
      /**
       * #getter
       */
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        const { assemblyManager } = getSession(self)
        // if init is set, wait for that assembly to be initialized
        if (self.init) {
          return !!assemblyManager.get(self.init.assembly)?.initialized
        }
        return this.assemblyNames.every(a => assemblyManager.get(a)?.initialized)
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
        return self.displayedRegions.length > 0 || !!self.init
      },

      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return !this.initialized && !self.error && this.hasSomethingToShow
      },

      /**
       * #getter
       * Whether the view is fully initialized and ready to display
       */
      get showView() {
        return (
          !!self.displayedRegions.length &&
          !!this.figureWidth &&
          !!this.figureHeight &&
          this.initialized
        )
      },

      /**
       * #getter
       * Whether to show the import form (when not ready to display and import
       * form is enabled, or when there's an error)
       */
      get showImportForm() {
        return (
          (!this.hasSomethingToShow && !self.disableImportForm) || !!self.error
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get staticSlices() {
        return calculateStaticSlices(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleStaticSlices() {
        return self.staticSlices.filter(s => sliceIsVisible(self, s))
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.volatileWidth = Math.max(newWidth, minWidth)
        return self.volatileWidth
      },
      /**
       * #action
       */
      setHeight(newHeight: number) {
        self.height = Math.max(newHeight, minHeight)
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        this.setModelViewWhenAdjust(!self.tooSmallToLock)
        return newHeight - oldHeight
      },
      /**
       * #action
       */
      resizeWidth(distance: number) {
        const oldWidth = self.width
        const newWidth = this.setWidth(self.width + distance)
        this.setModelViewWhenAdjust(!self.tooSmallToLock)
        return newWidth - oldWidth
      },
      /**
       * #action
       */
      rotateClockwiseButton() {
        this.rotateClockwise(Math.PI / 6)
      },

      /**
       * #action
       */
      rotateCounterClockwiseButton() {
        this.rotateCounterClockwise(Math.PI / 6)
      },

      /**
       * #action
       */
      rotateClockwise(distance = 0.17) {
        self.offsetRadians += distance
      },

      /**
       * #action
       */
      rotateCounterClockwise(distance = 0.17) {
        self.offsetRadians -= distance
      },

      /**
       * #action
       */
      zoomInButton() {
        this.setBpPerPx(self.bpPerPx / 1.4)
      },

      /**
       * #action
       */
      zoomOutButton() {
        this.setBpPerPx(self.bpPerPx * 1.4)
      },

      /**
       * #action
       */
      setBpPerPx(newVal: number) {
        self.bpPerPx = clamp(newVal, self.minBpPerPx, self.maxBpPerPx)
      },

      /**
       * #action
       */
      setModelViewWhenAdjust(secondCondition: boolean) {
        if (self.lockedFitToWindow && secondCondition) {
          this.setBpPerPx(self.minBpPerPx)
        }
      },

      /**
       * #action
       */
      setDisplayedRegions(regions: Region[]) {
        const previouslyEmpty = self.displayedRegions.length === 0
        self.displayedRegions = cast(regions)

        if (previouslyEmpty) {
          this.setBpPerPx(self.minBpPerPx)
        } else {
          this.setBpPerPx(self.bpPerPx)
        }
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
       * #action
       */
      toggleTrack(trackId: string) {
        toggleTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      setError(error: unknown) {
        self.error = error
      },

      /**
       * #action
       */
      setInit(init?: CircularViewInit) {
        self.init = init
      },

      /**
       * #action
       */
      showTrack(trackId: string, initialSnapshot = {}) {
        showTrackGeneric(self, trackId, initialSnapshot)
      },

      /**
       * #action
       */
      addTrackConf(configuration: AnyConfigurationModel, initialSnapshot = {}) {
        const { type } = configuration
        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)
        if (!trackType) {
          throw new Error(`unknown track type ${type}`)
        }
        const viewType = pluginManager.getViewType(self.type)!
        const supportedDisplays = new Set(
          viewType.displayTypes.map(d => d.name),
        )
        const displayConf = configuration.displays.find(
          (d: AnyConfigurationModel) => supportedDisplays.has(d.type),
        )
        self.tracks.push(
          trackType.stateModel.create({
            ...initialSnapshot,
            name,
            type,
            configuration,
            displays: [{ type: displayConf.type, configuration: displayConf }],
          }),
        )
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        hideTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      toggleFitToWindowLock() {
        // when going unlocked -> locked and circle is cut off, set to the
        // locked minBpPerPx
        self.lockedFitToWindow = !self.lockedFitToWindow
        this.setModelViewWhenAdjust(self.atMinBpPerPx)
        return self.lockedFitToWindow
      },
      /**
       * #action
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } = await import('./svgcomponents/SVGCircularView')
        const html = await renderToSvg(self as CircularViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')
        saveAs(
          new Blob([html], { type: 'image/svg+xml' }),
          opts.filename || 'image.svg',
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function circularViewInitAutorun() {
              const { init, initialized } = self
              if (!initialized) {
                return
              }
              if (init) {
                const session = getSession(self)
                const { assemblyManager } = session
                const regions = assemblyManager.get(init.assembly)?.regions

                if (regions) {
                  self.setDisplayedRegions(regions)
                }

                if (init.tracks) {
                  for (const trackId of init.tracks) {
                    self.showTrack(trackId)
                  }
                }

                self.setInit(undefined)
              }
            },
            { name: 'CircularViewInit' },
          ),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * return the view menu items
       */
      menuItems(): MenuItem[] {
        return [
          {
            label: 'Return to import form',
            onClick: () => {
              self.setDisplayedRegions([])
            },
            icon: FolderOpenIcon,
          },
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
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      const { init, ...rest } = snap as Omit<typeof snap, symbol>
      return rest
    })
}

export type CircularViewStateModel = ReturnType<typeof stateModelFactory>
export type CircularViewModel = Instance<CircularViewStateModel>

export default stateModelFactory
