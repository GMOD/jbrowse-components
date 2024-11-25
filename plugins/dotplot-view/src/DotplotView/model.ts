import type React from 'react'
import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  getSession,
  isSessionModelWithWidgets,
  minmax,
  measureText,
  max,
  localStorageGetItem,
  getTickDisplayStr,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { saveAs } from 'file-saver'
import { autorun, transaction } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  getRoot,
  getSnapshot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

// locals
import { Dotplot1DView, DotplotHView, DotplotVView } from './1dview'
import { getBlockLabelKeysToHide, makeTicks } from './components/util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseTrackStateModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { Instance, SnapshotIn } from 'mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog'))
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
type Coord = [number, number]

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
        height: 600,
        /**
         * #property
         */
        borderSize: 20,
        /**
         * #property
         */
        tickSize: 5,
        /**
         * #property
         */
        vtextRotation: 0,
        /**
         * #property
         */
        htextRotation: -90,
        /**
         * #property
         */
        fontSize: 15,
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
        tracks: types.array(
          pm.pluggableMstType('track', 'stateModel') as BaseTrackStateModel,
        ),

        /**
         * #property
         * this represents tracks specific to this view specifically used
         * for read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track')),
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,
      volatileError: undefined as unknown,

      // these are 'personal preferences', stored in volatile and
      // loaded/written to localStorage
      cursorMode: localStorageGetItem('dotplot-cursorMode') || 'crosshair',
      showPanButtons: Boolean(
        JSON.parse(localStorageGetItem('dotplot-showPanbuttons') || 'true'),
      ),
      wheelMode: localStorageGetItem('dotplot-wheelMode') || 'zoom',
      borderX: 100,
      borderY: 100,
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
      get loading() {
        return self.assemblyNames.length > 0 && !this.initialized
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
        const schema = pm.pluggableConfigSchemaType('track')
        const conf = resolveIdentifier(schema, getRoot(self), trackId)
        const trackType = pm.getTrackType(conf.type)
        if (!trackType) {
          throw new Error(`unknown track type ${conf.type}`)
        }
        const viewType = pm.getViewType(self.type)!
        const displayConf = conf.displays.find((d: AnyConfigurationModel) =>
          viewType.displayTypes.find(type => type.name === d.type),
        )
        if (!displayConf) {
          throw new Error(
            `could not find a compatible display for view type ${self.type}`,
          )
        }
        const track = trackType.stateModel.create({
          ...initialSnapshot,
          type: conf.type,
          configuration: conf,
          displays: [{ type: displayConf.type, configuration: displayConf }],
        })
        self.tracks.push(track)
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        const schema = pm.pluggableConfigSchemaType('track')
        const conf = resolveIdentifier(schema, getRoot(self), trackId)
        const t = self.tracks.filter(t => t.configuration === conf)
        transaction(() => {
          t.forEach(t => self.tracks.remove(t))
        })
        return t.length
      },
      /**
       * #action
       */
      toggleTrack(trackId: string) {
        const hiddenCount = this.hideTrack(trackId)
        if (!hiddenCount) {
          this.showTrack(trackId)
          return true
        }
        return false
      },
      /**
       * #action
       */
      setAssemblyNames(target: string, query: string) {
        self.assemblyNames = cast([target, query])
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
       */
      showAllRegions() {
        self.hview.zoomTo(self.hview.maxBpPerPx)
        self.vview.zoomTo(self.vview.maxBpPerPx)
        self.vview.center()
        self.hview.center()
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
        const { renderToSvg } = await import('./svgcomponents/SVGDotplotView')
        const html = await renderToSvg(self as DotplotViewModel, opts)
        const blob = new Blob([html], { type: 'image/svg+xml' })
        saveAs(blob, opts.filename || 'image.svg')
      },
      // if any of our assemblies are temporary assemblies
      beforeDestroy() {
        const session = getSession(self)
        for (const name in self.assemblyNames) {
          session.removeTemporaryAssembly?.(name)
        }
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const s = (s: unknown) => JSON.stringify(s)
            const { showPanButtons, wheelMode, cursorMode } = self
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('dotplot-showPanbuttons', s(showPanButtons))
              localStorage.setItem('dotplot-cursorMode', cursorMode)
              localStorage.setItem('dotplot-wheelMode', wheelMode)
            }
          }),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const session = getSession(self)

              // don't operate if width not set yet
              if (
                self.volatileWidth === undefined ||
                !self.assembliesInitialized
              ) {
                return
              }

              // also don't operate if displayedRegions already set, this is a
              // helper autorun to load regions from assembly
              if (
                self.hview.displayedRegions.length > 0 &&
                self.vview.displayedRegions.length > 0
              ) {
                return
              }

              const views = [self.hview, self.vview]
              transaction(() => {
                self.assemblyNames.forEach((name, index) => {
                  const assembly = session.assemblyManager.get(name)
                  const view = views[index]!
                  view.setDisplayedRegions(assembly?.regions || [])
                })
                self.showAllRegions()
              })
            },
            { delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(function borderSetter() {
            // make sure we have a width on the view before trying to load
            if (self.volatileWidth === undefined) {
              return
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

            // these are set via autorun to avoid dependency cycle
            self.setBorderY(Math.max(by + padding, 50))
            self.setBorderX(Math.max(bx + padding, 50))
          }),
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
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                { model: self, handleClose },
              ])
            },
            icon: FolderOpenIcon,
          },
          {
            label: 'Square view - same bp per pixel',
            onClick: () => {
              self.squareView()
            },
          },
          {
            label: 'Rectangular view - same total bp',
            onClick: () => {
              self.squareView()
            },
          },
          {
            label: 'Show all regions',
            onClick: () => {
              self.showAllRegions()
            },
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
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>

export { type Dotplot1DViewModel, Dotplot1DView } from './1dview'
