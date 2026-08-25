import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { legendIsReadable } from '@jbrowse/core/ui'
import { showLegendCheckboxItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin, {
  fetchAllRegions,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  clusteringMenuItem,
  computeClusterHierarchy,
  loadedRegionIndexAt,
  reconcileLayout,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowLabelsCarryText,
  setupRowSortAutorun,
  setupRunClusteringAutorun,
  setupTreeDrawingAutorun,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
} from '@jbrowse/tree-sidebar'
import { makeCrossHatchItem } from '@jbrowse/wiggle-core'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { compareStructural, computed } from 'mobx'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import { getRowHeight, isOverlayMode } from '../shared/wiggleComponentUtils.ts'
import { wiggleDisplayViews } from '../shared/wiggleDisplayViews.ts'
import {
  makeGroupedRenderingTypeSubMenu,
  makeLineWidthMenuItems,
  makePointSizeMenuItems,
  makeResolutionSubMenu,
  makeWiggleScoreSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import { MULTI_WIGGLE_RENDERING_GROUPS } from '../util.ts'
import { buildLegendItems } from './legendItems.ts'
import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
import {
  buildSources,
  rowColorMode,
  sourcesFromRegionData,
} from './sourcesLogic.ts'

import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { Source } from '../util.ts'
import type { MultiWiggleContextHit } from './components/findHit.ts'
import type { MultiWiggleDisplayModel } from './components/multiWiggleDisplayTypes.ts'
import type { MultiLinearWiggleDisplayConfigModel } from './configSchema.ts'
import type { ContextMenuAnchor, LegendItem, MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { RowSortSpec } from '@jbrowse/tree-sidebar'
import type { WiggleRenderingBackend } from '@jbrowse/wiggle-core'

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog.tsx'),
)

/**
 * #stateModel MultiLinearWiggleDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * Wiggle display overlaying/stacking multiple quantitative subtracks in one
 * area, with optional clustering and a tree sidebar.
 *
 * #example
 * The two row-ordering triggers are display *properties*, not config slots, so
 * they go on the display node in a session — `defaultSession` here, and the
 * same shape a `session=spec-` link carries. Written on the track config's own
 * `displays` entry they would be dropped as unknown slots.
 *
 * `runClustering` is a transient declarative launch spec, the same idea as
 * `LinearGenomeView`'s `init`: it runs the real "Cluster columns" RPC once
 * automatically (no dialog) as soon as subtrack data is available, then clears
 * itself so a saved session never re-triggers it. `sortRowsBy` is the other
 * one, and the declarative form of the right-click "Sort rows by score here" —
 * where clustering orders rows by the whole region in view, this ranks them by
 * the score each carries at one base, so a cohort can open already ranked at a
 * candidate locus with the surrounding context still on screen. Use one or the
 * other; whichever applies last owns the row order.
 * ```js
 * defaultSession: {
 *   name: 'Copy number at CCL3L1',
 *   views: [
 *     {
 *       type: 'LinearGenomeView',
 *       init: {
 *         assembly: 'hg38',
 *         loc: 'chr17:36,080,000-36,270,000',
 *         tracks: [
 *           {
 *             trackId: 'pur_copynumber_1000g',
 *             type: 'MultiLinearWiggleDisplay',
 *             sortRowsBy: { refName: 'chr17', pos: 36180000 },
 *           },
 *         ],
 *       },
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: MultiLinearWiggleDisplayConfigModel,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleCommonMixin(),
      LegendMixin(),
      TreeSidebarMixin<Source>(),
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        // `runClustering` / `clusterRegion` are TreeSidebarMixin's. The one
        // thing specific to this display: naming a `clusterRegion` also moves
        // where the sampling density comes from, since the matrix columns are
        // pixel bins over the span rather than over the view's zoom
        // (clusterScoreMatrixArgs).
        /**
         * #property
         * Transient declarative launch spec, the same idea as `runClustering`:
         * set `{refName, pos}` to rank the rows once by the score each subtrack
         * carries at that base — the session-expressible form of the right-click
         * "Sort rows by score here". `setupRowSortAutorun` applies it once the
         * region containing it has loaded and then clears it, so the row order
         * persists but a saved session never re-sorts.
         *
         * This is what lets a figure show a cohort ranked at a candidate CNV:
         * clustering orders rows by the whole region in view, `layout` states an
         * order outright, and only this one says "rank them here".
         */
        sortRowsBy: types.maybe(types.frozen<RowSortSpec>()),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Where the right-click menu opens (viewport coords) plus the genomic
       * column it was opened over, as one value — the menu's open-ness and the
       * position its items act on can't disagree. Undefined = closed.
       */
      contextMenuInfo: undefined as
        | (ContextMenuAnchor & MultiWiggleContextHit)
        | undefined,
    }))
    .views(self => ({
      // overrides WiggleScoreConfigMixin's `false` base, which is what its
      // showCrossHatches / effectiveSummaryScoreMode getters key on
      get isDensityMode() {
        return self.renderingType === 'multirowdensity'
      },

      get isOverlay() {
        return isOverlayMode(self.renderingType)
      },
    }))
    .views(self => {
      // A plain getter would hand out a fresh array on every region arrival,
      // and this list reaches `gpuProps()` — whose identity re-encodes every
      // loaded region. The structural comparer keeps the previous array while
      // the row metadata is unchanged, which is what a refetch of the same
      // track produces.
      const sources = computed(() => sourcesFromRegionData(self.rpcDataMap), {
        equals: compareStructural,
      })
      return {
        // Raw adapter sources, discovered from the loaded regions in adapter
        // order. Used as input to clustering: cluster RPC reads `name` and
        // `buildClusteredLayout` maps order indices into this list.
        get sourcesWithoutLayout(): Source[] {
          return sources.get()
        },

        // Adapter rows merged with the user's saved arrangement, in layout order —
        // no subtree filter and no palette synthesis, so the edit dialog only
        // persists colors the user actually chose. `reconcileLayout` owns the
        // membership rules (drop layout entries the adapter no longer reports,
        // append subtracks the layout never saw) and is shared with every other
        // multi-row display, so this display has nothing of its own to keep in
        // step. It used to, and that was the whole job of the wrapper this
        // replaced: aliasing `source` onto `name` before handing the rows over.
        get editableSources(): Source[] {
          return reconcileLayout(this.sourcesWithoutLayout, self.layout)
        },
      }
    })
    .views(self => ({
      get sources(): Source[] {
        return buildSources(
          self.editableSources,
          self.subtreeFilter,
          self.isOverlay,
          self.isDensityMode,
        )
      },
    }))
    .views(self => ({
      get numSources() {
        return self.sources.length
      },

      // Restrict the shared autoscale domain to the currently-visible sources
      // (a subtree filter hides some), so hidden sources don't stretch the axis.
      get autoscaleSourceNames() {
        return new Set(self.sources.map(s => s.name))
      },

      /**
       * #getter
       * The color key, as the shared `LegendSpec` items every other display
       * publishes — one row per (group, color) pair, colors resolved. The
       * on-screen `FloatingLegend`, the SVG export and `overlayLegendApplies`
       * all read this one list, so what is drawn and what was counted before
       * deciding to draw cannot disagree. See `buildLegendItems`.
       */
      get legendItems(): LegendItem[] {
        return buildLegendItems(
          self.sources,
          rowColorMode(self.isOverlay, self.isDensityMode),
          self.posColor,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved per-row height. This display is always fit-to-display-height —
       * there is no pinned-height setting and so no `rowHeight` sentinel to
       * resolve — but it carries the same name every row display exposes its
       * resolved height under (see agent-docs/reference/ROW_HEIGHT_AND_FIT),
       * which is also what tree-sidebar's `TreeDrawingModel` reads.
       */
      get effectiveRowHeight() {
        return self.isOverlay
          ? self.height
          : getRowHeight(self.height, self.numSources)
      },

      /**
       * #getter
       * Rows actually drawn: overlay collapses every source onto one shared
       * plot. Read by the render state and by everything that repeats itself
       * per row (scalebars, cross hatches), so they can't disagree about how
       * many rows exist.
       */
      get numRows() {
        return self.isOverlay ? 1 : self.numSources
      },
    }))
    .views(self => ({
      get rowHeightTooSmallForScalebar() {
        return self.effectiveRowHeight < 70
      },

      /**
       * #getter
       * Rows stacked edge-to-edge over the full height, no scalebar-label inset
       * (unlike single-wiggle): the axis is drawn per row and maximum density is
       * the point. Each row's own box is what the ticks are laid out in.
       */
      get plotGeometry() {
        return {
          yTop: 0,
          plotHeight: self.height,
          numRows: self.numRows,
          tickHeight: self.effectiveRowHeight,
        }
      },

      /**
       * #getter
       * Only density spends color on the score, and only when every row shares
       * the one ramp: a source with its own color is drawn on its own pos side
       * (see buildSourceRenderData), so a single bar would describe none of
       * them.
       */
      get scoreRampApplies() {
        return self.isDensityMode && self.sources.every(s => !s.color)
      },
    }))
    .views(self => wiggleDisplayViews(self))
    .views(self => ({
      /**
       * #method
       * summaryScoreMode rides along so an adapter can skip work it cannot be
       * asked to show. A store that keeps min/max beside each mean holds three
       * arrays per level, and `avg` — the default — draws none of them, so
       * sending the mode turns the common case back into one read per level
       * instead of three, and drops the two `processFeaturesFromArrays`
       * allocates per source per region for values it then discards.
       *
       * The raw slot, deliberately, and NOT effectiveSummaryScoreMode. The
       * effective one would be tighter -- density resolves whiskers to avg, so
       * it could skip the read there too -- but it changes when the rendering
       * type changes, and anything in rpcProps invalidates the fetch. That
       * would make switching to density discard the data and re-download it,
       * on every multi-wiggle track, including the ones whose adapter gets its
       * summary for free and gains nothing here. Over-fetching in
       * density-with-whiskers is the cheaper mistake.
       *
       * In rpcProps rather than gpuProps because it changes what is fetched:
       * switching the slot to max has to refetch, since a max nobody read
       * cannot be drawn.
       */
      rpcProps() {
        return {
          ...self.sharedRpcProps(),
          summaryScoreMode: self.summaryScoreMode,
        }
      },

      /**
       * #method
       * The row list is this display's own: the encoder places each payload
       * source by its position here, so a filter or a reorder re-uploads
       * bytes already in hand.
       */
      gpuProps() {
        return {
          ...self.sharedGpuProps(),
          sources: self.sources,
        }
      },
    }))
    .views(self => ({
      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },

      /**
       * #getter
       * Whether the source color key applies at all. Gates the menu checkbox,
       * which has to stay visible while the legend is toggled off.
       *
       * Four questions in order, each with its own guard below:
       *
       * 1. **Is there anything to key?** One source names itself by the track
       *    name.
       * 2. **Does anything ELSE on the frame name the colors?** Overlay
       *    collapses every source onto one plot, so nothing does and a key is
       *    the only identification there has ever been. A multi-row track names
       *    its rows beside them — but only while they carry text
       *    (`rowLabelsCarryText`, asked of the drawing side rather than
       *    restated) AND is drawing them at all — `showRowLabels` off means
       *    nothing beside the rows names anything, so the key is once again the
       *    only identification there is. Below that `SvgRowLabels` drops to an
       *    unlabelled swatch,
       *    and a per-cell density track at 0.14 px a row is then a stripe of
       *    nine colors with nothing saying what any of them is; that is the case
       *    this was widened for ("we need to make it so density can show legend
       *    also ideally because the left side labels are too small to see").
       *    `showTree` is deliberately no part of this: the labels are
       *    `MultiWiggleSvgScales`' own and draw whether or not a dendrogram
       *    does, so reading it here drew a key restating labels still on screen.
       * 3. **Is the key worth its rows?** Short enough to read, and made of
       *    more than one color — both `legendIsReadable`, shared with the other
       *    display that has to decide. Asked of `legendItems`, the very list
       *    that gets drawn, so a key can't be counted in one form and rendered
       *    in another.
       */
      get overlayLegendApplies() {
        if (self.numSources < 2) {
          return false
        }
        if (self.isOverlay) {
          return true
        }
        if (self.showRowLabels && rowLabelsCarryText(self.effectiveRowHeight)) {
          return false
        }
        return legendIsReadable(self.legendItems)
      },

      /**
       * #getter
       * Offset the track label above the visualization so the stacked
       * per-source rows aren't hidden behind an overlapping label.
       */
      get prefersOffset() {
        return true
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the overlay color key actually draws. The on-screen overlay and
       * the SVG export both read this, so a dismissed legend can't linger in
       * the export.
       */
      get hasOverlayLegend(): boolean {
        return self.overlayLegendApplies && self.showLegend
      },

      /**
       * #getter
       * The positioned dendrogram, or undefined in an overlay mode: overlay
       * collapses every source onto one row, so a tree spreading its leaves over
       * the full height would align to nothing. This is the single gate — the
       * on-screen sidebar, the SVG export, `spatialIndex` (subtree hover), and
       * `treeSidebarRightEdge` (the tooltip/crosshair dead zone the sidebar
       * reserves) all read it, so none of them can keep drawing or reserving
       * space on their own. A subtree filter set in a row mode still applies and
       * is still clearable from the track menu and MultiWiggleHint.
       */
      get hierarchy() {
        return self.isOverlay
          ? undefined
          : computeClusterHierarchy(
              self.root,
              self.sources,
              self.height,
              self.treeAreaWidth,
              self.showBranchLength,
            )
      },
    }))
    .views(self => ({
      get spatialIndex() {
        return buildSpatialIndex(self.hierarchy)
      },
    }))
    .actions(self => ({
      startRenderingBackend(backend: WiggleRenderingBackend) {
        installWiggleRenderingBackend(self, backend)
      },

      setShowRowSeparators(arg: boolean) {
        setConf(self, 'showRowSeparators', arg)
      },

      /**
       * #action
       * Rank the rows by each source's score at one genomic base. Reads the
       * region data already in hand — no refetch, no RPC — and writes the
       * order through `layout`, the same channel clustering and the
       * arrangement dialog write, so "Reset row order" undoes all three.
       *
       * Named by coordinate rather than by loaded-region index because both
       * entry points are: the right-click hit resolves to one, and a session's
       * `sortRowsBy` carries one across a reload. The region is looked up
       * here, and a position no loaded region covers is left alone rather than
       * sorted against nothing (which would rank every row equally and read as
       * the sort having silently done nothing).
       */
      sortRowsByScoreAt(refName: string, pos: number) {
        const index = loadedRegionIndexAt(self.loadedRegions, refName, pos)
        const data =
          index === undefined ? undefined : self.rpcDataMap.get(index)
        // Fewer than two rows has nothing to order, and the write is not a
        // harmless no-op: `setLayout` drops the cluster tree whenever the row
        // set changes, so an adapter that reported no sources for the loaded
        // region would trade a dendrogram for an empty layout. The
        // right-click item is already gated on the same count; this is the
        // declarative `sortRowsBy` entry point, which is not, and the same
        // guard the multi-row feature display's twin carries.
        if (data && self.editableSources.length > 1) {
          // editableSources, not `sources`: layout-merged (so a user's
          // colors survive the reorder) and unfiltered by the subtree, so a
          // focused clade doesn't persist itself as the whole row order and
          // drop everything it was hiding.
          self.setLayout(sortSourcesByScoreAt(self.editableSources, data, pos))
        }
      },

      /**
       * #action
       * Trigger (or clear) a one-shot declarative row sort; consumed and reset
       * by `setupRowSortAutorun`. The right-click menu calls
       * `sortRowsByScoreAt` directly (instant, the data is already loaded);
       * this prop is the session-level entry point.
       */
      setSortRowsBy(arg?: RowSortSpec) {
        self.sortRowsBy = arg
      },

      /**
       * #action
       */
      openContextMenu(info: ContextMenuAnchor & MultiWiggleContextHit) {
        self.contextMenuInfo = info
      },

      /**
       * #action
       */
      closeContextMenu() {
        self.contextMenuInfo = undefined
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const view = self.host
        // Always fetch the full (unfiltered, un-reordered) source list. A
        // subtree filter or reorder only affects client-side rendering
        // (gpuProps re-upload) and the autoscale domain — never what's
        // fetched — so every region's payload stays complete and consistent.
        // Filtering here instead would leave regions fetched under a stale
        // filter missing sources when the filter is later widened.
        const { adapterConfig, sourcesWithoutLayout } = self
        const { bpPerPx } = view
        // Batched, not per-region: every subtrack adapter gets all the
        // visible regions in one call, so a whole-genome or
        // collapsed-intron view coalesces each file's on-disk blocks into
        // one pass instead of one pass per region per subtrack. The
        // regions land together rather than painting progressively.
        return fetchAllRegions(self, needed, {
          call: (regions, ctx) =>
            ctx.callRpc('RenderMultiWiggleData', {
              adapterConfig,
              regions,
              sources: sourcesWithoutLayout,
              ...self.rpcProps(),
              bpPerPx,
            }),
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
          },
        })
      },

      // No superAfterAttach() call: the fork auto-chains hooks, so
      // MultiRegionDisplayMixin's afterAttach already runs (see
      // afterAttachAutoChain.test.ts). An explicit call would double-install
      // its fetch autoruns.
      afterAttach() {
        // Both are mobx-only glue and the barrel is a static import above, so
        // they install synchronously. The tree drawing one came through
        // `await import('@jbrowse/tree-sidebar')` until it was measured: a
        // dynamic import of a barrel this file already imports statically
        // deferred one 4KB module and dragged the rest of the barrel into an
        // async chunk, +69KB. See packages/tree-sidebar/CLAUDE.md.
        setupRowSortAutorun(self, {
          name: 'MultiWiggleSortRows',
          sortRows: (refName, pos) => {
            self.sortRowsByScoreAt(refName, pos)
          },
        })
        setupTreeDrawingAutorun(self)

        // The "Cluster columns" flavor of the shared declarative-clustering
        // autorun: fires once on `runClustering: true` and runs the real
        // score-matrix RPC over the `clusterRegion` locus if the session
        // named one and the visible blocks if not. Refuses a single row,
        // matching the track menu's gate.
        //
        // Installed synchronously; the heavy half is code-split inside `run`,
        // so the clustering module loads when a run starts rather than on
        // every attach.
        setupRunClusteringAutorun(self, {
          name: 'AutoRunMultiWiggleClustering',
          ready: () => self.sourcesWithoutLayout.length > 1,
          run: async args => {
            const [{ runWiggleClustering }, { DEFAULT_SAMPLES_PER_PIXEL }] =
              await Promise.all([
                import('./runWiggleClustering.ts'),
                import('./components/clusterOptions.ts'),
              ])
            await runWiggleClustering({
              model: self,
              // the default density, not the dialog's persisted preference —
              // see DEFAULT_SAMPLES_PER_PIXEL for why this path ignores it
              samplesPerPixel: DEFAULT_SAMPLES_PER_PIXEL,
              ...args,
            })
          },
        })
      },
    }))
    .views(self => ({
      trackMenuItems() {
        const showItems: MenuItem[] = [
          // row separators and row labels only render in multi-row modes, not
          // overlays — an overlay is one row and names itself by the track name
          ...(self.isOverlay
            ? []
            : [showRowSeparatorsMenuItem(self), showRowLabelsMenuItem(self)]),
          // the color key only renders as an overlay of >1 source
          ...(self.overlayLegendApplies
            ? [
                showLegendCheckboxItem(
                  self.showLegend,
                  () => {
                    self.setShowLegend(!self.showLegend)
                  },
                  { pin: self.showLegendDisplayTypeDefault },
                ),
              ]
            : []),
          // density maps score to color, so score-axis cross hatches are
          // meaningless there (`showCrossHatches` enforces the same on the
          // drawing side)
          ...(self.isDensityMode ? [] : [makeCrossHatchItem(self)]),
        ]
        return [
          makeGroupedRenderingTypeSubMenu(self, MULTI_WIGGLE_RENDERING_GROUPS),
          clusteringMenuItem(
            self,
            {
              label: 'Cluster rows by score...',
              // clustering reorders rows, so it needs rows to reorder and at
              // least two of them — the dialog would otherwise open only to
              // report the same thing after the user clicks Run
              disabled: self.isOverlay || self.sourcesWithoutLayout.length < 2,
              disabledHelpText: self.isOverlay
                ? 'Only available for multi-row rendering types'
                : 'Needs at least two subtracks to cluster',
              onClick: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  WiggleClusterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              // overlay draws no dendrogram (see the `hierarchy` getter), so
              // neither tree-display control has a subject there
              treeApplies: !self.isOverlay,
            },
          ),
          // top-level rather than inside the Clustering submenu, where it used
          // to sit as "Clear clustering" — see resetRowOrderMenuItems
          ...resetRowOrderMenuItems(self),
          ...makeResolutionSubMenu(self),
          makeWiggleScoreSubMenu(self),
          ...makeShowSubMenu(showItems),
          // point size / line width are top-level submenus, each present only in
          // its respective scatter / line rendering
          ...makePointSizeMenuItems(self),
          ...makeLineWidthMenuItems(self),
          rowArrangementMenuItem({
            ready: !!self.sourcesWithoutLayout.length,
            onOpen: () => {
              getDialogHost(self).queueDialog(handleClose => [
                SetColorDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          }),
        ]
      },

      /**
       * #method
       * Right-click menu, built from the column the click landed on. The
       * position is captured here rather than read inside the onClick, because
       * `closeContextMenu` runs first when an item is clicked.
       */
      contextMenuItems(): MenuItem[] {
        const info = self.contextMenuInfo
        if (!info) {
          return []
        }
        return [
          // needs rows to reorder, and at least two of them: overlay collapses
          // every source onto one plot, so there is no row axis for a ranking
          // to be read down. `editableSources`, the list the sort itself
          // orders — a clade focused to one row still has rows to sort
          ...(!self.isOverlay && self.editableSources.length > 1
            ? [
                {
                  label: 'Sort rows by score here',
                  icon: SwapVertIcon,
                  onClick: () => {
                    self.sortRowsByScoreAt(info.refName, info.bp)
                  },
                },
              ]
            : []),
          // stays in an overlay mode, where the sort doesn't: an order set in a
          // row mode is still what that display comes back to
          ...resetRowOrderMenuItems(self),
        ]
      },
    }))
    .actions(self => ({
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
}

export type MultiLinearWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearWiggleDisplayModel =
  Instance<MultiLinearWiggleDisplayStateModel>

// See SatisfiesComponentContract for why this guard exists and why it's spelled
// out in each model file rather than centralized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract = SatisfiesComponentContract<
  MultiWiggleDisplayModel,
  MultiLinearWiggleDisplayModel
>
