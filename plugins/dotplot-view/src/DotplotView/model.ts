import { lazy } from 'react'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import HighlightsMixin from '@jbrowse/core/pluggableElementTypes/models/HighlightsMixin'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getSession,
  isSessionModelWithWidgets,
  localStorageGetItem,
  minmax,
} from '@jbrowse/core/util'
import { getLayoutHighlightCoords } from '@jbrowse/core/util/Base1DUtils'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { cast, getParent, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { createKeyedUploadSync } from '@jbrowse/render-core/keyedUploadSync'
import {
  DiagonalizeProgressMixin,
  TrackColorsMixin,
  displaysSettled,
  lodMenuItems,
  regionSignature,
  trackHasLodTiers,
} from '@jbrowse/synteny-core'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { observable } from 'mobx'

import { Dotplot1DView, DotplotHView, DotplotVView } from './1dview.ts'
import { doAfterAttach } from './afterAttach.ts'
import {
  axisBorderPx,
  computeTickPositions,
  getBlockLabelKeysToHide,
  makeTicks,
} from './components/util.ts'
import { DRAG_THRESHOLD_PX, LS_CURSOR_MODE } from './types.ts'

import type {
  DotplotGeometryData,
  DotplotRenderingBackend,
} from '../DotplotDisplay/dotplotRenderingBackendTypes.ts'
import type { DotplotDisplayModel } from '../DotplotDisplay/stateModelFactory.tsx'
import type { Dotplot1DViewModel } from './1dview.ts'
import type { Coord, DotplotViewInit, ImportFormSyntenyTrack } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { LodMode } from '@jbrowse/synteny-core'
import type { ComponentType, ReactNode } from 'react'
import type React from 'react'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
type CursorMode = 'crosshair' | 'move'

// Drop an axis' ticks entirely — lines as well as labels — once more than this
// many blocks are visible. The reason is the labels, which overlap illegibly at
// high chromosome counts; the tick lines go with them only because they share
// this one list. Whether the lines should survive on their own (without them the
// region-boundary grid is the only structure a whole-genome plot has left) is an
// open UX question, not a settled decision — note that block *labels* get a real
// greedy overlap-hider for the same problem, `getBlockLabelKeysToHide`.
const MAX_TICK_BLOCKS = 5

function axisTicks(view: Dotplot1DViewModel) {
  const { dynamicBlocks, staticBlocks, bpPerPx } = view
  return dynamicBlocks.contentBlocks.length > MAX_TICK_BLOCKS
    ? []
    : makeTicks(staticBlocks.contentBlocks, bpPerPx)
}

// Resolve a region's refName to the assembly's canonical name, falling back to
// the raw name when the assembly isn't loaded or has no alias for it. Takes a
// plain node (not DotplotViewModel) to avoid a self-referential type cycle when
// called from the model's own views.
function canonicalRegion(
  node: IAnyStateTreeNode,
  region: {
    assemblyName?: string
    refName: string
    start: number
    end: number
  },
) {
  const { assemblyManager } = getSession(node)
  const asm = region.assemblyName
    ? assemblyManager.get(region.assemblyName)
    : undefined
  const refName = asm?.getCanonicalRefName(region.refName) ?? region.refName
  return { ...region, refName }
}

// Collapse an axis' drag span into a single highlight region. A drag can start
// or end past a region's edge, or run into the next region entirely, so both
// ends are clamped into the region the drag started in rather than producing a
// band that spans refNames.
//
// minmax, not "a then b": on a reversed displayed region (auto-diagonalize flips
// query regions, so the vertical axis routinely has them) bp decreases with
// screen position, and taking the ends in drag order emitted start > end. The
// bands still drew — getLayoutHighlightCoords is order-agnostic — but the
// backwards region is what gets persisted to the session and read back by
// everything downstream of it.
function dragToHighlight(a: PxToBpResult, b: PxToBpResult): HighlightType {
  const [start, end] = minmax(
    clamp(a.coord0, a.start, a.end),
    a.refName === b.refName ? clamp(b.coord0, a.start, a.end) : a.end,
  )
  return {
    assemblyName: a.assemblyName,
    refName: a.refName,
    start,
    end,
  }
}

// stripDefault baselines: a snapshot omits these unless the user changed them
// (exported so a launcher building a DotplotView snapshot can size its initial
// bpPerPx against the height the view will actually come up at)
export const defaultHeight = 600
const defaultLineWidth = 2.5

// Floor for the resize handle. Below this the axis borders (which floor at
// MIN_BORDER=50 each) would eat the whole box and viewWidth/viewHeight would go
// negative, feeding negative canvas dimensions and an inverted maxBpPerPx.
const minHeight = 120

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: React.FC<{ children: React.ReactNode }>
  themeName?: string
  fontFamily?: string
}

/**
 * #stateModel DotplotView
 * #category view
 *
 * #example
 * Hand-authored under `defaultSession.views`. `init.views` lists the two
 * assemblies on the axes and `tracks` the synteny track(s) to plot
 * (self-vs-self is allowed):
 * ```js
 * {
 *   type: 'DotplotView',
 *   init: {
 *     views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
 *     tracks: ['hg38_vs_mm10.paf'],
 *     colorBy: 'query',
 *   },
 * }
 * ```
 * Other `init` fields: `autoDiagonalize`, `minAlignmentLength`, and a per-axis
 * `loc` on each `views` entry — see the `init` property below.
 */
export default function stateModelFactory(pm: PluginManager) {
  return (
    types
      .compose(
        'DotplotView',
        BaseViewModel,
        RenderLifecycleMixin(),
        HighlightsMixin(),
        DiagonalizeProgressMixin(),
        TrackColorsMixin(),
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
          height: types.stripDefault(types.number, defaultHeight),
          /**
           * #property
           * vestigial: the hierarchical selector is the only one that exists, so
           * this value is ignored. Retained because saved sessions and configs
           * persist it.
           */
          trackSelectorType: types.stripDefault(types.string, 'hierarchical'),
          /**
           * #property
           */
          assemblyNames: types.stripDefault(types.array(types.string), []),
          /**
           * #property
           */
          drawCigar: types.stripDefault(types.boolean, true),
          /**
           * #property
           * Level-of-detail tier override for PIF adapters. 'auto' uses the
           * adapter's bpPerPx threshold; 'fine'/'coarse' force a tier. Stored
           * view-level so all displays render at the same tier and the menu
           * doesn't need to fan out per display.
           */
          lodMode: types.stripDefault(
            types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
            'auto',
          ),
          /**
           * #property
           * When true, hview and vview are kept at the same bpPerPx so the
           * dotplot stays square. Wheel zoom already preserves the ratio;
           * box-zoom and other independent ops trigger an autorun resync.
           */
          lockAspectRatio: types.stripDefault(types.boolean, false),
          /**
           * #property
           * Screen-space line width (CSS pixels) applied to every dotplot
           * display in this view. View-level because the GPU pass renders all
           * displays with one uniform.
           */
          lineWidth: types.stripDefault(types.number, defaultLineWidth),
          /**
           * #property
           * Plot-wide alpha applied to every point. View-level for the same
           * reason lineWidth is: the only control is view-level, so storing it
           * per display meant a track shown after the slider moved rendered at
           * the default while the slider said otherwise.
           */
          alpha: types.stripDefault(types.number, 1),
          /**
           * #property
           * Hide alignments shorter than this many bp. Enforced per feature in
           * buildLineSegments. Cuts whole-genome hairball noise. View-level, see
           * alpha.
           */
          minAlignmentLength: types.stripDefault(types.number, 0),
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
          viewTrackConfigs: types.stripDefault(
            types.array(pm.pluggableConfigSchemaType('track')),
            [],
          ),
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
        cursorMode:
          localStorageGetItem(LS_CURSOR_MODE) === 'move' ? 'move' : 'crosshair',
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
        /**
         * #getter
         * Left margin: fits the vertical (vview) axis labels. Derived purely
         * from that axis's regions + zoom — never from viewWidth — so it can't
         * feed back through viewWidth = width - borderX into a render loop.
         */
        get borderX() {
          return axisBorderPx(self.vview.displayedRegions, self.vview.bpPerPx)
        },
        /**
         * #getter
         * Bottom margin: fits the horizontal (hview) axis labels. See borderX.
         */
        get borderY() {
          return axisBorderPx(self.hview.displayedRegions, self.hview.bpPerPx)
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
          return axisTicks(self.hview)
        },
        /**
         * #getter
         */
        get vticks() {
          return axisTicks(self.vview)
        },
        /**
         * #getter
         */
        get hTickPositions() {
          return computeTickPositions(self.hview, this.hticks)
        },
        /**
         * #getter
         */
        get vTickPositions() {
          return computeTickPositions(self.vview, this.vticks)
        },
        /**
         * #getter
         */
        get hasSomethingToShow() {
          return self.assemblyNames.length > 0 || !!self.init
        },
        /**
         * #getter
         * An `init` blob that has not been applied yet — `installInitAutorun`
         * clears it as the last thing an apply pass does. The plot is
         * assembling itself: the axes can already exist, and be initialized,
         * while the tracks or the region restriction are still to come, which
         * is why the `settled` gate reads this.
         */
        get initPending() {
          return !!self.init
        },
        /**
         * #getter
         * Whether to show the import form
         */
        get showImportForm() {
          return (
            !this.hasSomethingToShow ||
            !!(self.volatileError ?? self.assemblyErrors)
          )
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
         * Label for the generic loading spinner. The auto-diagonalize wait is a
         * separate render branch (DiagonalizeLoadingScreen), so this only covers
         * the plain "view not ready" case.
         */
        get loadingMessage() {
          return this.showLoading ? 'Loading' : undefined
        },
        /**
         * #getter
         * Plot area width. Floored at 0: the axis borders have their own
         * MIN_BORDER floor, so a container narrower than that would otherwise
         * yield a negative canvas dimension and a negative maxBpPerPx.
         */
        get viewWidth() {
          return Math.max(self.width - self.borderX, 0)
        },
        /**
         * #getter
         * Plot area height. Floored at 0, see viewWidth.
         */
        get viewHeight() {
          return Math.max(self.height - self.borderY, 0)
        },
        // Block-label keys whose tick labels would overlap and are hidden.
        // Cached as a view so the horizontal and vertical axis components share
        // one computation per axis instead of recomputing it independently.
        get hblockLabelKeysToHide() {
          return getBlockLabelKeysToHide(
            self.hview.dynamicBlocks.contentBlocks,
            this.viewWidth,
            self.hview.offsetPx,
          )
        },
        get vblockLabelKeysToHide() {
          return getBlockLabelKeysToHide(
            self.vview.dynamicBlocks.contentBlocks,
            this.viewHeight,
            self.vview.offsetPx,
          )
        },
        /**
         * #getter
         * The h ticks that land on the drawn axis. `hTickPositions` comes from
         * staticBlocks, which extend a screen past the viewport in both
         * directions; clipping here rather than per element in the axis
         * component keeps the SVG export from carrying a group per invisible
         * tick, and is cached for the same reason hblockLabelKeysToHide is.
         */
        get visibleHTickPositions() {
          return this.hTickPositions.filter(
            t => t.alongPx > 0 && t.alongPx < this.viewWidth,
          )
        },
        /**
         * #getter
         * The v ticks that land on the drawn axis. See visibleHTickPositions.
         */
        get visibleVTickPositions() {
          return this.vTickPositions.filter(
            t => t.alongPx > 0 && t.alongPx < this.viewHeight,
          )
        },
        /**
         * #getter
         * Both axes have a region on screen, so the plot has a grid to draw and
         * a first block to anchor its backdrop rect on. The grid reads the two
         * block lists' heads, which only this makes safe.
         */
        get hasVisibleRegions() {
          return (
            self.hview.dynamicBlocks.contentBlocks.length > 0 &&
            self.vview.dynamicBlocks.contentBlocks.length > 0
          )
        },
        /**
         * #getter
         */
        get views() {
          return [self.hview, self.vview]
        },
        /**
         * #getter
         * Signature of the horizontal axis' displayed-region order and
         * orientation, which a diagonalize reorder/flip changes and a zoom or
         * pan does not. Computed here, once for the view, because every
         * display's `currentFetchKey` needs it alongside the zoom: derived
         * inside that key it was rebuilt — a template literal per displayed
         * region, so thousands on a fragmented assembly — per display on every
         * wheel step. As its own primitive-valued computed it notifies only when
         * the regions really change.
         */
        get hRegionSignature() {
          return regionSignature(self.hview.displayedRegions)
        },
        /**
         * #getter
         * The vertical axis' displayed-region signature. See hRegionSignature.
         */
        get vRegionSignature() {
          return regionSignature(self.vview.displayedRegions)
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
         * Every failed track's error, combined into the one value the plot has
         * room to report — resolved here rather than per display because they
         * all paint the same plot rect. SVG export draws one banner from it; a
         * box per errored display buried its siblings' dots.
         */
        get displayError() {
          const errors = this.dotplotDisplays
            .map(d => d.error)
            .filter(e => e != null)
          return errors.length > 0 ? errors.join('\n') : undefined
        },
        /**
         * #method
         * Every track that can take a palette slot, in paint order, paired with
         * whatever color the user pinned on it.
         */
        colorableTrackConfigs() {
          return self.tracks.map(t => {
            const { trackId, name } = t.configuration
            return { trackId, name }
          })
        },
        /**
         * #getter
         * Canvas has painted and no display is still fetching, so what's on
         * screen is the final settled content. Drives the
         * `dotplot_webgl_canvas_done` test-id that screenshot capture and the
         * browser-test suites wait on — so it must mean "done", not just
         * "first paint".
         */
        get settled() {
          return (
            self.canvasDrawn &&
            // the canvas paints from the moment the axes exist, but `init` adds
            // the tracks and restricts the regions after that — and with no
            // display yet there is nothing to report the plot unsettled
            !this.initPending &&
            // a requested reorder that hasn't succeeded means what's on screen
            // is the pre-reorder plot, not the answer
            !self.pendingAutoDiagonalize &&
            displaysSettled(this.dotplotDisplays)
          )
        },
        /**
         * #getter
         * True if any track has an adapter with tiered storage. Used to gate the
         * LOD menu — only the indexed PIF adapters have tiers.
         */
        get hasLodCapableAdapter() {
          return self.tracks.some(trackHasLodTiers)
        },
        /**
         * #getter
         * Per-display GPU geometry keyed by `displayKey`. The upload autorun
         * diffs this map: new entries upload, vanished entries evict. Drawn in
         * insertion order, so tracks paint bottom-of-the-list last.
         */
        get geometryByDisplayKey() {
          const m = new Map<number, DotplotGeometryData>()
          for (const display of this.dotplotDisplays) {
            const g = display.geometry
            if (g) {
              m.set(display.displayKey, g)
            }
          }
          return m
        },
        /**
         * #getter
         * Aggregated per-frame render state — a resolved value, never
         * undefined; "the view isn't measured yet" is the `canRender`
         * precondition below.
         *
         * An empty `displayKeys` is a real frame, not a skip: both backends
         * clear before drawing, so painting zero displays is what wipes the
         * plot when the last track is hidden. Gating the render pass on it left
         * the departed track's pixels on the canvas (its buffer was deleted,
         * but nothing repainted).
         */
        get dotplotRenderState() {
          const displayKeys = [...this.geometryByDisplayKey.keys()]
          const { hview, vview } = self
          return {
            viewBpH: hview.offsetPx * hview.bpPerPx,
            viewBpV: vview.offsetPx * vview.bpPerPx,
            bpPerPxHInv: 1 / hview.bpPerPx,
            bpPerPxVInv: 1 / vview.bpPerPx,
            lineWidth: self.lineWidth,
            alpha: self.alpha,
            displayKeys,
          }
        },
        /**
         * #method
         * Both corners of a drag rect, in bp on each axis. The vertical axis
         * lays out bottom-up, so its pixels are flipped through viewHeight
         * first. Undefined for a drag too small to be a selection — the same
         * threshold the interaction hook uses to tell a drag from a click.
         */
        getCoords(mousedown: Coord, mouseup: Coord) {
          const [xmin, xmax] = minmax(mouseup[0], mousedown[0])
          const [ymin, ymax] = minmax(mouseup[1], mousedown[1])
          return xmax - xmin > DRAG_THRESHOLD_PX &&
            ymax - ymin > DRAG_THRESHOLD_PX
            ? {
                x1: self.hview.pxToBp(xmin),
                x2: self.hview.pxToBp(xmax),
                y1: self.vview.pxToBp(this.viewHeight - ymin),
                y2: self.vview.pxToBp(this.viewHeight - ymax),
              }
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Render-lifecycle precondition (overrides `RenderLifecycleMixin`'s
         * default-true hook): before the axes have regions and a measured
         * width there is nothing to paint against. Gating the autorun pair
         * here is what lets `dotplotRenderState` stay a resolved getter.
         */
        get canRender() {
          return self.initialized
        },
      }))
      // One canvas on the view, shared by all displays. The view aggregates
      // per-display geometry from `geometryByDisplayKey` and runs both upload
      // and render against the shared backend.
      .actions(self => ({
        startRenderingBackend(backend: DotplotRenderingBackend) {
          // One display committing new geometry re-fires the shared upload
          // autorun for every track on the canvas, so diff by reference: only
          // the track that actually changed re-uploads, and a departed track's
          // buffer is deleted individually (an active-set prune would wipe the
          // siblings).
          const syncUpload = createKeyedUploadSync<
            DotplotGeometryData,
            DotplotRenderingBackend
          >()
          self.attachRenderingBackend<DotplotRenderingBackend>(backend, {
            upload: b => {
              syncUpload(b, self.geometryByDisplayKey)
            },
            render: b => {
              b.resize(self.viewWidth, self.viewHeight)
              b.render(self.dotplotRenderState)
              return true
            },
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        setCursorMode(mode: CursorMode) {
          self.cursorMode = mode
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
        setLodMode(value: LodMode) {
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
         */
        setLineWidth(value: number) {
          self.lineWidth = value
        },
        /**
         * #action
         */
        setAlpha(value: number) {
          self.alpha = value
        },
        /**
         * #action
         */
        setMinAlignmentLength(value: number) {
          self.minAlignmentLength = value
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
          // An init that never finished applying still counts towards
          // hasSomethingToShow, so leaving it here means "return to import form"
          // doesn't. Dropping the request is what returning to the form means.
          self.init = undefined
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
          self.height = Math.max(newHeight, minHeight)
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
          throw new Error('session does not support widgets')
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
          return toggleTrackGeneric(self, trackId)
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
         * zooms into clicked and dragged region
         */
        zoomInToMouseCoords(mousedown: Coord, mouseup: Coord) {
          const result = self.getCoords(mousedown, mouseup)
          if (result) {
            self.hview.moveTo(result.x1, result.x2)
            self.vview.moveTo(result.y2, result.y1)
          }
        },
        /**
         * #action
         * highlights the clicked and dragged region: the x-span becomes a band
         * on the horizontal axis and the y-span a band on the vertical axis, so
         * the drag rect is their intersection
         */
        addHighlightFromMouseCoords(mousedown: Coord, mouseup: Coord) {
          const result = self.getCoords(mousedown, mouseup)
          if (result) {
            self.addToHighlights(dragToHighlight(result.x1, result.x2))
            self.addToHighlights(dragToHighlight(result.y2, result.y1))
            self.setShowHighlightChips(true)
          }
        },
        /**
         * #action
         */
        showAllRegions() {
          const { hview, vview } = self
          // Two passes: the first zoom settles bpPerPx, which the derived
          // border getters read, which shifts viewWidth/viewHeight and hence
          // maxBpPerPx; the second re-fits against the settled border. No
          // border state to set — borderX/borderY follow bpPerPx reactively.
          for (let pass = 0; pass < 2; pass++) {
            if (self.lockAspectRatio) {
              // One shared bpPerPx, and it has to be the larger of the two
              // maxima for the longer genome to fit. That legitimately exceeds
              // the shorter axis's own maxBpPerPx, so set it directly instead of
              // through zoomTo's per-axis clamp — clamping here left the axes
              // unequal and made the aspect-lock autorun immediately re-square
              // them. center() below re-derives offsetPx, so nothing is lost by
              // skipping zoomTo's anchor arithmetic.
              const shared = Math.max(hview.maxBpPerPx, vview.maxBpPerPx)
              hview.setBpPerPx(shared)
              vview.setBpPerPx(shared)
            } else {
              hview.zoomTo(hview.maxBpPerPx)
              vview.zoomTo(vview.maxBpPerPx)
            }
          }
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
          const result = self.getCoords(mousedown, mouseup)
          if (result) {
            const { x1, x2, y1, y2 } = result
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
          doAfterAttach(self as DotplotViewModel)
        },
        /**
         * #action
         * Set both axes to the average bpPerPx (hview divided by `ratio`),
         * re-anchoring each on the locus that was at its center. setBpPerPx
         * alone would leave offsetPx untouched while bpPerPx changed under it,
         * scrolling the plot; the centerAt calls are what hold it still.
         */
        applySquare(ratio: number) {
          const { hview, vview } = self
          const avg = (hview.bpPerPx + vview.bpPerPx) / 2
          const hpx = hview.pxToBp(hview.width / 2)
          const vpx = vview.pxToBp(vview.width / 2)
          hview.setBpPerPx(avg / ratio)
          hview.centerAt(hpx.coord0, hpx.refName, hpx.index)
          vview.setBpPerPx(avg)
          vview.centerAt(vpx.coord0, vpx.refName, vpx.index)
        },
        /**
         * #action
         * Equalize both axes' bpPerPx. Also what the aspect-ratio lock applies
         * to absorb divergence from box-zoom and other per-axis operations —
         * deliberately not clamped to either axis's own maxBpPerPx, since a
         * shared bpPerPx that fits the larger genome necessarily exceeds the
         * smaller axis's limit, and it converges in one step where a clamped
         * one would ping-pong between the two maxima.
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
         * Map a highlight/bookmark region to {left, width} px on the
         * horizontal axis. left is already screen-offset. Returns undefined
         * when the region isn't on hview's assembly/displayed regions.
         */
        getHHighlightCoords(region: {
          assemblyName?: string
          refName: string
          start: number
          end: number
        }) {
          return getLayoutHighlightCoords(
            self.hview,
            canonicalRegion(self, region),
          )
        },
        /**
         * #method
         * Map a highlight/bookmark region to {top, height} px on the vertical
         * axis. The vview lays out bottom-to-top, so the band is y-flipped into
         * screen space. Returns undefined when the region isn't on vview.
         */
        getVHighlightCoords(region: {
          assemblyName?: string
          refName: string
          start: number
          end: number
        }) {
          const coords = getLayoutHighlightCoords(
            self.vview,
            canonicalRegion(self, region),
          )
          return coords
            ? {
                top: self.viewHeight - (coords.left + coords.width),
                height: coords.width,
              }
            : undefined
        },
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
            ...lodMenuItems(self),
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
        // init is transient: redundant once assemblyNames are set (the autorun's
        // first materialization step), so strip it then. While assemblyNames is
        // still empty, init is the only thing that can rebuild the view -> keep
        // it so a reload/restore resumes instead of dropping to the import form.
        // assemblyNames is stripDefault, so it's absent (not []) when empty —
        // the optional chain is runtime-necessary despite the non-nullish type.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (snap.assemblyNames?.length) {
          const { init, ...rest } = snap
          return rest as typeof snap
        }
        return snap
      })
  )
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>

export { Dotplot1DView, type Dotplot1DViewModel } from './1dview.ts'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'DotplotView-OverlaySVGComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: DotplotViewModel }
    }
    'DotplotView-OverlayHTMLComponent': {
      args: ComponentType<{ model: DotplotViewModel }>
      result: ComponentType<{ model: DotplotViewModel }>
      props: { model: DotplotViewModel }
    }
  }
}
