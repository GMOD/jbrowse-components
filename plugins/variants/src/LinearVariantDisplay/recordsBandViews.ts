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
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import {
  sameAsLast,
  stableIdentityComputed,
} from '@jbrowse/display-kit/stableIdentityComputed'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  DEFAULT_TOOLTIP,
  FEATURE_DESCRIPTION_FIELD,
  FEATURE_NAME_FIELD,
  MIN_GROW_HEIGHT,
  buildFeatureFlatbushIndex,
  createMembershipMemo,
  featureGroupSections,
  featureIdsTouchingBlocks,
  fitLadderViews,
  fitLadderVolatiles,
  isPlacedRow,
  labelFontSize,
  labelVisibility,
  maxBottom,
  scaleLaidOutData,
  unplaceBelow,
} from '@jbrowse/plugin-features/band'
import { computed, observable } from 'mobx'

import { cellHueField } from '../shared/cellHue.ts'
import { PHASE_SET_FIELD } from '../shared/getPhasedColor.ts'
import { resolveSampleName } from '../shared/getSources.ts'
import { paintFeatureColors } from './paintCells.ts'
import { countRecordCarriers } from './recordCarriers.ts'
import {
  RECORD_LABEL_LINE,
  labelsReadByWorker,
  buildRecordsRenderData,
  recordSpans,
  recordsDisplayConfig,
} from './recordsRenderData.ts'
import { svClassColors, svClassScale, svClassesOf } from './recordsSvColors.ts'
import {
  DEFAULT_RECORDS_HEIGHT,
  RECORDS_BAND_BOUNDS,
  recordsBandHeightOverRows,
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
  genotypesShowWritten: boolean
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
     * Whether the records band is the display, every record the filter
     * admits, sized by `heightMode` and lettered as a feature track: a VCF
     * with no samples, or a one-sample call set whose row nobody asked for.
     */
    get recordsOnly(): boolean {
      const sampleCount = self.adapterSamples?.length
      return (
        sampleCount === 0 || (sampleCount === 1 && !self.genotypesShowWritten)
      )
    },
    /**
     * #getter
     * Whether genotype rows draw: `genotypes.show`, on a VCF with samples.
     * Hidden, the rows take no height and the records band is the track.
     */
    get drawsRows(): boolean {
      return self.showGenotypes && !this.recordsOnly
    },
    /**
     * #getter
     * Whether the records band is drawn: at genomic positions only, where
     * a record lines up with the cells under it, and always while no row
     * draws.
     */
    get showRecords(): boolean {
      return (
        self.atGenomicPositions &&
        (!this.drawsRows || getConf(self, ['records', 'show']))
      )
    },
    // #endregion
    /**
     * #getter
     * Whether a drag, a config or the opening settle wrote
     * `records.height`; until then the band over rows is its stack, up to
     * the default.
     */
    get recordsHeightWritten() {
      return getConf(self, ['records', 'height']) !== undefined
    },
    /**
     * #getter
     * `records.height`, or the default the band opens at up to its stack
     * while none is written. Raw: what the band spends is
     * `topBands.recordsHeight`.
     */
    get recordsHeight(): number {
      return getConf(self, ['records', 'height']) ?? DEFAULT_RECORDS_HEIGHT
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
     * payload: a tooltip or label field other than its default, which the
     * band reads off the payload's own name and description, and the
     * records' facet field. A label is read shown or hidden, so its
     * checkbox redraws rather than refetches.
     */
    get recordFieldReads(): RecordFieldReads {
      const tooltip = this.recordsTooltipField
      const name = getConf(self, ['records', 'labels', 'name', 'field'])
      const description = getConf(self, [
        'records',
        'labels',
        'description',
        'field',
      ])
      return {
        tooltip: tooltip === DEFAULT_TOOLTIP ? '' : tooltip,
        facet: this.recordsFacet?.field ?? '',
        labelName: name === FEATURE_NAME_FIELD ? '' : name,
        labelDescription:
          description === FEATURE_DESCRIPTION_FIELD ? '' : description,
      }
    },
    /**
     * #getter
     * Whether the records band colors by SV class, the rest
     * `featureDefaultColor`: while no `encoding.color` is picked, with
     * rows or without, and under `phaseSet`, a genotype's value that no
     * record holds. Any other picked color paints the records as it
     * paints the cells.
     */
    get recordsColorBySvClass() {
      const encoding = self.colorEncoding
      return (
        encoding === undefined || cellHueField(encoding) === PHASE_SET_FIELD
      )
    },
    /**
     * #getter
     * Whether the cells' coloring is keyed: always while rows draw; with
     * none only under a picked `encoding.color` field, whose values the
     * records paint. A constant paints every record alike, so keys nothing.
     */
    get cellColorKeyed() {
      return this.drawsRows || cellHueField(self.colorEncoding) !== undefined
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

type RecordsActionsHost = RecordsSettingsHost & RecordsSettings

export function recordsBandActions(self: RecordsActionsHost) {
  return {
    /**
     * #action
     * Switch the records band on or off; over rows it adds its height to
     * the track above them.
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
     * Set the records band's height, clamped here because a drag can
     * deliver any number and a band dragged shut has to stay grabbable.
     */
    setRecordsHeight(arg: number) {
      setConf(
        self,
        ['records', 'height'],
        clampBandHeight(self.recordsHeight, arg, RECORDS_BAND_BOUNDS),
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
     * Each record's carriers among `recordCarrierSamples`, once per
     * payload and row set; none with no rows to carry it.
     */
    get recordCarriers(): ReadonlyMap<string, RecordCarriers> {
      const { cellData } = self
      return cellData && self.showRecords && self.drawsRows
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
        displayMode: this.recordsPackMode,
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
      return cellData && self.showRecords
        ? Object.entries(cellData.perRegionCellData).flatMap(([k, data]) => {
            const region = displayedRegions[Number(k)]
            return region ? [recordSpans({ data, region })] : []
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
     * The display mode the band packs at: `records.displayMode`, except
     * over rows past `records.maxFeatureScreenDensity` on screen, where
     * the records collapse into one row, the density at which a feature
     * track refuses the window, as the records-only display does.
     */
    get recordsPackMode(): DisplayMode {
      return !self.recordsOnly &&
        this.recordsLabelDensityPerPx > self.configuredMaxFeatureScreenDensity
        ? 'collapsed'
        : self.recordsDisplayMode
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
        collapsed: this.recordsPackMode === 'collapsed',
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
        const visible = labelsReadByWorker(
          this.recordsVisibleLabels,
          self.recordFieldReads,
        )
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
  // over rows the band's height is added to the display's, so it reads
  // nothing of the display's height
  const bands = computed(() =>
    variantTopBandsGeometry({
      showRecords: self.showRecords,
      recordsHeight: self.recordsOnly
        ? self.height
        : recordsBandHeightOverRows({
            recordsHeight: self.recordsHeight,
            recordsHeightWritten: self.recordsHeightWritten,
            recordsContentHeight: maxBottom(
              ladder.baseLaidOutDataMap,
              self.recordsMeasureIds,
            ),
          }),
      lineZoneHeight: self.lineZoneHeight,
    }),
  )
  return {
    /**
     * #getter
     * The bands stacked above the rows, resolved once: the layout below
     * and the painters read this instead of summing the bands
     * (`variantTopBands.ts`). The records band is `records.height` once
     * written, its `full` rung's stack up to the default before.
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
     * stack. With no rows it is scaled when the fit squeezed it, as a
     * feature track's; over rows it never squeezes, and past the ladder's
     * last rung a record that does not fit the band hides.
     */
    get recordsLaidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
      const { layout, scale } = this.recordsFitStage
      const facet = self.recordsFacet
      return !self.recordsOnly
        ? unplaceBelow(layout, this.topBands.recordsHeight)
        : scale === 1
          ? layout
          : scaleLaidOutData(
              layout,
              scale,
              facet && { facet, chipPx: GROUP_LABEL_HEIGHT },
            )
    },
    /**
     * #getter
     * How many records on screen the band leaves unplaced, past its
     * height over rows.
     */
    get recordsHiddenCount() {
      const onScreen = self.recordsOnScreenIds
      const hidden = new Set<string>()
      for (const data of this.recordsLaidOutDataMap.values()) {
        for (const { featureId, topPx } of data.flatbushItems) {
          if (!isPlacedRow(topPx) && onScreen.has(featureId)) {
            hidden.add(featureId)
          }
        }
      }
      return hidden.size
    },
    /**
     * #getter
     * The band's whole stack at full size, labels included: the height
     * at which no record hides.
     */
    get recordsStackHeight() {
      return Math.ceil(
        maxBottom(ladder.baseLaidOutDataMap, self.recordsMeasureIds),
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
    /**
     * #getter
     * `MultiRegionDisplayMixin`'s hook: whether `searchFeatureByID` has a
     * laid-out band to search, so an overlay can tell a record off the band
     * from a band not laid out yet.
     */
    get layoutReady() {
      return self.showRecords && self.canRender && self.cellData !== undefined
    },
    /**
     * #getter
     * The band's laid-out records by id, what `searchFeatureByID` reads.
     */
    get recordsItemById() {
      const out = new Map<string, FeatureDataResult['flatbushItems'][number]>()
      for (const data of this.recordsLaidOutDataMap.values()) {
        for (const item of data.flatbushItems) {
          out.set(item.featureId, item)
        }
      }
      return out
    },
    /**
     * #method
     * Where a record drew, `[startBp, top, endBp, bottom]`, as a feature
     * track answers it: the breakpoint split view's overlay subtracts the
     * display's `scrollTop`, so the top is the band's own, which over rows
     * does not scroll. A record the band hides is not found.
     */
    searchFeatureByID(id: string) {
      const item = this.recordsItemById.get(id)
      const shift = self.scrollTop - this.recordsScrollTop
      return item && isPlacedRow(item.topPx)
        ? ([
            item.startBp,
            item.topPx + shift,
            item.endBp,
            item.bottomPx + shift,
          ] as const)
        : undefined
    },
  }
}

export type RecordsLayout = ReturnType<typeof recordsLayoutViews>

interface RecordsLayoutActionsHost extends RecordsLayout {
  setRecordsHeight: (arg: number) => void
}

export function recordsLayoutActions(self: RecordsLayoutActionsHost) {
  return {
    /**
     * #action
     * Raise the band to its whole stack, so no record row hides.
     */
    showAllRecordRows() {
      self.setRecordsHeight(self.recordsStackHeight)
    },
    /**
     * #action
     * Write the band's height over rows once, at its first layout with a
     * record on screen: what it draws then, its stack up to the default.
     * From then on a pan fits the records inside the band rather than
     * resizing it, and a region with no record before that spends nothing.
     */
    settleRecordsBandHeight() {
      self.setRecordsHeight(self.topBands.recordsHeight)
    },
  }
}

interface RecordsOpeningHeightHost
  extends RecordsLayoutHost, RecordsLayout, RecordsLayoutActionsHost {
  configuration: RecordsSettingsHost['configuration']
  recordsOpeningHeightSettled: boolean
  hostHeight: number | undefined
  configuredHeight: number
  setHeight: (height: number) => number
}

export function recordsOpeningHeightActions(self: RecordsOpeningHeightHost) {
  return {
    /**
     * #action
     * Size a records-only track once, at its first layout with a record
     * on screen: its `full` stack up to the slot's `height`, so a sparse
     * window opens compact. Over rows, under `grow`, inside a ring, or
     * with a `height` a config, a session or a drag wrote, it keeps the
     * height it has. Never again for this display, so a pan into a
     * denser window fits the records inside the box rather than moving it.
     */
    settleRecordsOpeningHeight() {
      self.recordsOpeningHeightSettled = true
      const heightWritten = getSnapshot(self.configuration).height !== undefined
      if (
        self.recordsOnly &&
        !self.autoHeight &&
        self.hostHeight === undefined &&
        !heightWritten
      ) {
        self.setHeight(Math.min(self.growTargetHeight, self.configuredHeight))
      }
    },
  }
}

/**
 * Settle the opening height at the first layout with data: a payload
 * laid out and, with no rows, a record on screen to measure. Over rows the
 * band settles its own height at the first layout that draws a record.
 */
export function installRecordsOpeningHeight(
  self: RecordsOpeningHeightHost &
    ReturnType<typeof recordsOpeningHeightActions> &
    ReturnType<typeof recordsLayoutActions>,
) {
  autorunOnReadyView(
    self,
    () => {
      if (
        !self.recordsOpeningHeightSettled &&
        self.cellData !== undefined &&
        self.canRender &&
        (!self.recordsOnly || self.recordsOnScreenIds.size > 0)
      ) {
        self.settleRecordsOpeningHeight()
      }
    },
    { name: 'RecordsOpeningHeight' },
  )
  autorunOnReadyView(
    self,
    () => {
      if (
        !self.recordsOnly &&
        self.showRecords &&
        !self.recordsHeightWritten &&
        self.cellData !== undefined &&
        self.canRender &&
        self.topBands.recordsHeight > 0
      ) {
        self.settleRecordsBandHeight()
      }
    },
    { name: 'RecordsBandHeight' },
  )
}
