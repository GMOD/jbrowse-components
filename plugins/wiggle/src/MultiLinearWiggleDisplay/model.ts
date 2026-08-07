import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  checkboxItem,
  showLegendCheckboxItem,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchAllRegions,
} from '@jbrowse/plugin-linear-genome-view'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  clusteringMenuItem,
  reconcileLayout,
  computeClusterHierarchy,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  setupRowSortAutorun,
} from '@jbrowse/tree-sidebar'
import { computeYTicks, makeCrossHatchItem } from '@jbrowse/wiggle-core'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import {
  getRowHeight,
  isOverlayMode,
  makeWiggleRenderState,
} from '../shared/wiggleComponentUtils.ts'
import {
  makeGroupedRenderingTypeSubMenu,
  makeLineWidthMenuItems,
  makePointSizeMenuItems,
  makeResolutionSubMenu,
  makeWiggleScoreSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import { MULTI_WIGGLE_RENDERING_GROUPS } from '../util.ts'
import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
import { buildSources } from './sourcesLogic.ts'

import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { Source, SourceInfo, WiggleDataResult } from '../util.ts'
import type { MultiWiggleContextHit } from './components/findHit.ts'
import type { MultiWiggleDisplayModel } from './components/multiWiggleDisplayTypes.ts'
import type { MultiLinearWiggleDisplayConfigModel } from './configSchema.ts'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
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
      TreeSidebarMixin<Source>(),
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        // Transient declarative launch spec, same idea as LinearGenomeView's
        // `init`: session/config sets this to run the real "Cluster columns"
        // RPC once automatically (no dialog), applied by
        // getWiggleClusterAutorun and cleared afterwards so a saved session
        // never re-triggers it.
        runClustering: types.maybe(types.boolean),
        // Where that run reads from, as a locstring (whitespace-separated for
        // several). Clustering is region-scoped, so running it over the visible
        // window feeds the estimator whatever is on screen; naming the locus
        // instead lets a session cluster on the signal and show it against its
        // context. Cleared with `runClustering`. The sampling density then
        // comes from the named span rather than from the view's zoom, since the
        // columns are pixel bins (clusterScoreMatrixArgs).
        clusterRegion: types.maybe(types.string),
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
      sourcesVolatile: [] as SourceInfo[],
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
    .views(self => ({
      // Raw adapter sources, in adapter order. Used as input to clustering:
      // cluster RPC reads `name` and `buildClusteredLayout` maps order
      // indices into this list.
      get sourcesWithoutLayout(): Source[] {
        return self.sourcesVolatile
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
        return reconcileLayout(self.sourcesVolatile, self.layout)
      },
    }))
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
       * The color ramp the density legend draws, or undefined when there is no
       * single ramp to describe. Only density spends color on the score, and
       * only when every row shares the one ramp: a source with its own color is
       * drawn on its own pos side (see buildSourceRenderData), so a single bar
       * would describe none of them.
       */
      get scoreRamp() {
        return self.isDensityMode && self.sources.every(s => !s.color)
          ? {
              posColor: self.posColor,
              negColor: self.negColor,
              pivot: self.bicolorPivot,
              gradientId: `score-ramp-${self.id}`,
            }
          : undefined
      },

      get ticks() {
        return computeYTicks({
          height: self.effectiveRowHeight,
          domain: self.domain,
          scaleType: self.scaleType,
          minimalTicks: getConf(self, 'minimalTicks'),
          offset: 0,
        })
      },

      get renderState() {
        return makeWiggleRenderState(self, {
          width: self.canvasWidthPx,
          // Full height, no YSCALEBAR_LABEL_OFFSET inset (unlike single-wiggle):
          // rows stack edge-to-edge for maximum density. Don't "unify" with
          // LinearWiggleDisplay's inset — the divergence is intentional.
          height: self.height,
          numRows: self.numRows,
        })
      },

      // bicolorPivot is unconditional here: Multi has no global `color`
      // setting, only posColor/negColor.
      //
      // summaryScoreMode rides along so an adapter can skip work it cannot be
      // asked to show. A store that keeps min/max beside each mean holds three
      // arrays per level, and `avg` — the default — draws none of them, so
      // sending the mode turns the common case back into one read per level
      // instead of three, and drops the two `processFeaturesFromArrays`
      // allocates per source per region for values it then discards.
      //
      // The raw slot, deliberately, and NOT effectiveSummaryScoreMode. The
      // effective one would be tighter -- density resolves whiskers to avg, so
      // it could skip the read there too -- but it changes when the rendering
      // type changes, and anything in rpcProps invalidates the fetch. That
      // would make switching to density discard the data and re-download it,
      // on every multi-wiggle track, including the ones whose adapter gets its
      // summary for free and gains nothing here. Over-fetching in
      // density-with-whiskers is the cheaper mistake.
      //
      // In rpcProps rather than gpuProps because it changes what is fetched:
      // switching the slot to max has to refetch, since a max nobody read
      // cannot be drawn.
      rpcProps() {
        return {
          bicolorPivot: self.bicolorPivot,
          resolution: self.resolution,
          summaryScoreMode: self.summaryScoreMode,
        }
      },

      gpuProps() {
        return {
          sources: self.sources,
          posColor: self.posColor,
          negColor: self.negColor,
          summaryScoreMode: self.summaryScoreMode,
          renderingType: self.renderingType,
          isDensityMode: self.isDensityMode,
          bicolorPivot: self.bicolorPivot,
          maxGapMultiple: self.maxGapMultiple,
        }
      },
    }))
    .views(self => ({
      get showTree(): boolean {
        return getConf(self, 'showTree')
      },

      get showBranchLength(): boolean {
        return getConf(self, 'showBranchLength')
      },

      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },

      get showLegend(): boolean {
        return getConf(self, 'showLegend')
      },

      /**
       * #getter
       * Whether the overlay color key applies at all: one source needs no key,
       * and multi-row mode identifies sources by their sidebar row label
       * instead. Gates the menu checkbox, which has to stay visible while the
       * legend is toggled off.
       */
      get overlayLegendApplies() {
        return self.isOverlay && self.numSources > 1
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
    .actions(self => {
      const { clearDisplaySpecificData: superClearDisplaySpecificData } = self
      return {
        // sourcesVolatile is piggy-backed on each region's data — wipe it
        // whenever we wipe the data, so the next fetch's first region
        // repopulates with current adapter metadata (handles adapter
        // reconfigure / chromosome navigation).
        clearDisplaySpecificData() {
          superClearDisplaySpecificData()
          self.sourcesVolatile = []
        },
        setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
          self.rpcDataMap.set(displayedRegionIndex, data)
          // Merge (not replace-once): a multi-source adapter reports its full
          // static list in the first region, but a plain fallback adapter
          // discovers sources per region, so a source absent from the first
          // fetched region must still be appended when a later region reveals
          // it (otherwise it stays invisible forever). Appending keeps existing
          // order/layout stable.
          const seen = new Set(self.sourcesVolatile.map(s => s.name))
          const added = data.sources
            .filter(s => !seen.has(s.name))
            .map(({ name, color, labelColor, label, group, baseUri }) => ({
              name,
              color,
              labelColor,
              label,
              group,
              baseUri,
            }))
          if (added.length > 0) {
            self.sourcesVolatile = [...self.sourcesVolatile, ...added]
          }
        },

        startRenderingBackend(backend: WiggleRenderingBackend) {
          installWiggleRenderingBackend(self, backend)
        },

        setShowTree(arg: boolean) {
          setConf(self, 'showTree', arg)
        },

        setShowBranchLength(arg: boolean) {
          setConf(self, 'showBranchLength', arg)
        },

        setShowRowSeparators(arg: boolean) {
          setConf(self, 'showRowSeparators', arg)
        },

        setShowLegend(arg: boolean) {
          setConf(self, 'showLegend', arg)
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
          for (const [index, data] of self.rpcDataMap.entries()) {
            const region = self.loadedRegions.get(index)
            if (
              region?.refName === refName &&
              region.start <= pos &&
              pos < region.end
            ) {
              // editableSources, not `sources`: layout-merged (so a user's
              // colors survive the reorder) and unfiltered by the subtree, so a
              // focused clade doesn't persist itself as the whole row order and
              // drop everything it was hiding.
              self.setLayout(
                sortSourcesByScoreAt(self.editableSources, data, pos),
              )
              return
            }
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

        setRunClustering(arg?: boolean) {
          self.runClustering = arg
        },
        /**
         * #action
         */
        setClusterRegion(arg?: string) {
          self.clusterRegion = arg
        },
      }
    })
    .actions(self => {
      return {
        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          const view = self.lgv
          // Always fetch the full (unfiltered, un-reordered) source list. A
          // subtree filter or reorder only affects client-side rendering
          // (gpuProps re-upload) and the autoscale domain — never what's
          // fetched — so every region's payload stays complete and consistent.
          // Filtering here instead would leave regions fetched under a stale
          // filter missing sources when the filter is later widened.
          const { adapterConfig, sourcesWithoutLayout } = self
          const { bpPerPx } = view
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          // Batched, not per-region: every subtrack adapter gets all the
          // visible regions in one call, so a whole-genome or
          // collapsed-intron view coalesces each file's on-disk blocks into
          // one pass instead of one pass per region per subtrack. The
          // regions land together rather than painting progressively.
          return fetchAllRegions(self, needed, {
            call: (regions, ctx) =>
              rpcManager.call(sessionId, 'RenderMultiWiggleData', {
                adapterConfig,
                regions,
                sources: sourcesWithoutLayout,
                ...self.rpcProps(),
                stopToken: ctx.stopToken,
                bpPerPx,
                // One batched call for every region, so there is nothing to
                // aggregate: the plain status callback, not the per-region one
                // the fan-out displays use to merge N concurrent bars.
                statusCallback: self.makeStatusCallback(),
              }),
            onResult: (idx, result) => {
              self.setRpcData(idx, result)
            },
            onComplete: () => {
              self.setLoadedBpPerPx(bpPerPx)
            },
          })
        },

        // No superAfterAttach() call: the fork auto-chains hooks, so
        // MultiRegionDisplayMixin's afterAttach already runs (see
        // afterAttachAutoChain.test.ts). An explicit call would double-install
        // its fetch autoruns.
        async afterAttach() {
          // mobx-only and already bundled (the barrel is a static import
          // above), so it installs synchronously — unlike the two below, which
          // genuinely code-split d3/clustering code
          setupRowSortAutorun(self, {
            name: 'MultiWiggleSortRows',
            sortRows: (refName, pos) => {
              self.sortRowsByScoreAt(refName, pos)
            },
          })

          try {
            const { setupTreeDrawingAutorun } =
              await import('@jbrowse/tree-sidebar')
            if (isAlive(self)) {
              setupTreeDrawingAutorun(self)
            }
          } catch (e) {
            console.error(e)
          }

          try {
            const { getWiggleClusterAutorun } =
              await import('./getWiggleClusterAutorun.ts')
            if (isAlive(self)) {
              getWiggleClusterAutorun(self)
            }
          } catch (e) {
            console.error(e)
          }
        },
      }
    })
    .views(self => ({
      trackMenuItems() {
        const showItems: MenuItem[] = [
          // row separators only render in multi-row modes, not overlays
          ...(self.isOverlay
            ? []
            : [
                checkboxItem(
                  'Show row separators',
                  self.showRowSeparators,
                  () => {
                    self.setShowRowSeparators(!self.showRowSeparators)
                  },
                ),
              ]),
          // the color key only renders as an overlay of >1 source
          ...(self.overlayLegendApplies
            ? [
                showLegendCheckboxItem(self.showLegend, () => {
                  self.setShowLegend(!self.showLegend)
                }),
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
                getSession(self).queueDialog(handleClose => [
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
            ready: !!self.sourcesVolatile.length,
            onOpen: () => {
              getSession(self).queueDialog(handleClose => [
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
          // to be read down
          ...(!self.isOverlay && self.numSources > 1
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
