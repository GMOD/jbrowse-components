import { lazy } from 'react'

import { ConfigurationReference, setConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import {
  assembleLocString,
  getDialogHost,
  getEnv,
  getSession,
  pluralize,
} from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { unreadInEveryRegion } from '@jbrowse/core/util/fieldPredicate'
import {
  installPrerequisiteFetch,
  isCurrentRead,
  readFor,
} from '@jbrowse/core/util/installPrerequisiteFetch'
import {
  baseJexlFilters,
  configuredJexlFilters,
  writeJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { selectEncodedFeature } from '@jbrowse/core/util/selectEncodedFeature'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import FacetWritesMixin from '@jbrowse/display-kit/FacetWritesMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { openPlotDialog as queuePlotDialog } from '@jbrowse/display-kit/plotMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances, shiftInk, keySlot } from '@jbrowse/render-core/marks'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  orderRowsByValueAt,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
} from '@jbrowse/tree-sidebar'
import { ScoreScaleMixin } from '@jbrowse/wiggle-core'
import { autorun } from 'mobx'

import { exportedMarkFeatures } from './exportedFeatures.ts'
import { instancesOfFeature } from './featureInstances.ts'
import { fetchPlotFields, plotScanRegions } from './fetchPlotFields.ts'
import { sameMarkHit } from './findMarkHit.ts'
import { saysColor } from './inheritedColor.ts'
import {
  markChannelViews,
  markConfigViews,
  markEntryViews,
  markFacetViews,
  markRequestViews,
  markRowsViews,
  rowAttributesOf,
  isSizedRect,
} from './markConfigViews.ts'
import { rowValuesAt, storedRegionData } from './markList.ts'
import { markContextMenuItems, markTrackMenuItems } from './markMenus.ts'
import { markPlotSettingsOf } from './markPlot.ts'
import { markProblems, problemText } from './markProblems.ts'
import { binnedFetchRegions, positionSource } from './markRequest.ts'
import {
  markAutoscaleViews,
  markDiscoveredRowViews,
  markListedSourceViews,
  markRowListingViews,
  markDomainViews,
  markDrawnKeyViews,
  markRegionViews,
  markRowKeySpaceViews,
  markRowTableViews,
  markScaleViews,
  markSidebarViews,
  markStatsViews,
  markSvgSidebarViews,
} from './markResolveViews.ts'
import { MARK_Y_PATHS } from './markYPaths.ts'
import { sharedKeyNotice, sharedKeysOf } from './pinDistinct.ts'
import { defaultPlot } from './plotDefault.ts'
import {
  byCategoryBlocks,
  categoriesByColor,
  rowCompareLabel,
  rowCompareOf,
} from './rowCompare.ts'
import { TEXT_MARK_FONT_PX, placeTextMarks } from './textMarks.ts'

import type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
import type {
  LinearMarkDisplayConfig,
  LinearMarkDisplayConfigModel,
} from './configSchema.ts'
import type { MarkHitInfo } from './findMarkHit.ts'
import type { HiddenCategory } from './markColor.ts'
import type { MarkRegionData, MarkRenderState } from './markList.ts'
import type { MarkPlot, MarkPlotSettings } from './markPlot.ts'
import type { MarkProblem, MarkSnapshot } from './markProblems.ts'
import type { DefaultPlot } from './plotDefault.ts'
import type { RowCompare } from './rowCompare.ts'
import type { JoinedPlotFields, PlotFields } from './scanPlotFields.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  PlotWriteOptions,
} from '@jbrowse/core/configuration'
import type { RowSourceListing } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { MenuItem } from '@jbrowse/core/ui'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Feature } from '@jbrowse/core/util'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type {
  EncodedLayersResult,
  FacetSpec,
  LayerRequest,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { FloatingLabel } from '@jbrowse/display-kit/floatingLabelHost'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type MarkRenderingBackend = PerRegionRenderingBackend<
  MarkRegionData,
  MarkRenderState
>

const MarkPlotDialog = lazy(() => import('./components/MarkPlotDialog.tsx'))

// What the rule list reads beside the plot: the row attributes a config
// gives its rows, `group` where `rows.groups` declares any, and the display's
// own `encoding.color`.
type MarkColorSnapshot = NonNullable<MarkSnapshot['encoding']>['color']

function plotContextOf(conf: AnyConfigurationModel) {
  const { encoding } = getSnapshot<{
    encoding?: { color?: MarkColorSnapshot }
  }>(conf)
  return { rowAttributes: rowAttributesOf(conf), color: encoding?.color }
}

const NO_JOINED_FIELDS: JoinedPlotFields = { numeric: [], categorical: [] }

/**
 * #stateModel LinearMarkDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * A display declared in config: a list of marks, each with an encoding from
 * feature fields to channels, drawn in order over one score axis from one
 * worker fetch per region.
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: LinearMarkDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearMarkDisplay',
        // Nested so the parts stay under `types.compose`'s nine, the ceiling
        // whose tenth part erases every prop instead of failing.
        types.compose(
          BaseDisplay,
          TrackHeightMixin(),
          MultiRegionDisplayMixin(),
          TreeSidebarMixin(),
          RowHeightMixin(),
        ),
        ScoreScaleMixin(MARK_Y_PATHS),
        LegendMixin(),
        ContextMenuMixin<MarkDisplayContextMenuInfo>(),
        StoredHoverMixin<MarkHitInfo>(sameMarkHit),
        HiddenGroupsMixin(),
        FacetWritesMixin(),
        // #region configRef
        types.model({
          type: types.literal('LinearMarkDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          // #endregion
          /**
           * #property
           * The categories the key's rows hide, each a value of the field a
           * categorical color reads or a color an identity key lists: session
           * state the Categories menu toggles, applied where the colors
           * resolve, so a toggle refetches nothing. Kept across a field
           * change and live again when the field comes back.
           */
          hiddenCategories: types.frozen<
            readonly HiddenCategory[] | undefined
          >(),
        }),
      )
      .views(() => ({
        /**
         * #getter
         * Opt into the byte gate: `CoreGetEncodedLayers` measures the index before
         * it downloads, so an over-budget region is refused before a feature is
         * read.
         */
        get gateEnabled() {
          return true
        },
      }))
      // #region chainedViews
      .views(self => ({
        /**
         * #getter
         * the config typed off the concrete schema
         */
        get conf(): LinearMarkDisplayConfig {
          return self.configuration
        },
      }))
      // #endregion
      .views(self => ({
        /**
         * #getter
         * the track label sits above the plot so the y-axis stays on the edge
         */
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * Overridable hook: what every region's fetch hands the adapter beside
         * the region and the zoom, or undefined for nothing. A fetch input, so
         * a change refetches; `resolveAdapterOptions` places it on each region.
         * Manhattan's LD join is one.
         */
        get adapterOptions(): object | undefined {
          return undefined
        },
        /**
         * #method
         * Overridable hook: `adapterOptions` as one region's fetch sends them
         * as `CoreGetEncodedLayers`'s `opts`, resolved on the main thread,
         * where the assembly's aliases are; undefined sends none.
         */
        resolveAdapterOptions(
          options: object,
          _region: Region,
          _signal: AbortSignal,
        ): Promise<object | undefined> {
          return Promise.resolve(options)
        },
        /**
         * #method
         * Overridable hook: what the display draws with nothing declared, off
         * the scanned fields, or undefined where they decide nothing and the
         * plot dialog opens instead.
         */
        defaultPlotOf(fields: PlotFields): DefaultPlot | undefined {
          return defaultPlot(fields)
        },
        /**
         * #getter
         * Overridable hook: whether the track menu offers the scanned fields,
         * so a declared plot still scans, and rescans while it holds none.
         */
        get menusOfferPlotFields(): boolean {
          return false
        },
        /**
         * #getter
         * Overridable hook: the fields `adapterOptions` has the adapter write
         * onto a feature, which Edit plot offers beside the ones a scan of the
         * file found. Manhattan's LD join writes two.
         */
        get joinedPlotFields(): JoinedPlotFields {
          return NO_JOINED_FIELDS
        },
        /**
         * #getter
         * What each function a formula may call returns, so Edit plot offers
         * a formula's field as numeric or categorical by what it answers.
         */
        get jexlFunctions() {
          return getEnv(self).pluginManager.jexl.signatures()
        },
        /**
         * #getter
         * The `jexl:` expressions the `filter` list holds.
         */
        get configuredFilters() {
          return () => configuredJexlFilters(self)
        },
        /**
         * #getter
         * The expressions the track's config declares, which "Clear all
         * filters" returns to.
         */
        get baseFilters() {
          return () => baseJexlFilters(self)
        },
      }))
      .views(self => markConfigViews(self))
      .views(self => markChannelViews(self))
      .views(self => markFacetViews(self))
      .views(self => markEntryViews(self))
      .views(self => markRowsViews(self))
      .views(self => markRequestViews(self))
      .views(self => ({
        /**
         * #getter
         * The layers as they came back, keyed by displayedRegionIndex: the
         * foundation's per-region store.
         */
        get featurePayloads(): ReadonlyMap<number, MarkRegionData> {
          return self.regionPayloads as ReadonlyMap<number, MarkRegionData>
        },
      }))
      .volatile(() => ({
        /**
         * #volatile
         * The latest `MarkGetRowSources` answer, stamped with the adapter
         * config it answers; null where the adapter lists none or the read
         * failed.
         */
        sourceListing: undefined as
          | AdapterRead<RowSourceListing | null>
          | undefined,
      }))
      .actions(self => ({
        /**
         * #action
         */
        setSourceListing(read: AdapterRead<RowSourceListing | null>) {
          self.sourceListing = read
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The adapter's row listing for the current adapter config, until
         * which it is undefined, as for an adapter that lists none.
         */
        get adapterListing(): RowSourceListing | undefined {
          return readFor(self, self.sourceListing) ?? undefined
        },
        /**
         * #getter
         * The current adapter config's row listing has landed or failed, or
         * this display draws no rows from one.
         */
        get rowListingSettled(): boolean {
          return !self.drawsRows || isCurrentRead(self, self.sourceListing)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * True until the row listing settles, since the listing adds rows to
         * the ones the features name and reorders them.
         */
        get dataSuperseded(): boolean {
          return !self.rowListingSettled
        },
      }))
      .views(self => markRowListingViews(self))
      .views(self => markListedSourceViews(self))
      .views(self => ({
        /**
         * #method
         * A refName as the assembly it is on names it, which a link's far
         * foot is matched to the view's regions by.
         */
        canonicalRefName(assemblyName: string, refName: string): string {
          return (
            getSession(self)
              .assemblyManager.get(assemblyName)
              ?.getCanonicalRefName2(refName) ?? refName
          )
        },
      }))
      .views(self => markDiscoveredRowViews(self))
      .views(self => markRowKeySpaceViews(self))
      .views(self => markRegionViews(self))
      .views(self => markRowTableViews(self))
      .views(self => markDrawnKeyViews(self))
      .views(self => markStatsViews(self))
      .views(self => markAutoscaleViews(self))
      .views(self => markDomainViews(self))
      .views(self => markSidebarViews(self))
      .views(self => markScaleViews(self))
      .views(self => markSvgSidebarViews(self))
      .views(self => ({
        /**
         * #getter
         * Whether a point mark draws at the view's zoom, for the Point size menu.
         */
        get hasPointMark(): boolean {
          return self.drawingMarkIndices.some(
            i => self.markTypes[i] === 'point',
          )
        },
        /**
         * #method
         * the fetch inputs SettingsInvalidate watches: `plotRequest`, all of
         * it evaluated in the worker, and the `adapterOptions` each region
         * resolves
         */
        rpcProps(): {
          layers: LayerRequest[]
          transform: TransformStep[]
          facet?: FacetSpec
          opts?: object
        } {
          const opts = self.adapterOptions
          return { ...(opts ? { opts } : {}), ...self.plotRequest() }
        },
        /**
         * #getter
         * The mark the hover or the open context menu is on, or undefined.
         */
        get highlightedHit(): MarkHitInfo | undefined {
          return self.hoveredFeature ?? self.contextMenuInfo?.hit
        },
        /**
         * #getter
         * A ring around a point or a rule, since a wash over 4 px of ink is
         * invisible and every hue may be the color scale's; a shade over
         * anything else.
         */
        get highlightStyle(): HighlightStyle {
          const type = this.highlightedHit
            ? self.markTypes[this.highlightedHit.markIndex]
            : undefined
          return type === 'point' || type === 'rule' ? 'ring' : 'shade'
        },
        /**
         * #getter
         * The box the hovered instance painted, for the chrome's highlight; the
         * context menu's hit stands in while a menu is open. In the chrome's px,
         * so the plot's inset is added to the canvas box. A ring wraps the ink
         * a fixed margin out, round a point and along a rule's whole length,
         * and floors at 6 px, so a tiny point stays findable.
         */
        get hoverInk(): HighlightRect[] {
          const hit = this.highlightedHit
          if (!hit) {
            return []
          }
          const top = self.rowsTopOffset
          const region = self.rpcDataMap.get(hit.regionIndex)
          const lit =
            hit.root !== undefined && region
              ? instancesOfFeature(region, hit.root)
              : [{ markIndex: hit.markIndex, index: hit.instance }]
          const instances = lit.flatMap(({ markIndex, index }) => {
            const mark = self.markList.findIndex(m => m.markIndex === markIndex)
            return mark === -1 ? [] : [{ mark, index }]
          })
          const boxes = inkOfInstances(
            self.markList,
            self.renderBlocks,
            index => self.rpcDataMap.get(index),
            self.renderState,
            index => (index === hit.regionIndex ? instances : undefined),
            [hit.regionIndex],
          ).map(r => shiftInk(r, 0, top))
          if (this.highlightStyle !== 'ring') {
            return boxes
          }
          const size = self.markSizes[hit.markIndex]!
          const r = Math.max(6, size / 2 + 4)
          const margin = r - size / 2
          return boxes.map(box => {
            const width = Math.max(2 * r, box.width + 2 * margin)
            const height = Math.max(2 * r, box.height + 2 * margin)
            return {
              left: box.left + (box.width - width) / 2,
              top: box.top + (box.height - height) / 2,
              width,
              height,
            }
          })
        },
        /**
         * #method
         * The text marks' labels as records in the display's own px, for a
         * host that shows the plot canvas but not the text layer over it: a
         * ring of the circular view. Placed and culled as on screen.
         */
        floatingLabels(palette: JBrowsePalette): FloatingLabel[] {
          if (!self.markTypes.includes('text')) {
            return []
          }
          const fontSize = TEXT_MARK_FONT_PX
          const top = self.rowsTopOffset - fontSize * TEXT_BASELINE_RATIO
          return placeTextMarks(
            self.textMarkEntries,
            self.rpcDataMap,
            self.renderBlocks,
            self.renderState,
            { size: fontSize },
            palette.text.primary,
          ).map(label => ({
            key: `${label.regionIndex}-${label.markIndex}-${label.instance}`,
            x: label.x - label.width / 2,
            y: top + label.baseline,
            width: label.width,
            text: label.text,
            color: label.color,
            fontSize,
          }))
        },
        /**
         * #getter
         * The rule list over the live config, with each problem's level and
         * slot: jbrowse-img fails an export on an error and warns on the rest.
         */
        get configProblems(): MarkProblem[] {
          return markProblems({
            ...markPlotSettingsOf(self.conf),
            ...plotContextOf(self.conf),
          })
        },
        /**
         * #method
         * The rule list over a config, as lines. It replaces the schema's
         * rules rather than adding to them, since it checks the colors and
         * `encoding.y` itself.
         */
        configProblemsOf(conf: AnyConfigurationModel): string[] {
          return markProblems({
            ...markPlotSettingsOf(conf),
            ...plotContextOf(conf),
          }).map(problemText)
        },
        /**
         * #method
         * A draft as the rule list reads it, merged over `plot` and lifted by
         * the config schema, throwing what a config file would be refused
         * for. It changes no state on this display.
         */
        liftMarkPlot(plot: MarkPlot): MarkPlotSettings {
          return markPlotSettingsOf(self.liftPlot(plot, { whole: true }))
        },
        /**
         * #getter
         * What the adapter said about the loaded regions that the plot cannot
         * show — an index SNP no LD record names — each once, for the corner
         * notice, and each `filter` field no loaded feature carries.
         */
        get dataNotices(): string[] {
          const regions = [...self.rpcDataMap.values()]
          return [
            ...new Set(regions.flatMap(d => d.notices ?? [])),
            ...unreadInEveryRegion(regions.map(d => d.unreadFilterFields)).map(
              field => self.unreadFilterFieldNotice(field, 'feature'),
            ),
          ]
        },
        /**
         * #getter
         * Overridable hook: notices a display derives from its state and
         * the view, beside the adapter's. Manhattan's reports when the LD index
         * SNP is out of reach of the screen.
         */
        get displayNotices(): string[] {
          return []
        },
        /**
         * #getter
         * A color over the rows' field whose written `range` names a color a
         * row's own replaces (`withRowColors`), one line per color object.
         */
        get rowColorNotices(): string[] {
          if (!self.drawsRows || !self.rowColorPaintsMarks) {
            return []
          }
          const rows = self.resolvedRowColors
          const lines = self.conf.marks.flatMap((m, i) => {
            const source = self.markColors[i]
            if (
              source?.kind !== 'categories' ||
              source.encoding.field !== self.rowsField
            ) {
              return []
            }
            const { domain = [], range = [] } = source.encoding
            const replaced = domain.map(String).filter((value, j) => {
              const row = rows.get(value)
              const own = range[j]
              return (
                row !== undefined &&
                own !== undefined &&
                cssColorToABGR(row) !== cssColorToABGR(own)
              )
            })
            const path = saysColor(m.encoding.color)
              ? `marks[${i}].encoding.color`
              : 'encoding.color'
            return replaced.length > 0
              ? [
                  `${path}.scale.range: ${replaced.join(', ')} paint their row colors; set those in rows.colors`,
                ]
              : []
          })
          return [...new Set(lines)]
        },
        /**
         * #getter
         * The shape keys whose unlisted values collide on one shape, each
         * with the domain Pin distinct shapes writes.
         */
        get sharedKeys() {
          return sharedKeysOf(self.legendSections)
        },
        /**
         * #getter
         * The config's lines, `dataNotices`, and the keys whose values
         * collide: what the corner's problems notice lists. The skipped count
         * appears in a separate chip.
         */
        get cornerNotices(): string[] {
          return [
            ...self.configNotices,
            ...this.dataNotices,
            ...this.displayNotices,
            ...self.rowNarrowingNotices,
            ...this.rowColorNotices,
            ...this.sharedKeys.map(sharedKeyNotice),
          ]
        },
        /**
         * #getter
         * `dataNotices`, the colliding keys, and a mark whose every loaded
         * feature was skipped, which a mistyped field is: a display with any
         * of them still draws, so an agent's settle report lists them for a caller
         * that cannot see the corner.
         */
        get liveNotices(): string[] {
          const { skipped, total, fields } = this.skippedFeatures
          return [
            ...this.dataNotices,
            ...this.displayNotices,
            ...self.rowNarrowingNotices,
            ...this.rowColorNotices,
            ...this.sharedKeys.map(sharedKeyNotice),
            ...(total > 0 && skipped === total
              ? [
                  `every one of ${total.toLocaleString()} ${pluralize(total, 'feature')} was skipped: ${fields.join(', ') || 'start or end'} missing or not a number`,
                ]
              : []),
          ]
        },
        /**
         * #getter
         * What the worker left out of the loaded regions — a feature whose
         * position or `y` read as missing or not a number — for the corner
         * notice, naming the field a binned position came from.
         */
        get skippedFeatures(): SkippedFeatures {
          const { encodings } = self
          const { visible } = self.markView
          const positionFields = self.markStepLists.map((steps, i) => {
            const { x = 'start', x2 = 'end' } = encodings[i] ?? {}
            const x2Field = typeof x2 === 'object' ? x2.pos : x2
            return [
              ...new Set([
                positionSource(steps, x),
                positionSource(steps, x2Field),
              ]),
            ]
          })
          return skippedFeatures(
            [...self.featurePayloads.values()].map(d =>
              d.layers
                .map((layer, i) => ({
                  count: layer.count,
                  skipped: layer.skipped,
                  skippedPosition: layer.skippedPosition,
                  field: encodings[i]?.y,
                  positionFields: positionFields[i],
                }))
                .filter((_, i) => visible[i]),
            ),
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `TrackHeightMixin`'s hook: the rows under `rows`, taller than the
         * plot wherever a px `rows.step` asks for more than it holds.
         */
        get scrollContentHeight(): number {
          return self.drawsRows ? self.rowCount * self.effectiveRowHeight : 0
        },
        /**
         * #getter
         * `TrackHeightMixin`'s hook: the plot the rows scroll behind.
         */
        get scrollViewportHeight(): number {
          return self.plotBox.plotHeight
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Write every sized span's `mark.height.band`; a band-0 span stays
         * the line it draws.
         */
        setRowProportion(n: number) {
          for (const mark of self.conf.marks) {
            if (isSizedRect(mark)) {
              setConf(mark, ['mark', 'height', 'band'], n)
            }
          }
        },
        /**
         * #action
         * Hide a key row's categories, or show them all again where any is
         * hidden: `field` the color's, `''` under an identity color.
         */
        toggleCategory(field: string, values: readonly string[]) {
          const hidden = self.hiddenCategories ?? []
          const named = (h: HiddenCategory) =>
            h.field === field && values.includes(h.value)
          const next = hidden.some(named)
            ? hidden.filter(h => !named(h))
            : [...hidden, ...values.map(value => ({ field, value }))]
          self.hiddenCategories = next.length > 0 ? next : undefined
        },
        /**
         * #action
         */
        showAllCategories() {
          self.hiddenCategories = undefined
        },
      }))
      .views(self => ({
        /**
         * #method
         * The exported features this display draws: those a mark drawing at
         * this zoom reaches through the worker's steps, in a section or row
         * shown, outside the categories the key hides.
         */
        exportedFeatures(features: Feature[]) {
          const hidden = self.hiddenGroups
          const rows = self.drawsRows
            ? new Set(self.sources.map(row => row.name))
            : undefined
          return exportedMarkFeatures({
            features,
            request: self.plotRequest(),
            drawing: self.drawingMarkIndices,
            colors: self.markColors,
            sectionShown: key => !hidden.has(key) && (rows?.has(key) ?? true),
            jexl: getEnv(self).pluginManager.jexl,
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The mark clustering and "Sort rows by ... here" read at this zoom,
         * and what of its instances they compare (`rowCompareOf`).
         */
        get rowCompare(): RowCompare | undefined {
          return rowCompareOf(
            self.drawingMarkIndices,
            self.markTypes,
            self.markColors,
          )
        },
        /**
         * #getter
         * What a sort or a cluster caption names the compared thing.
         */
        get rowCompareLabel(): string {
          const compare = this.rowCompare
          return compare
            ? rowCompareLabel(compare.by, self.markColors[compare.mark])
            : 'value'
        },
        /**
         * #getter
         * The hidden categories a color drawn now reads, so a hide kept
         * across a field change counts only once its field is back.
         */
        get activeHiddenCategories(): readonly HiddenCategory[] {
          const fields = new Set(
            self.drawingMarkIndices.flatMap(i => {
              const color = self.markColors[i]
              return color?.kind === 'categories'
                ? [color.encoding.field]
                : color?.kind === 'identity'
                  ? ['']
                  : []
            }),
          )
          return (self.hiddenCategories ?? []).filter(h => fields.has(h.field))
        },
        /**
         * #getter
         * Two or more clusterable rows once the row listing settles, and a
         * mark to compare them on.
         */
        get autoClusterReady(): boolean {
          return (
            self.rowListingSettled &&
            self.clusterableSources.length > 1 &&
            this.rowCompare !== undefined
          )
        },
      }))
      .volatile(self => ({
        // The fields a scan of the features found, and whether the default rule
        // has already had its turn. Volatile: a field list describes the data,
        // not the session, and a reload scans again.
        plotFields: undefined as PlotFields | undefined,
        plotFieldsError: undefined as unknown,
        plotDefaultChecked: false,
        plotFieldsPromise: undefined as Promise<PlotFields> | undefined,
        plotScanned: [] as Region[],
        // The click-driven details fetch, lent the display's status window so
        // it reports through the same chip as the viewport fetch and a second
        // click supersedes the first.
        detailsRotation: createAbortRotation(self, {
          statusWindow: self.statusWindow,
        }),
        plotScanRotation: createAbortRotation(self, {
          statusWindow: self.statusWindow,
        }),
      }))
      .views(self => {
        const scanWindow = stableIdentityComputed(() =>
          plotScanRegions(self.host, onTrackAssembly(self)),
        )
        return {
          /**
           * #getter
           * The window a field scan reads now (`plotScanRegions`), the same
           * array while a pan stays inside its grid step
           */
          get plotScanWindow(): Region[] {
            return scanWindow.get()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The windows the held field scan read, for the dialog to name: one
         * window's locus, or how many sampled the span they lie across.
         */
        get plotScanLocus(): string | undefined {
          const scans = self.plotScanned
          const first = scans[0]
          const last = scans.at(-1)
          const locus = (refName: string, start: number, end: number) =>
            assembleLocString({ refName, start, end })
          return first && last
            ? scans.length === 1
              ? locus(first.refName, first.start, first.end)
              : first.refName === last.refName
                ? `${scans.length} windows across ${locus(first.refName, first.start, last.end)}`
                : `${scans.length} windows from ${locus(first.refName, first.start, first.end)} to ${locus(last.refName, last.start, last.end)}`
            : undefined
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Open the feature widget on the read, the bin or the run a hit drew,
         * inside its facet section, through `selectEncodedFeature`.
         */
        selectFeature(hit: MarkHitInfo) {
          const request = self.featurePayloads.get(hit.regionIndex)?.request
          if (request) {
            selectEncodedFeature(self, self.detailsRotation, {
              ...request,
              layer: hit.markIndex,
              featureIndex: hit.featureIndex,
            })
          }
        },
        /**
         * #action
         * Stage a region as fetched, with this display's payload layout.
         */
        setRpcData(idx: number, data: EncodedLayersResult, region: Region) {
          const { byteLimit, ...request } = rpcArgs(self)
          self.setLoadedRegion(idx, region, {
            ...storedRegionData(data),
            request: { ...request, region },
          })
        },
        /**
         * #action
         */
        setShowRowSeparators(show: boolean) {
          setConf(self, ['rows', 'axis', 'grid'], show)
        },
        /**
         * #action
         * Write a default plot: its marks, its axis, a row per value of its
         * `rows` field where nothing splits the features yet, and its color
         * where the display states none.
         */
        applyDefaultPlot(plot: DefaultPlot) {
          setConf(self.conf, 'marks', plot.marks)
          if (plot.zero === false) {
            self.setScaleZero(false)
          }
          if (plot.rows && self.splitField === undefined) {
            setConf(self.conf, ['rows', 'field'], plot.rows)
          }
          if (plot.color && !saysColor(self.conf.encoding.color)) {
            setConf(self.conf, ['encoding', 'color'], plot.color)
          }
        },
        /**
         * #action
         * Order the rows by what `rowCompare` reads over (refName, pos), off
         * the loaded regions with no refetch: values and ramped numbers
         * highest first, a span's categories in blocks of one category, the
         * largest on screen first and then in the categories' order, and
         * covered rows before bare ones; false where no loaded region covers
         * the column.
         */
        sortRowsByValueAt(refName: string, pos: number) {
          const compare = self.rowCompare
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => (compare ? self.rpcDataMap.get(index) : undefined),
            (rows, region) => {
              const { mark, by } = compare!
              const { rowTable } = self
              const { rowKeys } = self.rowKeySpace
              const byName = new Map<string, number>()
              for (const [key, value] of rowValuesAt(region, mark, pos, by)) {
                const name =
                  rowTable && keySlot(key, rowTable) !== undefined
                    ? rowKeys.names[key]
                    : undefined
                if (name !== undefined) {
                  byName.set(name, value)
                }
              }
              if (by !== 'colorKey') {
                return orderRowsByValueAt(rows, byName, (a, b) => b - a)
              }
              const category = categoriesByColor(region.layers[mark]?.scale)
              const categoryByName = new Map(
                [...byName].flatMap(([name, color]) => {
                  const value = category.get(color)
                  return value === undefined ? [] : [[name, value] as const]
                }),
              )
              return orderRowsByValueAt(
                rows,
                categoryByName,
                byCategoryBlocks(categoryByName),
              )
            },
          )
        },
        /**
         * #action
         * Write the `filter` list's expressions; undefined returns them to
         * what the track's config declares.
         */
        setFilter(filters?: string[]) {
          writeJexlFilters(self, filters ?? self.baseFilters())
        },
        /**
         * #action
         */
        setPlotFields(fields?: PlotFields, error?: unknown) {
          self.plotFields = fields
          self.plotFieldsError = error
        },
        /**
         * #action
         */
        setPlotDefaultChecked() {
          self.plotDefaultChecked = true
        },
        setPlotFieldsPromise(
          promise?: Promise<PlotFields>,
          scanned: Region[] = [],
        ) {
          self.plotFieldsPromise = promise
          self.plotScanned = scanned
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Scan the features for the fields a plot can read. A scan that found a
         * numeric field answers for the display's life; one that found none
         * answers only for the window it read, and a failed one for nothing. A
         * scan a newer one aborted answers with the newer one's fields.
         */
        ensurePlotFields() {
          const regions = self.plotScanWindow
          const held = self.plotFieldsPromise
          if (
            held &&
            ((self.plotFields?.numeric.length ?? 0) > 0 ||
              deepEqual(regions, self.plotScanned))
          ) {
            return held
          }
          const pending = scan()
          self.setPlotFieldsPromise(pending, regions)
          return pending

          async function scan(): Promise<PlotFields> {
            const active = self.plotScanRotation.begin()
            try {
              const fields = await fetchPlotFields({
                self,
                regions,
                opts: {
                  signal: active.signal,
                  statusCallback: active.statusCallback,
                },
              })
              if (active.isCurrent()) {
                self.setPlotFields(fields)
              }
              return fields
            } catch (error) {
              const successor = self.plotFieldsPromise
              if (!active.isCurrent() && successor && successor !== pending) {
                return successor
              }
              if (active.isCurrent()) {
                self.setPlotFields(undefined, error)
                self.setPlotFieldsPromise(undefined)
              }
              throw error
            } finally {
              active.end()
            }
          }
        },
        /**
         * #action
         * Open the plot as text, over the same settings the controls write.
         * `seed` overlays a setting the caller has in hand but has not
         * applied.
         */
        openPlotDialog(seed?: MarkPlot, seedOptions?: PlotWriteOptions) {
          queuePlotDialog(self, seed, seedOptions)
        },
        /**
         * #action
         * Write every point mark's `encoding.size` number; undefined returns
         * each to the default.
         */
        setPointSize(val?: number) {
          for (const mark of self.conf.marks) {
            if (mark.mark.type === 'point') {
              setConf(mark, ['encoding', 'size', 'value'], val)
            }
          }
        },
        /**
         * #action
         * The ordinal analogue of the min/max dialog's "Use current
         * range": every value a colliding shape key lists goes into the
         * shape's `scale.domain`, in key order after what it already lists, so each
         * takes a separate shape.
         */
        pinDistinctShapes() {
          for (const key of self.sharedKeys) {
            for (const i of key.markIndexes) {
              setConf(
                self.conf.marks[i]!,
                ['encoding', 'shape', 'scale', 'domain'],
                key.pinned,
              )
            }
          }
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Open the plot as controls: every mark, the channels its type reads,
         * and what the rules say under each. The field scan runs behind it, as
         * it does for the field dialog.
         */
        openMarkPlotDialog(seed?: MarkPlot) {
          void self.ensurePlotFields().catch(() => {})
          getDialogHost(self).queueDialog(handleClose => [
            MarkPlotDialog,
            { model: self, seed, handleClose },
          ])
        },
        /**
         * #action
         * The text box's "Back to form", opened on its draft.
         */
        openPlotForm(draft: MarkPlot) {
          this.openMarkPlotDialog(draft)
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          return markTrackMenuItems(self as LinearMarkDisplayModel)
        },
        /**
         * #method
         */
        contextMenuItems(): MenuItem[] {
          return markContextMenuItems(self as LinearMarkDisplayModel)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Fetch each needed region widened to the edges of the widest bin a
         * shared step or a mark drawing at this zoom cuts, so no bin a drawn
         * mark plots is cut at the fetch edge.
         */
        fetchNeeded(needed: IndexedRegion[]) {
          const { bpPerPx, displayedRegions } = self.host
          const regions = binnedFetchRegions(
            needed,
            self.rpcProps(),
            self.markView.visible,
            displayedRegions,
          )
          const { byteLimit, opts, ...request } = {
            ...rpcArgs(self),
            bpPerPx,
          }
          return fetchEachRegion(self, regions, {
            call: async (region, ctx) => {
              const resolved =
                opts &&
                (await self.resolveAdapterOptions(opts, region, ctx.signal))
              const asked = {
                ...request,
                region,
                ...(resolved ? { opts: resolved } : {}),
              }
              const result = await ctx.callRpc('CoreGetEncodedLayers', {
                ...asked,
                byteLimit,
              })
              return isRegionRefused(result) ? result : { result, asked }
            },
            onResult: (_idx, { result, asked }) => ({
              ...storedRegionData(result),
              request: asked,
            }),
          })
        },
        /**
         * #action
         * identity encode — the backend uploads the stored payload
         */
        startRenderingBackend(backend: MarkRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.rpcDataMap,
            render: b =>
              b.renderBlocks(
                self.renderBlocks,
                self.rpcDataMap,
                self.renderState,
              ),
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Scan the current window, and write the default plot off it where the
         * window holds features and nothing has been declared meanwhile. A
         * failed scan is the error of a display with nothing to draw; a
         * declared plot draws on, and the next window scans again.
         */
        async decideDefaultPlot() {
          let fields: PlotFields
          try {
            fields = await self.ensurePlotFields()
          } catch (error) {
            if (isAlive(self) && self.plotFieldsError === error) {
              if (self.conf.marks.length === 0) {
                self.setError(error)
              } else {
                console.warn(`Could not scan the features' fields: ${error}`)
              }
            }
            return
          }
          if (
            !isAlive(self) ||
            fields.empty ||
            self.plotDefaultChecked ||
            self.conf.marks.length > 0
          ) {
            return
          }
          self.setPlotDefaultChecked()
          const plot = self.defaultPlotOf(fields)
          if (plot) {
            self.applyDefaultPlot(plot)
          } else {
            self.openMarkPlotDialog()
          }
        },
      }))
      .actions(self => ({
        afterAttach() {
          installPrerequisiteFetch(self, {
            name: 'MarkRowSources',
            delay: 0,
            report: { setStatusMessage: () => {} },
            gate: () => self.drawsRows,
            run: async (adapterConfig, ctx) =>
              (await ctx.callRpc('MarkGetRowSources', { adapterConfig })) ??
              null,
            commit: read => {
              self.setSourceListing(read)
            },
            setError: error => {
              if (error !== undefined) {
                console.warn(
                  `Could not list the adapter's sources; rows come from the features alone: ${error}`,
                )
                self.setSourceListing({
                  adapterConfig: self.adapterConfig,
                  value: null,
                })
              }
            },
          })
          setupTreeSidebarAutoruns(self, {
            name: 'Mark',
            sortRows: (refName, pos) => self.sortRowsByValueAt(refName, pos),
            clustering: {
              run: async args => {
                const { runMarkClustering } =
                  await import('./runMarkClustering.ts')
                await runMarkClustering({ model: self, ...args })
              },
            },
          })
          // Nothing declared draws nothing, and the Display types menu offers
          // this display on every feature, alignments and variant track. So
          // while `marks` is empty, the features decide (`defaultPlot`), or the
          // dialog opens where they decide nothing. A window with no features
          // decides nothing, and the next window scans again; a failed scan is
          // the display's error, and its retry scans again. A display whose
          // menus offer the fields scans the same way while it holds none.
          addDisposer(
            self,
            autorun(() => {
              const decides =
                !self.plotDefaultChecked && self.conf.marks.length === 0
              const holdsFields =
                self.plotFields !== undefined && !self.plotFields.empty
              if (
                !(decides || (self.menusOfferPlotFields && !holdsFields)) ||
                !self.host.initialized ||
                self.error !== undefined ||
                self.plotScanWindow.length === 0
              ) {
                return
              }
              void self.decideDefaultPlot()
            }),
          )
        },
        /**
         * #action
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
  )
}

export type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
export type { FacetLayout } from './facet.ts'
export type { MarkView } from './markConfigViews.ts'
export type { MarkHitInfo } from './findMarkHit.ts'
export type { MarkLegendSection } from './legend.ts'
export type {
  DisplayMark,
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  TextMarkEntry,
} from './markList.ts'
export type { MarkPlot, MarkPlotSettings } from './markPlot.ts'
export type { MarkProblem } from './markProblems.ts'
export type { RowKeySpace, RowName } from './rowTable.ts'
export type { JoinedPlotFields, PlotFields } from './scanPlotFields.ts'
export type { StepChannels } from './stepChannels.ts'

export type LinearMarkDisplayStateModel = ReturnType<typeof stateModelFactory>
export interface LinearMarkDisplayModel extends Instance<LinearMarkDisplayStateModel> {}
