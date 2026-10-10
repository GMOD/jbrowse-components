import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { assembleLocString, getDialogHost } from '@jbrowse/core/util'
import { keyNames } from '@jbrowse/core/util/categoricalField'
import { copyText } from '@jbrowse/core/util/copyText'
import { thresholdLabels } from '@jbrowse/core/util/thresholdScale'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { fetchAllRegions } from '@jbrowse/display-kit/fetchEachRegion'
import {
  editPlotMenuItems,
  openPlotDialog as queuePlotDialog,
} from '@jbrowse/display-kit/plotMenu'
import { rowsSettingOf } from '@jbrowse/display-kit/rowsConfigSchema'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { leftAxisGutterWidth } from '@jbrowse/display-ui'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ContextMenuMixin,
  TreeSidebarMixin,
  clusteringMenuItem,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
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
  axisPlotBox,
  makeScoreAxisMenuItem,
} from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import {
  declaredCuts,
  paintedWiggleColor,
  resolveWiggleColor,
  wiggleColorEncoding,
  wiggleColorNotices,
} from '../shared/wiggleColor.ts'
import {
  getRowHeight,
  getRowTop,
  isLineMode,
} from '../shared/wiggleComponentUtils.ts'
import { wiggleDisplayViews } from '../shared/wiggleDisplayViews.ts'
import {
  makeLineWidthMenuItems,
  makePointSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import { WIGGLE_RENDERINGS } from '../util.ts'
import { sortSourcesByScoreAt } from './sortSourcesByScoreAt.ts'
import {
  UNCOLORED_ROW,
  markColorOf,
  sourceWarnings,
  sourcesFromRegionData,
} from './sourcesLogic.ts'

import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'
import type { WiggleHoveredFeature, Source } from '../util.ts'
import type { WiggleContextInfo } from './components/findHit.ts'
import type { WiggleDisplayModel } from './components/wiggleDisplayTypes.ts'
import type { LinearWiggleDisplayConfigSchema } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Plot } from '@jbrowse/core/configuration'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { RowsSetting } from '@jbrowse/display-kit/rowsConfigSchema'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SvgSidebarProps } from '@jbrowse/tree-sidebar'
import type { ValueScale, WiggleRenderingBackend } from '@jbrowse/wiggle-core'

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog.tsx'),
)

/**
 * #stateModel LinearWiggleDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 *
 * The quantitative display: one plot per rendering, drawn over one source or
 * over many. `rows: 'source'` gives each source a row of its own, with the
 * clustering sidebar, row labels and separators beside them, and holds the
 * arrangement a reader gives them; unset, every source shares one plot box.
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
      WiggleCommonMixin(),
      StoredHoverMixin<WiggleHoveredFeature>(),
      LegendMixin(),
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
      // overrides WiggleScoreConfigMixin's `false` base, which is what its
      // effectiveAggregate getter keys on
      get isDensityMode() {
        return self.renderingType === 'density'
      },

      /**
       * #getter
       * The `color` object as written, `value` undefined while nothing names
       * a color and the layout decides (`effectiveColor`).
       */
      get colorSetting(): ColorSetting {
        const { color } = self.configuration
        const setting = colorSettingOf(color)
        return {
          ...setting,
          field: setting.field ?? '',
          labels: readConfObject(color, 'labels'),
          title: readConfObject(color, 'title'),
        }
      },

      /**
       * #getter
       * The `rows` object's field and order, or undefined while every source
       * shares one plot. `source` is the only field the config admits here.
       */
      get rows(): RowsSetting | undefined {
        return rowsSettingOf({
          field: getConf(self, ['rows', 'field']),
          domain: self.rowDomain,
        })
      },

      /**
       * #getter
       * Whether each source takes a row of its own, which is the whole of what
       * `rows` decides here: the tree sidebar, the row labels, the separators,
       * the clustering menu and the row-order sort all hang off it.
       */
      get isRowLayout() {
        return !!this.rows
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
        return self.isOverlay && self.discoveredRows.length > 1
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
       * The color actually painted: what the config says, else the pos/neg
       * pair about the `origin`.
       */
      get effectiveColor(): ColorSetting {
        return paintedWiggleColor(self.colorSetting)
      },

      /**
       * #getter
       * `effectiveColor` as it paints, through the one resolver every
       * display's color object goes through.
       */
      get colorEncoding() {
        return wiggleColorEncoding(this.effectiveColor)
      },

      /**
       * #getter
       * `colorEncoding` as the encoder and both backends take it.
       */
      get wiggleColor(): ResolvedWiggleColor {
        return resolveWiggleColor(this.colorEncoding, self.origin)
      },

      /**
       * #getter
       * Whether color is spent on the score, so a row's color shows only on
       * its label bar: density always, where the white fade counts, and
       * bars or points under a declared `linear` color. Lines part
       * in two colors even then.
       */
      get scoreGradientPaints() {
        return (
          self.isDensityMode ||
          (this.wiggleColor.rampLut !== null && !isLineMode(self.renderingType))
        )
      },

      /**
       * #getter
       * What `colorSetting`'s and `scales.y`'s slots say together that they
       * cannot draw as written, and a gradient a line cannot paint, for the
       * corner notice.
       */
      get notices(): string[] {
        const notices = [
          ...wiggleColorNotices(self.colorSetting),
          ...self.valueScaleNotices,
          ...sourceWarnings(self.rpcDataMap),
        ]
        return this.wiggleColor.rampLut !== null &&
          isLineMode(self.renderingType)
          ? [
              ...notices,
              'color.scale: a gradient colors bars, points and density; a line paints its two end colors',
            ]
          : notices
      },

      /**
       * #getter
       * The one color the circular view's key names this track by
       * (`CircularLegendSource`), which a ring of this display answers where
       * it draws no ramp. The positive side, which is the whole plot wherever
       * nothing parts.
       */
      get legendColor(): string {
        return this.wiggleColor.posColor
      },

      /**
       * #getter
       * `TreeSidebarMixin`'s hook: a subtrack's color paints its plot while
       * nothing else colors it: no score gradient, and no declared `color`.
       */
      get rowColorPaintsMarks(): boolean {
        const { value, field } = self.colorSetting
        return !this.scoreGradientPaints && value === undefined && !field
      },

      /**
       * #getter
       * Whether each source's marks paint in its `rowColor`: while
       * `rowColorPaintsMarks`, and always in one shared box, which draws no
       * label bar to carry it.
       */
      get marksTakeRowColor(): boolean {
        return self.rowColorPaintsMarks || self.isOverlay
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Each source and the color its marks paint in (`markColorOf`), which
       * the encoder and the tooltip read. Where the palette deals the shared
       * panel and some row took a color, a row left without one paints
       * `UNCOLORED_ROW` grey rather than the plot color, which reads as one
       * of the dealt.
       */
      get markSources(): { name: string; color?: string }[] {
        const paints = self.marksTakeRowColor
        const uncolored =
          self.rowPaletteDeals && self.resolvedRowColors.size > 0
            ? UNCOLORED_ROW
            : undefined
        return self.sources.map(s => ({
          name: s.name,
          color: markColorOf(s, paints) ?? uncolored,
        }))
      },

      /**
       * #getter
       * Overrides WiggleCommonMixin's empty base, so the axis reaches a
       * rule of `scales.y.rules` even where the visible data does not.
       *
       * Empty in density, where no rule is drawn: the domain is spent on the
       * color ramp there, so widening it stretches the ramp over a range
       * nothing on screen reaches.
       */
      get scoreRuleValues() {
        return self.isDensityMode ? [] : self.scoreRules.map(r => r.value)
      },

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
       * Resolved per-row height. This display is always fit-to-display-height —
       * there is no pinned-height setting and so no `rowHeight` sentinel to
       * resolve — but it carries the same name every row display exposes its
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
       * Whether one ramp describes the color of every row: wherever a score
       * gradient paints, since a declared gradient's one table ignores the
       * rows' own colors. Density's white fade does not: a source with its
       * own color fades to it (see buildSourceRenderData), so a single bar
       * would describe none of them.
       */
      get scoreRampApplies() {
        return (
          self.scoreGradientPaints &&
          (self.wiggleColor.rampLut !== null ||
            self.sources.every(s => !s.color))
        )
      },

      /**
       * #getter
       * A density row has no y scale, so under the one ramp the ramp is the
       * key and carries the domain; bars and points keep their axis beside it.
       */
      get scoreRampReplacesAxis() {
        return self.isDensityMode && this.scoreRampApplies
      },
    }))
    .views(self => wiggleDisplayViews(self))
    .views(self => ({
      /**
       * #getter
       * Overlay draws every source on one row, so it names none.
       */
      get drawsRowLabels() {
        return self.numSources > 1 && !self.isOverlay && self.showRowLabels
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
       * track, past the dendrogram where one is shown. Density rows each in
       * their own color map the scale to color rather than to y, so they
       * rule no band and the chrome captions the domain instead; under the
       * one ramp the ramp is the key and carries the domain itself.
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
            minimalTicks: self.minimalTicks,
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
            caption: self.scaleTitle,
            rules: self.scoreRules,
            grid: self.grid,
          },
        ]
      },
      /**
       * #method
       * `aggregate` is a fetch key so an adapter that stores min/max
       * apart from the mean can skip reading them. The raw slot, not the
       * effective one, which moves with the rendering type and would refetch
       * on every switch to density (WIGGLE_DISPLAY.md, "Effective vs raw").
       */
      rpcProps() {
        return {
          ...self.sharedRpcProps(),
          aggregate: self.aggregate,
        }
      },

      /**
       * #method
       * The row list is this display's own: the encoder places each payload
       * source by its position here, so a filter or a reorder re-uploads
       * bytes already in hand.
       *
       * The color rides here and not in `rpcProps`: the worker ships one set
       * of score arrays and the main thread colors each instance by its side
       * of the cut, so a new color re-encodes and refetches nothing.
       */
      gpuProps() {
        return {
          ...self.sharedGpuProps(),
          sources: self.markSources,
          rowLayout: self.isRowLayout,
          perSource: self.rowPaletteDeals,
        }
      },

      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },

      /**
       * #getter
       * The key a threshold with declared cuts draws: one row per interval,
       * labelled by the span it covers. A threshold cutting at the `origin`
       * draws none, because the axis already shows where the origin is and a
       * `< 0` / `≥ 0` key on every bigWig says nothing a reader did not ask
       * for. Density draws none either: there the ramp is the key.
       */
      get thresholdColorScale(): ColorScale | undefined {
        const cuts = declaredCuts(self.colorEncoding)
        if (self.isDensityMode || cuts.length === 0) {
          return undefined
        }
        const { posColor, negColor, innerColors } = self.wiggleColor
        const colors = [negColor, ...innerColors, posColor]
        const { labels, title } = self.colorSetting
        const spans = thresholdLabels(cuts)
        const names = keyNames(spans, labels)
        return {
          kind: 'categorical',
          id: 'threshold',
          title: title ?? 'score',
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
        const { title } = self.colorSetting
        const scales: ColorScale[] = []
        if (self.scoreColorScale) {
          scales.push({
            ...self.scoreColorScale,
            title: title ?? self.scoreColorScale.title,
          })
        }
        if (this.thresholdColorScale) {
          scales.push(this.thresholdColorScale)
        }
        if (!(self.isOverlay && self.scoreGradientPaints)) {
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
        return !self.isOverlay
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
    .actions(self => ({
      startRenderingBackend(backend: WiggleRenderingBackend) {
        installWiggleRenderingBackend(self, backend)
      },

      setShowRowSeparators(arg: boolean) {
        setConf(self, 'showRowSeparators', arg)
      },

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

      /**
       * #action
       * A Plot type leaf whole, so the regions encode once and never as the
       * new plot in the old layout.
       */
      setPlot(rendering: string, rowLayout: boolean) {
        self.setRenderingType(rendering)
        setConf(self, ['rows', 'field'], rowLayout ? 'source' : '')
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
       * order through `rows.domain`, the same channel clustering and the
       * arrangement dialog write, so "Reset row order" undoes all three.
       *
       * Named by coordinate rather than by loaded-region index because both
       * entry points are: the right-click hit resolves to one, and a session's
       * `sortRowsBy` carries one across a reload. Resolving that region and
       * refusing the two cases where a sort would only cost a `rows.domain` write
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
            sortSourcesByScoreAt(sources, data, pos, self.effectiveAggregate),
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
            ready: () => self.clusterableSources.length > 1,
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
          makeRenderingTypeSubMenu(self, WIGGLE_RENDERINGS),
          // a row order exists only once the sources are on rows
          ...(self.isRowLayout
            ? [
                clusteringMenuItem(
                  self,
                  {
                    label: 'Cluster rows by score...',
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
                  self.clusterableSources.length,
                ),
                ...resetRowOrderMenuItems(self),
              ]
            : []),
          ...makeResolutionSubMenu(self),
          makeScoreAxisMenuItem(
            self,
            self.isDensityMode ? { label: SCORE_RANGE_LABEL } : {},
          ),
          ...makeShowSubMenu(showItems),
          // point size / line width are top-level submenus, each present only in
          // its respective scatter / line rendering
          ...makePointSizeMenuItems(self),
          ...makeLineWidthMenuItems(self),
          // `ready: true`: a swatch waits for no row list, and a gate would grey
          // out the only color route on a plain BigWig until a fetch lands
          rowArrangementMenuItem(self, {
            ready: true,
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
          ...editPlotMenuItems(self),
        ]
      },

      /**
       * #method
       * Right-click menu, built from the column the click landed on. The
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

// Re-exported off the module the `LinearWiggleDisplay/stateModel` subpath
// names, because gccontent composes this factory and its emitted `.d.ts` has to
// name every type the inferred model mentions. Without these the ESM build
// reports TS2883 against the source paths, which no package can import.
export type { WiggleContextInfo } from './components/findHit.ts'
export type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>

// See SatisfiesComponentContract for why this guard exists and why it's spelled
// out in each model file rather than centralized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract = SatisfiesComponentContract<
  WiggleDisplayModel,
  LinearWiggleDisplayModel
>
