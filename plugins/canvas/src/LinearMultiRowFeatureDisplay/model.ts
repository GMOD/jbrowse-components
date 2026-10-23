import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { summarizePast } from '@jbrowse/core/ui/colorScale'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { assembleLocString, getSession } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import FacetWritesMixin from '@jbrowse/display-kit/FacetWritesMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import PointerHoverMixin from '@jbrowse/display-kit/PointerHoverMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { installUpload } from '@jbrowse/render-core/installUpload'
import {
  HIDDEN_ROW,
  NO_ROW_COLOR,
  RowKeys,
  buildRowTable,
  inkOfInstances,
  shiftInk,
} from '@jbrowse/render-core/marks'
import {
  ContextMenuMixin,
  TreeSidebarMixin,
  resetRowOrderMenuItems,
  setupTreeSidebarAutoruns,
  loadedRegionIndexAt,
  sortRowsHereMenuItem,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { copyItem } from '../shared/copyMenuItem.ts'
import { featureColorViews } from '../shared/featureColorViews.ts'
import {
  featureSpanRegion,
  fetchCanvasFeatureDetails,
} from '../shared/fetchCanvasFeatureDetails.ts'
import { createCanvasFeatureDetailsOpener } from '../shared/openCanvasFeatureDetails.ts'
import { applyColumnSort, columnSortLabel } from './columnSort.ts'
import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'
import {
  contextTargetAtPixel,
  featureAtPixel,
  hitInstance,
  hitRow,
} from './hitTesting.ts'
import {
  buildColorLegend,
  entryHidden,
  resolveIdentityLegend,
} from './rendering/colorLegend.ts'
import { buildMultiRowChannels } from './rendering/multiRowChannels.ts'
import { MULTI_ROW_MARKS } from './rendering/multiRowMarks.ts'
import { compileRowGroups, orderRowValues, tagRowGroups } from './rowSources.ts'
import {
  answeredRowsField,
  effectiveRowsField,
  clusterCandidates,
  colorFieldCandidates,
  itemRgbFields,
  rowsFieldCandidates,
  rowCountsByField,
  pinnedRowsField,
  resolveClusterField,
  regionHasPinnedData,
} from './rowsFields.ts'
import { buildMultiRowTrackMenuItems } from './trackMenuItems.ts'
import { windowedRegion } from './windowedRegion.ts'

import type {
  LinearMultiRowFeatureDisplayConfig,
  LinearMultiRowFeatureDisplayConfigModel,
} from './configSchema.ts'
import type { MultiRowContextMenuInfo, MultiRowHit } from './hitTesting.ts'
import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type {
  MultiRowEncodeInputs,
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowRenderingBackend,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { RowGroup } from './rowSources.ts'
import type { RowCountByField } from './rowsFields.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CategoricalEntry, ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Region } from '@jbrowse/core/util'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { RowTable } from '@jbrowse/render-core/marks'
import type {
  RowBanding,
  RowSource,
  SvgSidebarProps,
  UnlistedRowsSort,
} from '@jbrowse/tree-sidebar'
import type React from 'react'

function listedOrSummarized(entries: CategoricalEntry[]) {
  return { entries, ...summarizePast(entries, MAX_LEGEND_ENTRIES) }
}

export type { MultiRowContextMenuInfo, MultiRowHit } from './hitTesting.ts'

/**
 * #stateModel LinearMultiRowFeatureDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * Partitions a single feature track into stacked rows by a feature attribute
 * and paints each feature as a colored block on its row.
 */
export default function stateModelFactory(
  configSchema: LinearMultiRowFeatureDisplayConfigModel,
) {
  return types
    .compose(
      'LinearMultiRowFeatureDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      LegendMixin(),
      ColorWritesMixin(),
      FacetWritesMixin(),
      TreeSidebarMixin(),
      ContextMenuMixin<MultiRowContextMenuInfo>(),
      PointerHoverMixin<MultiRowHit>(
        (a, b) => a.id === b.id && a.regionIndex === b.regionIndex,
      ),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMultiRowFeatureDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Legend categories toggled off, by label; features painted in a hidden
         * category's color drop out of both render paths and the hit test.
         */
        hiddenCategories: types.array(types.string),
        /**
         * #property
         * The `legendKeySpace` the hidden categories were picked in; they
         * apply only while it still holds. Unset in a session saved before it
         * existed, which keeps its hides.
         */
        hiddenKeySpace: types.maybe(types.string),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * The foundation's per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, MultiRowRegionData> {
        return self.regionPayloads as ReadonlyMap<number, MultiRowRegionData>
      },
      /**
       * #getter
       * This display always draws its label above the plot.
       */
      get prefersOffset() {
        return true
      },
      /**
       * #getter
       */
      get view() {
        return containingLgv(self)
      },
      /**
       * #getter
       * Config typed off the concrete schema, which ConfigurationReference
       * erases to any.
       */
      get conf(): LinearMultiRowFeatureDisplayConfig {
        return self.configuration
      },
      /**
       * #getter
       * The byte-gate opt-in: this display paints into fixed lanes, so a high
       * feature count is not a per-glyph render cost and only bytes gate it.
       */
      get gateEnabled() {
        return true
      },
      /**
       * #getter
       */
      get showRowSeparators(): boolean {
        return getConf(self, ['axis', 'grid'])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The raw `rows.field`, forwarded to the worker which resolves it per
       * feature. Reading it through `readConfObject` would evaluate a `jexl:`
       * expression against no context and ship the empty string as an
       * attribute name, drawing one unnamed row with nothing thrown.
       */
      get rowsField(): string {
        return self.conf.rows.field
      },
      /**
       * #getter
       * The raw `clusterField` slot, `auto` until the user picks one.
       */
      get clusterField(): string {
        return self.conf.clusterField
      },
      /**
       * #getter
       */
      get rowProportion(): number {
        return readConfObject(self.conf, 'rowProportion')
      },
      /**
       * #getter
       * Regex-to-group entries: a row takes the `group` of the first entry
       * its name matches. The read leaves a defaulted slot out, so this fills
       * it in.
       */
      get rowGroups(): RowGroup[] {
        return (
          readConfObject(self.conf, 'rowGroups') as Partial<RowGroup>[]
        ).map(({ match = '', group = '' }) => ({ match, group }))
      },
      /**
       * #getter
       * The `facet` object as written: `group` stacks the rows in bands by
       * their `rowGroups` group; undefined draws no bands.
       */
      get facet(): FacetSetting | undefined {
        return facetSettingOf({
          field: getConf(self, ['facet', 'field']),
          sort: getConf(self, ['facet', 'sort']),
        })
      },
    }))
    .views(featureColorViews)
    .actions(self => ({
      /**
       * #action
       * the picker Color by's Solid color... opens
       */
      openSolidColorDialog() {
        getSession(self).queueDialog(handleClose => [
          SolidColorDialog,
          {
            label: 'Feature color',
            color: self.solidColor ?? featureDefaultColor,
            written: self.writtenColor.value,
            onChange: (color: string) => {
              self.setColorValue(color)
            },
            onReset: () => {
              self.setColorValue(undefined)
            },
            handleClose,
          },
        ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The `rowGroups` entries whose `match` compiles.
       */
      get rowGroupMatchers() {
        return compileRowGroups(self.rowGroups)
      },
      /**
       * #getter
       * Whether anything is painted right now. An identity scale's key is
       * gated on this.
       */
      get hasDrawnFeatures(): boolean {
        return [...self.rpcDataMap.values()].some(
          data => data.featureIds.length > 0,
        )
      },
      /**
       * #getter
       * Whether the loaded data colored itself via `itemRgb`, which suppresses
       * the per-row palette that would paint over those colors.
       */
      get usedItemRgb(): boolean {
        return [...self.rpcDataMap.values()].some(data => data.usedItemRgb)
      },
      /**
       * #getter
       * The attribute a loaded region actually resolved its rows on, or
       * undefined while none has.
       */
      get answeredRowsField(): string | undefined {
        return answeredRowsField(self)
      },
      /**
       * #getter
       * The attribute the rows are actually partitioned on: the slot, or what
       * the worker picked off the data under auto. Everything asking "which
       * attribute are these rows" reads this rather than the raw slot above.
       */
      get effectiveRowsField(): string {
        return effectiveRowsField(self)
      },
      /**
       * #getter
       * What a fetch issued now should partition on under auto. Deliberately
       * not an `rpcProps()` key, which would refetch every region the moment
       * the first one answered.
       */
      get pinnedRowsField(): string {
        return pinnedRowsField(self)
      },
      /**
       * #getter
       * The attribute names on the loaded features, offered by the
       * "One row per..." menu.
       */
      get rowsFieldCandidates(): string[] {
        return rowsFieldCandidates(self)
      },
      /**
       * #getter
       * The attribute names Color by offers beside its Strand preset.
       */
      get colorFieldCandidates(): string[] {
        return colorFieldCandidates(self)
      },
      /**
       * #getter
       * Whether the loaded features carry a BED color column, which Color
       * by's itemRgb preset paints.
       */
      get carriesItemRgb(): boolean {
        return itemRgbFields(self).length > 0
      },
      /**
       * #getter
       * Whether each feature paints its own color, black included, through
       * a fieldless identity `encoding.color`.
       */
      get paintsItemRgb(): boolean {
        const { scale, field, value } = self.writtenColor
        return scale?.type === 'identity' && !field && value === undefined
      },
      /**
       * #getter
       * The attribute names "Cluster rows by similarity" offers.
       */
      get clusterCandidates(): string[] {
        return clusterCandidates(self)
      },
      /**
       * #getter
       * How many rows each candidate would draw, which the menu shows beside
       * each name so a reader can judge it before paying the refetch.
       */
      get rowCountsByField(): ReadonlyMap<string, RowCountByField> {
        return rowCountsByField(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Each loaded region narrowed to the features in the settled window
       * (`windowedRegion`), which the rows and the key are read off. The
       * window settles once a pan pauses, so rows change once per gesture.
       */
      get windowedRegions(): MultiRowRegionData[] {
        const blocks = self.view.settledDynamicBlocks
        return [...self.rpcDataMap].map(([idx, data]) =>
          windowedRegion(
            data,
            blocks.filter(b => b.displayedRegionIndex === idx),
          ),
        )
      },
    }))
    .views(self => {
      // A plain getter hands out a fresh array on every write to `rpcDataMap`,
      // and this list reaches the row table, whose identity has to hold
      // steady.
      const discoveredRows = stableIdentityComputed(() => {
        const values = new Set<string>()
        for (const data of self.windowedRegions) {
          for (const v of data.rowValues) {
            values.add(v)
          }
        }
        const unanswered = `(no ${self.effectiveRowsField})`
        return orderRowValues(values, self.baseRowSort).map(name =>
          name === '' ? { name, label: unanswered } : { name },
        )
      })
      return {
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the distinct partition values of the
         * features in the window, in the order the config.json declares, the rest
         * sorted.
         */
        get discoveredRows(): RowSource[] {
          return discoveredRows.get()
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the rows an order does not list sort,
         * digits by magnitude and the unanswered row last, since discovered
         * values arrive in arbitrary order.
         */
        get unlistedRowsSort(): UnlistedRowsSort {
          return 'sorted'
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the `facet`, its bands listed first and
         * then the `rowGroups` groups in the order they are declared. A row
         * has only its name and `group`, so a facet on a feature field
         * bands nothing, and `rowBandingNotices` reports that; banding by one
         * would split rows in the worker.
         */
        get rowBanding(): RowBanding | undefined {
          const { facet } = self
          return facet
            ? {
                field: facet.field,
                sort: [
                  ...facet.sort,
                  ...self.rowGroups.map(({ group }) => group),
                ],
              }
            : undefined
        },
        /**
         * #method
         * `TreeSidebarMixin`'s hook: each row tagged with the group of the
         * first `rowGroups` entry its name matches.
         */
        expandRows(rows: RowSource[]): RowSource[] {
          return tagRowGroups(rows, self.rowGroupMatchers)
        },
        /**
         * #method
         * `TreeSidebarMixin`'s hook: under `group`, the `rowGroups` groups
         * in the order they are declared, so a group's color holds whichever
         * rows have loaded.
         */
        rowColorDeclaredValues(field: string): readonly string[] {
          return field === 'group'
            ? self.rowGroups.map(({ group }) => group)
            : []
        },
        /**
         * #getter
         * `rowBandingNotices`.
         */
        get liveNotices(): string[] {
          return self.rowBandingNotices
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: a row's color paints its blocks while
         * nothing else colors them: no `color` value or field, and no itemRgb
         * in the file.
         */
        get rowColorPaintsMarks(): boolean {
          const { value, field } = self.workerColor
          return value === undefined && !field && !self.usedItemRgb
        },
        /**
         * #getter
         * The attribute each row's blocks are clustered on, resolving `auto`
         * off the coloring; empty clusters on presence alone.
         */
        get effectiveClusterField(): string {
          return resolveClusterField({
            clusterField: self.clusterField,
            color: self.workerColor,
            candidates: self.clusterCandidates,
            rowsField: self.effectiveRowsField,
          })
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       */
      get rowIndexByValue(): Map<string, number> {
        return new Map(self.sources.map((s, i) => [s.name, i] as const))
      },
      /**
       * #getter
       * Each display row's color, packed for the painters, `undefined` where
       * the row has none or `rowColorPaintsMarks` is off and the feature's own
       * color paints instead. Applied at render time, so any color change
       * repaints without a refetch.
       */
      get rowColorsByIndex(): (number | undefined)[] {
        const colors = self.rowColorPaintsMarks
          ? self.resolvedRowColors
          : undefined
        return self.sources.map(s => {
          const css = colors?.get(s.name)
          return css === undefined ? undefined : cssColorToABGR(css)
        })
      },
      /**
       * #getter
       * Number of displayed rows, at least 1 so the auto-fit division is safe
       * and the canvas mounts before data arrives.
       */
      get nrow(): number {
        return Math.max(1, self.sources.length)
      },
      /**
       * #getter
       * The track height the rows divide among them, as multi-wiggle's do:
       * more rows shrink them, never grow the track.
       */
      get fitTargetHeight(): number {
        return self.allottedHeight
      },
      /**
       * #getter
       * Ceiling on the whole row stack in CSS px: this display sizes its canvas
       * to its content and never scrolls, so nothing downstream bounds it.
       */
      get maxCanvasHeight(): number {
        return maxCanvasCssPx()
      },
      /**
       * #getter
       * The rows an identity `color` names, whether or not anything is drawn.
       */
      get identityLegend() {
        return resolveIdentityLegend(self.identityKeyEntries)
      },
      /**
       * #getter
       * What the key's names are names of: the painting field and the scale
       * it paints through, or the constant or expression every feature is
       * painted by. A name means nothing outside the key that offered it.
       */
      get legendKeySpace(): string {
        const encoding = self.colorEncoding
        return typeof encoding === 'object'
          ? `${encoding.field}\t${encoding.scale}`
          : `\t\t${self.colorSetting.value ?? ''}`
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The hidden categories, while the key they were picked in still holds.
       * Derived rather than cleared on a change, so an undo or a reload that
       * restores the key restores its hides with it.
       */
      get activeHiddenCategories(): readonly string[] {
        return self.hiddenKeySpace === undefined ||
          self.hiddenKeySpace === self.legendKeySpace
          ? self.hiddenCategories
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The single place "is this category hidden?" is answered, so a change to
       * how a label is matched cannot reach some legends and miss the rest.
       */
      get hiddenCategorySet(): ReadonlySet<string> {
        return new Set(self.activeHiddenCategories)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Categorical color key over `regions`: an identity scale's colors, else
       * the one the color field's scale derives from the values the worker
       * found, else the one the painted colors derive, each named by the
       * features that have it. All are gated on there being a painting to key, since a
       * key describes colors on screen. Empty under a ramp, which
       * paints over all of them.
       */
      colorLegendOf(regions: Iterable<MultiRowRegionData>) {
        if (self.colorRamp) {
          return []
        }
        const identity = self.hasDrawnFeatures ? self.identityLegend : []
        return identity.length
          ? identity
          : buildColorLegend(regions, {
              field: self.paintedColorField,
              domain: self.colorSetting.scale.domain,
              rowIndexByValue: self.rowIndexByValue,
              rowColorsByIndex: self.rowColorsByIndex,
            })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The key over the features in the window.
       */
      get colorLegend() {
        return self.colorLegendOf(self.windowedRegions)
      },
      /**
       * #getter
       * The key over every loaded feature, so a hidden value stays hidden on
       * a feature panning in before the window settles.
       */
      get loadedColorLegend() {
        return self.colorLegendOf(self.rpcDataMap.values())
      },
    }))
    .views(self => {
      // Identity-stable, in color order: the encode keys on it, and the legend
      // it is read off recomputes on every recolor and region arrival.
      const hiddenColors = stableIdentityComputed(() => {
        if (!self.activeHiddenCategories.length) {
          return new Set<number>()
        }
        const hidden = self.hiddenCategorySet
        return new Set(
          [...self.colorLegend, ...self.loadedColorLegend]
            .filter(e => entryHidden(e, hidden))
            .map(e => e.color)
            .sort((a, b) => a - b),
        )
      })
      return {
        /**
         * #getter
         * ABGR colors currently hidden via the legend's category toggles. Both
         * render paths and the hit test skip features painted in one of these,
         * so a toggle drops it everywhere without a refetch.
         */
        get hiddenColors(): ReadonlySet<number> {
          return hiddenColors.get()
        },
        /**
         * #getter
         * The height under `rowsTopOffset` split evenly across the rows, the
         * stack capped at `maxCanvasHeight`. Not floored at a pixel: `rowBand`
         * widens a sub-pixel row for drawing without changing how many fit.
         */
        get effectiveRowHeight(): number {
          return (
            Math.min(
              Math.max(0, self.fitTargetHeight - self.rowsTopOffset),
              self.maxCanvasHeight,
            ) / self.nrow
          )
        },
        /**
         * #getter
         * `LegendMixin`'s hook, two vocabularies as two scales: the per-feature
         * painting, toggleable and dimmed where a category is hidden, and the
         * row color key, which names rows and is not.
         */
        get colorScales(): ColorScale[] {
          const hidden = self.hiddenCategorySet
          const { paintedColorField: field } = self
          const ramp = self.hasDrawnFeatures
            ? self.rampColorScales('features')
            : []
          return [
            ...ramp,
            {
              kind: 'categorical' as const,
              id: 'features',
              title: self.colorKeyTitle ?? 'Feature colors',
              domain: field ? field.domain : self.colorSetting.scale.domain,
              ...listedOrSummarized(
                self.colorLegend.map(e => ({
                  value: e.values[0]!,
                  values: e.values,
                  label: e.label,
                  color: abgrToCssRgba(e.color),
                  hidden: entryHidden(e, hidden),
                })),
              ),
            },
            ...self.rowColorScales,
          ].filter(scale => scale.kind === 'ramp' || scale.entries.length > 0)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * Overrides `LegendMixin`'s: an identity key merely waiting for data
       * must not take the way back to the "Legend" toggle with it.
       */
      get hasLegendKey() {
        return self.colorScales.length > 0 || self.identityLegend.length > 0
      },
      /**
       * #getter
       * The `height` slot, the row stack capped at `maxCanvasHeight` and the
       * track floored at MIN_DISPLAY_HEIGHT, never the row, so a sub-pixel row
       * stays legitimate.
       */
      get height(): number {
        return Math.max(
          MIN_DISPLAY_HEIGHT,
          Math.min(
            self.fitTargetHeight,
            self.rowsTopOffset + self.maxCanvasHeight,
          ),
        )
      },
      /**
       * #getter
       * Pixel width reserved on the left for the tree, 0 when no tree shows.
       */
      get sidebarOffset(): number {
        return treeSidebarOffset(self)
      },
      /**
       * #getter
       */
      get svgSidebar(): SvgSidebarProps {
        return {
          showTree: self.showTree,
          hierarchy: self.hierarchy,
          sources: self.sources,
          rowHeight: self.effectiveRowHeight,
          treeAreaWidth: self.treeAreaWidth,
          showLabels: self.showRowLabels,
          bands: self.rowBands,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The box the rows paint in, under `rowsTopOffset`: the canvas, its
       * overlays and the labels.
       */
      get rowsHeight(): number {
        return Math.max(0, self.height - self.rowsTopOffset)
      },
    }))
    .views(self => {
      let keySpace = { field: '', rowKeys: new RowKeys() }
      const currentRowKeys = () => {
        const field = self.effectiveRowsField
        if (keySpace.field !== field) {
          keySpace = { field, rowKeys: new RowKeys() }
        }
        return keySpace.rowKeys
      }
      // Every value a loaded region carries, and every row drawn, keyed; the
      // identity moves only when a name is first seen.
      const rowKeyNames = stableIdentityComputed(() => {
        const rowKeys = currentRowKeys()
        for (const data of self.rpcDataMap.values()) {
          for (const value of data.rowValues) {
            rowKeys.keyOf(value)
          }
        }
        for (const { name } of self.sources) {
          rowKeys.keyOf(name)
        }
        return rowKeys.names.slice()
      })
      const tableInputs = stableIdentityComputed(() => ({
        order: self.sources.map(s => s.name),
        colors: self.rowColorsByIndex,
      }))
      return {
        /**
         * #getter
         * The key each row name holds across every loaded region, assigned
         * at the name's first arrival and never moved; the instance buffers
         * contain these. A new partitioning field is a new key space.
         */
        get rowKeys(): RowKeys {
          return currentRowKeys()
        },
        /**
         * #getter
         * What the encode reads, and so what re-encodes every region on its
         * identity: the keys, the hidden categories and the color field's
         * palette. The reader's order, focus and colors are the table's.
         */
        get encodeInputs(): MultiRowEncodeInputs {
          return {
            rowKeys: currentRowKeys(),
            hiddenColors: self.hiddenColors,
            fieldPalette: self.fieldPalette,
          }
        },
        /**
         * #getter
         * The row table both backends and the hit test place each key
         * through: its drawn row, hidden where the focus left it out, and its
         * color override. Rebuilt on a reorder, focus, recolor or a new
         * name, which is one texture upload and no instance bytes.
         */
        get rowTable(): RowTable {
          const keys = rowKeyNames.get().length
          const rowKeys = currentRowKeys()
          const { order, colors } = tableInputs.get()
          const slot = new Uint32Array(keys).fill(HIDDEN_ROW)
          const color = new Uint32Array(keys)
          for (const [i, name] of order.entries()) {
            const key = rowKeys.keyOf(name)
            slot[key] = i
            color[key] = colors[i] ?? NO_ROW_COLOR
          }
          return buildRowTable(slot, color)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * Render state passed to the GPU/Canvas2D backend each frame.
       */
      get renderState(): MultiRowRenderState {
        return {
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.rowsHeight,
          rowHeight: self.effectiveRowHeight,
          rowProportion: self.rowProportion,
          rowTable: self.rowTable,
        }
      },
      /**
       * #method
       * Fetch-input cache keys; color is resolved in the worker, so the raw
       * color slot is one.
       */
      rpcProps() {
        return {
          rowsField: self.rowsField,
          colorConfig: self.workerColor,
        }
      },
    }))
    .views(self => {
      const encoded = createEncodeMemo(
        () => self.rpcDataMap,
        // `encodeInputs`, never `renderState`: the channels hold
        // {x,x2,row,color} and no geometry — the row height and canvas box
        // reach the shape as uniforms, the reader's order, focus and colors
        // reach it as the row table, and a category toggle is what is left
        // to re-encode for.
        () => self.encodeInputs,
        buildMultiRowChannels,
      )
      return {
        /**
         * #getter
         * Every loaded region's `span` channels with their per-key buckets:
         * what the backend uploads, the hit test reads and the hover and
         * export draw from. The memo is held in this closure so it outlives a
         * context-loss recovery.
         */
        get encodedChannels(): ReadonlyMap<number, MultiRowEncoded> {
          return encoded()
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * The feature under a display-relative pixel.
       */
      featureAt(mouseX: number, mouseY: number): MultiRowHit | undefined {
        return featureAtPixel(self, mouseX, mouseY - self.rowsTopOffset)
      },
      /**
       * #method
       */
      hoverHitAt(mouseX: number, mouseY: number) {
        return this.featureAt(mouseX, mouseY)
      },
      /**
       * #method
       * A region that answered a different attribute than the pin holds nothing
       * this display can draw, and is refetched with the field spelled out. A
       * view, not an action: an action untracks the `rpcDataMap` read and
       * `FetchVisibleRegions` keeps a stale answer.
       */
      regionHasData(displayedRegionIndex: number) {
        return regionHasPinnedData(self, displayedRegionIndex)
      },
      /**
       * #method
       * What a right-click at this display-relative pixel resolves to.
       */
      contextTargetAt(mouseX: number, mouseY: number) {
        return contextTargetAtPixel(self, mouseX, mouseY - self.rowsTopOffset)
      },

      /**
       * #getter
       * The box of the block to mark, for the chrome's highlight. The hover
       * drops when a right-click menu opens, else its tooltip sticks under the
       * menu, so the menu's own feature stands in.
       */
      get hoverInk(): HighlightRect[] {
        const hit = self.hoveredFeature ?? self.contextMenuInfo?.hit
        const instance = hitInstance(self, hit)
        if (!hit || !instance) {
          return []
        }
        return inkOfInstances(
          MULTI_ROW_MARKS,
          self.renderBlocks,
          index => self.encodedChannels.get(index),
          self.renderState,
          index => (index === hit.regionIndex ? [instance] : undefined),
        ).map(r => shiftInk(r, 0, self.rowsTopOffset))
      },
      /**
       * #getter
       * A wash and a border: the block colors are the data.
       */
      get highlightStyle(): HighlightStyle {
        return 'box'
      },

      /**
       * #getter
       * The row the hovered feature sits on, off the live order.
       */
      get hoveredRow(): RowSource | undefined {
        return hitRow(self, self.hoveredFeature)
      },
    }))
    .actions(self => {
      const openDetails = createCanvasFeatureDetailsOpener(self)
      // The sort in flight, which a newer one supersedes: landing after it
      // would overwrite the order the reader asked for last.
      let columnSort: AbortController | undefined
      return {
        /**
         * #action
         */
        setShowRowSeparators(f: boolean) {
          setConf(self, ['axis', 'grid'], f)
        },
        /**
         * #action
         * Color by's itemRgb: each feature its file's color, through a
         * fieldless identity `encoding.color`, so a black triple paints
         * black.
         */
        colorByItemRgb() {
          if (!self.paintsItemRgb) {
            setConf(self, ['encoding', 'color'], {
              scale: { type: 'identity' },
            })
          }
        },
        /**
         * #action
         * Show or hide a key row's names together, at render time with no
         * refetch: a row any of whose names is hidden shows again.
         */
        toggleCategory(values: readonly string[]) {
          const active = self.activeHiddenCategories
          self.hiddenCategories.replace(
            values.some(v => self.hiddenCategorySet.has(v))
              ? active.filter(v => !values.includes(v))
              : [...active, ...values],
          )
          self.hiddenKeySpace = self.legendKeySpace
        },
        /**
         * #action
         */
        setHiddenCategories(labels: string[]) {
          self.hiddenCategories.replace(labels)
          self.hiddenKeySpace = self.legendKeySpace
        },
        /**
         * #action
         * Repartition. The arrangement and the row colors stay: a name keyed
         * on another field matches nothing and comes back with the field. The
         * legend's hidden categories stay too, since the features and their
         * colors do. Writing `rows.field` triggers a refetch.
         */
        setRowsField(field: string) {
          // Under auto, against what auto picked, so picking that radio pins
          // nothing; otherwise against the slot, since the loaded rows answer
          // the old field until a repartition's refetch lands.
          if (field === (self.rowsField || self.effectiveRowsField)) {
            return
          }
          setConf(self, ['rows', 'field'], field)
        },
        /**
         * #action
         * Recluster on a different feature attribute; empty clusters on
         * presence alone.
         */
        setClusterField(field: string) {
          setConf(self, 'clusterField', field)
        },
        /**
         * #action
         * Reorder the rows by each one's `effectiveClusterField` value at
         * (refName, pos). Resolves whether it wrote an order; `false` right
         * away where no region holding data covers the column or there is
         * under two rows to order.
         */
        async sortRowsByValueAt(refName: string, pos: number) {
          const index = loadedRegionIndexAt(self.loadedRegions, refName, pos)
          const region =
            index === undefined || !self.rpcDataMap.has(index)
              ? undefined
              : self.loadedRegions.get(index)
          if (!region || self.editableSources.length < 2) {
            return false
          }
          columnSort?.abort()
          const controller = new AbortController()
          columnSort = controller
          try {
            return await applyColumnSort(
              self,
              {
                rpcManager: getSession(self).rpcManager,
                sessionId: getRpcSessionId(self),
                signal: controller.signal,
              },
              region,
              pos,
            )
          } catch (e) {
            if (!isAbortException(e)) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
            return false
          }
        },
        /**
         * #action
         * Re-fetch the full clicked feature by id and open it in the feature
         * details widget, since the painting ships only the slim render arrays.
         */
        selectFeatureById(featureId: string, displayedRegionIndex: number) {
          void openDetails(async () => {
            const region = self.loadedRegions.get(displayedRegionIndex)
            // Narrowed to the clicked feature's own span, which the packed
            // arrays already carry; the buffered region would re-download
            // everything on screen to pick one feature out of it.
            const data = self.rpcDataMap.get(displayedRegionIndex)
            const i = data ? data.featureIds.indexOf(featureId) : -1
            const detailsRegion =
              region && data && i !== -1
                ? featureSpanRegion(
                    region,
                    data.featureStarts[i]!,
                    data.featureEnds[i]!,
                  )
                : region
            return detailsRegion
              ? fetchCanvasFeatureDetails(
                  getSession(self),
                  getRpcSessionId(self),
                  self.adapterConfig,
                  featureId,
                  detailsRegion,
                )
              : undefined
          })
        },
        /**
         * #action
         * Stage a region as fetched, so a test stands up a loaded display in one
         * call; production goes through `ctx.commitRegion`.
         */
        setRpcData(
          regionIndex: number,
          data: MultiRowRegionData,
          region: Region,
        ) {
          self.setLoadedRegion(regionIndex, region, data)
        },
        /**
         * #action
         * Set the track height, floored at MIN_DISPLAY_HEIGHT; the rows divide
         * it.
         */
        setHeight(newHeight: number) {
          setConf(self, 'height', Math.max(newHeight, MIN_DISPLAY_HEIGHT))
          return self.height
        },
        /**
         * #action
         * Drag-resize, deferring to `setHeight`.
         */
        resizeHeight(distance: number) {
          const oldHeight = self.height
          self.setHeight(self.height + distance)
          return self.height - oldHeight
        },
        /**
         * #action
         */
        startRenderingBackend(backend: MultiRowRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.encodedChannels,
            render: (b, uploaded) =>
              b.renderBlocks(self.renderBlocks, uploaded, self.renderState),
          })
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        return fetchMultiRowFeatures(self, needed)
      },
      /**
       * #action
       */
      async renderSvg(opts: ExportSvgDisplayOptions): Promise<React.ReactNode> {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
    .actions(self => ({
      afterAttach() {
        // What makes `encodedChannels` and the row table memos at all: their
        // consumers are pointer handlers, and MobX discards an unobserved
        // computed's value as it hands it over. Safe to hold because both key
        // off the data, the rows and the colors, never live view geometry.
        autorunOnReadyView(
          self,
          () => {
            void self.encodedChannels
            void self.rowTable
          },
          { name: 'MultiRowHitIndexes' },
        )
        setupTreeSidebarAutoruns(self, {
          name: 'MultiRowFeature',
          // Forwarded, not swallowed: `false` is "no loaded region covers
          // that column", and it holds `sortRowsBy` for the fetch that will.
          sortRows: (refName, pos) => self.sortRowsByValueAt(refName, pos),
          clustering: {
            run: async args => {
              const { runMultiRowClustering } =
                await import('./runMultiRowClustering.ts')
              await runMultiRowClustering({ model: self, ...args })
            },
          },
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       * Items for the right-click context menu, built from the clicked position.
       */
      contextMenuItems(): MenuItem[] {
        const info = self.contextMenuInfo
        if (!info) {
          return []
        }
        const { hit } = info
        return [
          sortRowsHereMenuItem({
            label: columnSortLabel(self.effectiveClusterField),
            rowCount: self.editableSources.length,
            onClick: () => {
              void self.sortRowsByValueAt(info.refName, info.pos)
            },
          }),
          ...(hit
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.selectFeatureById(hit.id, hit.regionIndex)
                  },
                },
                copyItem(
                  self,
                  'Copy location',
                  assembleLocString({
                    refName: hit.refName,
                    start: hit.start,
                    end: hit.end,
                  }),
                  'location',
                ),
              ]
            : []),
          ...resetRowOrderMenuItems(self),
        ]
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            ...buildMultiRowTrackMenuItems(self),
            ...editPlotMenuItems(self),
          ]
        },
      }
    })
}

type LinearMultiRowFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiRowFeatureDisplayModel =
  Instance<LinearMultiRowFeatureDisplayStateModel>
