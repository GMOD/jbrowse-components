import type React from 'react'
import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { GpuLifecycleMixin } from '@jbrowse/core/gpu/GpuLifecycleMixin'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  getSession,
  isSessionModelWithWidgets,
  localStorageGetItem,
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
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { autorun, observable, when } from 'mobx'

import { Dotplot1DView, DotplotHView, DotplotVView } from './1dview.ts'
import {
  getBlockLabelKeysToHide,
  makeTicks,
  pxWidthForBlocks,
} from './components/util.ts'

import type { AxisBundle } from './components/util.ts'
import type { DotplotViewInit, ImportFormSyntenyTrack } from './types.ts'
import type {
  DotplotBackend,
  DotplotGeometryData,
} from '../DotplotDisplay/dotplotBackendTypes.ts'
import type { DotplotDisplayModel } from '../DotplotDisplay/stateModelFactory.tsx'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
type Coord = [number, number]

const LS_CURSOR_MODE = 'dotplot-cursorMode'

// Hide axis tick labels when more than this many blocks are visible — the
// labels would overlap at high chromosome counts.
const MAX_TICK_BLOCKS = 5

// defaults for postProcessSnapshot filtering
const defaultHeight = 600
const defaultBorderSize = 20
const defaultTickSize = 5
const defaultHtextRotation = -90
const defaultFontSize = 15
const defaultLineWidth = 2.5

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  themeName?: string
}

/**
 * #stateModel DotplotView
 * #category view
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
export default function stateModelFactory(pm: PluginManager) {
  return (
    types
      .compose(
        'DotplotView',
        BaseViewModel,
        GpuLifecycleMixin(),
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
           * Level-of-detail tier override for PIF adapters. 'auto' uses the
           * adapter's bpPerPx threshold; 'fine'/'coarse' force a tier. Stored
           * view-level so all displays render at the same tier and the menu
           * doesn't need to fan out per display.
           */
          lodMode: types.optional(
            types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
            'auto',
          ),
          /**
           * #property
           * When true, hview and vview are kept at the same bpPerPx so the
           * dotplot stays square. Wheel zoom already preserves the ratio;
           * box-zoom and other independent ops trigger an autorun resync.
           */
          lockAspectRatio: false,
          /**
           * #property
           * Screen-space line width (CSS pixels) applied to every dotplot
           * display in this view. View-level because the GPU pass renders all
           * displays with one uniform.
           */
          lineWidth: types.optional(types.number, defaultLineWidth),
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

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        volatileError: undefined as unknown,

        /**
         * #volatile
         * these are 'personal preferences', stored in volatile and
         * loaded/written to localStorage
         */
        cursorMode: localStorageGetItem(LS_CURSOR_MODE) || 'crosshair',
        /**
         * #volatile
         */
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
        /**
         * #volatile
         * True while the init autorun is waiting for the first dotplot RPC
         * so it can run the DiagonalizeDotplot pass. Used to gate showLoading
         * on so the user sees a spinner with "Reordering chromosomes…"
         * instead of an undiagonalized plot that immediately re-paints.
         */
        awaitingAutoDiagonalize: false,
      }))
      .actions(self => ({
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
            .map(name => assemblyManager.get(name)?.error)
            .filter(e => !!e)
            .join(', ')
        },
        /**
         * #getter
         */
        get assembliesInitialized() {
          const { assemblyManager } = getSession(self)
          return self.assemblyNames.every(
            name => assemblyManager.get(name)?.initialized,
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
          return dynamicBlocks.contentBlocks.length > MAX_TICK_BLOCKS
            ? []
            : makeTicks(staticBlocks.contentBlocks, bpPerPx)
        },
        /**
         * #getter
         */
        get vticks() {
          const { vview } = self
          const { dynamicBlocks, staticBlocks, bpPerPx } = vview
          return dynamicBlocks.contentBlocks.length > MAX_TICK_BLOCKS
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
            self.awaitingAutoDiagonalize ||
            (this.hasSomethingToShow &&
              !this.initialized &&
              !self.volatileError &&
              !self.assemblyErrors)
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
          if (self.awaitingAutoDiagonalize) {
            return 'Reordering chromosomes…'
          }
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

        /**
         * #getter
         * DotplotDisplays under each track, indexed to match `tracks`.
         */
        get dotplotDisplays() {
          return self.tracks.map(t => t.displays[0] as DotplotDisplayModel)
        },
        /**
         * #getter
         * True if any track has an adapter that declares the 'lod'
         * capability. Used to gate the LOD menu — only PIF supports it.
         */
        get hasLodCapableAdapter() {
          return self.tracks.some(t =>
            t.adapterType.adapterCapabilities.includes('lod'),
          )
        },
        /**
         * #getter
         * Per-display GPU geometry keyed by track index. The upload autorun
         * diffs this map: new entries upload, vanished entries evict.
         */
        get geometryByTrackIndex() {
          const m = new Map<number, DotplotGeometryData>()
          const displays = this.dotplotDisplays
          for (let idx = 0, l = displays.length; idx < l; idx++) {
            const g = displays[idx]!.geometry
            if (g) {
              m.set(idx, g)
            }
          }
          return m
        },
        /**
         * #getter
         * Aggregated per-frame render state. Built by walking each
         * display that has uploaded geometry; returns undefined when none
         * do, which gates the render pass.
         */
        get dotplotRenderState() {
          if (!this.initialized) {
            return undefined
          }
          const displayKeys = [...this.geometryByTrackIndex.keys()]
          if (displayKeys.length === 0) {
            return undefined
          }
          const { hview, vview } = self
          return {
            viewBpH: hview.offsetPx * hview.bpPerPx,
            viewBpV: vview.offsetPx * vview.bpPerPx,
            bpPerPxHInv: 1 / hview.bpPerPx,
            bpPerPxVInv: 1 / vview.bpPerPx,
            lineWidth: self.lineWidth,
            displayKeys,
          }
        },
      }))
      // One canvas on the view, shared by all displays. The view aggregates
      // per-display geometry from `geometryByTrackIndex` and runs both upload
      // and render against the shared backend.
      .actions(self => ({
        startBackend(backend: DotplotBackend) {
          // Previously-uploaded keys, so we can fire deleteGeometry for
          // entries that disappear between autorun ticks.
          const lastKeys = new Set<number>()
          self.attachBackend<DotplotBackend>(backend, {
            upload: b => {
              const currentKeys = new Set<number>()
              for (const [key, data] of self.geometryByTrackIndex) {
                b.uploadGeometry(key, data)
                currentKeys.add(key)
              }
              for (const key of lastKeys) {
                if (!currentKeys.has(key)) {
                  b.deleteGeometry(key)
                }
              }
              lastKeys.clear()
              for (const key of currentKeys) {
                lastKeys.add(key)
              }
            },
            render: b => {
              const state = self.dotplotRenderState
              if (!state) {
                return false
              }
              b.resize(self.viewWidth, self.viewHeight)
              b.render(state)
              return true
            },
          })
        },
      }))
      .actions(self => ({
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
         */
        setLodMode(value: 'auto' | 'fine' | 'coarse') {
          self.lodMode = value
        },
        /**
         * #action
         */
        setLockAspectRatio(flag: boolean) {
          self.lockAspectRatio = flag
        },
        /**
         * #action
         * Equalize hview/vview bpPerPx without recentering. Used by the
         * aspect-lock autorun to absorb divergence from box-zoom and similar
         * operations while preserving the user's current pan position.
         */
        syncBpPerPx() {
          const { hview, vview } = self
          if (hview.bpPerPx === vview.bpPerPx) {
            return
          }
          const avg = (hview.bpPerPx + vview.bpPerPx) / 2
          hview.setBpPerPx(avg)
          vview.setBpPerPx(avg)
        },
        /**
         * #action
         */
        setLineWidth(value: number) {
          self.lineWidth = value
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
        setAwaitingAutoDiagonalize(arg: boolean) {
          self.awaitingAutoDiagonalize = arg
        },

        /**
         * #action
         */
        zoomOut() {
          for (const v of self.views) {
            v.zoomOut()
            if (v.bpPerPx >= v.maxBpPerPx * 0.99) {
              v.center()
            }
          }
        },
        /**
         * #action
         */
        zoomIn() {
          for (const v of self.views) {
            v.zoomIn()
          }
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
          throw new Error(
            `invalid track selector type ${self.trackSelectorType}`,
          )
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
          const hAxis: AxisBundle = {
            blocks: hview.dynamicBlocks.contentBlocks,
            bpPerPx: hview.bpPerPx,
            hide: getBlockLabelKeysToHide(
              hview.dynamicBlocks.contentBlocks,
              viewWidth,
              hview.offsetPx,
            ),
          }
          const vAxis: AxisBundle = {
            blocks: vview.dynamicBlocks.contentBlocks,
            bpPerPx: vview.bpPerPx,
            hide: getBlockLabelKeysToHide(
              vview.dynamicBlocks.contentBlocks,
              viewHeight,
              vview.offsetPx,
            ),
          }

          return {
            borderX: Math.max(pxWidthForBlocks(vAxis) + padding, 50),
            borderY: Math.max(pxWidthForBlocks(hAxis) + padding, 50),
          }
        },
        /**
         * #action
         */
        showAllRegions() {
          const { hview, vview } = self
          // When locked, use the larger maxBpPerPx so both assemblies fit.
          // Re-evaluated on each call because maxBpPerPx depends on viewWidth
          // which changes after setBorderX/Y below.
          const getMax = (v: typeof hview) =>
            self.lockAspectRatio
              ? Math.max(hview.maxBpPerPx, vview.maxBpPerPx)
              : v.maxBpPerPx

          // First pass: zoom so calculateBorders sees the right bpPerPx
          hview.zoomTo(getMax(hview))
          vview.zoomTo(getMax(vview))
          const { borderX, borderY } = this.calculateBorders()
          self.setBorderX(borderX)
          self.setBorderY(borderY)
          // Second pass: re-zoom with updated dimensions, then center
          hview.zoomTo(getMax(hview))
          vview.zoomTo(getMax(vview))
          vview.center()
          hview.center()
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
            assemblyManager.get(assemblyNames[0]!)?.regions ?? [],
          )
          vview.setDisplayedRegions(
            assemblyManager.get(assemblyNames[1]!)?.regions ?? [],
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
            })
            const d2 = Dotplot1DView.create({
              ...getSnapshot(self.vview),
              minimumBlockWidth: 0,
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
                const trackConf = getParent<AnyConfigurationModel>(
                  displayConf,
                  2,
                )
                return {
                  type: trackConf.type,
                  configuration: trackConf.trackId,
                  displays: [
                    {
                      type: displayConf.type,
                      configuration: displayConf.displayId,
                    },
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
          const { saveSvgAsImage } = await import('@jbrowse/core/util')
          await saveSvgAsImage(html, opts)
        },
        // if any of our assemblies are temporary assemblies
        beforeDestroy() {
          const session = getSession(self)
          for (const name of self.assemblyNames) {
            session.removeTemporaryAssembly?.(name)
          }
        },
        afterAttach() {
          let initRunning = false
          addDisposer(
            self,
            autorun(
              async function dotplotInitAutorun() {
                const { init, volatileWidth } = self
                if (!volatileWidth || !init || initRunning) {
                  return
                }
                initRunning = true

                const session = getSession(self)

                try {
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

                  // colorBy and minAlignmentLength live on each display, not
                  // the view — apply to every display the showTrack calls just
                  // created. Untyped because tracks/displays are pluggable.
                  if (
                    init.colorBy !== undefined ||
                    init.minAlignmentLength !== undefined
                  ) {
                    for (const track of self.tracks) {
                      for (const display of track.displays) {
                        const d = display as {
                          setColorBy?: (v: string) => void
                          setMinAlignmentLength?: (v: number) => void
                        }
                        if (init.colorBy && d.setColorBy) {
                          d.setColorBy(init.colorBy)
                        }
                        if (
                          init.minAlignmentLength !== undefined &&
                          d.setMinAlignmentLength
                        ) {
                          d.setMinAlignmentLength(init.minAlignmentLength)
                        }
                      }
                    }
                  }

                  if (init.autoDiagonalize) {
                    // Wait for the first DotplotDisplay RPC to populate rpcData
                    // so we have a meaningful diagonalize result, then call
                    // the RPC. Race with a 30s ceiling so a stuck display
                    // can't deadlock startup. The awaitingAutoDiagonalize
                    // flag flips showLoading on for the duration so the user
                    // sees a "Reordering chromosomes…" spinner instead of an
                    // undiagonalized plot that immediately re-paints.
                    self.setAwaitingAutoDiagonalize(true)
                    try {
                      const { runDotplotDiagonalize, dotplotDisplaysReady } =
                        await import('./util/runDotplotDiagonalize.ts')
                      const view = self as DotplotViewModel
                      await Promise.race([
                        when(() => dotplotDisplaysReady(view)),
                        new Promise(resolve => {
                          setTimeout(resolve, 30_000)
                        }),
                      ])
                      if (dotplotDisplaysReady(view) && isAlive(self)) {
                        await runDotplotDiagonalize(view)
                      }
                    } catch (e) {
                      console.error(e)
                    } finally {
                      if (isAlive(self)) {
                        self.setAwaitingAutoDiagonalize(false)
                      }
                    }
                  }

                  // Clear init state
                  if (isAlive(self)) {
                    self.setInit(undefined)
                  }
                } finally {
                  initRunning = false
                }
              },
              { name: 'DotplotInit' },
            ),
          )
          addDisposer(
            self,
            autorun(
              function dotplotLocalStorageAutorun() {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(LS_CURSOR_MODE, self.cursorMode)
                }
              },
              { name: 'DotplotLocalStorage' },
            ),
          )
          addDisposer(
            self,
            autorun(
              function dotplotRegionsAutorun() {
                // assemblyNames.length > 0 both tracks the array (so MobX
                // re-runs when names change) and guards against vacuous truth
                // from every() on an empty array after clearView().
                if (
                  self.volatileWidth !== undefined &&
                  self.assemblyNames.length > 0 &&
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
              function dotplotAspectLockAutorun() {
                if (self.lockAspectRatio) {
                  self.syncBpPerPx()
                }
              },
              { name: 'DotplotAspectLock' },
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
        applySquare(ratio: number) {
          const { hview, vview } = self
          const avg = (hview.bpPerPx + vview.bpPerPx) / 2
          const hpx = hview.pxToBp(hview.width / 2)
          const vpx = vview.pxToBp(vview.width / 2)
          hview.setBpPerPx(avg / ratio)
          hview.centerAt(hpx.coord, hpx.refName, hpx.index)
          vview.setBpPerPx(avg)
          vview.centerAt(vpx.coord, vpx.refName, vpx.index)
        },
        /**
         * #action
         */
        squareView() {
          this.applySquare(1)
        },
        /**
         * #action
         */
        squareViewProportional() {
          this.applySquare(self.hview.width / self.vview.width)
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
            ...(self.hasLodCapableAdapter
              ? [
                  {
                    label: 'Level of detail',
                    subMenu: (
                      [
                        {
                          label: 'Auto',
                          value: 'auto',
                          helpText:
                            'Switch between fine and coarse automatically based on zoom level.',
                        },
                        {
                          label: 'Fine',
                          value: 'fine',
                          helpText:
                            'Always fetch per-row CIGAR detail. Slower at low zoom.',
                        },
                        {
                          label: 'Coarse',
                          value: 'coarse',
                          helpText:
                            'Skip CIGAR detail. Fastest, but no indel/mismatch colors.',
                        },
                      ] as const
                    ).map(({ label, value, helpText }) => ({
                      helpText,
                      label,
                      type: 'radio' as const,
                      checked: self.lodMode === value,
                      onClick: () => {
                        self.setLodMode(value)
                      },
                    })),
                  },
                ]
              : []),
            ...(isSessionModelWithWidgets(session)
              ? [
                  {
                    label: 'Open track selector',
                    onClick: () => {
                      self.activateTrackSelector()
                    },
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
          return self.volatileError ?? self.assemblyErrors
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
          lodMode,
          lockAspectRatio,
          lineWidth,
          assemblyNames,
          viewTrackConfigs,
          ...rest
        } = snap
        return {
          ...rest,
          ...(height !== defaultHeight ? { height } : {}),
          ...(borderSize !== defaultBorderSize ? { borderSize } : {}),
          ...(tickSize !== defaultTickSize ? { tickSize } : {}),
          ...(vtextRotation ? { vtextRotation } : {}),
          ...(htextRotation !== defaultHtextRotation ? { htextRotation } : {}),
          ...(fontSize !== defaultFontSize ? { fontSize } : {}),
          ...(trackSelectorType !== 'hierarchical'
            ? { trackSelectorType }
            : {}),
          ...(!drawCigar ? { drawCigar } : {}),
          ...(lodMode !== 'auto' ? { lodMode } : {}),
          ...(lockAspectRatio ? { lockAspectRatio } : {}),
          ...(lineWidth !== defaultLineWidth ? { lineWidth } : {}),
          ...(assemblyNames.length ? { assemblyNames } : {}),
          ...(viewTrackConfigs.length ? { viewTrackConfigs } : {}),
        } as typeof snap
      })
  )
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>

export { Dotplot1DView, type Dotplot1DViewModel } from './1dview.ts'
