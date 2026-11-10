/**
 * The records band as one seam on the variant display: its
 * settings, its render data, the hosted fit ladder, the track height and the
 * display hooks the band decides. Every `recordsOnly` choice the model makes
 * is made here, but the opening height `configuredHeight` reads
 * (`variantRowViews.ts`); the model composes these in order, each block
 * reading the ones before it.
 */
import { getConf, setConf } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { boundBandHeight, clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { facetForField } from '@jbrowse/display-kit/FacetWritesMixin'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { containingHost } from '@jbrowse/display-kit/foundationView'
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
  countTruncatedFeatures,
  createMembershipMemo,
  featureIdsTouchingBlocks,
  hiddenSectionFeatureIds,
  hostFeatureBand,
  labelFontSize,
  labelVisibility,
  maxBottom,
} from '@jbrowse/plugin-features/band'
import { computed } from 'mobx'

import { cellHueField } from '../shared/cellHue.ts'
import { PHASE_SET_FIELD } from '../shared/getPhasedColor.ts'
import { resolveSampleName } from '../shared/getSources.ts'
import { DEFAULT_VARIANT_DISPLAY_HEIGHT } from './configSchema.ts'
import { paintFeatureColors } from './paintCells.ts'
import { mapPayloadRegions } from './payloadRegions.ts'
import { recordCarrierCounter } from './recordCarriers.ts'
import {
  RECORD_LABEL_LINE,
  labelsReadByWorker,
  buildRecordsRenderData,
  recordSpans,
  recordsDisplayConfig,
} from './recordsRenderData.ts'
import { svClassColors, svClassScale } from './recordsSvColors.ts'
import {
  DEFAULT_RECORDS_HEIGHT,
  RECORDS_BAND_BOUNDS,
  recordsBandHeightOverRows,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { CellHue, cellColorEncodingOf } from '../shared/cellHue.ts'
import type { RecordFieldReads } from '../shared/recordFields.ts'
import type { ProcessedSource } from '../shared/types.ts'
import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { KeyedVariants } from './keyedVariants.ts'
import type { RecordCarrierCounter } from './recordCarriers.ts'
import type { RecordsLabels } from './recordsRenderData.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Band } from '@jbrowse/core/util/bandLayout'
import type { WrittenFacet } from '@jbrowse/display-kit/FacetWritesMixin'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  DisplayMode,
  FeatureBandHost,
  FeatureDataResult,
  FeatureFacet,
  FeatureGroupSection,
  FitStage,
  LabelPlacementContext,
  LayoutRegionData,
} from '@jbrowse/plugin-features/band'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const NO_RECORD_LABELS: RecordsLabels = { name: '', description: '' }

const NO_FEATURE_IDS: ReadonlySet<string> = new Set()

export interface RecordsSettingsHost {
  configuration: Instance<LinearVariantDisplayConfigModel>
  recordsOnly: boolean
  drawsGenotypeRows: boolean
  atGenomicPositions: boolean
  colorEncoding: ReturnType<typeof cellColorEncodingOf>
  gateActive: boolean
  aboveForceLoadFloor: boolean
  openingRecordsHeight: number | undefined
}

/** What {@link recordsKeyViews} reads: the layout, the rows and the coloring. */
export type RecordsKeyHost = Pick<
  RecordsSettingsHost,
  'configuration' | 'atGenomicPositions' | 'drawsGenotypeRows' | 'colorEncoding'
>

/**
 * Whether the records band draws and what its key and the cells' key list,
 * which the display and a static export install alike.
 */
export function recordsKeyViews(self: RecordsKeyHost) {
  return {
    /**
     * #getter
     * Whether the records band is drawn: at genomic positions only, where
     * a record lines up with the cells under it, and always while no row
     * draws.
     */
    get showRecords(): boolean {
      return (
        self.atGenomicPositions &&
        (!self.drawsGenotypeRows || getConf(self, ['records', 'show']))
      )
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
     * none only under a picked `encoding.color` field whose values the
     * records paint. A constant paints every record alike, and `phaseSet`
     * paints them by SV class, so neither keys a cell nothing draws.
     */
    get cellColorKeyed() {
      const field = cellHueField(self.colorEncoding)
      return (
        self.drawsGenotypeRows ||
        (field !== undefined && field !== PHASE_SET_FIELD)
      )
    },
  }
}

export function recordsSettingsViews(self: RecordsSettingsHost) {
  return {
    /**
     * #getter
     * Whether a drag, `+N hidden` or a config wrote `records.height`.
     */
    get recordsHeightWritten() {
      return getConf(self, ['records', 'height']) !== undefined
    },
    /**
     * #getter
     * Whether the band's height holds: written, or settled at its opening.
     * Until then the band over rows is its stack, up to the default.
     */
    get recordsHeightHeld() {
      return (
        this.recordsHeightWritten || self.openingRecordsHeight !== undefined
      )
    },
    /**
     * #getter
     * `records.height`, else the height the band opened at, else the
     * default it opens at up to its stack. Raw: what the band spends is
     * `topBands.reserved.records`.
     */
    get recordsHeight(): number {
      return (
        getConf(self, ['records', 'height']) ??
        self.openingRecordsHeight ??
        DEFAULT_RECORDS_HEIGHT
      )
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
     * `records.displayMode`, and unset the one rule its default
     * follows: `compact` over rows, tight with its one label line; with
     * no rows `normal`, a feature track's default.
     */
    get recordsDisplayMode(): DisplayMode {
      const written = getConf(self, ['records', 'displayMode'])
      return written ?? (self.recordsOnly ? 'normal' : 'compact')
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
      return self.recordsOnly
        ? getConf(self, 'growMaxHeight')
        : Number.POSITIVE_INFINITY
    },
    /**
     * #getter
     * The density axis acts only on a VCF with no samples, where the
     * records are the display, as on a feature track, always at genomic
     * positions. Over rows, shown or hidden, the byte gate alone guards
     * the fetch.
     */
    get densityGateActive() {
      return self.gateActive && self.aboveForceLoadFloor && self.recordsOnly
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

export type RecordsSettings = ReturnType<typeof recordsKeyViews> &
  ReturnType<typeof recordsSettingsViews>

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
  }
}

/** What {@link recordColorViews} reads: the payload and its coloring. */
export interface RecordColorHost {
  cellData: CellDataResult | undefined
  cellHue: CellHue
  cellHueValuesRead: boolean
  recordsColorBySvClass: boolean
}

/** The records' colors, which the display and a static export install alike. */
export function recordColorViews(self: RecordColorHost) {
  return {
    /**
     * #getter
     * Each fetched region's record colors: the SV class or
     * `featureDefaultColor` (`svClassColors`), or under a picked
     * `encoding.color` the alt cells' hue at full dose, which neither
     * shading nor the phased mode moves.
     */
    get regionRecordColors() {
      const { cellHue, cellHueValuesRead } = self
      return mapPayloadRegions(
        self.cellData,
        self.recordsColorBySvClass
          ? data => svClassColors(data.featureInfo)
          : data => paintFeatureColors(data, cellHue, cellHueValuesRead),
      )
    },
  }
}

interface RecordsRenderHost
  extends
    RecordsSettings,
    Pick<RecordsSettingsHost, 'recordsOnly' | 'drawsGenotypeRows'> {
  cellData: CellDataResult | undefined
  regionRecordColors: ReadonlyMap<number, Uint32Array>
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
     * A record's carriers among `recordCarrierSamples`, counted when a
     * drawn label or a hover first asks and held per payload and row set;
     * undefined with no rows to carry it.
     */
    get recordCarriersOf(): RecordCarrierCounter | undefined {
      const { cellData } = self
      return cellData && self.showRecords && self.drawsGenotypeRows
        ? recordCarrierCounter(cellData, this.recordCarrierSamples)
        : undefined
    },
    /**
     * #getter
     * What the band's packer reads, minus the label reservation each fit
     * rung varies. `coarseBpPerPx`, so packing does not recompute per
     * frame of a zoom.
     */
    get recordsLayoutInputs(): FeatureBandHost['layoutInputs'] {
      return {
        bpPerPx: self.view.coarseBpPerPx,
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
     * The records of the sections the user hid, as LinearBasicDisplay's
     * `hiddenGroupFeatureIds`: once per payload, facet and hidden set,
     * not per pan.
     */
    get recordsHiddenGroupIds() {
      return hiddenSectionFeatureIds(
        this.recordsSpans,
        self.recordsFacet,
        self.recordsHiddenGroups,
      )
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
              this.recordsHiddenGroupIds,
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
     * How the band letters its records: with no rows as a feature track
     * does, a name line and a description line off the label fields; over
     * rows one `recordLabel` line carrying both, built into each record.
     */
    get recordsLabelPlan() {
      const shown = this.recordsVisibleLabels
      const read = labelsReadByWorker(shown, self.recordFieldReads)
      return self.recordsOnly
        ? {
            configLabels: read,
            recordLabels: NO_RECORD_LABELS,
            showLabels: shown.name !== '',
            showDescriptions: shown.description !== '',
          }
        : {
            configLabels: RECORD_LABEL_LINE,
            recordLabels: read,
            showLabels: shown.name !== '' || shown.description !== '',
            showDescriptions: false,
          }
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
        const { configLabels, recordLabels } = this.recordsLabelPlan
        const config = recordsDisplayConfig({
          featureHeight: self.recordsFeatureHeight,
          labels: configLabels,
          tooltip: self.recordFieldReads.tooltip,
          faceted: self.recordsFacet !== undefined,
        })
        const { jexl } = getEnv(self).pluginManager
        const { displayedRegions } = self.view
        const featureColors = self.regionRecordColors
        const carriersOf = this.recordCarriersOf
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
                labels: recordLabels,
                carriersOf,
                config,
                jexl,
              }),
            )
          }
        }
      }
      return out
    },
  }
}

export type RecordsRender = ReturnType<typeof recordsRenderViews>

/** What {@link recordsColorScaleViews} reads: the band and its records. */
export interface RecordsColorScaleHost {
  showRecords: boolean
  recordsColorBySvClass: boolean
  keyedVariants: KeyedVariants
}

/** The records band's key, which the display and a static export install alike. */
export function recordsColorScaleViews(self: RecordsColorScaleHost) {
  return {
    /**
     * #getter
     * The key to the records band's SV classes, the ones its records on
     * screen hold, while it colors by them.
     */
    get recordsColorScales(): ColorScale[] {
      return self.showRecords && self.recordsColorBySvClass
        ? [svClassScale(self.keyedVariants.svTypes)].filter(
            scale => scale.entries.length > 0,
          )
        : []
    },
  }
}

interface RecordsLayoutHost extends RecordsRenderHost, RecordsRender {
  height: number
  atGenomicPositions: boolean
  connectorsBand: Band
  fitHeightToDisplay: boolean
  autoHeight: boolean
  fitTargetHeight: number
  scrollTop: number
  rowsContentHeight: number
  availableHeight: number
}

export function recordsLayoutViews(self: RecordsLayoutHost) {
  // LinearBasicDisplay's own feature band, hosted for the records. Its host
  // is a plain object and not this model, whose `facet` is the sample
  // facet and not a feature one.
  const host: FeatureBandHost = {
    get rpcDataMap() {
      return self.recordsRenderDataMap
    },
    get layoutReady() {
      return self.showRecords && self.canRender
    },
    get layoutInputs() {
      return self.recordsLayoutInputs
    },
    get showLabels() {
      return self.recordsLabelPlan.showLabels
    },
    get effectiveShowDescriptions() {
      return self.recordsLabelPlan.showDescriptions
    },
    get facet() {
      return self.recordsFacet
    },
    sectionHeadPx: GROUP_LABEL_HEIGHT,
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
      return bands.get().reserved.records
    },
    get labelFontSize() {
      return self.recordsFontSize
    },
    // over rows a record the band has no room for hides; with no rows the
    // band is the display, and squeezes as a feature track does
    get hidesOverflow() {
      return !self.recordsOnly
    },
  }
  const band = hostFeatureBand(host)
  const fullStackHeight = computed(() =>
    maxBottom(band.baseLaidOutDataMap, self.recordsMeasureIds),
  )
  // over rows the band's height is added to the display's, so it reads
  // nothing of the display's height
  const bands = computed(() =>
    variantTopBandsGeometry({
      showRecords: self.showRecords,
      recordsHeight: self.recordsOnly
        ? self.height
        : recordsBandHeightOverRows({
            recordsHeight: self.recordsHeight,
            recordsHeightHeld: self.recordsHeightHeld,
            recordsContentHeight: fullStackHeight.get(),
          }),
      showChips: self.atGenomicPositions && !self.recordsOnly,
      connectors: self.connectorsBand,
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
        ? Math.max(MIN_GROW_HEIGHT, fullStackHeight.get())
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
      return band.fitStage
    },
    /**
     * #getter
     * What the band's painter, labels and hit test all read: the kept
     * stack. With no rows it is scaled when the fit squeezed it, as a
     * feature track's; over rows it never squeezes, and past the ladder's
     * last rung a record that does not fit the band hides.
     */
    get recordsLaidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
      return band.laidOutDataMap
    },
    /**
     * #getter
     * How many records on screen the band leaves unplaced, past its
     * height over rows.
     */
    get recordsHiddenCount() {
      return countTruncatedFeatures(
        this.recordsLaidOutDataMap,
        self.recordsOnScreenIds,
      )
    },
    /**
     * #getter
     * The band's whole stack at full size, labels included: the height
     * at which no record hides.
     */
    get recordsStackHeight() {
      return Math.ceil(fullStackHeight.get())
    },
    /**
     * #getter
     * The record sections in stacking order, each with the chip row the
     * packer reserved above it; empty while the records are one section.
     */
    get recordsGroupSections(): FeatureGroupSection[] {
      return band.groupSections
    },
    /**
     * #getter
     * Which label kinds the band paints: what the kept rung reserved, so a
     * box never claims width for a description the band had no room for.
     */
    get recordsRenderedLabels(): LabelPlacementContext {
      return band.renderedLabels
    },
    /**
     * #getter
     * Per-region hit index over the band's laid-out records, off the
     * painted stack and the RENDERED label flags, a label's overhang being
     * part of its hit box. Held alive by the `RecordsHitIndexes` autorun
     * across pointer frames.
     */
    get recordsFlatbushIndexes() {
      return band.flatbushIndexes
    },
    /**
     * #getter
     * The band's record ids to the primitives they painted, per region.
     * Held by no autorun, as a feature track's: built when a hover or a
     * highlight first asks, and the per-region memo outlives the computed.
     */
    get recordsRegionInstanceIndexes() {
      return band.regionInstanceIndexes
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
     * `TreeSidebarMixin`'s hook: the chips' strip, which holds only
     * controls. It shows only at genomic positions, where the connectors
     * take no height, so it sits directly above the focus chip's line.
     */
    get rowsHeaderControlsHeight() {
      return this.topBands.reserved.chips
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
        ? this.topBands.reserved.records
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
     * #method
     * Where a record drew, `[startBp, top, endBp, bottom]`, as a feature
     * track answers it: the breakpoint split view's overlay subtracts the
     * display's `scrollTop`, so the top is the band's own, which over rows
     * does not scroll. A record the band hides is not found.
     */
    searchFeatureByID(id: string) {
      const drawn = band.searchFeatureByID(id)
      const shift = self.scrollTop - this.recordsScrollTop
      return drawn
        ? ([drawn[0], drawn[1] + shift, drawn[2], drawn[3] + shift] as const)
        : undefined
    },
  }
}

export type RecordsLayout = ReturnType<typeof recordsLayoutViews>

interface RecordsTrackHeightHost extends IStateTreeNode {
  recordsOnly: boolean
  drawsGenotypeRows: boolean
  autoHeight: boolean
  grownHeight: number
  fitTargetHeight: number
  topBands: RecordsLayout['topBands']
}

export function recordsTrackHeightViews(self: RecordsTrackHeightHost) {
  return {
    /**
     * #getter
     * Genotype rows hidden on a VCF with samples: the band and its chip
     * strip are all the track draws, and the slot waits for the rows'
     * return.
     */
    get rowsHidden() {
      return !self.drawsGenotypeRows && !self.recordsOnly
    },
    /**
     * #getter
     * The records band as the whole track, which the R export hands over
     * as a feature track: the height it draws at, and whether it fits its
     * records into that height, as it does over hidden rows. Undefined
     * while genotype rows draw.
     */
    get recordsAlone(): { height: number; fits: boolean } | undefined {
      return self.drawsGenotypeRows
        ? undefined
        : { height: self.topBands.reserved.records, fits: this.rowsHidden }
    },
    /**
     * #getter
     * Over genotype rows the records band and its chip strip add their
     * height to the track above them, so the rows keep the slot's height;
     * with the rows hidden the track is the band and its chip strip.
     * With no samples, or in a ring, the band is the display, sized by
     * `heightMode`. Overrides `HeightModeMixin.height`.
     */
    get height(): number {
      const sized =
        self.autoHeight && containingHost(self).initialized
          ? self.grownHeight
          : self.fitTargetHeight
      return self.recordsOnly
        ? sized
        : (this.rowsHidden ? 0 : sized) + self.topBands.addedHeight
    },
  }
}

interface RecordsTrackResizeHost {
  rowsHidden: boolean
  resizeHeight: (distance: number) => number
  expandToContentHeight: () => number
  resizeRecordsBand: (distance: number) => number
  showAllRecordRows: () => number
}

export function recordsTrackResizeActions(self: RecordsTrackResizeHost) {
  const superResizeHeight = self.resizeHeight
  const superExpandToContentHeight = self.expandToContentHeight
  return {
    /**
     * #action
     * With the rows hidden the track's edge resizes the records band;
     * otherwise `HeightModeMixin`'s, on the slot the rows draw at.
     */
    resizeHeight(distance: number) {
      return self.rowsHidden
        ? self.resizeRecordsBand(distance)
        : superResizeHeight(distance)
    },
    /**
     * #action
     * With the rows hidden the handle's double click grows the band
     * to its whole stack, so no record hides; it never shrinks it.
     */
    expandToContentHeight() {
      return self.rowsHidden
        ? self.showAllRecordRows()
        : superExpandToContentHeight()
    },
  }
}

interface RecordsLayoutActionsHost extends RecordsLayout {
  configuration: RecordsSettingsHost['configuration']
  openingRecordsHeight: number | undefined
}

export function recordsLayoutActions(self: RecordsLayoutActionsHost) {
  function resizeRecordsBand(distance: number) {
    const before = self.topBands.reserved.records
    const after = clampBandHeight(
      before,
      before + distance,
      RECORDS_BAND_BOUNDS,
    )
    if (after !== before) {
      setConf(
        self,
        ['records', 'height'],
        before === 0 ? boundBandHeight(after, RECORDS_BAND_BOUNDS) : after,
      )
    }
    return self.topBands.reserved.records - before
  }
  return {
    /**
     * #action
     * Raise the band to its whole stack, so no record row hides; it never
     * shrinks it. The `+N hidden` chip, and the track handle's double click
     * with the rows hidden.
     */
    showAllRecordRows() {
      return resizeRecordsBand(
        Math.max(0, self.recordsStackHeight - self.topBands.reserved.records),
      )
    },
    /**
     * #action
     * Resize the band by `distance` from what it draws, answering how far
     * it moved, as `resizeHeight` answers for the track. A resize the
     * clamp leaves where it is writes nothing, so an empty band pushed
     * shut stays unwritten; one pulled open opens at least at the floor,
     * since it is empty for want of records, not set below the floor.
     */
    resizeRecordsBand,
    /**
     * #action
     * The seam handle's drag: `resizeRecordsBand` to `height`.
     */
    setRecordsHeight(height: number) {
      resizeRecordsBand(height - self.topBands.reserved.records)
    },
    /**
     * #action
     * Hold the band's height over rows from its first layout of a fetched
     * record at `records.displayMode`, not one collapsed past the density
     * budget: what it draws then, its stack up to the default. From
     * then on a pan fits the records inside the band rather than resizing
     * it, and a region with no record before that spends nothing. Held on
     * this display alone, never written, so viewing a track edits no
     * session; a written `records.height` wins over it.
     */
    settleRecordsBandHeight() {
      self.openingRecordsHeight = self.topBands.reserved.records
    },
  }
}

interface RecordsOpeningHeightHost
  extends RecordsLayoutHost, RecordsLayout, RecordsLayoutActionsHost {
  openingHeight: number | undefined
  heightWritten: boolean
  inRing: boolean
}

export function recordsOpeningHeightActions(self: RecordsOpeningHeightHost) {
  return {
    /**
     * #action
     * Hold a records-only track's height from its first layout with a
     * record on screen: its `full` stack up to the default, so a sparse
     * window opens compact. Once for this display, so a pan into a denser
     * window fits the records inside the box rather than moving it. Held
     * on this display alone, never written, so viewing a track edits no
     * session; a written `height` wins over it.
     */
    settleRecordsOpeningHeight() {
      self.openingHeight = Math.min(
        self.growTargetHeight,
        DEFAULT_VARIANT_DISPLAY_HEIGHT,
      )
    },
  }
}

/**
 * Settle the opening heights once: with no rows the track's, at the first
 * layout with a record on screen, unless `grow`, a ring or a written `height`
 * sizes it; over rows the band's, at the first layout packing a record at its
 * display mode, unless `records.height` is written.
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
        self.recordsOnly &&
        self.openingHeight === undefined &&
        !self.heightWritten &&
        !self.autoHeight &&
        !self.inRing &&
        self.recordsStackHeight > 0
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
        !self.recordsHeightHeld &&
        self.recordsPackMode === self.recordsDisplayMode &&
        self.recordsStackHeight > 0
      ) {
        self.settleRecordsBandHeight()
      }
    },
    { name: 'RecordsBandHeight' },
  )
}
