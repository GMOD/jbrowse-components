import type React from 'react'
import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  getSession,
  getTickDisplayStr,
  isSessionModelWithWidgets,
  localStorageGetBoolean,
  localStorageGetItem,
  max,
  measureText,
  minmax,
} from '@jbrowse/core/util'
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
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { autorun, observable } from 'mobx'

import { Dotplot1DView, DotplotHView, DotplotVView } from './1dview.ts'
import { getBlockLabelKeysToHide, makeTicks } from './components/util.ts'

import type { DotplotViewInit, ImportFormSyntenyTrack } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
type Coord = [number, number]

// defaults for postProcessSnapshot filtering
const defaultHeight = 600
const defaultBorderSize = 20
const defaultTickSize = 5
const defaultHtextRotation = -90
const defaultFontSize = 15

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  themeName?: string
}

function stringLenPx(a: string) {
  return measureText(a.slice(0, 30))
}

function pxWidthForBlocks(
  blocks: BaseBlock[],
  bpPerPx: number,
  hide: Set<string>,
) {
  return max([
    ...blocks.filter(b => !hide.has(b.key)).map(b => stringLenPx(b.refName)),
    ...blocks
      .filter(b => !hide.has(b.key))
      .map(b => stringLenPx(getTickDisplayStr(b.end, bpPerPx))),
  ])
}

/**
 * #stateModel DotplotView
 * #category view
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
export default function stateModelFactory(pm: PluginManager) {
  return types
    .compose(
      'DotplotView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: types.literal('DotplotView'),
        /**
         * #property
         */
        height: defaultHeight,
        /**
         * #property
         */
        borderSize: defaultBorderSize,
        /**
         * #property
         */
        tickSize: defaultTickSize,
        /**
         * #property
         */
        vtextRotation: 0,
        /**
         * #property
         */
        htextRotation: defaultHtextRotation,
        /**
         * #property
         */
        fontSize: defaultFontSize,
        /**
         * #property
         */
        trackSelectorType: 'hierarchical',
        /**
         * #property
         */
        assemblyNames: types.array(types.string),
        /**
         * #property
         */
        drawCigar: true,
        /**
         * #property
         */
        hview: types.optional(DotplotHView, {}),
        /**
         * #property
         */
        vview: types.optional(DotplotVView, {}),

        /**
         * #property
         */
        tracks: types.array(pm.pluggableMstType('track', 'stateModel')),

        /**
         * #property
         * this represents tracks specific to this view specifically used
         * for read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track')),
        /**
         * #property
         * used for initializing the view from a session snapshot
         */
        init: types.frozen<DotplotViewInit | undefined>(),
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
      volatileError: undefined as unknown,

      /**
       * #volatile
       * these are 'personal preferences', stored in volatile and
       * loaded/written to localStorage
       */
      cursorMode: localStorageGetItem('dotplot-cursorMode') || 'crosshair',
      /**
       * #volatile
       */
      showPanButtons: localStorageGetBoolean('dotplot-showPanbuttons', true),
      /**
       * #volatile
       */
      wheelMode: localStorageGetItem('dotplot-wheelMode') || 'zoom',
      /**
       * #volatile
       */
      borderX: 100,
      /**
       * #volatile
       */
      borderY: 100,
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
    }))
    .actions(self => ({
      /**
       * #action
       */
      importFormRemoveRow(idx: number) {
        self.importFormSyntenyTrackSelections.splice(idx, 1)
      },
      /**
       * #action
       */
      clearImportFormSyntenyTracks() {
        self.importFormSyntenyTrackSelections.clear()
      },
      /**
       * #action
       */
      setImportFormSyntenyTrack(arg: number, val: ImportFormSyntenyTrack) {
        self.importFormSyntenyTrackSelections[arg] = val
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get width(): number {
        if (!self.volatileWidth) {
          throw new Error('width not initialized')
        }
        return self.volatileWidth
      },
    }))
    .views(self => ({
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
          n => assemblyManager.get(n)?.initialized ?? true,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return (
          self.volatileWidth !== undefined &&
          self.hview.displayedRegions.length > 0 &&
          self.vview.displayedRegions.length > 0 &&
          self.assembliesInitialized
        )
      },
      /**
       * #getter
       */
      get hticks() {
        const { hview } = self
        const { dynamicBlocks, staticBlocks, bpPerPx } = hview
        return dynamicBlocks.contentBlocks.length > 5
          ? []
          : makeTicks(staticBlocks.contentBlocks, bpPerPx)
      },
      /**
       * #getter
       */
      get vticks() {
        const { vview } = self
        const { dynamicBlocks, staticBlocks, bpPerPx } = vview
        return dynamicBlocks.contentBlocks.length > 5
          ? []
          : makeTicks(staticBlocks.contentBlocks, bpPerPx)
      },
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.assemblyNames.length > 0 || !!self.init
      },
      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return (
          this.hasSomethingToShow &&
          !this.initialized &&
          !self.volatileError &&
          !self.assemblyErrors
        )
      },
      /**
       * #getter
       * Whether to show the import form
       */
      get showImportForm() {
        return !this.hasSomethingToShow || !!self.volatileError
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
      get viewWidth() {
        return self.width - self.borderX
      },
      /**
       * #getter
       */
      get viewHeight() {
        return self.height - self.borderY
      },
      /**
       * #getter
       */
      get views() {
        return [self.hview, self.vview]
      },

      /**
       * #method
       */
      renderProps() {
        const session = getSession(self)
        return {
          ...getParentRenderProps(self),
          drawCigar: self.drawCigar,
          highResolutionScaling: getConf(session, 'highResolutionScaling'),
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowPanButtons(flag: boolean) {
        self.showPanButtons = flag
      },
      /**
       * #action
       */
      setWheelMode(str: string) {
        self.wheelMode = str
      },
      /**
       * #action
       */
      setCursorMode(str: string) {
        self.cursorMode = str
      },
      /**
       * #action
       */
      setDrawCigar(flag: boolean) {
        self.drawCigar = flag
      },
      /**
       * #action
       * returns to the import form
       */
      clearView() {
        self.hview.setDisplayedRegions([])
        self.vview.setDisplayedRegions([])
        self.assemblyNames = cast([])
        self.tracks.clear()
      },
      /**
       * #action
       */
      setBorderX(n: number) {
        self.borderX = n
      },
      /**
       * #action
       */
      setBorderY(n: number) {
        self.borderY = n
      },
      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.volatileWidth = newWidth
        return self.volatileWidth
      },
      /**
       * #action
       */
      setHeight(newHeight: number) {
        self.height = newHeight
        return self.height
      },

      /**
       * #action
       */
      setError(e: unknown) {
        self.volatileError = e
      },

      /**
       * #action
       */
      setInit(init?: DotplotViewInit) {
        self.init = init
      },

      /**
       * #action
       */
      zoomOut() {
        self.hview.zoomOut()
        self.vview.zoomOut()
      },
      /**
       * #action
       */
      zoomIn() {
        self.hview.zoomIn()
        self.vview.zoomIn()
      },
    }))
    .actions(self => ({
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
      showTrack(trackId: string, initialSnapshot = {}) {
        return showTrackGeneric(self, trackId, initialSnapshot)
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
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
      setAssemblyNames(target: string, query: string) {
        self.assemblyNames = cast([target, query])
        // Clear displayed regions to trigger re-initialization with the new
        // assemblies. The dotplotRegionsAutorun will re-populate them.
        self.hview.setDisplayedRegions([])
        self.vview.setDisplayedRegions([])
      },
      /**
       * #action
       */
      setViews(arr: SnapshotIn<Base1DViewModel>[]) {
        self.hview = cast(arr[0])
        self.vview = cast(arr[1])
      },

      /**
       * #action
       */
      getCoords(mousedown: Coord, mouseup: Coord) {
        const [xmin, xmax] = minmax(mouseup[0], mousedown[0])
        const [ymin, ymax] = minmax(mouseup[1], mousedown[1])
        return Math.abs(xmax - xmin) > 3 && Math.abs(ymax - ymin) > 3
          ? [
              self.hview.pxToBp(xmin),
              self.hview.pxToBp(xmax),
              self.vview.pxToBp(self.viewHeight - ymin),
              self.vview.pxToBp(self.viewHeight - ymax),
            ]
          : undefined
      },

      /**
       * #action
       * zooms into clicked and dragged region
       */
      zoomInToMouseCoords(mousedown: Coord, mouseup: Coord) {
        const result = this.getCoords(mousedown, mouseup)
        if (result) {
          const [x1, x2, y1, y2] = result
          self.hview.moveTo(x1, x2)
          self.vview.moveTo(y2, y1)
        }
      },
      /**
       * #action
       * Calculate borders synchronously for a given zoom level
       */
      calculateBorders() {
        if (self.volatileWidth === undefined) {
          return { borderX: self.borderX, borderY: self.borderY }
        }
        const { vview, hview, viewHeight, viewWidth } = self
        const padding = 40
        const vblocks = vview.dynamicBlocks.contentBlocks
        const hblocks = hview.dynamicBlocks.contentBlocks
        const hoffset = hview.offsetPx
        const voffset = vview.offsetPx

        const vhide = getBlockLabelKeysToHide(vblocks, viewHeight, voffset)
        const hhide = getBlockLabelKeysToHide(hblocks, viewWidth, hoffset)
        const by = pxWidthForBlocks(hblocks, vview.bpPerPx, hhide)
        const bx = pxWidthForBlocks(vblocks, hview.bpPerPx, vhide)

        return {
          borderX: Math.max(bx + padding, 50),
          borderY: Math.max(by + padding, 50),
        }
      },
      /**
       * #action
       */
      showAllRegions() {
        // First zoom to max to trigger border recalculation
        self.hview.zoomTo(self.hview.maxBpPerPx)
        self.vview.zoomTo(self.vview.maxBpPerPx)

        // Calculate what borders should be at this zoom level
        const { borderX, borderY } = this.calculateBorders()

        // Apply calculated borders
        self.setBorderX(borderX)
        self.setBorderY(borderY)

        // Now zoom again with updated borders/dimensions and center
        self.hview.zoomTo(self.hview.maxBpPerPx)
        self.vview.zoomTo(self.vview.maxBpPerPx)
        self.vview.center()
        self.hview.center()
      },
      /**
       * #action
       */
      initializeDisplayedRegions() {
        const { hview, vview, assemblyNames } = self
        if (hview.displayedRegions.length && vview.displayedRegions.length) {
          return
        }
        const { assemblyManager } = getSession(self)
        hview.setDisplayedRegions(
          assemblyManager.get(assemblyNames[0]!)?.regions || [],
        )
        vview.setDisplayedRegions(
          assemblyManager.get(assemblyNames[1]!)?.regions || [],
        )
        this.showAllRegions()
      },
      /**
       * #action
       * creates a linear synteny view from the clicked and dragged region
       */
      onDotplotView(mousedown: Coord, mouseup: Coord) {
        const result = this.getCoords(mousedown, mouseup)
        if (result) {
          const [x1, x2, y1, y2] = result
          const session = getSession(self)

          const d1 = Dotplot1DView.create({
            ...getSnapshot(self.hview),
            minimumBlockWidth: 0,
            interRegionPaddingWidth: 0,
          })
          const d2 = Dotplot1DView.create({
            ...getSnapshot(self.vview),
            minimumBlockWidth: 0,
            interRegionPaddingWidth: 0,
          })
          d1.setVolatileWidth(self.hview.width)
          d2.setVolatileWidth(self.vview.width)
          d1.moveTo(x1, x2)
          d2.moveTo(y2, y1)
          d1.zoomTo(d1.bpPerPx / (self.width / self.hview.width), 0)
          d2.zoomTo(d2.bpPerPx / (self.width / self.vview.width), 0)

          // add the specific evidence tracks to the LGVs in the split view
          // note: scales the bpPerPx by scaling proportional of the dotplot
          // width to the eventual lgv width
          const tracks = self.tracks
            .map(track =>
              track.configuration.displays.find(
                (display: { type: string }) =>
                  display.type === 'LinearSyntenyDisplay',
              ),
            )
            .filter(f => !!f)
            .map(displayConf => {
              const trackConf = getParent<AnyConfigurationModel>(displayConf, 2)
              return {
                type: trackConf.type,
                configuration: trackConf,
                displays: [
                  { type: displayConf.type, configuration: displayConf },
                ],
              }
            })

          const { id: _unused1, ...rest1 } = getSnapshot(d1)
          const { id: _unused2, ...rest2 } = getSnapshot(d2)
          const viewSnapshot = {
            type: 'LinearSyntenyView',
            views: [
              {
                type: 'LinearGenomeView',
                tracks: [],
                hideHeader: true,
                ...rest1,
              },
              {
                type: 'LinearGenomeView',
                tracks: [],
                hideHeader: true,
                ...rest2,
              },
            ],
            tracks,
          }

          session.addView('LinearSyntenyView', viewSnapshot)
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGDotplotView.tsx')
        const html = await renderToSvg(self as DotplotViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')
        saveAs(
          new Blob([html], { type: 'image/svg+xml' }),
          opts.filename || 'image.svg',
        )
      },
      // if any of our assemblies are temporary assemblies
      beforeDestroy() {
        const session = getSession(self)
        for (const name of self.assemblyNames) {
          session.removeTemporaryAssembly?.(name)
        }
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function dotplotInitAutorun() {
              const { init, volatileWidth } = self
              if (!volatileWidth || !init) {
                return
              }

              const session = getSession(self)

              // Set assembly names from init
              const assemblyNames = init.views.map(v => v.assembly)
              self.setAssemblyNames(assemblyNames[0]!, assemblyNames[1]!)

              // Show tracks
              if (init.tracks) {
                for (const trackId of init.tracks) {
                  try {
                    self.showTrack(trackId)
                  } catch (e) {
                    console.error(e)
                    session.notifyError(`${e}`, e)
                  }
                }
              }

              // Clear init state
              self.setInit(undefined)
            },
            { name: 'DotplotInit' },
          ),
        )
        addDisposer(
          self,
          autorun(
            function dotplotLocalStorageAutorun() {
              const s = (s: unknown) => JSON.stringify(s)
              const { showPanButtons, wheelMode, cursorMode } = self
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem(
                  'dotplot-showPanbuttons',
                  s(showPanButtons),
                )
                localStorage.setItem('dotplot-cursorMode', cursorMode)
                localStorage.setItem('dotplot-wheelMode', wheelMode)
              }
            },
            { name: 'DotplotLocalStorage' },
          ),
        )
        addDisposer(
          self,
          autorun(
            function dotplotRegionsAutorun() {
              // IMPORTANT: Must actually read assemblyNames array (via slice) to
              // force MobX to track it. Just referencing it without reading won't
              // make the autorun re-run when assembly names change. This ensures
              // the autorun fires when setAssemblyNames is called with different
              // assemblies, which is critical for re-initializing displayed regions
              void self.assemblyNames.slice()
              if (
                self.volatileWidth !== undefined &&
                self.assembliesInitialized
              ) {
                self.initializeDisplayedRegions()
              }
            },
            { delay: 1000, name: 'DotplotRegions' },
          ),
        )
        addDisposer(
          self,
          autorun(
            function dotplotBorderAutorun() {
              // make sure we have a width on the view before trying to load
              if (self.volatileWidth === undefined) {
                return
              }

              // Calculate and apply borders
              const { borderX, borderY } = self.calculateBorders()
              self.setBorderX(borderX)
              self.setBorderY(borderY)
            },
            { name: 'DotplotBorder' },
          ),
        )
      },
      /**
       * #action
       */
      squareView() {
        const { hview, vview } = self
        const avg = (hview.bpPerPx + vview.bpPerPx) / 2
        const hpx = hview.pxToBp(hview.width / 2)
        const vpx = vview.pxToBp(vview.width / 2)
        hview.setBpPerPx(avg)
        hview.centerAt(hpx.coord, hpx.refName, hpx.index)
        vview.setBpPerPx(avg)
        vview.centerAt(vpx.coord, vpx.refName, vpx.index)
      },
      /**
       * #action
       */
      squareViewProportional() {
        const { hview, vview } = self
        const ratio = hview.width / vview.width
        const avg = (hview.bpPerPx + vview.bpPerPx) / 2
        const hpx = hview.pxToBp(hview.width / 2)
        const vpx = vview.pxToBp(vview.width / 2)
        hview.setBpPerPx(avg / ratio)
        hview.centerAt(hpx.coord, hpx.refName, hpx.index)
        vview.setBpPerPx(avg)
        vview.centerAt(vpx.coord, vpx.refName, vpx.index)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menuItems() {
        const session = getSession(self)
        return [
          {
            label: 'Return to import form',
            icon: FolderOpenIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          {
            label: 'Export SVG',
            icon: PhotoCameraIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ExportSvgDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          ...(isSessionModelWithWidgets(session)
            ? [
                {
                  label: 'Open track selector',
                  onClick: self.activateTrackSelector,
                  icon: TrackSelectorIcon,
                },
              ]
            : []),
        ]
      },
      /**
       * #getter
       */
      get error(): unknown {
        return self.volatileError || self.assemblyErrors
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        height,
        borderSize,
        tickSize,
        vtextRotation,
        htextRotation,
        fontSize,
        trackSelectorType,
        drawCigar,
        assemblyNames,
        viewTrackConfigs,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(height !== defaultHeight ? { height } : {}),
        ...(borderSize !== defaultBorderSize ? { borderSize } : {}),
        ...(tickSize !== defaultTickSize ? { tickSize } : {}),
        ...(vtextRotation ? { vtextRotation } : {}),
        ...(htextRotation !== defaultHtextRotation ? { htextRotation } : {}),
        ...(fontSize !== defaultFontSize ? { fontSize } : {}),
        ...(trackSelectorType !== 'hierarchical' ? { trackSelectorType } : {}),
        ...(!drawCigar ? { drawCigar } : {}),
        ...(assemblyNames.length ? { assemblyNames } : {}),
        ...(viewTrackConfigs.length ? { viewTrackConfigs } : {}),
      } as typeof snap
    })
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>

export { Dotplot1DView, type Dotplot1DViewModel } from './1dview.ts'
