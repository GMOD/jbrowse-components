import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import HighlightsMixin from '@jbrowse/core/pluggableElementTypes/models/HighlightsMixin'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getDialogHost,
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
import { installKeyedLifecycle } from '@jbrowse/render-core/installKeyedLifecycle'
import {
  DiagonalizeProgressMixin,
  TrackColorsMixin,
  collectTrackWarnings,
  comparativeSurfacePhase,
  comparativeSurfaceSettled,
  regionSignature,
  releaseTemporaryAssemblies,
  trackHasLodTiers,
} from '@jbrowse/synteny-core'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { observable } from 'mobx'

import { pickDotplotFeature } from '../DotplotDisplay/dotplotPickEngine.ts'
import { Dotplot1DView, DotplotHView, DotplotVView } from './1dview.ts'
import { doAfterAttach } from './afterAttach.ts'
import {
  axisBorderPx,
  computeTickPositions,
  getBlockLabelKeysToHide,
  makeTicks,
  regionBoundaryLines,
  thinTickPositions,
  tickLines,
  truncateRefNames,
} from './components/util.ts'
import { DRAG_THRESHOLD_PX, HOVER_SLACK_PX, LS_CURSOR_MODE } from './types.ts'

import type { DotplotPlotPickHit } from '../DotplotDisplay/dotplotPickEngine.ts'
import type {
  DotplotGeometryData,
  DotplotRenderingBackend,
} from '../DotplotDisplay/dotplotRenderingBackendTypes.ts'
import type { DotplotDisplayModel } from '../DotplotDisplay/stateModelFactory.tsx'
import type { DotplotHoverHighlight } from '../DotplotDisplay/types.ts'
import type { Dotplot1DViewModel } from './1dview.ts'
import type {
  Coord,
  DotplotViewCommands,
  ImportFormSyntenyTrack,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { DisplayInitialSnapshot } from '@jbrowse/core/util/tracks'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type {
  AttributeRange,
  ComparativeSurface,
  ComparativeTrackModel,
  LodMode,
} from '@jbrowse/synteny-core'
import type React from 'react'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
type CursorMode = 'crosshair' | 'move'

// Ticks for one axis. There used to be a cutoff here — more than five visible
// blocks and the axis got no ticks at all — because at high chromosome counts
// the labels overlap illegibly. It cost the lines too, and without them the
// region-boundary grid is the only structure a whole-genome plot has left.
//
// It was also load-bearing in a way its comment didn't say: positioning a tick
// meant a `bpToPx` scan of `displayedRegions`, so ticks x regions per pan, and
// these axes carry one region per refName. The cutoff was the only thing
// keeping that off a fragmented assembly. Both halves are now handled where
// they belong — `makeTicks` resolves position from the block in O(1) and skips
// sub-tick-width blocks, and `thinTickPositions` drops marks and labels that
// would collide — so the axis can just always have ticks.
function axisTicks(view: Dotplot1DViewModel) {
  const { staticBlocks, bpPerPx } = view
  return makeTicks(staticBlocks.contentBlocks, bpPerPx)
}

// Resolve a highlight/bookmark region against ONE axis of the plot, or reject
// it as belonging to the other one. Two things happen here that the pixel
// lookup below doesn't do on its own:
//
// - The assembly check. `bpToPx` compares refNames and nothing else, and a
//   dotplot is the one view whose two layouts are two different assemblies —
//   so on an hg38-vs-mm10 plot a bookmark on mm10 `chr1` also banded hg38's
//   `chr1` on the horizontal axis. Aliases go through the axis assembly's
//   `hasName`, so a highlight naming `GRCh38` still lands on an `hg38` axis.
//   A region with no assemblyName is drawn on both axes: hand-authored session
//   JSON and grid bookmarks may omit it, and on a self-vs-self plot both bands
//   are wanted regardless. (An `init.highlight` entry always carries one —
//   whichever assembly its `{...}` prefix named, else the horizontal axis'.)
// - The refName alias, resolved against the AXIS assembly rather than the
//   region's own. Having passed the check above they name the same assembly,
//   and the axis's is the one the view has already waited on, so it is the one
//   that can actually answer. An assembly whose aliases have not loaded — which
//   a bookmark on some unrelated one can name — answers with the input rather
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

// stripDefault baselines: a snapshot omits these unless the user changed them
// (exported so a launcher building a DotplotView snapshot can size its initial
// bpPerPx against the height the view will actually come up at)
export const defaultHeight = 600
// Exported because the settings menu's slider rows carry a reset-to-default
// button, and a default spelled twice is a reset that silently stops agreeing
// with the property it resets.
export const DEFAULT_LINE_WIDTH = 2.5
export const DEFAULT_ALPHA = 1
export const DEFAULT_MIN_ALIGNMENT_LENGTH = 0
export const DEFAULT_MIN_IDENTITY = 0

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
           * the height of the plot in pixels
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
          lineWidth: types.stripDefault(types.number, DEFAULT_LINE_WIDTH),
          /**
           * #property
           * Plot-wide alpha applied to every point. View-level for the same
           * reason lineWidth is: the only control is view-level, so storing it
           * per display meant a track shown after the slider moved rendered at
           * the default while the slider said otherwise.
           */
          alpha: types.stripDefault(types.number, DEFAULT_ALPHA),
          /**
           * #property
           * Hide alignments shorter than this many bp. Enforced per feature in
           * buildLineSegments. Cuts whole-genome hairball noise. View-level, see
           * alpha.
           */
          minAlignmentLength: types.stripDefault(
            types.number,
            DEFAULT_MIN_ALIGNMENT_LENGTH,
          ),
          /**
           * #property
           * Hide alignments whose sequence identity is below this fraction
           * (0-1), enforced per feature in buildLineSegments beside
           * minAlignmentLength. A feature carrying no identity at all is kept
           * at every threshold — the alternative blanks a plot whose adapter
           * simply never reported one. View-level, see alpha.
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
           * used for initializing the view from a session snapshot
           */
          init: types.frozen<DotplotViewCommands | undefined>(),
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
        /**
         * #action
         * Drop the import form's pending selections once they have been applied.
         * Left in place they outlive the form: "return to import form" would
         * reopen on a finished upload from the previous launch, and a pair whose
         * assemblies no longer match it reads as an unfinished upload and
         * disables Launch for something this visit never started.
         */
        clearImportFormSyntenyTracks() {
          self.importFormSyntenyTrackSelections.clear()
        },
      }))
      .views(self => ({
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
        // refName -> the string the axis actually prints for it. Off
        // displayedRegions rather than off the visible blocks so panning and
        // zooming can't change a label, and declared here — ahead of the borders
        // — so `axisBorderPx` is HANDED the map it sizes the margin against
        // instead of deriving its own copy from the same input. The two agreeing
        // is what keeps a label from being clipped by a margin measured off a
        // different string, and it is now one computation rather than an
        // invariant between two.
        get hRefNameLabels() {
          return truncateRefNames(
            self.hview.displayedRegions.map(r => r.refName),
          )
        },
        get vRefNameLabels() {
          return truncateRefNames(
            self.vview.displayedRegions.map(r => r.refName),
          )
        },
        /**
         * #getter
         * Left margin: fits the vertical (vview) axis labels. Derived purely
         * from that axis's regions + zoom — never from viewWidth — so it can't
         * feed back through viewWidth = width - borderX into a render loop.
         */
        get borderX() {
          return axisBorderPx(
            self.vview.displayedRegions,
            self.vview.bpPerPx,
            this.vRefNameLabels,
          )
        },
        /**
         * #getter
         * Bottom margin: fits the horizontal (hview) axis labels. See borderX.
         */
        get borderY() {
          return axisBorderPx(
            self.hview.displayedRegions,
            self.hview.bpPerPx,
            this.hRefNameLabels,
          )
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
        /**
         * #getter
         * A dotplot plots one assembly against another, so anything but two
         * names here cannot lay out. `initializeDisplayedRegions` walks the two
         * axes in step with this array, so one name leaves the other axis with
         * no regions and `initialized` never comes true — the view sat on its
         * spinner saying "Loading" forever, with the assembly it was supposedly
         * waiting for already loaded. Extra names are the same statement in the
         * other direction: nothing reads past the second, so a third assembly is
         * silently not plotted.
         *
         * Only reachable from a hand-authored snapshot — `setAssemblyNames`
         * writes both, and `applyInit` already rejects an init naming one — which
         * is exactly the case that needs telling. Zero names is not an error: it
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
         *
         * Read by `settled`, deliberately **not** by `showLoading` — a plot
         * whose axes are up is worth showing while the rest lands. LGV's
         * equivalent is `awaitingInitNavigation`, a narrower thing (init set
         * and nothing on screen at all) that it does fold into `showLoading`;
         * it used to share this name, and the two disagree exactly where a
         * reader would assume they agree.
         */
        get initPending() {
          return !!self.init
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
              : (self.init?.views.map(v => v.assembly) ?? []),
          )
        },
        /**
         * #getter
         * Label for the generic loading spinner, naming the assembly file being
         * downloaded when the assembly load is what the wait is. The
         * auto-diagonalize wait is a separate render branch
         * (DiagonalizeLoadingScreen), so this only covers the plain "view not
         * ready" case.
         */
        get loadingMessage() {
          return this.showLoading
            ? this.loadingAssembly?.statusMessage || 'Loading'
            : undefined
        },
        /**
         * #getter
         * Determinate fraction for the spinner's bar, when the assembly load
         * reports one
         */
        get loadingProgress() {
          return this.showLoading
            ? this.loadingAssembly?.statusProgress
            : undefined
        },
        /**
         * #getter
         * The URL the assembly load is currently fetching, when the phase named
         * one. Only the stalled-load notice reads it — see `ViewLoadingScreen`.
         */
        get loadingSource() {
          return this.showLoading
            ? this.loadingAssembly?.statusSource
            : undefined
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
         * The h ticks that land on the drawn axis, thinned to what can be read
         * and flagged for labelling. `hTickPositions` comes from staticBlocks,
         * which extend a screen past the viewport in both directions; clipping
         * here rather than per element in the axis component keeps the SVG
         * export from carrying a group per invisible tick, and is cached for
         * the same reason hblockLabelKeysToHide is.
         *
         * Clip before thinning: spacing is a question about what is on screen,
         * and offscreen ticks would otherwise claim slots from visible ones.
         */
        get visibleHTickPositions() {
          return thinTickPositions(
            this.hTickPositions.filter(
              t => t.alongPx > 0 && t.alongPx < this.viewWidth,
            ),
          )
        },
        /**
         * #getter
         * The v ticks that land on the drawn axis. See visibleHTickPositions.
         */
        get visibleVTickPositions() {
          return thinTickPositions(
            this.vTickPositions.filter(
              t => t.alongPx > 0 && t.alongPx < this.viewHeight,
            ),
          )
        },
        /**
         * #getter
         * Region-boundary lines for the horizontal axis, in plot px. Computed
         * here rather than in the grid component so the screen and the SVG
         * export cannot drift apart, and so the gridlines below can see which
         * pixels a boundary already owns.
         */
        get hRegionLines() {
          const { offsetPx, displayedRegionsTotalPx } = self.hview
          return regionBoundaryLines(
            self.hview.dynamicBlocks.contentBlocks,
            b => b.offsetPx - offsetPx,
            displayedRegionsTotalPx - offsetPx,
            this.viewWidth,
          )
        },
        /**
         * #getter
         * See hRegionLines. The vertical axis lays out bottom-up, so its block
         * offsets are mirrored into screen y here — the same mirror its ticks
         * and labels take.
         */
        get vRegionLines() {
          const { offsetPx, displayedRegionsTotalPx } = self.vview
          return regionBoundaryLines(
            self.vview.dynamicBlocks.contentBlocks,
            b => this.viewHeight - (b.offsetPx - offsetPx),
            this.viewHeight - (displayedRegionsTotalPx - offsetPx),
            this.viewHeight,
          )
        },
        /**
         * #getter
         * The faint coordinate lines the horizontal ruler casts across the
         * plot, in its two weights. Empty when the setting is off, and empty
         * with it on whenever this axis could not number itself anywhere —
         * which at whole-genome zoom is the usual case. All or nothing per
         * axis, never per chromosome; see `tickLines`.
         */
        get hGridlines() {
          return self.showGridlines
            ? tickLines(this.visibleHTickPositions, px => px, this.hRegionLines)
            : []
        },
        /**
         * #getter
         * See hGridlines.
         */
        get vGridlines() {
          return self.showGridlines
            ? tickLines(
                this.visibleVTickPositions,
                px => this.viewHeight - px,
                this.vRegionLines,
              )
            : []
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
            this.hGridlines.length === 0 &&
            this.vGridlines.length === 0
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
         * `axisMaxBpPerPx`), which is what keeps every route to a zoom — the
         * buttons, the wheel, box-zoom, `showAllRegions` — clamping against the
         * same ceiling.
         */
        get sharedFitBpPerPx() {
          return Math.max(self.hview.fitBpPerPx, self.vview.fitBpPerPx)
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
         * Every track that can take a palette slot, in paint order, paired with
         * whatever color the user pinned on it.
         */
        colorableTrackConfigs() {
          return self.tracks.map((t: ComparativeTrackModel) => {
            const { trackId, name } = t.configuration
            return { trackId, name }
          })
        },
        /**
         * #method
         * The numeric columns the overlaid tracks declare, so the palette menu can
         * offer one mode per measurement without any of them being a named mode.
         * `attributeColumns` is the ortholog-table adapter's slot; a track whose
         * adapter has no such slot contributes nothing.
         */
        colorableAttributeNames() {
          // Annotated for the reason ComparativeTrackModel documents: this array
          // is `any`, which switched off checking on the getConf call below
          // until the shape was named.
          return self.tracks.flatMap((t: ComparativeTrackModel) => {
            const declared = getConf(t, ['adapter', 'attributeColumns']) as
              | string[]
              | undefined
            return declared ?? []
          })
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
          // Named rather than spread: `plotTransform`'s `viewHeight` is not a
          // render input. A backend gets the plot height through `resize`, and
          // shipping it twice in one frame is two numbers to disagree.
          const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv } =
            this.plotTransform
          return {
            viewBpH,
            viewBpV,
            bpPerPxHInv,
            bpPerPxVInv,
            lineWidth: self.lineWidth,
            alpha: self.alpha,
            displayKeys: [...this.geometryByDisplayKey.keys()],
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
          const transform = this.plotTransform
          // Half the drawn line width, so anything painted under the cursor
          // hits, plus a fixed slack for the sub-pixel dots a whole-genome plot
          // is mostly made of — they are a couple of px across at most, and
          // without slack they would be unhoverable.
          const tolerancePx = self.lineWidth / 2 + HOVER_SLACK_PX
          let best: DotplotPlotPickHit | undefined
          for (const display of this.dotplotDisplays) {
            const { instanceData } = display
            if (!instanceData) {
              continue
            }
            const hit = pickDotplotFeature({
              data: instanceData,
              x,
              y,
              transform,
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
          // autorun for every track on the canvas, so the installer diffs by
          // reference: only the track that actually changed re-uploads.
          installKeyedLifecycle<DotplotGeometryData, DotplotRenderingBackend>(
            self,
            backend,
            {
              entries: () => self.geometryByDisplayKey,
              render: b => {
                b.resize(self.viewWidth, self.viewHeight)
                b.render(self.dotplotRenderState)
                return true
              },
            },
          )
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
          // An init that never finished applying still counts towards
          // hasSomethingToShow, so leaving it here means "return to import form"
          // doesn't. Dropping the request is what returning to the form means.
          self.init = undefined
          // Highlights are (assemblyName, refName, start, end) against the pair
          // being cleared. Kept, they reappear over whatever pair is picked
          // next whenever it reuses one of these assemblies — and the chips
          // offer to dismiss a region the plot no longer shows.
          self.setHighlight([])
          // The banner over the form describes the submit that failed, and this
          // is the one route to the form that isn't a submit — so it was the one
          // that left an error standing over a form with nothing wrong with it,
          // until the next Launch cleared it. `LinearComparativeView.clearView`
          // already does this.
          self.volatileError = undefined
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
        setInit(init?: DotplotViewCommands) {
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
         * handlers pass around, so the vertical flip through `viewHeight`
         * happens here — the way `getCoords` already does it — rather than at
         * the call site against a separately measured element height.
         *
         * Multiplying both axes by one factor is what makes wheel zoom
         * ratio-preserving, so the aspect lock never has to correct it. One
         * action, for the reason `scrollXY` documents.
         */
        zoomAt(factor: number, [x, y]: Coord) {
          self.hview.zoomTo(self.hview.bpPerPx * factor, x)
          self.vview.zoomTo(self.vview.bpPerPx * factor, self.viewHeight - y)
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
          const { saveSvgAsImage } =
            await import('@jbrowse/core/svg/saveSvgAsImage')
          await saveSvgAsImage(html, opts)
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
          const r = axisHighlightRegion(self, self.assemblyNames[0], region)
          return r ? getLayoutHighlightCoords(self.hview, r) : undefined
        },
        /**
         * #method
         * Map a highlight/bookmark region to {top, height} px on the vertical
         * axis. The vview lays out bottom-to-top, so the band is y-flipped into
         * screen space. Returns undefined when the region isn't on vview's
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
          ]
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
