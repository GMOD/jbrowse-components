import { lazy } from 'react'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { exportViewSvg } from '@jbrowse/core/svg/exportViewSvg'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getDialogHost,
  getSession,
  isSessionModelWithWidgets,
  localStorageGetItem,
  minmax,
} from '@jbrowse/core/util'
import {
  computeMoveToLayout,
  getLayoutHighlightCoords,
} from '@jbrowse/core/util/Base1DUtils'
import {
  hideTrackGeneric,
  launchToggleTrackGeneric,
  launchTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { highlightsOnAssemblies } from '@jbrowse/core/util/viewHighlights'
import {
  assemblyErrorMessage,
  computeViewStatus,
  viewLoading,
} from '@jbrowse/core/util/viewStatus'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { svgLegendGutterWidth } from '@jbrowse/display-kit/LegendMixin'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'
import {
  DiagonalizeProgressMixin,
  ImportFormSyntenyMixin,
  SyntenyViewMixin,
  carriedSyntenySettings,
  collectTrackWarnings,
  comparativeSurfacePhase,
  comparativeSurfaceSettled,
  liftSyntenyViewSettings,
  releaseTemporaryAssemblies,
} from '@jbrowse/synteny-core'
import DataUsageIcon from '@mui/icons-material/DataUsage'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import HighlightIcon from '@mui/icons-material/Highlight'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

import { pickDotplotFeature } from '../DotplotDisplay/dotplotPickEngine.ts'
import { DotplotHView, DotplotVView } from './1dview.ts'
import { doAfterAttach } from './afterAttach.ts'
import { dotplotLaunchKeys } from './launchKeys.ts'
import { DRAG_THRESHOLD_PX, HOVER_SLACK_PX, LS_CURSOR_MODE } from './types.ts'

import type { DotplotPlotPickHit } from '../DotplotDisplay/dotplotPickEngine.ts'
import type {
  DotplotGeometryData,
  DotplotRenderState,
  DotplotRenderingBackend,
} from '../DotplotDisplay/dotplotRenderingBackendTypes.ts'
import type { DotplotDisplayModel } from '../DotplotDisplay/stateModelFactory.tsx'
import type { DotplotHoverHighlight } from '../DotplotDisplay/types.ts'
import type { Dotplot1DViewModel } from './1dview.ts'
import type { Coord, DotplotViewCommands } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewExportSvgOptions } from '@jbrowse/core/svg/exportViewSvg'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { DisplayInitialSnapshot } from '@jbrowse/core/util/tracks'
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type {
  AttributeRange,
  ComparativeSurface,
  ComparativeTrackModel,
} from '@jbrowse/synteny-core'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
type CursorMode = 'crosshair' | 'move'

// Resolve a highlight region against ONE axis of the plot, or reject
// it as belonging to the other one. Two things happen here that the pixel
// lookup below doesn't do on its own:
//
// - The assembly check. `bpToPx` compares refNames and nothing else, and a
//   dotplot is the one view whose two layouts are two different assemblies —
//   so on an hg38-vs-mm10 plot a highlight on mm10 `chr1` also banded hg38's
//   `chr1` on the horizontal axis. Aliases go through the axis assembly's
//   `hasName`, so a highlight naming `GRCh38` still lands on an `hg38` axis.
//   A region with no assemblyName is drawn on both axes. (A session highlight
//   always carries one — a launch entry's is whichever assembly its `{...}`
//   prefix named, else the horizontal axis'.)
// - The refName alias, resolved against the AXIS assembly rather than the
//   region's own. Having passed the check above they name the same assembly,
//   and the axis's is the one the view has already waited on, so it is the one
//   that can actually answer. An assembly whose aliases have not loaded — which
//   a highlight on some unrelated one can name — answers with the input rather
//   than the alias, so asking the axis is the difference between resolving and
//   not.
//
// Takes a plain node (not DotplotViewModel) to avoid a self-referential type
// cycle when called from the model's own views.
function axisHighlightRegion(
  node: IAnyStateTreeNode,
  axisAssemblyName: string | undefined,
  region: {
    assemblyName?: string
    refName: string
    start: number
    end: number
  },
) {
  const asm = axisAssemblyName
    ? getSession(node).assemblyManager.get(axisAssemblyName)
    : undefined
  const onAxis = region.assemblyName
    ? (asm?.hasName(region.assemblyName) ??
      region.assemblyName === axisAssemblyName)
    : true
  return onAxis
    ? {
        ...region,
        refName: asm?.getCanonicalRefName2(region.refName) ?? region.refName,
      }
    : undefined
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
//
// The same reversal decides which edge a runaway drag clamps to: `b` past the
// region means "as far along the axis as this region goes", and a reversed
// region lays out right-to-left, so that edge is its `start`. Clamping to `end`
// unconditionally pointed the band back at where the drag came FROM, so it
// covered the complement of what was selected.
//
// Compared by displayed-region index rather than refName: an axis can show one
// refName in two regions (a read-vs-ref h axis comes from gatherOverlaps, so a
// read aligned twice to one chromosome yields two), and on refName alone a drag
// that crossed between them read as staying put and clamped `b` into the wrong
// one.
function dragToHighlight(a: PxToBpResult, b: PxToBpResult): HighlightType {
  const [start, end] = minmax(
    clamp(a.coord0, a.start, a.end),
    a.index === b.index
      ? clamp(b.coord0, a.start, a.end)
      : a.reversed
        ? a.start
        : a.end,
  )
  return {
    assemblyName: a.assemblyName,
    refName: a.refName,
    start,
    end,
  }
}

import {
  DEFAULT_ALPHA,
  DEFAULT_LINE_WIDTH,
  DEFAULT_MIN_IDENTITY,
  defaultHeight,
} from './consts.ts'

// Floor for the resize handle. Below this the axis borders (which floor at
// MIN_BORDER=50 each) would eat the whole box and viewWidth/viewHeight would go
// negative, feeding negative canvas dimensions and an inverted maxBpPerPx.
const minHeight = 120

export type ExportSvgOptions = ViewExportSvgOptions

/**
 * #stateModel DotplotView
 * #category view
 *
 * #example
 * Hand-authored under `defaultSession.views`, with every setting written
 * directly on the view object. `views` lists the two assemblies on the axes and
 * `tracks` the synteny track(s) to plot (self-vs-self is allowed):
 * ```js
 * {
 *   type: 'DotplotView',
 *   views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
 *   tracks: ['hg38_vs_mm10.paf'],
 *   color: { field: 'query' },
 * }
 * ```
 * `autoDiagonalize` and a per-axis `loc` on each `views` entry are the other
 * launch keys; everything else is a property below.
 */
export default function stateModelFactory(pm: PluginManager) {
  return withLaunchInput(
    types
      .compose(
        'DotplotView',
        BaseViewModel,
        RenderLifecycleMixin(),
        DiagonalizeProgressMixin(),
        ImportFormSyntenyMixin(),
        SyntenyViewMixin({ defaultAlpha: DEFAULT_ALPHA }),
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
           * the height of the plot in pixels
           */
          height: types.stripDefault(types.number, defaultHeight),
          /**
           * #property
           * vestigial: the hierarchical selector is the only one that exists, so
           * this value is ignored. Retained because saved sessions and share links
           * persist it.
           */
          trackSelectorType: types.stripDefault(types.string, 'hierarchical'),
          /**
           * #property
           * the two assemblies being compared, horizontal axis first. A spec
           * normally names these per axis instead, as `views[0].assembly` and
           * `views[1].assembly`.
           */
          assemblyNames: types.stripDefault(types.array(types.string), []),
          /**
           * #property
           * resolve each alignment's CIGAR into the drawn shape rather than
           * plotting it as a single straight segment
           */
          drawCigar: types.stripDefault(types.boolean, true),
          /**
           * #property
           * carry each axis' ruler ticks across the plot as faint lines, the way
           * LinearGenomeView's gridlines carry its own down over the tracks
           */
          showGridlines: types.stripDefault(types.boolean, true),
          /**
           * #property
           * When true, hview and vview are kept at the same bpPerPx so the
           * dotplot stays square. Wheel zoom already preserves the ratio;
           * box-zoom and other independent ops trigger an autorun resync.
           */
          lockAspectRatio: types.stripDefault(types.boolean, false),
          /**
           * #property
           * Line width in CSS pixels of every alignment in the plot
           */
          lineWidth: types.stripDefault(types.number, DEFAULT_LINE_WIDTH),
          /**
           * #property
           * Hide alignments whose sequence identity is below this fraction
           * (0-1), enforced per feature in buildLineSegments beside
           * minAlignmentLength. A feature carrying no identity at all is kept
           * at every threshold — the alternative blanks a plot whose adapter
           * simply never reported one.
           */
          minIdentity: types.stripDefault(types.number, DEFAULT_MIN_IDENTITY),
          /**
           * #property
           * the horizontal axis, as a full 1D view state. A spec writes
           * `views[0]` instead, which the launcher resolves into this.
           */
          hview: types.optional(DotplotHView, {}),
          /**
           * #property
           * the vertical axis, the counterpart to `hview`. A spec writes
           * `views[1]`.
           */
          vview: types.optional(DotplotVView, {}),

          /**
           * #property
           */
          tracks: types.array(pm.pluggableMstType('track', 'stateModel')),

          /**
           * #property
           * transient launch state: the settings written on the view object
           * that need resolving before they can be view state — the two axis
           * assemblies, track recipes, highlights. `preProcessSnapshot` moves
           * them here off the snapshot, the afterAttach autorun applies them
           * and clears this, so a saved session never retains it. Not written
           * by hand: author every setting directly on the view.
           */
          launch: types.frozen<LaunchInput<DotplotViewCommands> | undefined>(),
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
      }))
      .views(self => ({
        /**
         * #getter
         * The census entry for this view: the tracks it holds itself. Declared
         * rather than derived — see `BaseViewModel.ownTracks`.
         */
        get ownTracks() {
          return [...self.tracks]
        },
        /**
         * #getter
         */
        // Unmeasured is `undefined`, which is also what `initialized` tests —
        // a falsy test additionally threw on a measured 0, so a view that
        // reported initialized failed here instead
        get width(): number {
          if (self.volatileWidth === undefined) {
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
          return self.vview.labelMarginPx
        },
        /**
         * #getter
         * Bottom margin: fits the horizontal (hview) axis labels. See borderX.
         */
        get borderY() {
          return self.hview.labelMarginPx
        },
      }))
      .views(self => ({
        /**
         * #getter
         * the launch state that still has something to apply — the gate every
         * loading and import-form path below reads.
         */
        get pendingLaunch() {
          return pendingLaunch(self.launch)
        },
        /**
         * #getter
         */
        get assemblyErrors() {
          const { assemblyManager } = getSession(self)
          return assemblyErrorMessage(assemblyManager, self.assemblyNames)
        },
        /**
         * #getter
         * the session's highlights on either axis' assembly
         */
        get highlights() {
          const { highlights, assemblyManager } = getSession(self)
          return highlightsOnAssemblies(
            highlights,
            self.assemblyNames,
            assemblyManager,
          )
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
        /**
         * #getter
         * A dotplot plots one assembly against another, so anything but two
         * names here cannot lay out. `initializeDisplayedRegions` walks the two
         * axes in step with this array, so one name leaves the other axis with
         * no regions and `initialized` never comes true — the view sat on its
         * spinner saying "Loading" forever, with the assembly it was supposedly
         * waiting for already loaded. Extra names fail the other way: nothing
         * reads past the second, so a third assembly is not plotted and nothing
         * says so.
         *
         * Only reachable from a hand-authored snapshot — `setAssemblyNames`
         * writes both, and `applyInit` already rejects an init naming one — and
         * that snapshot is the case this error reports. Zero names is not an error: it
         * is the import form.
         */
        get axisAssemblyError() {
          const { length } = self.assemblyNames
          return length > 0 && length !== 2
            ? new Error(
                `A DotplotView needs exactly two assemblyNames, horizontal axis first; got ${length} (${self.assemblyNames.join(', ')})`,
              )
            : undefined
        },
        /**
         * #getter
         * The view's terminal state: whatever the import form's submit threw,
         * else a pair of axes that cannot lay out, else whatever the assemblies
         * did. Declared here rather than beside `menuItems` so every reader below
         * is the same expression — `showImportForm` and `showLoading` each used
         * to re-spell it, and `showLoading` spelled it as a two-term `&&` that a
         * third source of error would have to be added to in three places.
         */
        get error(): unknown {
          return (
            self.volatileError ?? this.axisAssemblyError ?? this.assemblyErrors
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
        get hasSomethingToShow() {
          return self.assemblyNames.length > 0 || !!self.pendingLaunch
        },
        /**
         * #getter
         * An `init` blob that has not been applied yet — `installInitAutorun`
         * clears it as the last thing an apply pass does. The plot is
         * assembling itself: the axes can already exist, and be initialized,
         * while the tracks or the region restriction are still to come, which
         * is why the `settled` gate reads this.
         *
         * Read by `settled`, deliberately **not** by `showLoading` — a plot
         * whose axes are up is worth showing while the rest lands. LGV's
         * equivalent is `awaitingInitNavigation`, a narrower thing (init set
         * and nothing on screen at all) that it does fold into `showLoading`;
         * it used to share this name, and the two disagree exactly where a
         * reader would assume they agree.
         */
        get initPending() {
          return !!self.pendingLaunch
        },
        /**
         * #getter
         * Whether to show the import form
         */
        get showImportForm() {
          return !this.hasSomethingToShow || !!self.error
        },
        /**
         * #getter
         * Whether to show a loading indicator instead of the import form or view
         */
        get showLoading() {
          return (
            self.awaitingAutoDiagonalize ||
            (this.hasSomethingToShow && !this.initialized && !self.error)
          )
        },
        /**
         * #getter
         * The assembly whose load the spinner is waiting on. `init` names them
         * before assemblyNames is materialized, so it is the source until then.
         */
        get loadingAssembly() {
          const { assemblyManager } = getSession(self)
          return assemblyManager.loadingAssembly(
            self.assemblyNames.length > 0
              ? self.assemblyNames
              : (self.pendingLaunch?.views?.map(v => v.assembly) ?? []),
          )
        },
        /**
         * #getter
         * What the loading screen says while `showLoading`, read off the
         * assembly whose load is the wait; undefined otherwise.
         */
        get loading() {
          return viewLoading(this.showLoading, () => this.loadingAssembly)
        },
        /**
         * #getter
         * The view's lifecycle as one value — ready, error, loading or noRegions
         * — for a host that draws its own chrome and has to render all four.
         * Same shape and same precedence as the linear view's, through
         * `computeViewStatus`.
         */
        get status(): ViewStatus {
          return computeViewStatus({
            error: self.error,
            hasSomethingToShow: this.hasSomethingToShow,
            loading: () => this.loading,
          })
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
        /**
         * #getter
         * The setting is on and neither axis has a ruler to cast — a ticked
         * checkbox doing nothing observable, which the menu says out loud
         * rather than looking broken. The whole-genome view is this.
         */
        get gridlinesEmpty() {
          return (
            self.showGridlines &&
            self.hview.gridlines.length === 0 &&
            self.vview.gridlines.length === 0
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
         * The zoom-out limit both axes share under `lockAspectRatio`: one
         * bpPerPx has to fit the LONGER genome, so it is the larger of the two
         * axes' own fits. Read back by each axis as its `maxBpPerPx` (see
         * `axisMaxBpPerPx`), so every route to a zoom — the buttons, the wheel,
         * box-zoom, `showAllRegions` — clamps against the same ceiling.
         */
        get sharedFitBpPerPx() {
          return Math.max(self.hview.fitBpPerPx, self.vview.fitBpPerPx)
        },

        /**
         * #getter
         * Every DotplotDisplay under this view's tracks. Filtered by `type`
         * rather than taken as `tracks[i].displays[0]`: `showTrack` only ever
         * builds one view-compatible display, but a hand-written or legacy
         * session snapshot is hydrated verbatim, and an empty or foreign
         * `displays` array put an `undefined` into this list that every
         * consumer below dereferences — `settled` and `geometryByDisplayKey`
         * both crash the view on it. Same spelling as the synteny level's
         * `linearSyntenyDisplays`.
         *
         * Not index-aligned with `tracks`, so a consumer that wants a display's
         * track reads `display.parentTrack` rather than `tracks[i]`.
         */
        get dotplotDisplays() {
          const out: DotplotDisplayModel[] = []
          for (const track of self.tracks) {
            for (const display of track.displays) {
              if (display.type === 'DotplotDisplay') {
                out.push(display as DotplotDisplayModel)
              }
            }
          }
          return out
        },
        /**
         * #getter
         * Every loaded track's render warnings, under the name to report them
         * by. Shared with the synteny view's own report (see
         * `collectTrackWarnings` for why the name has to come off the display's
         * `parentTrack`), and a cached computed rather than a render-time
         * flatMap: the header that reads it re-renders on every pointermove of
         * a selection drag, and resolving a name is a `getConf` per track.
         */
        get trackWarnings() {
          return collectTrackWarnings(this.dotplotDisplays)
        },
        /**
         * #method
         * Annotated for the reason `ComparativeTrackModel` documents: the
         * array is `any`.
         */
        syntenyTracks(): ComparativeTrackModel[] {
          return self.tracks
        },
        /**
         * #method
         * Each loaded display's observed attribute spans, which the mixin
         * unions into the domain the legend labels its ramp with.
         */
        loadedAttributeRanges(): Record<string, AttributeRange>[] {
          return this.dotplotDisplays.map(d => d.rpcData?.attributeRanges ?? {})
        },

        /**
         * #method
         * Flat points, never a CIGAR op.
         */
        colorSurface() {
          return 'points' as const
        },

        /**
         * #method
         * The export parks the key beside the plot rather than over it: a
         * diagonalized plot's alignments run into the top-right corner the key
         * would otherwise cover.
         */
        svgLegendWidth(): number {
          return svgLegendGutterWidth(self)
        },

        /**
         * #getter
         * The plot rect as the displays drawing onto it see it: first paint,
         * plus the two flags that mean what is on screen is not the answer yet.
         * Published here so a display reads one field, and so `settled` below
         * and every display's `displayPhase` are computed from the same three
         * values.
         */
        get surfaceReadiness(): ComparativeSurface {
          return {
            painted: self.painted,
            initPending: this.initPending,
            pendingAutoDiagonalize: self.pendingAutoDiagonalize,
            renderError: self.renderError,
            hostMounted: self.effectiveBodyMounted,
          }
        },
        /**
         * #getter
         * What the shared canvas publishes as `data-display-phase`: the ranking
         * over the plots drawing onto it. Its twin `settled` below is the
         * stricter question — see `comparativeReadiness`.
         */
        get displayPhase(): DisplayStatusPhase {
          return comparativeSurfacePhase(
            this.surfaceReadiness,
            this.dotplotDisplays,
          )
        },
        /**
         * #getter
         * Canvas has painted and no display is still fetching, so what's on
         * screen is the final settled content. Drives the
         * `data-display-drawn` on `dotplot_webgl_canvas` that screenshot capture and the
         * browser-test suites wait on — so it must mean "done", not just
         * "first paint".
         *
         * Not the same question as "is every display finished" — see
         * `comparativeReadiness`, which holds both and says why an error answers
         * them differently.
         */
        get settled() {
          return comparativeSurfaceSettled(
            this.surfaceReadiness,
            this.dotplotDisplays,
          )
        },
        /**
         * #getter
         * The one track that owns the plot's hover, or undefined. At most one
         * can: `setHoveredFeature` points a single display at the hit and clears
         * every other in the same batch.
         *
         * Resolved here so the two readers below — and the components — take the
         * view they already have rather than looping the tracks themselves.
         */
        get hoveredDisplay(): DotplotDisplayModel | undefined {
          return this.dotplotDisplays.find(d => d.hoveredSegmentIdx >= 0)
        },
        /**
         * #getter
         * The hovered alignment's tooltip lines, or undefined when nothing is
         * hovered.
         */
        get hoveredTooltipLines(): string[] | undefined {
          return this.hoveredDisplay?.tooltipLines
        },
        /**
         * #getter
         * The hovered alignment's restroke geometry — see
         * `DotplotDisplay.hoveredFeatureHighlight`.
         */
        get hoveredHighlight(): DotplotHoverHighlight | undefined {
          return this.hoveredDisplay?.hoveredFeatureHighlight
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
         * The cumBp -> plot px reconstruction, as the numbers everything that
         * draws or hit-tests this plot runs on: the viewport-start cumBp per
         * axis, the inverse bpPerPx per axis, and the plot height the v axis is
         * flipped through (it lays out bottom-up).
         *
         * Its own getter because three readers want exactly these and nothing
         * else — the render state below, the pick's exact test, and
         * `DotplotDisplay.hoveredFeatureHighlight`. Taking them off
         * `dotplotRenderState` also subscribes to `alpha`, `lineWidth` and the
         * display-key list, so an opacity drag rebuilt the hover path.
         *
         * `viewHeight` belongs in here and not beside it: this is also what
         * `setupClearHoverOnPlotMove` watches to decide the plot has moved under
         * a stationary cursor, and a height change slides every alignment down
         * the canvas exactly as a pan does. Left out, it was the one way to move
         * the plot that kept the hover pinned to the alignment it no longer
         * pointed at.
         */
        get plotTransform() {
          const { hview, vview } = self
          return {
            viewBpH: hview.offsetPx * hview.bpPerPx,
            viewBpV: vview.offsetPx * vview.bpPerPx,
            bpPerPxHInv: 1 / hview.bpPerPx,
            bpPerPxVInv: 1 / vview.bpPerPx,
            viewHeight: this.viewHeight,
          }
        },
        /**
         * #getter
         * One canvas-wide block per loaded display, in the map's insertion
         * order, so tracks paint bottom-of-the-list last. An empty list is a
         * real frame, not a skip: the backend clears before drawing, so
         * painting zero displays is what wipes the plot when the last track is
         * hidden.
         */
        get dotplotBlocks() {
          return canvasWideBlocks(
            this.geometryByDisplayKey.keys(),
            this.viewWidth,
          )
        },
        /**
         * #getter
         * Aggregated per-frame render state — a resolved value, never
         * undefined; "the view isn't measured yet" is the `canRender`
         * precondition below.
         */
        get dotplotRenderState(): DotplotRenderState {
          // Named rather than spread: `plotTransform` calls the plot height
          // `viewHeight`, and a mark frame calls it `canvasHeight`.
          const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewHeight } =
            this.plotTransform
          return {
            viewBpH,
            viewBpV,
            bpPerPxHInv,
            bpPerPxVInv,
            lineWidth: self.lineWidth,
            alpha: self.alpha,
            canvasWidth: this.viewWidth,
            canvasHeight: viewHeight,
          }
        },
        /**
         * #method
         * Both corners of a drag rect, in bp on each axis. Undefined for a
         * drag too small to be a selection — the same threshold the
         * interaction hook uses to tell a drag from a click.
         */
        getCoords(mousedown: Coord, mouseup: Coord) {
          const { hview, vview } = self
          const [xmin, xmax] = minmax(mouseup[0], mousedown[0])
          const [ymin, ymax] = minmax(mouseup[1], mousedown[1])
          return xmax - xmin > DRAG_THRESHOLD_PX &&
            ymax - ymin > DRAG_THRESHOLD_PX
            ? {
                x1: hview.pxToBp(hview.fromScreenPx(xmin)),
                x2: hview.pxToBp(hview.fromScreenPx(xmax)),
                y1: vview.pxToBp(vview.fromScreenPx(ymin)),
                y2: vview.pxToBp(vview.fromScreenPx(ymax)),
              }
            : undefined
        },
        /**
         * #method
         * The alignment under a pointer position (plot px, y downward), across
         * every track on the shared canvas, or undefined.
         *
         * Resolved on the model rather than through the rendering backend, which
         * is where this departs from synteny's `backend.pick(...)`: dotplot
         * geometry is already here in absolute cumBp (`display.instanceData`), so
         * this answers with NO backend attached at all — before the first paint,
         * through a context loss that has not recovered, and in a test with no
         * canvas. (Both of synteny's backends implement `pick`, so its hover is
         * not GPU-only either despite `gpuRenderingBackend`'s name; what it cannot
         * do is answer while nothing is attached. It lives in the backend because
         * the projected geometry it indexes does, which also means each backend
         * builds its own index.)
         *
         * Nearest wins ACROSS tracks too, ties going to the later track (the one
         * drawn on top) — see `pickDotplotFeature` for why a dotplot answers
         * nearest where a ribbon answers topmost.
         */
        pickFeatureAt(x: number, y: number) {
          const state = this.dotplotRenderState
          // Half the drawn line width, so anything painted under the cursor
          // hits, plus a fixed slack for the sub-pixel dots a whole-genome plot
          // is mostly made of — they are a couple of px across at most, and
          // without slack they would be unhoverable.
          const tolerancePx = self.lineWidth / 2 + HOVER_SLACK_PX
          let best: DotplotPlotPickHit | undefined
          for (const display of this.dotplotDisplays) {
            const { geometry } = display
            if (!geometry) {
              continue
            }
            const hit = pickDotplotFeature({
              data: geometry,
              x,
              y,
              state,
              tolerancePx,
            })
            if (hit && (!best || hit.distancePx <= best.distancePx)) {
              best = { ...hit, displayKey: display.displayKey }
            }
          }
          return best
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Render-lifecycle precondition (overrides `RenderLifecycleMixin`'s
         * default-true hook): before the axes have regions and a measured
         * width there is nothing to paint against. Gating the autorun pair
         * here lets `dotplotRenderState` stay a resolved getter.
         */
        get canRender() {
          return self.initialized
        },
        /**
         * #getter
         * Overrides `RenderLifecycleMixin`'s hook: a measured plot with no
         * tracks on it paints nothing this tick and nothing is coming, so it
         * has finished rather than being pending. The backend answers "did
         * content reach the canvas" off the blocks it drew, which is the right
         * answer for a track still fetching and the wrong one for a canvas
         * with nothing to draw on it.
         *
         * `initialized` is the other half and is not redundant with
         * `canRender`: an import form has no tracks either, and it is *not*
         * finished — `AppReadyMarkerComparative` pins that its `settled` stays
         * false, and the marker asks its displays rather than this.
         */
        get paintInert() {
          return self.initialized && self.dotplotDisplays.length === 0
        },
      }))
      // One canvas on the view, shared by all displays. The view aggregates
      // per-display geometry from `geometryByDisplayKey` and runs both upload
      // and render against the shared backend.
      .actions(self => ({
        startRenderingBackend(backend: DotplotRenderingBackend) {
          // One display committing new geometry re-fires the shared upload
          // autorun for every track on the canvas, so the installer diffs by
          // reference: only the track that actually changed re-uploads.
          installUpload(self, backend, {
            cells: () => self.geometryByDisplayKey,
            render: b =>
              b.renderBlocks(
                self.dotplotBlocks,
                self.geometryByDisplayKey,
                self.dotplotRenderState,
              ),
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Point the whole plot's hover state at one pick hit: the track whose
         * geometry was hit takes the segment index, every other track clears, so
         * `undefined` (a miss) clears the plot. An action rather than a loop in
         * the pointer handler so the N writes land in one MobX batch — and so
         * nothing outside the model has to resolve a `displayKey` to a display.
         * Same shape as the synteny level's `setHoveredFeature`.
         */
        setHoveredFeature(hit: DotplotPlotPickHit | undefined) {
          for (const display of self.dotplotDisplays) {
            display.setHoveredSegmentIdx(
              display.displayKey === hit?.displayKey ? hit.segmentIdx : -1,
            )
          }
        },
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
        setShowGridlines(flag: boolean) {
          self.showGridlines = flag
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
        setMinIdentity(value: number) {
          self.minIdentity = value
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
          // A launch that never finished applying still counts towards
          // hasSomethingToShow, so leaving it here means "return to import form"
          // doesn't. Dropping the request is what returning to the form means.
          self.launch = undefined
          // The banner over the form describes the submit that failed, and this
          // is the one route to the form that isn't a submit — so it was the one
          // that left an error standing over a form with nothing wrong with it,
          // until the next Launch cleared it. `LinearSyntenyView.clearView`
          // already does this.
          self.volatileError = undefined
          self.cancelAutoDiagonalize()
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
        setLaunch(launch?: LaunchInput<DotplotViewCommands>) {
          self.launch = launch
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
        /**
         * #action
         * Pan both axes one gesture step. Each delta is in its own axis'
         * scroll direction, not screen px — the vertical axis lays out
         * bottom-up, and both callers (wheel, drag) already hold the flipped
         * value for their own reasons.
         *
         * One action rather than two `scroll` calls, because an MST action is
         * a MobX action: unbatched, the render autorun ran twice per
         * pointermove and drew a whole frame against a moved h axis and a
         * stale v one.
         */
        scrollXY(dx: number, dy: number) {
          self.hview.scroll(dx)
          self.vview.scroll(dy)
        },
        /**
         * #action
         * Zoom both axes by `factor`, holding the locus under a plot-area
         * point still. The anchor is the same component-px `Coord` the drag
         * handlers pass around, so each axis takes it through its own
         * `fromScreenPx`, as `getCoords` does.
         *
         * Multiplying both axes by one factor keeps wheel zoom
         * ratio-preserving, so the aspect lock never has to correct it. One
         * action, for the reason `scrollXY` documents.
         */
        zoomAt(factor: number, [x, y]: Coord) {
          const { hview, vview } = self
          hview.zoomTo(hview.bpPerPx * factor, hview.fromScreenPx(x))
          vview.zoomTo(vview.bpPerPx * factor, vview.fromScreenPx(y))
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        activateTrackSelector() {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.openWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            return selector
          }
          throw new Error('session does not support widgets')
        },

        /**
         * #action
         * `initialSnapshot` is annotated rather than inferred from its default.
         * A bare `{}` accepts a number, so this signature satisfied
         * `applySyntenyTrackSelections`' `(trackId, level) => void` callback —
         * passing `model.showTrack` there typechecked and handed the pair index
         * over as the new track's snapshot.
         */
        showTrack(
          trackId: string,
          initialSnapshot: object = {},
          displayInitialSnapshot: DisplayInitialSnapshot = {},
          inlineConf?: Record<string, unknown>,
        ) {
          return showTrackGeneric(
            self,
            trackId,
            initialSnapshot,
            displayInitialSnapshot,
            inlineConf,
          )
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
        setAssemblyNames(x: string, y: string) {
          self.assemblyNames = cast([x, y])
          // Clear displayed regions to trigger re-initialization with the new
          // assemblies. The dotplotRegionsAutorun will re-populate them.
          self.hview.setDisplayedRegions([])
          self.vview.setDisplayedRegions([])
        },
        /**
         * #action
         * zooms into clicked and dragged region. Under `lockAspectRatio` both
         * axes take the larger of the two fits, so the whole box stays in view
         * on the axis whose plot dimension is shorter.
         */
        zoomInToMouseCoords(mousedown: Coord, mouseup: Coord) {
          const result = self.getCoords(mousedown, mouseup)
          if (result) {
            const { hview, vview } = self
            const floor = self.lockAspectRatio
              ? Math.max(
                  computeMoveToLayout(hview, result.x1, result.x2).bpPerPx,
                  computeMoveToLayout(vview, result.y2, result.y1).bpPerPx,
                )
              : 0
            hview.moveTo(result.x1, result.x2, floor)
            vview.moveTo(result.y2, result.y1, floor)
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
            const session = getSession(self)
            session.addHighlight(dragToHighlight(result.x1, result.x2))
            session.addHighlight(dragToHighlight(result.y2, result.y1))
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
          //
          // No aspect-lock branch: under the lock each axis' `maxBpPerPx` is
          // already the shared ceiling, so both land on it and the lock autorun
          // has nothing to correct.
          for (let pass = 0; pass < 2; pass++) {
            hview.zoomTo(hview.maxBpPerPx)
            vview.zoomTo(vview.maxBpPerPx)
          }
          vview.center()
          hview.center()
        },
        /**
         * #action
         */
        initializeDisplayedRegions() {
          const { assemblyNames } = self
          // Per axis, not "either axis is empty, rewrite both": the whole-genome
          // default is only ever the fallback for an axis that has nothing, and
          // an axis that does have regions has them because something chose
          // them — `init.displayedRegionNames`, a diagonalize reorder, a
          // restored snapshot. Rewriting it because its neighbour was empty
          // threw that choice away.
          const { assemblyManager } = getSession(self)
          let changed = false
          for (const [i, axis] of self.views.entries()) {
            if (axis.displayedRegions.length === 0) {
              axis.setDisplayedRegions(
                assemblyManager.get(assemblyNames[i]!)?.regions ?? [],
              )
              changed = true
            }
          }
          if (changed) {
            this.showAllRegions()
          }
        },
        /**
         * #action
         * a circular view of the two axes' genomes with this view's tracks as
         * ribbons, the second genome reordered to follow the first, and this
         * view's colour and length filter
         */
        openInCircularSyntenyView() {
          const assembly = [...new Set(self.assemblyNames)]
          void getSession(self).launchView('CircularView', {
            assembly,
            tracks: self.tracks.map(
              track => track.configuration.trackId as string,
            ),
            autoDiagonalize: assembly.length === 2,
            ...carriedSyntenySettings(self),
          })
        },
        /**
         * #action
         * opens a linear synteny view on the clicked and dragged region: the
         * horizontal axis' span on the top row, the vertical axis' below, each
         * fitted to this view's width, with every track that has a linear
         * synteny display, painted and filtered by the settings the two views
         * share
         */
        launchLinearSyntenyView(mousedown: Coord, mouseup: Coord) {
          const result = self.getCoords(mousedown, mouseup)
          if (result) {
            const { lodMode } = self
            const { x1, x2, y1, y2 } = result
            const row = (
              axis: Dotplot1DViewModel,
              start: PxToBpResult,
              end: PxToBpResult,
            ) => {
              const { displayedRegions } = getSnapshot(axis)
              return {
                type: 'LinearGenomeView',
                tracks: [],
                hideHeader: true,
                displayedRegions,
                ...computeMoveToLayout(
                  { displayedRegions, width: self.width },
                  start,
                  end,
                ),
              }
            }
            const tracks = self.tracks.flatMap(track => {
              const trackConf = track.configuration
              const displayConf = trackConf.displays.find(
                (display: { type: string }) =>
                  display.type === 'LinearSyntenyDisplay',
              )
              return displayConf
                ? [
                    {
                      type: trackConf.type,
                      configuration: trackConf.trackId,
                      displays: [
                        {
                          type: displayConf.type,
                          configuration: displayConf.displayId,
                        },
                      ],
                    },
                  ]
                : []
            })
            void getSession(self).launchView('LinearSyntenyView', {
              ...carriedSyntenySettings(self),
              lodMode,
              views: [row(self.hview, x1, x2), row(self.vview, y2, y1)],
              // the level between the two rows, which is where a synteny track
              // lives. `tracks` on the view means trackIds to open, so a built
              // track snapshot written there is a launch recipe and never
              // becomes a band.
              levels: [{ tracks }],
            })
          }
        },
      }))
      .actions(self => ({
        /**
         * #action
         * showTrack for a track whose display state model may be lazily
         * loaded: loads it, then shows
         */
        async launchTrack(
          trackId: string,
          initialSnapshot: object = {},
          displayInitialSnapshot: DisplayInitialSnapshot = {},
          inlineConf?: Record<string, unknown>,
        ) {
          return launchTrackGeneric(
            self,
            trackId,
            initialSnapshot,
            displayInitialSnapshot,
            inlineConf,
          )
        },
        /**
         * #action
         * toggleTrack with launchTrack's loading behavior
         */
        async launchToggleTrack(trackId: string) {
          return launchToggleTrackGeneric(self, trackId)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * renders the view to SVG markup, which it returns; saves it through
         * FileSaver unless `save: false`
         */
        // Promise<string> is stated: renderToSvg is typed against this very
        // model, so an inferred return makes the type reference itself (TS2456)
        async exportSvg(opts: ExportSvgOptions = {}): Promise<string> {
          return exportViewSvg(
            self as DotplotViewModel,
            opts,
            () => import('./svgcomponents/SVGDotplotView.tsx'),
          )
        },
        // if any of our assemblies are temporary assemblies. Both hooks, and
        // `releaseTemporaryAssemblies` says why: `removeView` detaches before
        // it destroys, so the reach for the session has to happen at the
        // detach.
        beforeDetach() {
          releaseTemporaryAssemblies(self)
        },
        beforeDestroy() {
          releaseTemporaryAssemblies(self)
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
         * Map a highlight region to {left, width} px on the
         * horizontal axis. left is already screen-offset. Returns undefined
         * when the region isn't on hview's assembly/displayed regions.
         */
        getHHighlightCoords(region: {
          assemblyName?: string
          refName: string
          start: number
          end: number
        }) {
          const r = axisHighlightRegion(self, self.assemblyNames[0], region)
          return r ? getLayoutHighlightCoords(self.hview, r) : undefined
        },
        /**
         * #method
         * Map a highlight region to {top, height} px on the vertical
         * axis. Returns undefined when the region isn't on vview's
         * assembly/displayed regions.
         */
        getVHighlightCoords(region: {
          assemblyName?: string
          refName: string
          start: number
          end: number
        }) {
          const r = axisHighlightRegion(self, self.assemblyNames[1], region)
          const coords = r ? getLayoutHighlightCoords(self.vview, r) : undefined
          return coords
            ? {
                top: self.vview.toScreenPx(coords.left + coords.width),
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
                getDialogHost(self).queueDialog(handleClose => [
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
                getDialogHost(self).queueDialog(handleClose => [
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
                    onClick: () => {
                      self.activateTrackSelector()
                    },
                    icon: TrackSelectorIcon,
                  },
                ]
              : []),
            ...(self.assemblyNames.length > 0 &&
            pm.viewTypes.has('CircularView')
              ? [
                  {
                    label: 'Open in circular synteny view',
                    icon: DataUsageIcon,
                    onClick: () => {
                      self.openInCircularSyntenyView()
                    },
                  },
                ]
              : []),
            {
              label: 'Show highlights',
              icon: HighlightIcon,
              type: 'checkbox' as const,
              checked: session.highlightsVisible,
              onClick: () => {
                session.setHighlightsVisible(!session.highlightsVisible)
              },
            },
          ]
        },
      })),
    dotplotLaunchKeys,
    {
      registry: pm,
      materialized: snap => !!snap.assemblyNames?.length,
    },
  ).preProcessSnapshot(liftSyntenyViewSettings)
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
// An interface, not `type … = Instance<…>`: `dotplotDisplays` names the display
// model and the display names this view back (`self.view`), and only the
// interface form defers that mutual reference instead of collapsing it. See
// ADR-055.
export interface DotplotViewModel extends Instance<DotplotViewStateModel> {}

export { Dotplot1DView, type Dotplot1DViewModel } from './1dview.ts'

declare module '@jbrowse/core/PluginManager' {
  // Both overlay points accumulate, so the highlight bands this plugin draws
  // and a third party's overlay both appear. The HTML one used to be a single
  // component, which meant the slot was already taken: installDotplotHighlights
  // returns its chip overlay unconditionally, so a second contributor either
  // lost its own overlay or erased the chips, depending on install order.
  //
  // Both render through PluggableElements' `name` prop, so neither has a
  // string-literal fire site for its docs tag to sit at; they live here at the
  // contract, the same way Core-replaceWidget's does.
  interface ExtensionPointRegistry {
    /** #extensionPoint DotplotView-OverlaySVGComponent | sync | Add an SVG overlay component to the dotplot view */
    'DotplotView-OverlaySVGComponent': ElementList<{ model: DotplotViewModel }>
    /** #extensionPoint DotplotView-OverlayHTMLComponent | sync | Add an HTML overlay component to the dotplot view */
    'DotplotView-OverlayHTMLComponent': ElementList<{ model: DotplotViewModel }>
  }
  interface ViewTypeRegistry {
    DotplotView: DotplotViewStateModel
  }
}
