import { lazy } from 'react'

import {
  ConfigurationReference,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import {
  assembleLocString,
  getDialogHost,
  getEnv,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import LegendMixin, { legendMenuItems } from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import ParkedColorMixin from '@jbrowse/display-kit/ParkedColorMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchAllRegions } from '@jbrowse/display-kit/fetchEachRegion'
import {
  editPlotMenuItems,
  openPlotDialog as queuePlotDialog,
} from '@jbrowse/display-kit/plotMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ContextMenuMixin,
  TreeSidebarMixin,
  resetRowOrderMenuItems,
  rowOrderMenuItems,
  setupTreeSidebarAutoruns,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsAtColumn,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import {
  SCORE_RANGE_LABEL,
  YFieldConfigMixin,
  makeScoreAxisMenuItem,
} from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { renderingOf } from '../renderingTypes.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import { clampResolution } from '../shared/resolution.ts'
import {
  wiggleColorProblems,
  wiggleColorSettingOf,
} from '../shared/wiggleColor.ts'
import {
  wiggleConfigViews,
  wiggleLabelViews,
  wiggleModeViews,
} from '../shared/wiggleConfigViews.ts'
import { wiggleFeatureWidgetData } from '../shared/wiggleHitTest.ts'
import {
  makeMarkSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import {
  wiggleScoreStages,
  wiggleSidebarStages,
} from '../shared/wiggleStages.ts'
import { WIGGLE_Y_PATHS } from '../shared/wiggleYPaths.ts'
import { WIGGLE_PLOTS } from '../util.ts'
import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
import { sourceWarnings } from './sourcesLogic.ts'

import type { LineInterpolation, WiggleMark } from '../renderingTypes.ts'
import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { Source, WiggleHoveredFeature, WiggleMarkObject } from '../util.ts'
import type { WiggleContextInfo } from './components/findHit.ts'
import type { WiggleDisplayModel } from './components/wiggleDisplayTypes.ts'
import type { LinearWiggleDisplayConfigSchema } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel, Plot } from '@jbrowse/core/configuration'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  Extent,
  WiggleDataResult,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'

const RowArrangementDialog = lazy(
  () => import('./components/RowArrangementDialog.tsx'),
)
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog.tsx'),
)

/**
 * #stateModel LinearWiggleDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 *
 * The quantitative display: one plot per rendering, drawn over one source or
 * over many. `rows: 'source'` puts each source in a separate row, with the
 * clustering sidebar, row labels and separators beside them, and holds the
 * arrangement a reader sets; unset, every source shares one plot box.
 *
 * #example
 * A complete `QuantitativeTrack` config to paste into `tracks`:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 *   displays: [
 *     {
 *       type: 'LinearWiggleDisplay',
 *       displayId: 'coverage-LinearWiggleDisplay',
 *       height: 100,
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * The two row-ordering triggers are display *properties*, not config slots, so
 * they go on the display node in a session — `defaultSession` here, and the
 * same shape a `session=spec-` link uses. Written in the track config's
 * `displays` entry they would be dropped as unknown slots.
 *
 * `runClustering` is a transient declarative launch spec, the same idea as
 * `LinearGenomeView`'s `init`: it runs the real "Cluster columns" RPC once
 * automatically (no dialog) as soon as subtrack data is available, then clears
 * itself so a saved session never re-triggers it. `sortRowsBy` is the other
 * one, and the declarative form of the right-click "Sort rows by score here" —
 * where clustering orders rows by the whole region in view, this ranks them by
 * the score each has at one base, so a cohort can open already ranked at a
 * candidate locus with the surrounding context still on screen. Use one or the
 * other; whichever applies last owns the row order.
 * ```js
 * defaultSession: {
 *   name: 'Copy number at CCL3L1',
 *   views: [
 *     {
 *       type: 'LinearGenomeView',
 *       assembly: 'hg38',
 *       loc: 'chr17:36,080,000-36,270,000',
 *       tracks: [
 *         {
 *           trackId: 'pur_copynumber_1000g',
 *           type: 'LinearWiggleDisplay',
 *           sortRowsBy: { refName: 'chr17', pos: 36180000 },
 *         },
 *       ],
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: LinearWiggleDisplayConfigSchema,
) {
  const base = types
    .compose(
      'LinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      YFieldConfigMixin(WIGGLE_Y_PATHS),
      StoredHoverMixin<WiggleHoveredFeature>(),
      LegendMixin(),
      ParkedColorMixin(),
      TreeSidebarMixin<Source>(),
      ContextMenuMixin<ContextMenuAnchor & { hit: WiggleContextInfo }>(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearWiggleDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        // `runClustering` / `clusterRegion` / `sortRowsBy` are
        // TreeSidebarMixin's. The one thing specific to this display: naming a
        // `clusterRegion` also moves where the sampling density comes from,
        // since the matrix columns are pixel bins over the span rather than
        // over the view's zoom (clusterScoreMatrixArgs).
      }),
    )
    .views(self => ({
      /**
       * #getter
       * The fetched scores, keyed by displayedRegionIndex — the foundation's
       * per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, WiggleDataResult> {
        return self.regionPayloads as ReadonlyMap<number, WiggleDataResult>
      },
    }))
    .views(self => wiggleConfigViews(self))
    .views(self => wiggleModeViews(self))
    .views(self => wiggleLabelViews(self))
    .views(self => ({
      /**
       * #getter
       * Asked of the display's own adapter, for the GC track the synthesized
       * GCContentAdapter: the resolution slot it gates is passed to whatever
       * this display fetches from.
       */
      get hasResolution() {
        const { type } = self.adapterConfig
        const { pluginManager } = getEnv(self)
        return (
          typeof type === 'string' &&
          pluginManager.hasAdapterType(type) &&
          pluginManager
            .getAdapterType(type)
            .adapterCapabilities.includes('hasResolution')
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Stage a region as fetched, with this mixin's payload shape — so a test
       * stands up a loaded display in one call. Production goes through
       * `ctx.commitRegion`.
       */
      setRpcData(
        displayedRegionIndex: number,
        data: WiggleDataResult,
        region: Region,
      ) {
        self.setLoadedRegion(displayedRegionIndex, region, data)
      },
      /**
       * #action
       */
      selectFeature(feat: WiggleHoveredFeature) {
        openFeatureWidget(self, wiggleFeatureWidgetData(feat))
      },
      /**
       * #action
       */
      setResolution(res: number) {
        setConf(self, ['data', 'resolution'], clampResolution(res))
      },
      /**
       * #action
       */
      setOrigin(val?: number) {
        setConf(self, 'origin', val)
      },
      /**
       * #action
       * The plot's `mark.type`, and a line's `mark.interpolate`; any other
       * type resets `interpolate`, which only a line reads.
       */
      setMark(mark: WiggleMark, interpolate?: LineInterpolation) {
        setConf(self, ['mark', 'type'], mark)
        setConf(
          self,
          ['mark', 'interpolate'],
          mark === 'line' ? interpolate : undefined,
        )
      },
      /**
       * #action
       * The field plotted on the value axis: a stored summary (`score`,
       * `minScore`, `maxScore`) or any feature field.
       */
      setY(field: string) {
        setConf(self, ['encoding', 'y', 'field'], field)
      },
      /**
       * #action
       */
      setExtent(val: Extent) {
        setConf(self, ['mark', 'extent'], val)
      },
      /**
       * #action
       */
      setPointSize(val?: number) {
        setConf(self, ['encoding', 'size', 'value'], val)
      },
      /**
       * #action
       */
      setStrokeWidth(val?: number) {
        setConf(self, ['encoding', 'strokeWidth', 'value'], val)
      },
    }))

  return wiggleSidebarStages(wiggleScoreStages(base))
    .views(self => ({
      /**
       * #getter
       * `TreeSidebarMixin`'s hook: the adapter lists its subtracks, so a
       * `rows.kept` name no subtrack has is named.
       */
      get rowsListedUpFront(): boolean {
        return true
      },

      /**
       * #getter
       * What the loaded sources said they could not serve, and
       * `rowNarrowingNotices`.
       */
      get liveNotices(): string[] {
        return [
          ...sourceWarnings(self.rpcDataMap),
          ...self.rowNarrowingNotices,
          ...(self.isDensityMode && self.sharesPanel
            ? [
                'rows: an overlaid heatmap draws every source on one strip, the last covering the rest; put the sources on rows',
              ]
            : []),
        ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The one color the circular view's key names this track by
       * (`CircularLegendSource`), which a ring of this display answers where
       * it draws no ramp. The positive side, which is the whole plot wherever
       * nothing parts.
       */
      get legendColor(): string {
        return self.wiggleColor.posColor
      },
      /**
       * #getter
       * Whether a summary bin's tooltip lists its min and max: where they are
       * drawn, or where the bar is one of them rather than the mean.
       */
      get tooltipShowsMinMax() {
        return (
          self.effectiveExtent === 'min-max' || self.summaryField !== 'score'
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `TreeSidebarMixin`'s hook. On a log or symlog axis it also waits for
       * the domain the matrix places scores through, which lags the data
       * until the view settles; with no scores loaded there is none to wait
       * for.
       */
      get autoClusterReady(): boolean {
        return (
          self.clusterableSources.length > 1 &&
          (self.scaleType === 'linear' ||
            self.domain !== undefined ||
            ![...self.rpcDataMap.values()].some(d =>
              d.sources.some(source => source.numFeatures > 0),
            ))
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * `y` is a fetch key as written, so picking another stored summary
       * refetches arrays the worker already shipped; `extent` is not
       * (WIGGLE_DISPLAY.md, "`y`, `mark.extent`"). The color settings are not
       * among the keys: every mode partitions by sign on the main thread, so
       * moving the pivot re-encodes and refetches nothing.
       */
      rpcProps() {
        return {
          resolution: self.resolution,
          yField: self.yField,
        }
      },
    }))
    .views(self => {
      const superConfigProblemsOf = self.configProblemsOf
      return {
        /**
         * #method
         * The schema's rules, then what the plot cannot paint as written:
         * threshold cuts past eight, and a gradient on a line.
         */
        configProblemsOf(conf: AnyConfigurationModel): string[] {
          const own = conf as Instance<LinearWiggleDisplayConfigSchema>
          return [
            ...superConfigProblemsOf(conf),
            ...wiggleColorProblems(
              wiggleColorSettingOf(own.encoding.color),
              renderingOf(
                readConfObject(own, ['mark', 'type']),
                readConfObject(own, ['mark', 'interpolate']),
              ),
            ),
          ]
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * The layout half of a Plot type leaf — `Multi-row` or `Overlapping`,
       * each holding the five plot names. Writes the field alone, so the
       * arrangement survives a trip through the shared plot and comes back
       * with the rows.
       */
      setRowLayout(on: boolean) {
        setConf(self, ['rows', 'field'], on ? 'source' : '')
      },
    }))
    .actions(self => ({
      startRenderingBackend(backend: WiggleRenderingBackend) {
        installWiggleRenderingBackend(self, backend)
      },

      setShowRowSeparators(arg: boolean) {
        setConf(self, ['rows', 'axis', 'grid'], arg)
      },

      /**
       * #action
       * A Plot type leaf whole: `setMark` then `setRowLayout` in one action, so
       * the regions encode once and never as the new plot in the old layout.
       */
      setPlot({
        mark,
        rowLayout,
      }: {
        mark: WiggleMarkObject
        rowLayout: boolean
      }) {
        self.setMark(mark.type, mark.interpolate)
        self.setRowLayout(rowLayout)
      },

      /**
       * #action
       * The arrangement dialog's "Edit plot..." button: the color object and
       * the rows beside it as text, the escape for a ramp, several cut points
       * or a typed row order, none of which the dialog's own controls offer.
       */
      openPlotDialog(seed?: Plot) {
        queuePlotDialog(self, seed)
      },

      /**
       * #action
       * Rank the rows by each source's score at one genomic base. Reads the
       * region data already in hand — no refetch, no RPC — and writes the
       * order through `rows.sort`, the same channel clustering and the
       * arrangement dialog write, so "Reset row order" undoes all three.
       *
       * Named by coordinate rather than by loaded-region index because both
       * entry points are: the right-click hit resolves to one, and a session's
       * `sortRowsBy` holds one across a reload. Resolving that region and
       * refusing the two cases where a sort would only cost a `rows.sort` write
       * are `sortRowsAtColumn`'s, shared with the multi-row feature display's
       * twin, and so is the returned "did it sort" the declarative entry point
       * reads to decide whether to keep its trigger for a later fetch.
       */
      sortRowsByScoreAt(refName: string, pos: number) {
        return sortRowsAtColumn(
          self,
          refName,
          pos,
          index => self.rpcDataMap.get(index),
          (sources, data) =>
            sortSourcesByScoreAt(sources, data, pos, self.summaryField),
        )
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: IndexedRegion[]) {
        const view = self.host
        // Always fetch the full (unfiltered, un-reordered) source list. A
        // subtree filter or reorder only affects client-side rendering
        // (gpuProps re-upload) and the autoscale domain — never what's
        // fetched — so every region's payload stays complete and consistent.
        // Filtering here instead would leave regions fetched under a stale
        // filter missing sources when the filter is later widened.
        const { discoveredRows } = self
        const { bpPerPx } = view
        // Batched, not per-region: every subtrack adapter gets all the
        // visible regions in one call, so a whole-genome or
        // collapsed-intron view coalesces each file's on-disk blocks into
        // one pass instead of one pass per region per subtrack. The
        // regions land together rather than painting progressively.
        return fetchAllRegions(self, needed, {
          call: (regions, ctx) =>
            ctx.callRpc('RenderMultiWiggleData', {
              ...rpcArgs(self),
              regions,
              sources: discoveredRows,
              bpPerPx,
            }),
          onResult: (_idx, result) => result,
        })
      },

      afterAttach() {
        setupTreeSidebarAutoruns(self, {
          name: 'Wiggle',
          // Forwarded, not swallowed: `false` is "no loaded region covers that
          // column", and it holds `sortRowsBy` for the fetch that will.
          sortRows: (refName, pos) => self.sortRowsByScoreAt(refName, pos),
          // "Cluster rows by score": the score-matrix RPC over the
          // `clusterRegion` locus if the session named one and the visible
          // blocks if not. Refuses a single row, matching the track menu's gate
          clustering: {
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
          },
        })
      },
    }))
    .views(self => ({
      trackMenuItems() {
        const showItems: MenuItem[] = [
          // the tree, row labels and row separators only render in multi-row
          // modes, not overlays — an overlay is one row and names itself by
          // the track name, and draws no dendrogram (see `hierarchy`). A
          // persisted `showTree` is left untouched, so it comes back on
          // return to a row mode
          ...(self.isOverlay
            ? []
            : [
                ...treeSidebarShowMenuItems(self),
                showRowLabelsMenuItem(self),
                showRowSeparatorsMenuItem(self),
              ]),
          ...(self.hasLegendKey ? legendMenuItems(self) : []),
        ]
        return [
          makeRenderingTypeSubMenu(self, WIGGLE_PLOTS),
          ...makeResolutionSubMenu(self),
          makeScoreAxisMenuItem(
            self,
            self.isDensityMode ? { label: SCORE_RANGE_LABEL } : {},
          ),
          ...makeShowSubMenu(showItems),
          ...makeMarkSizeMenuItems(self),
          ...rowOrderMenuItems(self, {
            // `ready: true`: a swatch waits for no row list, and a gate would
            // grey out the only color route on a plain BigWig until a fetch
            // lands
            arrangement: {
              ready: true,
              onOpen: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  RowArrangementDialog,
                  { model: self, handleClose },
                ])
              },
            },
            // a row order exists only once the sources are on rows
            cluster: self.isRowLayout
              ? {
                  runItem: {
                    label: 'Cluster rows by score...',
                    onClick: () => {
                      getDialogHost(self).queueDialog(handleClose => [
                        WiggleClusterDialog,
                        { model: self, handleClose },
                      ])
                    },
                  },
                  rowCount: self.clusterableSources.length,
                }
              : undefined,
          }),
          ...editPlotMenuItems(self),
        ]
      },

      /**
       * #method
       * Right-click menu, built from the column under the click. The
       * position is captured here rather than read inside the onClick, because
       * `closeContextMenu` runs first when an item is clicked.
       */
      contextMenuItems(): MenuItem[] {
        const info = self.contextMenuInfo?.hit
        if (!info) {
          return []
        }
        const { feature } = info
        return [
          // overlay collapses every source onto one plot, so there is no row
          // axis for a ranking to be read down
          ...(self.isOverlay
            ? []
            : [
                // Each display names its own measure here (MAF "by
                // identity", variants "by genotype", marks the field it
                // compares), so "by score" stands.
                sortRowsHereMenuItem({
                  label: 'Sort rows by score here',
                  rowCount: self.editableSources.length,
                  onClick: () => {
                    self.sortRowsByScoreAt(info.refName, info.bp)
                  },
                }),
              ]),
          // The two rows the multi-row painting and the variant displays offer
          // on a right-click, under the labels they use, so one action is not
          // three names across three displays. They are about the bin the
          // pointer is on where the sort is about the rows, and they need the
          // hit rather than the column — a gap has no record to open or paste.
          ...(feature
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.selectFeature(feature)
                  },
                },
                {
                  label: 'Copy location',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    void copyText(
                      self,
                      assembleLocString({
                        refName: feature.refName,
                        start: feature.start,
                        end: feature.end,
                      }),
                      'location',
                    )
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

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>

// See SatisfiesComponentContract for why this guard exists and why it's spelled
// out in each model file rather than centralized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract = SatisfiesComponentContract<
  WiggleDisplayModel,
  LinearWiggleDisplayModel
>
