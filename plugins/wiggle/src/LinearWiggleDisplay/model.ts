import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
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
import { keyNames } from '@jbrowse/core/util/categoricalField'
import { copyText } from '@jbrowse/core/util/copyText'
import { thresholdLabels } from '@jbrowse/core/util/thresholdScale'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
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
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { leftAxisGutterWidth } from '@jbrowse/display-ui'
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
  sidebarPanelWidth,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import {
  SCORE_RANGE_LABEL,
  YFieldConfigMixin,
  axisPlotBox,
  computeScoreStats,
  makeScoreAxisMenuItem,
  visibleStats,
} from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import {
  DEFAULT_LINE_WIDTH_PX,
  DEFAULT_POINT_SIZE_PX,
  renderingOf,
} from '../renderingTypes.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import { clampResolution } from '../shared/resolution.ts'
import { colorKeyTitleOf } from '../shared/scoreRampScale.ts'
import {
  declaredCuts,
  wiggleColorProblems,
  wiggleColorSettingOf,
  wiggleSharesPanel,
} from '../shared/wiggleColor.ts'
import { getRowHeight, getRowTop } from '../shared/wiggleComponentUtils.ts'
import { wiggleDisplayViews } from '../shared/wiggleDisplayViews.ts'
import { wiggleFeatureWidgetData } from '../shared/wiggleHitTest.ts'
import {
  makeMarkSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import {
  wiggleAutoscaleRange,
  wiggleResolveViews,
} from '../shared/wiggleResolveViews.ts'
import { WIGGLE_Y_PATHS } from '../shared/wiggleYPaths.ts'
import { WIGGLE_PLOTS } from '../util.ts'
import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
import {
  declaredValueDomain,
  sourceWarnings,
  sourcesFromRegionData,
} from './sourcesLogic.ts'

import type {
  LineInterpolation,
  WiggleMark,
  WiggleRendering,
} from '../renderingTypes.ts'
import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { Extent } from '../shared/wiggleMarkConfigSchema.ts'
import type { Source, WiggleHoveredFeature, WiggleMarkObject } from '../util.ts'
import type { WiggleContextInfo } from './components/findHit.ts'
import type { WiggleDisplayModel } from './components/wiggleDisplayTypes.ts'
import type { LinearWiggleDisplayConfigSchema } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel, Plot } from '@jbrowse/core/configuration'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Region } from '@jbrowse/core/util'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SvgSidebarProps } from '@jbrowse/tree-sidebar'
import type {
  ValueScale,
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
  return types
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
       * Points per pixel the fetch asks for, clamped to what the Resolution
       * menu offers: the slot is reachable from a track config, which runs no
       * setter, and `0` there divides by zero inside the adapter.
       */
      get resolution(): number {
        return clampResolution(getConf(self, ['data', 'resolution']))
      },
      /**
       * #getter
       * The fetched scores, keyed by displayedRegionIndex — the foundation's
       * per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, WiggleDataResult> {
        return self.regionPayloads as ReadonlyMap<number, WiggleDataResult>
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The value bars grow from, which a color scale also reads where its
       * domain is unset.
       */
      get origin(): number {
        return getConf(self, 'origin')
      },
      /**
       * #getter
       * A line's width, `encoding.strokeWidth` or 1 px while unset.
       */
      get lineWidth(): number {
        return (
          getConf(self, ['encoding', 'strokeWidth', 'value']) ??
          DEFAULT_LINE_WIDTH_PX
        )
      },
      /**
       * #getter
       * A point's diameter, `encoding.size` or 2 px while unset.
       */
      get size(): number {
        return (
          getConf(self, ['encoding', 'size', 'value']) ?? DEFAULT_POINT_SIZE_PX
        )
      },
      /**
       * #getter
       */
      get extent(): Extent {
        return getConf(self, ['mark', 'extent'])
      },
      /**
       * #getter
       */
      get renderingType(): WiggleRendering {
        return renderingOf(
          getConf(self, ['mark', 'type']),
          getConf(self, ['mark', 'interpolate']),
        )
      },
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
    .views(self => ({
      /**
       * #getter
       */
      get domain() {
        return self.autoscaledDomain
      },
      /**
       * #getter
       * The bounds the adapter declares its values lie in, where it declares
       * any (`getValueDomain`): a GC content track's [0, 1], so its axis
       * reads alike at every locus. Config bounds still win.
       */
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        return declaredValueDomain(self.rpcDataMap.values())
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
    .views(self => ({
      // overrides WiggleScoreConfigMixin's `false` base, which is what its
      // axisReachesZero getter keys on
      get isDensityMode() {
        return self.renderingType === 'density'
      },

      /**
       * #getter
       * The `encoding.color` channel as written, `value` undefined while
       * nothing names a color and the layout decides (`effectiveColor`).
       */
      get colorSetting(): ColorSetting {
        return wiggleColorSettingOf(self.configuration.encoding.color)
      },

      /**
       * #getter
       * The heading both color keys carry: `encoding.color.legend.title` as
       * written (`''` draws none), else the y axis title the key replaces,
       * else `Score`.
       */
      get colorKeyTitle() {
        return colorKeyTitleOf(this.colorSetting.legend.title, self.scaleTitle)
      },

      /**
       * #getter
       * Whether each source is drawn in a separate row, which is all that
       * `rows.field` decides here: the tree sidebar, the row labels, the separators,
       * the clustering menu and the row-order sort all hang off it.
       */
      get isRowLayout() {
        return getConf(self, ['rows', 'field']) !== ''
      },

      /**
       * #getter
       * Every source in one plot box. The complement of the row layout, named
       * for what is drawn rather than for the setting that is off.
       */
      get isOverlay() {
        return !this.isRowLayout
      },
    }))
    .views(self => {
      // This list reaches `gpuProps()`, whose identity re-encodes every loaded
      // region, and a plain getter would hand out a fresh array on every region
      // arrival — `stableIdentityComputed` keeps the previous one while the row
      // metadata is unchanged, which is what a refetch of the same track
      // produces.
      const sources = stableIdentityComputed(() =>
        sourcesFromRegionData(self.rpcDataMap),
      )
      return {
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the adapter's sources, discovered from
         * the loaded regions in adapter order.
         */
        get discoveredRows(): Source[] {
          return sources.get()
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * `TreeSidebarMixin`'s hook: whether several plots share one box, where
       * only color tells the sources apart. A lone plot has nothing to be
       * told apart from and is the pos/neg picture a quantitative track has
       * always drawn.
       */
      get sharesPanel(): boolean {
        return wiggleSharesPanel(self.isRowLayout, self.discoveredRows.length)
      },
      /**
       * #getter
       * `TreeSidebarMixin`'s hook: the row color key over a shared panel
       * lists subtracks.
       */
      get rowNoun(): string {
        return 'Subtrack'
      },
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
    .views(self => wiggleResolveViews(self))
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
      /**
       * #getter
       * The stats of the sources visible in the settled blocks, `undefined`
       * until the view and the data are ready.
       */
      get statsInView() {
        const names = self.autoscaleSourceNames
        return visibleStats({
          active: true,
          view: self.host,
          payloadFor: index => self.rpcDataMap.get(index),
          itemsFor: regionData =>
            regionData.sources.filter(source => names.has(source.name)),
          accumulate: entries =>
            computeScoreStats(self.summaryField, entries, self.effectiveExtent),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * What the sources visible in the settled blocks span, under the
       * autoscale mode (`wiggleAutoscaleRange`). `undefined` until the view
       * and the data are ready, which is not the `[0, 1]` a caller falls
       * back to — see `visibleStats`.
       */
      get autoscaleRange(): [number, number] | undefined {
        return wiggleAutoscaleRange(self.statsInView, {
          quantile: self.fenceQuantile,
          zero: self.axisReachesZero,
          field: self.summaryField,
          extent: self.effectiveExtent,
          ruleValues: self.scoreRuleValues,
        })
      },
      /**
       * #getter
       * The least and greatest value the visible sources draw, unfenced.
       */
      get valuesInView(): [number, number] | undefined {
        const walked = self.statsInView
        return walked
          ? [walked.stats.scoreMin, walked.stats.scoreMax]
          : undefined
      },

      get numSources() {
        return self.sources.length
      },

      /**
       * #getter
       * Resolved per-row height. This display is always fit-to-display-height —
       * its rows declare no `step`, so there is no pinned height to
       * resolve — but it uses the same name every row display exposes its
       * resolved height under (see agent-docs/reference/ROW_HEIGHT_AND_FIT),
       * which is also what tree-sidebar's `TreeDrawingModel` reads.
       */
      get effectiveRowHeight() {
        return self.isOverlay
          ? this.rowsHeight
          : getRowHeight(this.rowsHeight, this.numSources)
      },

      /**
       * #getter
       * The height under `rowsTopOffset` the rows, or the one plot, fill.
       */
      get rowsHeight() {
        return Math.max(0, self.height - self.rowsTopOffset)
      },

      /**
       * #getter
       * Rows actually drawn: overlay collapses every source onto one shared
       * plot. Read by the render state and by everything that repeats itself
       * per row (scalebars, cross hatches), so they can't disagree about how
       * many rows exist.
       */
      get numRows() {
        return self.isOverlay ? 1 : this.numSources
      },

      /**
       * #getter
       * One row takes the scalebar-label gutter at top and bottom, so its end
       * labels are never clipped; a stack of rows gives that up, because the
       * axis is drawn per row and maximum density is the point. `ticks`, the
       * render height, the on-screen canvas and the SVG clip all read this, so
       * a tick stays on the data it labels.
       */
      get plotGeometry() {
        const { rowsTopOffset } = self
        const { rowsHeight, numRows } = this
        if (numRows === 1) {
          const { yTop, plotHeight } = axisPlotBox(rowsHeight)
          return {
            yTop: rowsTopOffset + yTop,
            plotHeight,
            numRows: 1,
            tickHeight: rowsHeight,
          }
        }
        return {
          yTop: rowsTopOffset,
          plotHeight: rowsHeight,
          numRows,
          tickHeight: this.effectiveRowHeight,
        }
      },

      /**
       * #getter
       * A density row has no y scale, so under the one ramp the ramp is the
       * key and shows the domain; bars and points keep their axis beside it.
       */
      get scoreRampReplacesAxis() {
        return self.isDensityMode && self.scoreGradientPaints
      },
    }))
    .views(self => wiggleDisplayViews(self))
    .views(self => ({
      /**
       * #getter
       * Overlay draws every source on one row, so it names none.
       */
      get drawsRowLabels() {
        return self.numSources > 1 && self.isRowLayout && self.showRowLabels
      },
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
       * #getter
       * The dendrogram and row labels at the display's left, which the axis
       * sits past on screen and the export parks left of the figure.
       */
      get sidebarPanel(): SvgSidebarProps {
        return {
          showTree: self.showTree,
          hierarchy: self.hierarchy,
          sources: self.sources,
          rowHeight: self.effectiveRowHeight,
          treeAreaWidth: self.treeAreaWidth,
          showLabels: self.drawsRowLabels,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The one scale every row shares, ruling a band per row stacked down the
       * track, past the dendrogram where one is shown. Density rows, one
       * color per row, map the scale to color rather than to y, so they
       * rule no band and the chrome captions the domain instead; under the
       * one ramp the ramp is the key and shows the domain itself.
       */
      get valueScales(): ValueScale[] {
        if (self.scoreRampReplacesAxis) {
          return []
        }
        const { tickHeight, yTop, numRows } = self.plotGeometry
        return [
          {
            domain: self.domain,
            scaleType: self.scaleType,
            height: tickHeight,
            offset: yTop - self.rowsTopOffset,
            symlogConstant: self.symlogConstant,
            bandTops: self.isDensityMode
              ? []
              : Array.from(
                  { length: numRows },
                  (_, row) =>
                    self.rowsTopOffset +
                    getRowTop(row, self.effectiveRowHeight),
                ),
            left: sidebarPanelWidth(self.sidebarPanel),
            ...self.axisGuide,
          },
        ]
      },
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

      get showRowSeparators(): boolean {
        return getConf(self, ['rows', 'axis', 'grid'])
      },

      /**
       * #getter
       * The key a threshold with declared cuts draws: one row per interval,
       * labelled by the span it covers. A threshold cutting at the `origin`
       * draws none, because the axis already shows where the origin is and a
       * `< 0` / `≥ 0` key on every bigWig adds nothing a reader asked
       * for. A heatmap has no axis, so its threshold keys the origin's cut
       * too.
       */
      get thresholdColorScale(): ColorScale | undefined {
        const encoding = self.colorEncoding
        const threshold =
          typeof encoding === 'object' && encoding.scale === 'threshold'
        const declared = declaredCuts(encoding)
        const cuts =
          declared.length > 0 || !self.isDensityMode || !threshold
            ? declared
            : self.wiggleColor.cuts
        if (cuts.length === 0) {
          return undefined
        }
        const { posColor, negColor, innerColors } = self.wiggleColor
        const colors = [negColor, ...innerColors, posColor]
        const { scale } = self.colorSetting
        const spans = thresholdLabels(cuts)
        const names = keyNames(spans, scale.names ?? [])
        return {
          kind: 'categorical',
          id: 'threshold',
          title: self.colorKeyTitle,
          entries: spans.map((span, i) => ({
            value: span,
            label: names.get(span) ?? span,
            color: colors[i]!,
          })),
        }
      },

      /**
       * #getter
       * Offset the track label above the plot so the left y-axis stays pinned
       * to the content edge instead of dodging right of the label, and so a
       * stack of rows is not hidden behind it. One density plot draws no left
       * axis (just a top score legend), so there let the label overlap.
       */
      get prefersOffset() {
        return !self.isDensityMode || self.isRowLayout
      },

      /**
       * #getter
       * `LegendMixin`'s hook: the score ramp or threshold key, then the row
       * color key, except in a shared panel painting the score gradient,
       * where no row color shows.
       */
      get colorScales(): ColorScale[] {
        const scales: ColorScale[] = []
        if (self.scoreColorScale) {
          scales.push(self.scoreColorScale)
        }
        if (this.thresholdColorScale) {
          scales.push(this.thresholdColorScale)
        }
        if (self.isRowLayout || self.rowColorPaintsMarks) {
          scales.push(...self.rowColorScales)
        }
        return scales
      },

      /**
       * #getter
       * `TreeSidebarMixin`'s hook: off in overlay, which collapses every
       * source onto one row, so a tree spreading its leaves over the full
       * height would align to nothing. A subtree filter
       * set in a row mode still applies and is still clearable from the track
       * menu and WiggleHint.
       */
      get drawsTree(): boolean {
        return self.isRowLayout
      },

      /**
       * #getter
       */
      get svgSidebar(): SvgSidebarProps {
        return {
          ...self.sidebarPanel,
          leftInset: leftAxisGutterWidth(self.axes),
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
          // the tree, row separators and row labels only render in multi-row
          // modes, not overlays — an overlay is one row and names itself by
          // the track name, and draws no dendrogram (see `hierarchy`). A
          // persisted `showTree` is left untouched, so it comes back on
          // return to a row mode
          ...(self.isOverlay
            ? []
            : [
                ...treeSidebarShowMenuItems(self),
                showRowSeparatorsMenuItem(self),
                showRowLabelsMenuItem(self),
              ]),
          ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
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
