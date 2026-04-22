import { lazy } from 'react'
import type { FC, ReactNode } from 'react'

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

import { calculateStaticSlices, sliceIsVisible } from './slices.ts'
import { viewportVisibleSection } from './viewportVisibleRegion.ts'

import type { SliceRegion } from './slices.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))

export interface CircularViewInit {
  assembly: string
  tracks?: string[]
}
export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: FC<{ children: ReactNode }>
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
  const defaultOffsetRadians = -Math.PI / 2
  const defaultBpPerPx = 200
  const defaultMinimumRadiusPx = 25
  const defaultSpacingPx = 10
  const defaultPaddingPx = 80
  const defaultMinVisibleWidth = 6
  const defaultMinimumBlockWidth = 20
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
        offsetRadians: defaultOffsetRadians,
        /**
         * #property
         */
        bpPerPx: defaultBpPerPx,
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
        minimumRadiusPx: defaultMinimumRadiusPx,
        /**
         * #property
         */
        spacingPx: defaultSpacingPx,
        /**
         * #property
         */
        paddingPx: defaultPaddingPx,
        /**
         * #property
         */
        minVisibleWidth: defaultMinVisibleWidth,
        /**
         * #property
         */
        minimumBlockWidth: defaultMinimumBlockWidth,
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

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      volatileError: undefined as unknown,
      panX: 0,
      panY: 0,
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
        const { width, height } = self
        return viewportVisibleSection(
          [0, width, 0, height],
          this.centerXY,
          this.radiusPx,
        )
      },
      /**
       * #getter
       */
      get circumferencePx() {
        return this.elidedRegions.reduce(
          (sum, r) => sum + r.widthBp / self.bpPerPx + self.spacingPx,
          0,
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
        const c = this.radiusPx + self.paddingPx
        return [c, c]
      },
      /**
       * #getter
       */
      get totalBp() {
        return self.displayedRegions.reduce(
          (sum, r) => sum + r.end - r.start,
          0,
        )
      },
      /**
       * #getter
       */
      get maximumRadiusPx() {
        return 5000
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
      get figureDimensions(): [number, number] {
        const d = this.radiusPx * 2 + 2 * self.paddingPx
        return [d, d]
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
        return visible.map(v =>
          v.elided && v.regions.length === 1
            ? { ...v, ...v.regions[0]!, elided: false as const }
            : v,
        )
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
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        const { assemblyManager } = getSession(self)
        // if init is set, wait for that assembly to have regions loaded
        if (self.init) {
          const asm = assemblyManager.get(self.init.assembly)
          return !!(asm?.initialized && asm.regions)
        }
        return this.assemblyNames.every(
          name => assemblyManager.get(name)?.initialized,
        )
      },

      /**
       * #getter
       */
      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        return this.assemblyNames
          .map(name => assemblyManager.get(name)?.error)
          .filter(e => !!e)
          .join(', ')
      },

      /**
       * #getter
       */
      get error(): unknown {
        if (self.volatileError) {
          return self.volatileError
        }
        if (this.assemblyErrors) {
          return this.assemblyErrors
        }
        // Check init assembly for errors (displayedRegions may be empty during init)
        if (self.init) {
          const { assemblyManager } = getSession(self)
          const asm = assemblyManager.get(self.init.assembly)
          if (asm?.error) {
            return asm.error
          }
          if (!asm) {
            return `Assembly ${self.init.assembly} not found`
          }
        }
        return undefined
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
        return !this.initialized && !this.error && this.hasSomethingToShow
      },

      /**
       * #getter
       * Whether the view is fully initialized and ready to display
       */
      get showView() {
        return (
          !!self.displayedRegions.length &&
          !!this.figureWidth &&
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
          (!this.hasSomethingToShow && !self.disableImportForm) || !!this.error
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
      fitToWindow() {
        if (!self.displayedRegions.length) {
          return
        }
        const r = Math.min(self.width, self.height) / 2 - self.paddingPx
        this.setBpPerPx(
          self.totalBp / (2 * Math.PI * Math.max(r, self.minimumRadiusPx)),
        )
        self.panX = 0
        self.panY = 0
      },
      setWidth(newWidth: number) {
        self.volatileWidth = Math.max(newWidth, minWidth)
        this.fitToWindow()
        return self.volatileWidth
      },
      /**
       * #action
       */
      setHeight(newHeight: number) {
        self.height = Math.max(newHeight, minHeight)
        this.fitToWindow()
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
      /**
       * #action
       */
      resizeWidth(distance: number) {
        const oldWidth = self.width
        const newWidth = this.setWidth(self.width + distance)
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
      rotate(delta: number) {
        self.offsetRadians += delta
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
       * zoom toward/away from a specific angle on the circle, keeping the
       * genome position at that angle visually fixed under the cursor
       */
      zoomToPoint(newBpPerPx: number, cursorAngle: number) {
        const oldRadius = self.radiusPx
        self.bpPerPx = clamp(newBpPerPx, self.minBpPerPx, self.maxBpPerPx)
        const dr = oldRadius - self.radiusPx
        self.panX += dr * (1 + Math.cos(cursorAngle))
        self.panY += dr * (1 + Math.sin(cursorAngle))
      },

      /**
       * #action
       */
      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        this.fitToWindow()
      },

      /**
       * #action
       */
      activateTrackSelector() {
        const session = getSession(self)
        if (!isSessionModelWithWidgets(session)) {
          return
        }
        const selector = session.addWidget(
          'HierarchicalTrackSelectorWidget',
          'hierarchicalTrackSelector',
          { view: self },
        )
        session.showWidget(selector)
        return selector
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
        self.volatileError = error
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
      openExportDialog() {
        getSession(self).queueDialog(handleClose => [
          ExportSvgDialog,
          {
            model: self as unknown as {
              exportSvg(opts: ExportSvgOptions): Promise<void>
            },
            handleClose,
          },
        ])
      },

      /**
       * #action
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGCircularView.tsx')
        const html = await renderToSvg(self as CircularViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')

        if (opts.format === 'png') {
          const img = new Image()
          const svgBlob = new Blob([html], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(svgBlob)
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0)
              URL.revokeObjectURL(url)
              canvas.toBlob(blob => {
                if (blob) {
                  saveAs(blob, opts.filename || 'image.png')
                  resolve()
                } else {
                  reject(
                    new Error(
                      `Failed to create PNG. The image may be too large (${img.width}x${img.height}). Try reducing the view size or use SVG format.`,
                    ),
                  )
                }
              }, 'image/png')
            }
            img.onerror = () => {
              URL.revokeObjectURL(url)
              reject(new Error('Failed to load SVG for PNG conversion'))
            }
            img.src = url
          })
        } else {
          saveAs(
            new Blob([html], { type: 'image/svg+xml' }),
            opts.filename || 'image.svg',
          )
        }
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
            onClick: self.openExportDialog,
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        offsetRadians,
        bpPerPx,
        hideVerticalResizeHandle,
        hideTrackSelectorButton,
        disableImportForm,
        height,
        displayedRegions,
        minimumRadiusPx,
        spacingPx,
        paddingPx,
        minVisibleWidth,
        minimumBlockWidth,
        trackSelectorType,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(offsetRadians !== defaultOffsetRadians ? { offsetRadians } : {}),
        ...(bpPerPx !== defaultBpPerPx ? { bpPerPx } : {}),
        ...(hideVerticalResizeHandle ? { hideVerticalResizeHandle } : {}),
        ...(hideTrackSelectorButton ? { hideTrackSelectorButton } : {}),
        ...(disableImportForm ? { disableImportForm } : {}),
        ...(height !== defaultHeight ? { height } : {}),
        ...(displayedRegions.length ? { displayedRegions } : {}),
        ...(minimumRadiusPx !== defaultMinimumRadiusPx
          ? { minimumRadiusPx }
          : {}),
        ...(spacingPx !== defaultSpacingPx ? { spacingPx } : {}),
        ...(paddingPx !== defaultPaddingPx ? { paddingPx } : {}),
        ...(minVisibleWidth !== defaultMinVisibleWidth
          ? { minVisibleWidth }
          : {}),
        ...(minimumBlockWidth !== defaultMinimumBlockWidth
          ? { minimumBlockWidth }
          : {}),
        ...(trackSelectorType !== 'hierarchical' ? { trackSelectorType } : {}),
      } as typeof snap
    })
}

export type CircularViewStateModel = ReturnType<typeof stateModelFactory>
export type CircularViewModel = Instance<CircularViewStateModel>

export default stateModelFactory
