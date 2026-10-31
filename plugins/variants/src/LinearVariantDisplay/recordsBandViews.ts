/**
 * The records band as one seam on the variant display: its
 * settings, its render data, the hosted fit ladder and the display hooks the
 * band decides. Every `recordsOnly` choice the model makes is made here; the
 * model composes these in order, each block reading the ones before it.
 */
import { getConf, setConf } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { facetForField } from '@jbrowse/display-kit/FacetWritesMixin'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import {
  sameAsLast,
  stableIdentityComputed,
} from '@jbrowse/display-kit/stableIdentityComputed'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  DEFAULT_TOOLTIP,
  MIN_GROW_HEIGHT,
  buildFeatureFlatbushIndex,
  createMembershipMemo,
  featureGroupSections,
  featureIdsTouchingBlocks,
  fitLadderViews,
  fitLadderVolatiles,
  labelFontSize,
  labelVisibility,
  maxBottom,
  scaleLaidOutData,
} from '@jbrowse/plugin-features/band'
import { computed, observable } from 'mobx'

import { cellHueField } from '../shared/cellHue.ts'
import { resolveSampleName } from '../shared/getSources.ts'
import { paintFeatureColors } from './paintCells.ts'
import { countRecordCarriers } from './recordCarriers.ts'
import {
  RECORD_LABEL_LINE,
  buildRecordsRenderData,
  recordSpans,
  recordsDisplayConfig,
} from './recordsRenderData.ts'
import { svClassColors, svClassScale, svClassesOf } from './recordsSvColors.ts'
import {
  recordsBandBounds,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { CellHue, cellColorEncodingOf } from '../shared/cellHue.ts'
import type { RecordFieldReads } from '../shared/recordFields.ts'
import type { ProcessedSource, Source } from '../shared/types.ts'
import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { RecordCarriers } from './recordCarriers.ts'
import type { RecordsLabels } from './recordsRenderData.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { WrittenFacet } from '@jbrowse/display-kit/FacetWritesMixin'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  DisplayMode,
  FeatureDataResult,
  FeatureFacet,
  FeatureGroupSection,
  FitLadderHost,
  FitStage,
  FlatbushRegionIndexes,
  LayoutRegionData,
} from '@jbrowse/plugin-features/band'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const NO_RECORD_LABELS: RecordsLabels = { name: '', description: '' }

const NO_FEATURE_IDS: ReadonlySet<string> = new Set()

export interface RecordsSettingsHost {
  configuration: Instance<LinearVariantDisplayConfigModel>
  adapterSamples: Source[] | undefined
  showGenotypes: boolean
  atGenomicPositions: boolean
  colorEncoding: ReturnType<typeof cellColorEncodingOf>
  gateActive: boolean
  aboveForceLoadFloor: boolean
}

export function recordsSettingsViews(self: RecordsSettingsHost) {
  return {
    // #region sameBlockThis
    /**
     * #getter
     * Whether no genotype row draws: `genotypes.show` off, or a VCF
     * whose sample listing landed empty. The records band is then the
     * display, every record the filter admits, sized by `heightMode`.
     */
    get recordsOnly(): boolean {
      return !self.showGenotypes || self.adapterSamples?.length === 0
    },
    /**
     * #getter
     * Whether the records band is drawn: at genomic positions only, where
     * a record lines up with the cells under it, and always while it is
     * the whole display.
     */
    get showRecords(): boolean {
      return (
        self.atGenomicPositions &&
        (this.recordsOnly || getConf(self, ['records', 'show']))
      )
    },
    // #endregion
    /**
     * #getter
     * `records.maxHeight`, the cap on the band. Raw: what the band
     * spends is `topBands.recordsHeight`.
     */
    get recordsMaxHeight(): number {
      return getConf(self, ['records', 'maxHeight'])
    },
    /**
     * #getter
     * The field each label kind of the records band reads, empty where it
     * is hidden; what it draws is `recordsRenderedLabels`.
     */
    get recordsLabels(): RecordsLabels {
      const field = (kind: 'name' | 'description') =>
        getConf(self, ['records', 'labels', kind, 'show'])
          ? getConf(self, ['records', 'labels', kind, 'field'])
          : ''
      return { name: field('name'), description: field('description') }
    },
    /**
     * #getter
     * `records.facet` as written, or undefined while the records stack
     * in one section. The display's own `facet` bands the sample rows.
     */
    get recordsFacet(): FeatureFacet | undefined {
      return facetSettingOf({
        field: getConf(self, ['records', 'facet', 'field']),
        sort: getConf(self, ['records', 'facet', 'sort']),
      })
    },
    /**
     * #getter
     * The record sections the user hid, `records.facet.hidden`.
     */
    get recordsHiddenGroups(): ReadonlySet<string> {
      return new Set<string>(getConf(self, ['records', 'facet', 'hidden']))
    },
    /**
     * #getter
     * `records.mark.height`, each record's body at `normal`.
     */
    get recordsFeatureHeight(): number {
      return getConf(self, ['records', 'mark', 'height'])
    },
    /**
     * #getter
     * `records.tooltip.field`, the record's line in the hover tooltip.
     */
    get recordsTooltipField(): string {
      return getConf(self, ['records', 'tooltip', 'field'])
    },
    /**
     * #getter
     * What the worker reads off each record for the band beyond the
     * payload: a tooltip field other than the default, which the band
     * reads off the payload's own name, and the records' facet field.
     */
    get recordFieldReads(): RecordFieldReads {
      const tooltip = this.recordsTooltipField
      return {
        tooltip: tooltip === DEFAULT_TOOLTIP ? '' : tooltip,
        facet: this.recordsFacet?.field ?? '',
      }
    },
    /**
     * #getter
     * Whether the records band colors by SV class, the rest
     * `featureDefaultColor`: while no `encoding.color` is picked, with
     * rows or without. A picked color paints the records as it paints
     * the cells.
     */
    get recordsColorBySvClass() {
      return self.colorEncoding === undefined
    },
    /**
     * #getter
     * Whether the cells' coloring is keyed: always over rows; with no rows
     * only under a picked `encoding.color` field, whose values the records
     * paint. A constant paints every record alike, so keys nothing.
     */
    get cellColorKeyed() {
      return !this.recordsOnly || cellHueField(self.colorEncoding) !== undefined
    },
    /**
     * #getter
     * Whether the records band is the SV band: while genotype rows are
     * drawn. With none it draws every record the filter admits, and
     * states no carriers.
     */
    get recordsSvOnly() {
      return !this.recordsOnly
    },
    /**
     * #getter
     * `records.displayMode`, and unset the one rule its default
     * follows: `compact` over rows, tight with its one label line; with
     * no rows `normal`, a feature track's default.
     */
    get recordsDisplayMode(): DisplayMode {
      const written: DisplayMode | undefined = getConf(self, [
        'records',
        'displayMode',
      ])
      return written ?? (this.recordsOnly ? 'normal' : 'compact')
    },
    /**
     * #getter
     * The size the band letters at, plugin-features's for its display
     * mode, so the width its packer reserved is the width the text draws.
     */
    get recordsFontSize() {
      return labelFontSize(this.recordsDisplayMode)
    },
    /**
     * #getter
     * `HeightModeMixin`'s ceiling on `grow`: the slot's with no rows;
     * over rows none, so `height` holds in every mode.
     */
    get growMaxHeight(): number {
      return this.recordsOnly
        ? getConf(self, 'growMaxHeight')
        : Number.POSITIVE_INFINITY
    },
    /**
     * #getter
     * The density axis acts only with no genotype rows, where the records
     * are the display, as on `LinearVariantDisplay`. Over rows the byte
     * gate alone guards the fetch.
     */
    get densityGateActive() {
      return (
        self.gateActive &&
        self.aboveForceLoadFloor &&
        this.recordsOnly &&
        self.atGenomicPositions
      )
    },
    /**
     * #getter
     * `records.maxFeatureScreenDensity`, the density budget.
     */
    get configuredMaxFeatureScreenDensity(): number {
      return getConf(self, ['records', 'maxFeatureScreenDensity'])
    },
  }
}

export type RecordsSettings = ReturnType<typeof recordsSettingsViews>

interface RecordsActionsHost extends RecordsSettingsHost, RecordsSettings {
  height: number
}

export function recordsBandActions(self: RecordsActionsHost) {
  return {
    /**
     * #action
     * Switch the records band on or off; it takes its space from the
     * rows.
     */
    setShowRecords(arg: boolean) {
      setConf(self, ['records', 'show'], arg)
    },
    /**
     * #action
     * `records.displayMode`, each record's height preset.
     */
    setRecordsDisplayMode(mode: DisplayMode) {
      setConf(self, ['records', 'displayMode'], mode)
    },
    /**
     * #action
     * Show or hide one label kind of the records.
     */
    setRecordsLabelShow(kind: 'name' | 'description', show: boolean) {
      setConf(self, ['records', 'labels', kind, 'show'], show)
    },
    /**
     * #action
     * Split the records into sections by `field`, `''` for none,
     * keeping the order and hidden sections while it is the field
     * already grouping.
     */
    recordsFacetByField(field: string) {
      const written =
        getSnapshot<WrittenFacet | undefined>(
          self.configuration.records.facet,
        ) ?? {}
      setConf(self, ['records', 'facet'], facetForField(written, field))
    },
    /**
     * #action
     * The order the record sections take, the ones it names first.
     */
    setRecordsFacetSort(sort: readonly string[]) {
      setConf(self, ['records', 'facet', 'sort'], [...sort])
    },
    /**
     * #action
     * Drop a record section from the band; `showAllRecordsGroups`
     * brings it back.
     */
    hideRecordsGroup(key: string) {
      setConf(
        self,
        ['records', 'facet', 'hidden'],
        [...new Set([...self.recordsHiddenGroups, key])],
      )
    },
    /**
     * #action
     */
    showAllRecordsGroups() {
      setConf(self, ['records', 'facet', 'hidden'], [])
    },
    /**
     * #action
     * Set the records band's cap, clamped here because a drag can
     * deliver any number and a band dragged shut has to stay grabbable.
     */
    setRecordsMaxHeight(arg: number) {
      setConf(
        self,
        ['records', 'maxHeight'],
        clampBandHeight(
          self.recordsMaxHeight,
          arg,
          recordsBandBounds(self.height),
        ),
      )
    },
  }
}

interface RecordsRenderHost extends RecordsSettings {
  cellData: CellDataResult | undefined
  cellHue: CellHue
  cellHueValuesRead: boolean
  sources: ProcessedSource[]
  view: LinearGenomeViewModel
  canRender: boolean
}

export function recordsRenderViews(self: RecordsRenderHost) {
  // sorted, and kept while the set holds, so a reorder recounts nothing
  const carrierSamples = stableIdentityComputed(() =>
    [...new Set(self.sources.map(resolveSampleName))].sort(),
  )
  const onScreenIdsMemo = createMembershipMemo()
  const keepVisibleLabels = sameAsLast<RecordsLabels>()
  return {
    /**
     * #getter
     * The samples a record's carrier share is out of: the ones shown as
     * rows, so it matches the matrix under it. A haplotype row counts as
     * its sample.
     */
    get recordCarrierSamples(): readonly string[] {
      return carrierSamples.get()
    },
    /**
     * #getter
     * Each SV record's carriers among `recordCarrierSamples`, once per
     * payload and row set.
     */
    get recordCarriers(): ReadonlyMap<string, RecordCarriers> {
      const { cellData } = self
      return cellData && self.showRecords && self.recordsSvOnly
        ? countRecordCarriers(cellData, this.recordCarrierSamples)
        : new Map<string, RecordCarriers>()
    },
    /**
     * #getter
     * Each fetched region's record colors: the SV class or
     * `featureDefaultColor` (`svClassColors`), or under a picked
     * `encoding.color` the alt cells' hue at full dose, which neither
     * shading nor the phased mode moves.
     */
    get regionRecordColors() {
      const { cellData, cellHue, cellHueValuesRead } = self
      const out = new Map<number, Uint32Array>()
      if (cellData) {
        for (const k in cellData.perRegionCellData) {
          const data = cellData.perRegionCellData[k]!
          out.set(
            Number(k),
            self.recordsColorBySvClass
              ? svClassColors(data.featureInfo)
              : paintFeatureColors(data, cellHue, cellHueValuesRead),
          )
        }
      }
      return out
    },
    /**
     * #getter
     * What the band's packer reads, minus the label reservation each fit
     * rung varies. `coarseBpPerPx`, so packing does not recompute per
     * frame of a zoom.
     */
    get recordsLayoutInputs(): FitLadderHost['layoutInputs'] {
      const reversedRegions = new Set<number>()
      const { displayedRegions } = self.view
      for (let i = 0; i < displayedRegions.length; i++) {
        if (displayedRegions[i]!.reversed) {
          reversedRegions.add(i)
        }
      }
      return {
        bpPerPx: self.view.coarseBpPerPx,
        reversedRegions,
        displayMode: self.recordsDisplayMode,
        pinnedFeatureIds: NO_FEATURE_IDS,
        expandedGeneIds: NO_FEATURE_IDS,
        facet: self.recordsFacet,
        hiddenGroupKeys: self.recordsHiddenGroups,
      }
    },
    /**
     * #getter
     * The spans of the records the band draws, per fetched region, once
     * per payload.
     */
    get recordsSpans() {
      const { cellData } = self
      const { displayedRegions } = self.view
      const svOnly = self.recordsSvOnly
      return cellData && self.showRecords
        ? Object.entries(cellData.perRegionCellData).flatMap(([k, data]) => {
            const region = displayedRegions[Number(k)]
            return region ? [recordSpans({ data, region, svOnly })] : []
          })
        : []
    },
    /**
     * #getter
     * The records the band draws whose span touches the screen, as
     * LinearBasicDisplay's `onScreenFeatureIds`: what its labels gate
     * on, so records buffered off screen cost no label. None before the
     * view has a width to lay its blocks out across.
     */
    get recordsOnScreenIds(): ReadonlySet<string> {
      return self.canRender
        ? onScreenIdsMemo(
            featureIdsTouchingBlocks(
              this.recordsSpans,
              self.view.settledDynamicBlocks,
            ),
          )
        : NO_FEATURE_IDS
    },
    /**
     * #getter
     * The records the band's fit and height measure: with no rows those
     * on screen, as a feature track measures; over rows every fetched
     * one, so the rows under the band hold still between fetches.
     */
    get recordsMeasureIds(): ReadonlySet<string> | undefined {
      return self.recordsOnly ? this.recordsOnScreenIds : undefined
    },
    /**
     * #getter
     * Records on screen per pixel of the blocks on screen, as
     * LinearBasicDisplay's `labelDensityPerPx`.
     */
    get recordsLabelDensityPerPx() {
      const widthPx = self.canRender
        ? self.view.settledDynamicBlocks.reduce(
            (sum, block) => sum + block.widthPx,
            0,
          )
        : 0
      return widthPx > 0 ? this.recordsOnScreenIds.size / widthPx : 0
    },
    /**
     * #getter
     * `recordsLabels` past LinearBasicDisplay's label density rule
     * (`labelVisibility`): names go past 0.2 records per pixel on
     * screen and descriptions past 0.1, as on a feature track.
     */
    get recordsVisibleLabels(): RecordsLabels {
      const { name, description } = self.recordsLabels
      const { showLabels, showDescriptions } = labelVisibility({
        name: name !== '',
        description: description !== '',
        collapsed: self.recordsDisplayMode === 'collapsed',
        density: this.recordsLabelDensityPerPx,
        geneDensity: () => undefined,
      })
      return keepVisibleLabels({
        name: showLabels ? name : '',
        description: showDescriptions ? description : '',
      })
    },
    /**
     * #getter
     * The band's records as plugin-features render data, one entry per
     * fetched region, empty while the band is off. Keyed off the payload
     * and the displayed regions' bounds, never the row-placed map or
     * `visibleRegions`, which would rebuild it per reorder or per frame.
     */
    get recordsRenderDataMap(): ReadonlyMap<number, LayoutRegionData> {
      const out = new Map<number, LayoutRegionData>()
      const cellData =
        self.canRender && self.showRecords ? self.cellData : undefined
      if (cellData) {
        // with no rows the display's own label fields, as a feature
        // track letters them; over rows the one-line `recordLabel`
        const visible = this.recordsVisibleLabels
        const config = recordsDisplayConfig({
          featureHeight: self.recordsFeatureHeight,
          labels: self.recordsOnly ? visible : RECORD_LABEL_LINE,
          tooltip: self.recordFieldReads.tooltip,
          faceted: self.recordsFacet !== undefined,
        })
        const labels = self.recordsOnly ? NO_RECORD_LABELS : visible
        const { jexl } = getEnv(self).pluginManager
        const { displayedRegions } = self.view
        const featureColors = this.regionRecordColors
        const carriers = this.recordCarriers
        const svOnly = self.recordsSvOnly
        for (const k in cellData.perRegionCellData) {
          const displayedRegionIndex = Number(k)
          const data = cellData.perRegionCellData[k]!
          const region = displayedRegions[displayedRegionIndex]
          if (region && data.featureInfo.length) {
            out.set(
              displayedRegionIndex,
              buildRecordsRenderData({
                data: {
                  ...data,
                  featureColors: featureColors.get(displayedRegionIndex)!,
                },
                region,
                labels,
                carriers,
                svOnly,
                config,
                jexl,
              }),
            )
          }
        }
      }
      return out
    },
    /**
     * #getter
     * The key to the records band's SV classes, the ones its records
     * hold, while it colors by them.
     */
    get recordsColorScales(): ColorScale[] {
      const { cellData } = self
      return cellData && self.showRecords && self.recordsColorBySvClass
        ? [
            svClassScale(
              Object.values(cellData.perRegionCellData).flatMap(d => [
                ...svClassesOf(d.featureInfo),
              ]),
            ),
          ].filter(scale => scale.entries.length > 0)
        : []
    },
  }
}

export type RecordsRender = ReturnType<typeof recordsRenderViews>

interface RecordsLayoutHost extends RecordsRenderHost, RecordsRender {
  height: number
  lineZoneHeight: number
  fitHeightToDisplay: boolean
  autoHeight: boolean
  fitTargetHeight: number
  scrollTop: number
  rowsContentHeight: number
  availableHeight: number
}

export function recordsLayoutViews(self: RecordsLayoutHost) {
  // LinearBasicDisplay's own fit ladder, hosted for the band. Its host
  // is a plain object and not this model, whose `facet` is the sample
  // facet and not a feature one; `observable` caches each ladder getter
  // as a computed, as spreading it into a model's views would.
  const host: FitLadderHost = {
    ...fitLadderVolatiles(),
    get rpcDataMap() {
      return self.recordsRenderDataMap
    },
    get layoutReady() {
      return self.showRecords && self.canRender
    },
    get layoutInputs() {
      return self.recordsLayoutInputs
    },
    // over rows the description rides the name's one line
    get showLabels() {
      const { name, description } = self.recordsVisibleLabels
      return name !== '' || (!self.recordsOnly && description !== '')
    },
    get effectiveShowDescriptions() {
      return self.recordsOnly && self.recordsVisibleLabels.description !== ''
    },
    get facet() {
      return self.recordsFacet
    },
    get fitMeasureFeatureIds() {
      return self.recordsMeasureIds
    },
    get fitHeightToDisplay() {
      return !self.recordsOnly || self.fitHeightToDisplay
    },
    get autoHeight() {
      return self.recordsOnly && self.autoHeight
    },
    showsEveryIsoform: true,
    reservesBelowLabelRows: false,
    get fitTargetHeight() {
      return bands.get().recordsHeight
    },
    get labelFontSize() {
      return self.recordsFontSize
    },
  }
  const ladder = observable(fitLadderViews(host), {
    fitLayoutAt: false,
    decimatedLayoutInputs: false,
    solveLabelRoomFactors: false,
    bodyScaleHeightProbe: false,
  })
  const bands = computed(() =>
    variantTopBandsGeometry({
      showRecords: self.showRecords,
      recordsOnly: self.recordsOnly,
      displayHeight: self.height,
      recordsMaxHeight: self.recordsMaxHeight,
      recordsContentHeight: maxBottom(
        ladder.baseLaidOutDataMap,
        self.recordsMeasureIds,
      ),
      recordsBounds: recordsBandBounds(self.height),
      lineZoneHeight: self.lineZoneHeight,
    }),
  )
  return {
    /**
     * #getter
     * The bands stacked above the rows, resolved once: the layout below
     * and the painters read this instead of summing the bands
     * (`variantTopBands.ts`). The records band is its `full` rung's
     * stack, up to `records.maxHeight`.
     */
    get topBands() {
      return bands.get()
    },
    /**
     * #getter
     * `HeightModeMixin`'s hook: with no rows, the records' `full`
     * stack on screen, as LinearBasicDisplay grows to its features;
     * over rows the slot height, so `grow` keeps the rows' height.
     */
    get growTargetHeight() {
      return self.recordsOnly && self.cellData !== undefined && self.canRender
        ? Math.max(
            MIN_GROW_HEIGHT,
            maxBottom(ladder.baseLaidOutDataMap, self.recordsMeasureIds),
          )
        : self.fitTargetHeight
    },
    /**
     * #getter
     * The rung the band keeps and the scale that fits it, off
     * LinearBasicDisplay's ladder run against `recordsHeight`: under the
     * cap the `full` rung fits at scale 1; past it descriptions go, then
     * bodies thin, names decimate, names go, and the boxes squeeze.
     */
    get recordsFitStage(): FitStage {
      return ladder.fitStage
    },
    /**
     * #getter
     * What the band's painter, labels and hit test all read: the kept
     * stack, scaled only when the fit squeezed it.
     */
    get recordsLaidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
      const { layout, scale } = this.recordsFitStage
      const facet = self.recordsFacet
      return scale === 1
        ? layout
        : scaleLaidOutData(
            layout,
            scale,
            facet && { facet, chipPx: GROUP_LABEL_HEIGHT },
          )
    },
    /**
     * #getter
     * The record sections in stacking order, each with the chip row the
     * packer reserved above it; empty while the records are one section.
     */
    get recordsGroupSections(): FeatureGroupSection[] {
      const facet = self.recordsFacet
      return facet
        ? featureGroupSections(
            this.recordsLaidOutDataMap,
            facet,
            GROUP_LABEL_HEIGHT,
          )
        : []
    },
    /**
     * #getter
     * Which label kinds the band paints: what the kept rung reserved, so a
     * box never claims width for a description the band had no room for.
     */
    get recordsRenderedLabels() {
      const { showLabels, showDescriptions } = this.recordsFitStage
      return { showLabels, showDescriptions }
    },
    /**
     * #getter
     * Per-region hit index over the band's laid-out records, off the
     * painted stack and the RENDERED label flags, a label's overhang being
     * part of its hit box. Held alive by the `RecordsHitIndexes` autorun
     * across pointer frames.
     */
    get recordsFlatbushIndexes() {
      const { showLabels, showDescriptions } = this.recordsRenderedLabels
      const { reversedRegions } = self.recordsLayoutInputs
      const bpPerPx = self.view.coarseBpPerPx
      const out = new Map<number, FlatbushRegionIndexes>()
      for (const [idx, data] of this.recordsLaidOutDataMap) {
        out.set(idx, {
          feature: buildFeatureFlatbushIndex(
            data.flatbushItems,
            data.floatingLabelsData,
            bpPerPx,
            reversedRegions.has(idx),
            {
              showLabels,
              showDescriptions,
              fontSize: self.recordsFontSize,
            },
          ),
          subfeature: null,
        })
      }
      return out
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the records band and the connector-line
     * zone, which `rowsTopOffset` stacks the focus chip's line under.
     */
    get rowsHeaderHeight() {
      return this.topBands.bottom
    },
    /**
     * #getter
     * `LegendMixin`'s hook: the key sits under the records band, over
     * the rows, so it hides no record; with no rows, at the top, as on
     * a feature track.
     */
    get legendTop() {
      return self.recordsOnly ? 0 : this.topBands.recordsHeight
    },
    /**
     * #getter
     * The rows; with no rows the records' drawn stack on screen, as a
     * feature track scrolls what `fixed` or a capped `grow` cannot show.
     */
    get scrollContentHeight() {
      return self.recordsOnly
        ? maxBottom(this.recordsLaidOutDataMap, self.recordsOnScreenIds)
        : self.rowsContentHeight
    },
    /**
     * #getter
     */
    get scrollViewportHeight() {
      return self.recordsOnly
        ? this.topBands.recordsHeight
        : self.availableHeight
    },
    /**
     * #getter
     * How far the records band is scrolled: the display's `scrollTop`
     * with no rows, where the band is what scrolls, else 0.
     */
    get recordsScrollTop() {
      return self.recordsOnly ? self.scrollTop : 0
    },
  }
}
