import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import {
  canonicalizeViewRefName,
  getDialogHost,
  getEnv,
  getSession,
  SimpleFeature,
} from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import {
  FEATURE_FIELD_PRESETS,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import {
  lowerBoundOf,
  predicatesOf,
  unreadFieldNotice,
  upperBoundOf,
  withLowerBound,
  withUpperBound,
} from '@jbrowse/core/util/fieldPredicate'
import Flatbush from '@jbrowse/core/util/flatbush'
import { readFor } from '@jbrowse/core/util/installPrerequisiteFetch'
import {
  baseJexlFilters,
  configuredJexlFilters,
  writeJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import FacetWritesMixin from '@jbrowse/display-kit/FacetWritesMixin'
import HeightModeMixin from '@jbrowse/display-kit/HeightModeMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import {
  colorSnapshotOf,
  paintedColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { fetchRegionsBatched } from '@jbrowse/display-kit/fetchEachRegion'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import {
  buildFeatureFlatbushIndex,
  createFeatureDetailsOpener,
  createMembershipMemo,
  FeatureGateMixin,
  featureSpanRegion,
  fetchFeatureDetails,
  featureIdsTouchingBlocks,
  fitLadderViews,
  fitLadderVolatiles,
  labelFontSize,
  labelVisibility,
  MIN_GROW_HEIGHT,
  maxBottom,
  scaleLaidOutData,
} from '@jbrowse/plugin-features/band'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { makeBpMapper, spanRect } from '@jbrowse/render-core/canvas2dUtils'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances, shiftInk } from '@jbrowse/render-core/marks'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  keptRows,
  loadedRegionIndexAt,
} from '@jbrowse/tree-sidebar'
import { computed, observable } from 'mobx'

import {
  cellColorEncodingOf,
  cellHueField,
  cellHueOf,
  sameHueRead,
} from '../shared/cellHue.ts'
import {
  HIDDEN_ROW,
  INTERNAL_SOURCE_KEYS,
  MULTI_SAMPLE_VARIANT_DISPLAY,
  VARIANT_FEATURE_WIDGET,
  clampLineZoneHeight,
} from '../shared/constants.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { buildSampleIndex } from '../shared/genotypeCodec.ts'
import {
  expandPhasedRows,
  parseRowName,
  resolveSampleName,
  rowAliasOf,
} from '../shared/getSources.ts'
import { CellSolidColorDialog } from '../shared/lazyDialogs.ts'
import { isSiteField } from '../shared/minorAlleleFrequencyUtils.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import {
  sitesBySpan,
  sortSourcesAroundVariant,
} from './anchoredHaplotypeSort.ts'
import { cellGlyphs } from './components/cellGlyphs.ts'
import { withClickedSample } from './components/enrichFeatureFromClick.ts'
import { VARIANT_MARKS } from './components/variantMarks.ts'
import {
  densityRung,
  fadeCellColors,
  recordDensityAlpha,
} from './densityFade.ts'
import { VARIANT_MATRIX_MARKS } from './matrix/variantMatrixMarks.ts'
import {
  variantContextMenuItems,
  variantTrackMenuItems,
} from './multiSampleVariantMenuItems.ts'
import {
  paintCellColors,
  paintFeatureColors,
  paintedColorKeys,
} from './paintCells.ts'
import { placeVariantRows } from './placeVariantRows.ts'
import { countRecordCarriers } from './recordCarriers.ts'
import { recordCountMeasurements } from './recordsDensityGate.ts'
import {
  RECORD_LABEL_LINE,
  buildRecordsRenderData,
  recordSpans,
  recordsDisplayConfig,
} from './recordsRenderData.ts'
import { svClassColors, svClassScale, svClassesOf } from './recordsSvColors.ts'
import { getVariantColorScales } from './variantLegend.ts'
import {
  recordsBandBounds,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

import type { SimplifiedVariantFeature } from '../VariantRPC/analyzeVariants.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { VariantUnit } from '../shared/constants.ts'
import type {
  ProcessedSource,
  Source,
  VariantContextMenuInfo,
  VariantFeatureInfo,
} from '../shared/types.ts'
import type { HoveredCell } from './components/VariantComponent.tsx'
import type { CellGlyphs } from './components/cellGlyphs.ts'
import type { VariantCellData } from './components/computeVariantCells.ts'
import type { VariantRenderingBackend } from './components/variantRenderingBackendTypes.ts'
import type { LinearMultiSampleVariantDisplayConfigModel } from './configSchema.ts'
import type { MatrixHoveredCell } from './matrix/VariantMatrixComponent.tsx'
import type {
  VariantMatrixRenderBlock,
  VariantMatrixRenderingBackend,
} from './matrix/variantMatrixRenderingBackendTypes.ts'
import type { Placed } from './placeVariantRows.ts'
import type { RecordCarriers } from './recordCarriers.ts'
import type { RecordsLabels } from './recordsRenderData.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  FeatureDataResult,
  FitLadderHost,
  FitStage,
  FlatbushRegionIndexes,
  HitFeatureResult,
  LayoutRegionData,
} from '@jbrowse/plugin-features/band'
import type {
  RowAlias,
  RowBanding,
  SvgSidebarProps,
} from '@jbrowse/tree-sidebar'

type VariantHoverFields = Record<string, unknown> & {
  genotype: string
  name: string
}

// Called from the actions that set an attribute and from `setSources`, never
// from a computed, which would console.warn per menu render. Silent on an empty
// source list, the pre-load state.
function warnMissingAttribute(
  setting: string,
  attribute: string,
  sources: Record<string, unknown>[],
) {
  if (sources.length) {
    console.warn(
      `${setting} attribute "${attribute}" not found in sample metadata. ` +
        `Available attributes: ${Object.keys(sources[0]!).join(', ')}`,
    )
  }
}

// What an anchored sort needs: the sites in genomic order and each feature's
// interned codes, which live per region.
function getOrderedGenotypeCodes(cellData: CellDataResult) {
  const genotypeCodesByFeatureId = new Map<string, Uint32Array>()
  for (const regionData of Object.values(cellData.perRegionCellData)) {
    for (const info of regionData.featureInfo) {
      genotypeCodesByFeatureId.set(info.featureId, info.genotypeCodes)
    }
  }
  return {
    sites: sitesBySpan(cellData.simplifiedFeatures),
    genotypeCodesByFeatureId,
  }
}

function warnUnknownArrangementAttributes(
  self: { rowColorField: string; facet: FacetSetting | undefined },
  sources: Source[],
) {
  const { rowColorField } = self
  if (rowColorField && !sources.some(source => rowColorField in source)) {
    warnMissingAttribute('rowColor', rowColorField, sources)
  }
  const field = self.facet?.field
  if (field && !sources.some(source => field in source)) {
    warnMissingAttribute('facet', field, sources)
  }
}

// Columns fetch the visible regions only: they are laid out by feature index
// across the visible width, so a buffered feature would be crammed into the
// viewport. Genomic positions clip, and fetch the buffered regions.
function fetchRegionsForLayout(
  view: RegionHost,
  onTrack: (assemblyName: string) => boolean,
  layout: 'genomic' | 'columns',
): IndexedRegion[] {
  if (layout === 'columns') {
    return view.visibleRegions
      .filter(vr => onTrack(vr.assemblyName))
      .map(vr => ({
        region: {
          refName: vr.refName,
          start: Math.floor(vr.start),
          end: Math.ceil(vr.end),
          assemblyName: vr.assemblyName,
          // carried so the worker can put the columns in screen order inside a
          // reversed region (orderByScreenPosition)
          reversed: vr.reversed,
        },
        displayedRegionIndex: vr.displayedRegionIndex,
      }))
  }
  return view.bufferedVisibleRegions.filter(b => onTrack(b.region.assemblyName))
}

/**
 * plugin-features's own `featureHeight` default at its compact display mode,
 * which keeps the band's stack, and so its natural height, tight.
 */
const RECORDS_FEATURE_HEIGHT = 10

const NO_RECORD_LABELS: RecordsLabels = { name: '', description: '' }

const NO_FEATURE_IDS: ReadonlySet<string> = new Set()

/**
 * The GPU program each layout draws with, tagged so the one upload lifecycle
 * sends each payload to the backend that can draw it.
 */
export type VariantLayoutBackend =
  | (VariantRenderingBackend & { columns: false })
  | (VariantMatrixRenderingBackend & { columns: true })

/**
 * #stateModel LinearMultiSampleVariantDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 * Multi-sample variant display drawing one genotype row per sample, with a
 * per-cell feature widget on click.
 *
 * #example
 * `unit`, `rowColor`, `rows` and `filter` are
 * config (see the display's config schema), read at runtime through `getConf`
 * and written as session edits to the track's config — they are not plain MST
 * properties. Set them in a track's `displays` array to change the default:
 * ```js
 * displays: [
 *   {
 *     type: 'LinearMultiSampleVariantDisplay',
 *     displayId: 'my-cohort',
 *     unit: 'haplotype',
 *     rowColor: 'population',
 *     rows: { sort: ['NA12878', 'NA12891'] },
 *     filter: [{ field: 'minorAlleleFrequency', gte: 0.05 }],
 *   },
 * ]
 * ```
 *
 * `runClustering` is a transient declarative launch spec, the same idea as
 * `LinearGenomeView`'s `init`: set it to run the real "Cluster rows by genotype"
 * RPC once automatically (no dialog) as soon as sources are available, and it
 * clears itself afterwards so a saved session never re-triggers it.
 * ```js
 * displays: [
 *   {
 *     type: 'LinearMultiSampleVariantDisplay',
 *     runClustering: true,
 *   },
 * ]
 * ```
 *
 * ## How the rows are arranged
 *
 * The arrangement is config: `rows` holds the order, the labels, the cluster
 * tree with its provenance and the focus, and `rowColor` the colors, each by
 * row name at the mode's granularity — a sample in allele-count mode, a
 * haplotype (`"<sample> HP<n>"`) in phased mode, where a sample name stands
 * for its haplotypes. A drag, the arrangement dialog, "Sort rows by genotype here" and
 * a clustering run write it; the rows are derived from it on every read:
 *
 * 1. `rows.kept` focuses the adapter's samples (`adapterSamples`) to the set
 *    the fetch asks for (`sourcesBase`, `sampleFilter`),
 * 2. phased mode expands each sample to its haplotypes (`expandedRows`), and
 *    `rows.sort` orders them, `rows.labels` relabels them and each row has
 *    its resolved `rowColor` (`editableSources`, the dialog's list), each from
 *    `TreeSidebarMixin` over this display's hooks,
 * 3. the focus narrows those (`clusterableSources`, what a run clusters),
 * 4. `facet` stacks those in bands (`bandedSources`), each band's rows in their
 *    arranged order,
 * 5. the result is `sources`, each row's `rowColor` its label bar.
 *
 * **The `rowColor` palette wins over a color the row already has**, a
 * `samplesTsv` `color` column: a channel bound to a variable beats a per-row
 * constant, so "Color by… → (none)" restores the row's color from that column.
 * `rowColor` holds one field's values, so a dialog color set under the palette
 * turns every row's color into a `name` pair.
 *
 * **The `facet` bands win over a tree**: a band draws the clade of the tree
 * whose leaves are exactly its rows in order, and a clustering run under bands
 * clusters each band apart and writes one forest. A whole-cohort tree under a
 * facet set afterwards draws where a band happens to be a clade, and the hint
 * counts the bands without one.
 */
export function stateModelFactory(
  configSchema: LinearMultiSampleVariantDisplayConfigModel,
) {
  return (
    types
      .compose(
        MULTI_SAMPLE_VARIANT_DISPLAY,
        BaseDisplay,
        HeightModeMixin(),
        types.compose(MultiRegionDisplayMixin(), FeatureGateMixin()),
        LegendMixin(),
        types.compose(ColorWritesMixin(), FacetWritesMixin()),
        RowHeightMixin(),
        StoredHoverMixin<VariantHoverFields>(),
        TreeSidebarMixin<ProcessedSource>(),
        ContextMenuMixin<VariantContextMenuInfo>(),
        types.model({
          type: types.literal(MULTI_SAMPLE_VARIANT_DISPLAY),
          configuration: ConfigurationReference(configSchema),
        }),
      )
      .volatile(() => ({
        /**
         * #volatile
         * The adapter's sample list, stamped with the adapter config it
         * answers.
         */
        sampleListing: undefined as AdapterRead<Source[]> | undefined,
        /**
         * #volatile
         * The fetched per-display data, replaced whole by each fetch.
         */
        cellData: undefined as CellDataResult | undefined,
        /**
         * #volatile
         * The displayed regions the current `cellData` was fetched for. The
         * payload does not list them: a region with no variants gets no
         * `perRegionCellData` entry, and the columns payload is one entry
         * for every region.
         */
        cellDataRegionIndices: new Set<number>() as ReadonlySet<number>,
        /**
         * #volatile
         * The zoom the current `cellData` was fetched at, set in columns
         * alone. The columns are the features of exactly the span on
         * screen, so after a zoom inside the loaded span the held payload
         * still lays out features the view no longer shows. Undefined answers
         * at every zoom, as the position-drawn payload does.
         */
        cellDataBpPerPx: undefined as number | undefined,
        /**
         * #volatile
         * The genotype cell under the pointer, as `hoverInk` lights it; the
         * shared tooltip slot holds no cell instance.
         */
        hoveredCell: undefined as HoveredCell | undefined,
        /**
         * #volatile
         * The record under the pointer in the records band, plugin-features's
         * hit result, so `hoverInk` lights the box the band painted.
         */
        hoveredRecord: undefined as HitFeatureResult | undefined,
        /**
         * #volatile
         * The matrix cell under the pointer, in the equal-width column layout.
         */
        hoveredMatrixCell: undefined as MatrixHoveredCell | undefined,
        /**
         * #volatile
         * Whether the attached backend draws columns, so the upload sends it
         * the payload it can draw across the swap a layout change makes.
         */
        backendDrawsColumns: false,
      }))
      .actions(self => {
        const { clearHoveredFeature: superClearHoveredFeature } = self
        return {
          /**
           * #action
           */
          setHoveredCell(cell?: HoveredCell) {
            self.hoveredCell = cell
          },
          /**
           * #action
           */
          setHoveredRecord(record?: HitFeatureResult) {
            self.hoveredRecord = record
          },
          /**
           * #action
           */
          setHoveredMatrixCell(cell?: MatrixHoveredCell) {
            self.hoveredMatrixCell = cell
          },
          /**
           * #action
           * `StoredHoverMixin`'s clears the tooltip; the highlight boxes go
           * with it.
           */
          clearHoveredFeature() {
            superClearHoveredFeature()
            self.hoveredCell = undefined
            self.hoveredRecord = undefined
            self.hoveredMatrixCell = undefined
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The samples the adapter lists, undefined until the current adapter
         * config's list lands.
         */
        get adapterSamples(): Source[] | undefined {
          return readFor(self, self.sampleListing)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Store a payload and the regions it covers. One payload serves every
         * region of a fetch and replaces the last one whole, so this is also
         * where the previous batch's regions stop having data behind them, and
         * where a hover indexing the old payload's cells goes.
         */
        setCellData(
          data: CellDataResult | undefined,
          displayedRegionIndices: Iterable<number> = [],
          bpPerPx?: number,
        ) {
          self.cellData = data
          self.cellDataRegionIndices = new Set(displayedRegionIndices)
          self.cellDataBpPerPx = bpPerPx
          self.clearHoveredFeature()
        },
      }))
      .views(self => {
        let held:
          | {
              cellData: CellDataResult
              info: Map<string, VariantFeatureInfo>
              positional: Map<string, SimplifiedVariantFeature>
            }
          | undefined
        // keyed on the payload rather than a computed: pointer handlers read
        // these untracked, where a computed would rebuild per call
        function recordsOf(cellData: CellDataResult) {
          if (held?.cellData !== cellData) {
            const info = new Map<string, VariantFeatureInfo>()
            for (const data of Object.values(cellData.perRegionCellData)) {
              for (const record of data.featureInfo) {
                info.set(record.featureId, record)
              }
            }
            held = {
              cellData,
              info,
              positional: new Map(
                cellData.simplifiedFeatures.map(f => [f.id, f]),
              ),
            }
          }
          return held
        }
        return {
          /**
           * #method
           * The payload's record behind a cell.
           */
          featureInfoById(featureId: string) {
            return self.cellData
              ? recordsOf(self.cellData).info.get(featureId)
              : undefined
          },
          /**
           * #method
           * The payload's positional record behind a cell.
           */
          simplifiedFeatureById(featureId: string) {
            return self.cellData
              ? recordsOf(self.cellData).positional.get(featureId)
              : undefined
          },
        }
      })
      .views(self => ({
        get view() {
          return containingLgv(self)
        },
        /**
         * #method
         * Whether the held payload was fetched for this region: a batched fetch
         * replaces the whole payload, so a region an earlier batch loaded keeps
         * its `loadedRegions` entry with nothing behind it. In columns, also
         * whether it was fetched at the zoom on screen.
         */
        regionHasData(displayedRegionIndex: number): boolean {
          const fetchedAt = self.cellDataBpPerPx
          return (
            self.cellDataRegionIndices.has(displayedRegionIndex) &&
            (fetchedAt === undefined || fetchedAt === self.host.bpPerPx)
          )
        },
        /**
         * #method
         * The `jexl:` expressions the `filter` list holds.
         */
        configuredFilters(): string[] {
          return configuredJexlFilters(self)
        },
        /**
         * #method
         * The expressions the track's config declares, which "Clear all
         * filters" returns to.
         */
        baseFilters(): string[] {
          return baseJexlFilters(self)
        },
        /**
         * #method
         * The record a click on the rows or the matrix resolved to,
         * positional fields only: its genotypes are in the cell payload.
         */
        featureById(featureId: string): Feature | undefined {
          const hit = self.simplifiedFeatureById(featureId)
          return hit && new SimpleFeature(hit)
        },
        /**
         * #getter
         * Whether any called genotype is phased or haploid (no `/`), which
         * gates the per-haplotype rows; a pangenome callset writes bare `0`/`1`
         * with no `|` anywhere.
         */
        get hasPhasedOrHaploid() {
          return self.cellData?.hasPhasedOrHaploid ?? false
        },
        /**
         * #getter
         * Whether the worker painted a secondary-alt cell, which keys the
         * "Other alt allele" legend entry. Painted, not possible.
         */
        get hasSecondaryAlt() {
          return self.cellData?.hasSecondaryAlt ?? false
        },
        /**
         * #getter
         * Whether phase-set coloring painted an alt cell whose call names no
         * phase set, which keys that cell's plain hue.
         */
        get hasAltWithoutPhaseSet() {
          return self.cellData?.hasAltWithoutPhaseSet ?? false
        },
        /**
         * #getter
         * Whether the worker painted a black unphased cell (drives the
         * "Unphased" legend entry).
         */
        get hasUnphased() {
          return self.cellData?.hasUnphased ?? false
        },
        /**
         * #getter
         * Whether the worker painted a no-call cell (drives the "No call"
         * legend entry).
         */
        get hasNoCall() {
          return self.cellData?.hasNoCall ?? false
        },
        /**
         * #getter
         * Whether any visible variant has a SnpEff/VEP annotation, gating
         * the "Color by→Consequence impact" menu option.
         */
        get hasConsequence() {
          return self.cellData?.hasConsequence ?? false
        },
        /**
         * #getter
         * Whether any visible variant is a structural variant, gating the "Color
         * by...→SV type" menu option.
         */
        get hasSvType() {
          return self.cellData?.hasSvType ?? false
        },
        /**
         * #getter
         * Whether any visible variant declares a phase set (PS in FORMAT),
         * gating the "Color by→Phase set" menu option.
         */
        get hasPhaseSet() {
          return self.cellData?.hasPhaseSet ?? false
        },
      }))
      .views(self => {
        const ploidy = stableIdentityComputed(() => self.cellData?.samplePloidy)
        return {
          /**
           * #getter
           * Each sample's ploidy as the latest fetch reports it, the same
           * object while a region arrival reports the same ploidies, so the
           * phased rows are expanded again only when one changes.
           */
          get samplePloidy(): Readonly<Record<string, number>> | undefined {
            return ploidy.get()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         */
        get unit(): VariantUnit {
          return getConf(self, 'unit')
        },
        /**
         * #getter
         * Whether each variant draws at its genomic span, or as one of a row
         * of equal-width columns tied to its position by a connector line.
         */
        get variantLayout(): 'genomic' | 'columns' {
          return getConf(self, 'variantLayout')
        },
        /**
         * #getter
         */
        get atGenomicPositions(): boolean {
          return this.variantLayout === 'genomic'
        },
        /**
         * #getter
         * Height of the connector-line zone above the columns; 0 at genomic
         * positions, where nothing needs connecting.
         */
        get lineZoneHeight(): number {
          return this.atGenomicPositions ? 0 : getConf(self, 'lineZoneHeight')
        },
        /**
         * #getter
         * `genotypes.show`: whether the display reads genotypes and draws a
         * row per sample.
         */
        get showGenotypes(): boolean {
          return getConf(self, ['genotypes', 'show'])
        },
        /**
         * #getter
         * Whether no genotype row draws: `genotypes.show` off, or a VCF
         * whose sample listing landed empty. The records band is then the
         * display, every record the filter admits, sized by `heightMode`.
         */
        get recordsOnly(): boolean {
          return !this.showGenotypes || self.adapterSamples?.length === 0
        },
        /**
         * #getter
         * Whether the records band is drawn: at genomic positions only, where
         * a record lines up with the cells under it, and always while it is
         * the whole display.
         */
        get showRecords(): boolean {
          return (
            this.atGenomicPositions &&
            (this.recordsOnly || getConf(self, ['records', 'show']))
          )
        },
        /**
         * #getter
         * `records.growMaxHeight`, the cap on the band. Raw: what the band
         * spends is `topBands.recordsHeight`.
         */
        get recordsGrowMaxHeight(): number {
          return getConf(self, ['records', 'growMaxHeight'])
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
         */
        get showRowSeparators(): boolean {
          return getConf(self, ['axis', 'grid'])
        },
        /**
         * #getter
         * Whether a hover draws the tooltip table. The crosshairs, the
         * hovered-cell highlight and `hoveredFeature` keep working with it off.
         */
        get showTooltips(): boolean {
          return getConf(self, ['tooltip', 'show'])
        },

        /**
         * #getter
         * The `facet` object as written: the sample-metadata attribute whose
         * values band the rows, and the band order; undefined leaves the
         * existing order alone.
         */
        get facet(): FacetSetting | undefined {
          return facetSettingOf({
            field: getConf(self, ['facet', 'field']),
            sort: getConf(self, ['facet', 'sort']),
          })
        },
        /**
         * #getter
         * `encoding.color` as written, `value` raw: a `jexl:` callback is the
         * worker's to evaluate per variant.
         */
        get colorSetting(): ColorSetting {
          return colorSnapshotOf(self.configuration.encoding.color)
        },
        /**
         * #getter
         * `rowBandingNotices`, and each `filter` field no loaded variant
         * carries.
         */
        get liveNotices(): string[] {
          return [
            ...self.rowBandingNotices,
            ...(self.cellData?.unreadFilterFields ?? []).map(field =>
              unreadFieldNotice(field, 'variant'),
            ),
          ]
        },
        /**
         * #getter
         * What the alt cells' hue paints: undefined for the genotype colors,
         * a CSS color or `jexl:` callback, or a field through its ordinal or
         * threshold scale (`shared/cellHue.ts`).
         */
        get colorEncoding() {
          return cellColorEncodingOf(this.colorSetting)
        },
        /**
         * #getter
         * The field the alt cells paint by, '' while they paint the genotype
         * colors or a constant.
         */
        get colorField(): string {
          return cellHueField(this.colorEncoding) ?? ''
        },
        /**
         * #getter
         * Whether an alt cell's hue is composed with the genotype's alt dosage.
         * The main thread paints it, so a toggle refetches nothing.
         */
        get shadeByDosage(): boolean {
          return getConf(self, 'shadeByDosage')
        },

        get featureWidgetType() {
          return VARIANT_FEATURE_WIDGET
        },
      }))
      .actions(self => {
        const fetchMetadata = createAdapterMetadataFetch(self)
        const openDetails = createFeatureDetailsOpener(self)
        const superSetRowColorChoice = self.setRowColorChoice
        // the click in flight, aborted by the next: the last click wins
        let clickInFlight: AbortController | undefined
        // Queried over the record's first base, which finds it as surely as
        // its span does without reading a 5 Mb SV's whole span.
        async function fullRecordOf(feature: Feature) {
          clickInFlight?.abort()
          const click = new AbortController()
          clickInFlight = click
          const refName = canonicalizeViewRefName(self, feature.get('refName'))
          const region = self.view.displayedRegions.find(
            r => r.refName === refName,
          )
          const start = feature.get('start')
          const full = region
            ? await fetchFeatureDetails(
                getSession(self),
                getRpcSessionId(self),
                self.adapterConfig,
                feature.id(),
                featureSpanRegion(
                  region,
                  start,
                  Math.min(feature.get('end'), start + 1),
                ),
                { signal: click.signal },
              )
            : undefined
          checkAbortSignal(click.signal)
          return full
            ? withClickedSample(full, feature, self.recordsOnly)
            : feature
        }
        return {
          /**
           * #action
           */
          setFilter(f?: string[]) {
            writeJexlFilters(self, f ?? self.baseFilters())
          },
          /**
           * #action
           * The adapter's header metadata, fetched once per adapter config.
           */
          fetchAdapterMetadata() {
            return fetchMetadata()
          },
          /**
           * #action
           * The clicked record as the adapter holds it, INFO and every sample
           * included, as LinearBasicDisplay's `fetchFullFeature` reads it: the
           * cell payload carries positions and genotype codes, no INFO. The
           * clicked cell's sample card rides along; the click's own record
           * where the adapter finds none.
           */
          fetchFullRecord(feature: Feature) {
            return fullRecordOf(feature)
          },
          /**
           * #action
           */
          selectFeature(feature: Feature) {
            void openDetails(() => fullRecordOf(feature))
          },
          /**
           * #action
           */
          setSources(sources: Source[], adapterConfig = self.adapterConfig) {
            const held = self.sampleListing?.value
            if (held !== undefined && deepEqual(sources, held)) {
              self.sampleListing = { adapterConfig, value: held }
              return
            }
            // An order none of whose names is a current row is a previous
            // dataset's. A partial overlap is the same cohort with samples
            // added or removed, and keeps the reader's order.
            const names = new Set(sources.map(resolveSampleName))
            const domain = self.rowSort
            const arrangementIsStale =
              self.rowArrangementIsCustom &&
              domain.length > 0 &&
              !domain.some(name => parseRowName(name, names))
            self.sampleListing = { adapterConfig, value: sources }
            if (arrangementIsStale) {
              self.resetRowArrangement()
            }
            warnUnknownArrangementAttributes(self, sources)
          },
          /**
           * #action
           * The mixin's, then a warning naming a metadata field no sample
           * carries. The tint is resolved on every read of `sources`, so a
           * recolor moves no rows and drops no cluster tree.
           */
          setRowColorChoice(choice: string) {
            superSetRowColorChoice(choice)
            warnUnknownArrangementAttributes(self, self.adapterSamples ?? [])
          },
          /**
           * #action
           */
          setMinMinorAlleleFrequency(arg: number) {
            setConf(
              self.configuration,
              'filter',
              withLowerBound(
                predicatesOf(self.configuration.filter),
                'minorAlleleFrequency',
                arg > 0 ? arg : undefined,
              ),
            )
          },
          /**
           * #action
           */
          setMaxMissingness(arg: number) {
            setConf(
              self.configuration,
              'filter',
              withUpperBound(
                predicatesOf(self.configuration.filter),
                'missingness',
                arg < 1 ? arg : undefined,
              ),
            )
          },
          /**
           * #action
           * Enable fit-to-display-height mode: `rowHeight = 0` makes
           * `effectiveRowHeight` divide `availableHeight` across the rows.
           */
          setFitToHeight() {
            setConf(self, 'rowHeight', 0)
          },
          /**
           * #action
           */
          setReferenceDrawingMode(arg: string) {
            setConf(self, 'referenceDrawingMode', arg)
          },
          /**
           * #action
           */
          setShowRowSeparators(arg: boolean) {
            setConf(self, ['axis', 'grid'], arg)
          },
          /**
           * #action
           */
          setShowTooltips(arg: boolean) {
            setConf(self, ['tooltip', 'show'], arg)
          },
          /**
           * #action
           * Turn dosage shading on or off; the main thread repaints the loaded
           * cells.
           */
          setShadeByDosage(arg: boolean) {
            setConf(self, 'shadeByDosage', arg)
          },
          /**
           * #action
           * the picker Color by's Solid color... opens
           */
          openSolidColorDialog() {
            getDialogHost(self).queueDialog(handleClose => [
              CellSolidColorDialog,
              { model: self, handleClose },
            ])
          },
          /**
           * #action
           */
          setVariantLayout(arg: 'genomic' | 'columns') {
            setConf(self, 'variantLayout', arg)
            // the other layout mounts a backend of its own; a failure of this
            // one's must not keep the banner up in its place
            self.setRenderError(undefined)
          },
          /**
           * #action
           */
          setLineZoneHeight(n: number) {
            setConf(
              self,
              'lineZoneHeight',
              clampLineZoneHeight(self.lineZoneHeight, n),
            )
          },
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
           * Draw the genotype rows, or the records alone.
           */
          setShowGenotypes(arg: boolean) {
            setConf(self, ['genotypes', 'show'], arg)
          },
          /**
           * #action
           * Set the records band's cap, clamped here because a drag can
           * deliver any number and a band dragged shut has to stay grabbable.
           */
          setRecordsGrowMaxHeight(arg: number) {
            setConf(
              self,
              ['records', 'growMaxHeight'],
              clampBandHeight(
                self.recordsGrowMaxHeight,
                arg,
                recordsBandBounds(self.height),
              ),
            )
          },
          /**
           * #action
           */
          setBackendDrawsColumns(arg: boolean) {
            self.backendDrawsColumns = arg
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The `filter` list's site fields, `minorAlleleFrequency` and
         * `missingness`, which the worker tests off each site's allele summary.
         */
        get siteFilter(): FieldPredicate[] {
          return predicatesOf(self.configuration.filter).filter(p =>
            isSiteField(p.field),
          )
        },

        /**
         * #getter
         * The floor the filter puts on `minorAlleleFrequency`, 0 for none: the
         * slider's value
         */
        get minMinorAlleleFrequency(): number {
          return lowerBoundOf(this.siteFilter, 'minorAlleleFrequency') ?? 0
        },

        /**
         * #getter
         * The ceiling the filter puts on `missingness`, 1 for none: the
         * slider's value
         */
        get maxMissingness(): number {
          return upperBoundOf(this.siteFilter, 'missingness') ?? 1
        },

        /**
         * #getter
         * The `filter` list's other entries as the RPC's `filters` arg.
         */
        get filters() {
          const filters = predicatesOf(self.configuration.filter).filter(
            p => !isSiteField(p.field),
          )
          return filters.length
            ? new SerializableFilterChain({
                filters,
                jexl: getEnv(self).pluginManager.jexl,
              })
            : undefined
        },

        get referenceDrawingMode(): string {
          return getConf(self, 'referenceDrawingMode')
        },

        /**
         * #getter
         * Distinct sample-metadata attributes (from samplesTsv) the user can
         * color rows by — every key the sources have except internal plumbing.
         */
        get colorByAttributes(): string[] {
          const sources = self.adapterSamples
          if (!sources?.length) {
            return []
          }
          const keys = new Set<string>()
          for (const source of sources) {
            for (const key in source) {
              if (!INTERNAL_SOURCE_KEYS.has(key)) {
                keys.add(key)
              }
            }
          }
          return [...keys]
        },

        /**
         * #getter
         * `TreeSidebarMixin`'s hook: never, since the cells paint by genotype
         * and a row's color shows only on its label bar.
         */
        get rowColorPaintsMarks(): boolean {
          return false
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: a haplotype row's `sampleName` and `HP`,
         * which the arrangement dialog lists as no column.
         */
        get internalRowFields(): readonly string[] {
          return ['sampleName', 'HP']
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the samplesTsv attributes, the ones
         * "Color by" offers.
         */
        get rowColorFields(): readonly string[] {
          return this.colorByAttributes
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the adapter's samples as rows, each
         * answering to its sample name, a samplesTsv `color` column the row's
         * own color. None while `genotypes.show` is off.
         */
        get discoveredRows(): ProcessedSource[] {
          const samples = self.showGenotypes ? self.adapterSamples : undefined
          return (samples ?? []).map(source => ({
            ...source,
            sampleName: resolveSampleName(source),
          }))
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: a haplotype row answers to its sample's
         * name, so an order, a label, a tint or a focus written against a
         * sample reaches each of its haplotypes.
         */
        get rowAlias(): RowAlias {
          return rowAliasOf(self.adapterSamples ?? [])
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the `facet` bands the rows by a samplesTsv
         * attribute.
         */
        get rowBanding(): RowBanding | undefined {
          return self.facet
        },
        /**
         * #method
         * `TreeSidebarMixin`'s hook: phased mode draws a row per haplotype,
         * once `samplePloidy` lands or the order names them.
         */
        expandRows(rows: ProcessedSource[]): ProcessedSource[] {
          return self.unit === 'haplotype'
            ? expandPhasedRows({
                rows,
                ploidy: self.samplePloidy,
                domain: self.rowSort,
              })
            : rows
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The adapter's samples narrowed to the focus, `rows.kept`: the row set
         * the fetch asks for, so it must not read `samplePloidy`. `undefined`
         * until the samples land; that transition wakes the fetch autorun
         * (reference/FETCH_KEYS.md).
         */
        get sourcesBase(): Source[] | undefined {
          const sources = self.adapterSamples
          return (
            sources &&
            (self.showGenotypes
              ? keptRows(sources, self.rowFocus, self.rowAlias)
              : [])
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the rows are at the granularity they draw, which clustering
         * and the arrangement dialog need: phased mode draws haplotypes, which
         * needs the `samplePloidy` a fetch brings.
         */
        get clusteringReady() {
          return (
            !!self.adapterSamples &&
            (self.unit !== 'haplotype' || !!self.samplePloidy)
          )
        },
        /**
         * #getter
         * Whether there are at least two rows on screen to put in an order,
         * counted over `clusterableSources`, the list a run clusters.
         */
        get hasClusterableRows() {
          return self.clusterableSources.length > 1
        },
        /**
         * #getter
         * Whether the declarative `runClustering: true` path may fire: the fetched
         * inputs have landed and two or more rows are on screen.
         */
        get autoClusterReady() {
          return this.clusteringReady && this.hasClusterableRows
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Which samples the worker emits rows for, as a sorted set: row order
         * is not a fetch input (reference/FETCH_KEYS.md). `undefined` means the
         * sources haven't loaded and is never reused for "all of them", or the
         * fetch would not wake when they land. Reads `sourcesBase`, never
         * `sources`, which reads the fetch-derived `samplePloidy`.
         */
        get sampleFilter(): string[] | undefined {
          const base = self.sourcesBase
          return base?.map(resolveSampleName).sort()
        },
      }))
      .views(self => {
        // compared by value, so editing the key's title or names repaints
        // nothing
        const hueInput = stableIdentityComputed(() => ({
          encoding: paintedColorEncoding(self.colorEncoding),
          keptField: self.colorSetting.field || self.parkedColor?.field,
        }))
        return {
          /**
           * #getter
           * The painted `encoding.color` and the field kept beside it, which
           * `cellHue` resolves.
           */
          get cellHueInput() {
            return hueInput.get()
          },
          /**
           * #getter
           * What the worker reads off each variant for the alt cells' hue,
           * apart from the loaded values a ramp follows.
           */
          get cellHueRead() {
            const { encoding, keptField } = hueInput.get()
            return cellHueOf(encoding, keptField).read
          },
        }
      })
      .views(self => ({
        // Payload for MultiSampleVariantGetCellData; a change refetches. Only
        // what the worker reads, and nothing fetch-derived.
        // `referenceDrawingMode` is one at genomic positions only: columns draw
        // every reference cell.
        rpcProps() {
          return {
            layout: self.variantLayout,
            sampleFilter: self.sampleFilter,
            siteFilter: self.siteFilter,
            filters: self.filters,
            unit: self.unit,
            color: self.cellHueRead,
            referenceDrawingMode: self.atGenomicPositions
              ? self.referenceDrawingMode
              : 'draw',
          }
        },
        /**
         * #getter
         * Whether the held payload's color values were read for the current
         * `encoding.color`; one read for another paints as though it read
         * none.
         */
        get cellHueValuesRead() {
          return sameHueRead(self.cellData?.colorRead, self.cellHueRead)
        },
        /**
         * #getter
         * Where the alt cells' hue comes from: what the worker reads and how
         * the main thread paints it (`cellHueOf`), a ramp over the values
         * every fetched region read.
         */
        get cellHue() {
          const { encoding, keptField } = self.cellHueInput
          const { cellData } = self
          return cellHueOf(
            encoding,
            keptField,
            heldColorSlots(self, encoding),
            cellData && this.cellHueValuesRead
              ? Object.values(cellData.perRegionCellData).flatMap(
                  d => d.colorValues,
                )
              : [],
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The cell scale's domain values an alt cell was painted for in the
         * fetched cell data — the impact tiers or SV classes the legend lists.
         */
        get paintedDomain(): string[] {
          const { cellData } = self
          return cellData && self.cellHueValuesRead
            ? paintedColorKeys(
                Object.values(cellData.perRegionCellData),
                self.cellHue,
              )
            : []
        },
      }))
      .views(self => {
        // sorted, and kept while the set holds, so a reorder recounts nothing
        const carrierSamples = stableIdentityComputed(() =>
          [...new Set(self.sources.map(resolveSampleName))].sort(),
        )
        return {
          /**
           * #getter
           * Whether the records band colors by SV class: while the cells paint
           * the genotype colors, which name no record. A picked color follows
           * the cells.
           */
          get recordsColorBySvClass() {
            return self.colorEncoding === undefined && !self.recordsOnly
          },
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
           * Whether the records band is the SV band: while genotype rows are
           * drawn. With none it draws every record the filter admits, and
           * states no carriers.
           */
          get recordsSvOnly() {
            return !self.recordsOnly
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * Each SV record's carriers among `recordCarrierSamples`, once per
         * payload and row set.
         */
        get recordCarriers(): ReadonlyMap<string, RecordCarriers> {
          const { cellData } = self
          return cellData && self.showRecords && self.recordsSvOnly
            ? countRecordCarriers(cellData, self.recordCarrierSamples)
            : new Map<string, RecordCarriers>()
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Each fetched region's record colors: the SV class, the alt
         * cells' hue at full dose, which neither shading nor the phased mode
         * moves, or with no rows and no `encoding.color` the feature track's
         * own default, `featureDefaultColor`.
         */
        get regionRecordColors() {
          const { cellData, cellHue, cellHueValuesRead } = self
          const featureDefault = getCachedABGR(featureDefaultColor)
          const out = new Map<number, Uint32Array>()
          if (cellData) {
            for (const k in cellData.perRegionCellData) {
              const data = cellData.perRegionCellData[k]!
              out.set(
                Number(k),
                self.recordsColorBySvClass
                  ? svClassColors(data.featureInfo)
                  : self.recordsOnly && self.colorEncoding === undefined
                    ? new Uint32Array(data.featureInfo.length).fill(
                        featureDefault,
                      )
                    : paintFeatureColors(data, cellHue, cellHueValuesRead),
              )
            }
          }
          return out
        },
        /**
         * #getter
         * The band's display mode: `compact` over rows, tight with its one
         * label line; with no rows `normal`, a feature track's default.
         */
        get recordsDisplayMode() {
          return self.recordsOnly ? ('normal' as const) : ('compact' as const)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The size the band letters at, plugin-features's for its display
         * mode, so the width its packer reserved is the width the text draws.
         */
        get recordsFontSize() {
          return labelFontSize(self.recordsDisplayMode)
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
          }
        },
      }))
      .views(self => ({
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
            ? Object.entries(cellData.perRegionCellData).flatMap(
                ([k, data]) => {
                  const region = displayedRegions[Number(k)]
                  return region ? [recordSpans({ data, region, svOnly })] : []
                },
              )
            : []
        },
      }))
      .views(self => {
        const onScreenIdsMemo = createMembershipMemo()
        return {
          /**
           * #getter
           * The records the band draws whose span touches the screen, as
           * LinearBasicDisplay's `onScreenFeatureIds`: what its labels gate
           * on, so records buffered off screen cost no label.
           */
          get recordsOnScreenIds(): ReadonlySet<string> {
            return onScreenIdsMemo(
              featureIdsTouchingBlocks(
                self.recordsSpans,
                self.view.settledDynamicBlocks,
              ),
            )
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
        }
      })
      .views(self => ({
        /**
         * #getter
         * Records on screen per pixel of the blocks on screen, as
         * LinearBasicDisplay's `labelDensityPerPx`.
         */
        get recordsLabelDensityPerPx() {
          const widthPx = self.view.settledDynamicBlocks.reduce(
            (sum, block) => sum + block.widthPx,
            0,
          )
          return widthPx > 0 ? self.recordsOnScreenIds.size / widthPx : 0
        },
      }))
      .views(self => {
        const visibleLabels = stableIdentityComputed(() => {
          const { name, description } = self.recordsLabels
          const { showLabels, showDescriptions } = labelVisibility({
            name: name !== '',
            description: description !== '',
            collapsed: false,
            density: self.recordsLabelDensityPerPx,
            geneDensity: () => undefined,
          })
          return {
            name: showLabels ? name : '',
            description: showDescriptions ? description : '',
          }
        })
        return {
          /**
           * #getter
           * `recordsLabels` past LinearBasicDisplay's label density rule
           * (`labelVisibility`): names go past 0.2 records per pixel on
           * screen and descriptions past 0.1, as on a feature track.
           */
          get recordsVisibleLabels(): RecordsLabels {
            return visibleLabels.get()
          },
        }
      })
      .views(self => ({
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
            const visible = self.recordsVisibleLabels
            const config = recordsDisplayConfig(
              RECORDS_FEATURE_HEIGHT,
              self.recordsOnly ? visible : RECORD_LABEL_LINE,
            )
            const labels = self.recordsOnly ? NO_RECORD_LABELS : visible
            const { jexl } = getEnv(self).pluginManager
            const { displayedRegions } = self.view
            const featureColors = self.regionRecordColors
            const carriers = self.recordCarriers
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
      }))
      .views(self => {
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
            return (
              self.recordsOnly && self.recordsVisibleLabels.description !== ''
            )
          },
          facet: undefined,
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
            recordsGrowMaxHeight: self.recordsGrowMaxHeight,
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
           * stack, up to `records.growMaxHeight`.
           */
          get topBands() {
            return bands.get()
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
           * `HeightModeMixin`'s hook: with no rows, the records' `full`
           * stack on screen, as LinearBasicDisplay grows to its features;
           * over rows the slot height, so `grow` keeps the rows' height.
           */
          get growTargetHeight() {
            return self.recordsOnly &&
              self.cellData !== undefined &&
              self.canRender
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
        }
      })
      .views(self => ({
        /**
         * #getter
         * What the band's painter, labels and hit test all read: the kept
         * stack, scaled only when the fit squeezed it.
         */
        get recordsLaidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
          const { layout, scale } = self.recordsFitStage
          return scale === 1 ? layout : scaleLaidOutData(layout, scale)
        },
        /**
         * #getter
         * Which label kinds the band paints: what the kept rung reserved, so a
         * box never claims width for a description the band had no room for.
         */
        get recordsRenderedLabels() {
          const { showLabels, showDescriptions } = self.recordsFitStage
          return { showLabels, showDescriptions }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-region hit index over the band's laid-out records, off the
         * painted stack and the RENDERED label flags, a label's overhang being
         * part of its hit box. Held alive by the `RecordsHitIndexes` autorun
         * across pointer frames.
         */
        get recordsFlatbushIndexes() {
          const { showLabels, showDescriptions } = self.recordsRenderedLabels
          const { reversedRegions } = self.recordsLayoutInputs
          const bpPerPx = self.view.coarseBpPerPx
          const out = new Map<number, FlatbushRegionIndexes>()
          for (const [idx, data] of self.recordsLaidOutDataMap) {
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
      }))
      .views(self => {
        // the last placement handed out, so a change that moves no row (a
        // relabel, a tint) returns the same array and re-places nothing
        let lastRowRemap: Uint32Array | undefined
        return {
          /**
           * #getter
           * Row name -> source, for the hover tooltip. A Map because row names
           * come from the file, and on a plain object a sample called
           * `constructor` resolves to something inherited rather than to a miss.
           */
          get sourceMap() {
            return new Map(self.sources.map(source => [source.name, source]))
          },
          /**
           * #getter
           * sampleName -> column of each feature's interned `genotypeCodes`,
           * for the tooltips (genotypeCodec.ts). Rebuilt per pointer frame, its
           * readers being untracked pointer handlers. A keep-alive autorun was
           * tried and throws on test stubs that resolve the cell-data RPC to a
           * bare `[]`.
           */
          get genotypeSampleIndex() {
            return self.cellData
              ? buildSampleIndex(self.cellData.sampleNames)
              : undefined
          },
          /**
           * #getter
           * Worker row -> screen row. The cells arrive numbered against the
           * worker's `rowNames`, so rebuilding this is all a reorder costs, and
           * a change that moves no row hands back the previous array. A worker
           * row the display isn't drawing maps to `HIDDEN_ROW`, which every
           * painter's Y-cull puts below the canvas. Undefined until data lands:
           * never fall back to identity: the worker's order is not the screen order.
           */
          get rowRemap(): Uint32Array | undefined {
            const rowNames = self.cellData?.rowNames
            if (!rowNames) {
              return undefined
            }
            const sources = self.sources
            const screenRowByName = new Map<string, number>()
            for (let i = 0; i < sources.length; i++) {
              screenRowByName.set(sources[i]!.name, i)
            }
            const out = new Uint32Array(rowNames.length)
            for (let i = 0; i < rowNames.length; i++) {
              out[i] = screenRowByName.get(rowNames[i]!) ?? HIDDEN_ROW
            }
            const last = lastRowRemap
            if (
              last?.length === out.length &&
              out.every((row, i) => row === last[i])
            ) {
              return last
            }
            lastRowRemap = out
            return out
          },
          /**
           * #getter
           * `TreeSidebarMixin`'s hook: the records band and the connector-line
           * zone, which `rowsTopOffset` stacks the focus chip's line under.
           */
          get rowsHeaderHeight() {
            return self.topBands.bottom
          },
          /**
           * #getter
           * `LegendMixin`'s hook: the key sits under the records band, over
           * the rows, so it hides no record; with no rows, at the top, as on
           * a feature track.
           */
          get legendTop() {
            return self.recordsOnly ? 0 : self.topBands.recordsHeight
          },
          /**
           * #getter
           * Height left for the rows under the bands above them, floored at 0:
           * every consumer treats it as a pixel dimension.
           */
          get availableHeight() {
            return Math.max(0, self.height - self.rowsTopOffset)
          },
          /**
           * #getter
           */
          get nrow() {
            return Math.max(1, self.sources.length)
          },

          /**
           * #getter
           * What fit-to-display-height divides between the rows.
           */
          get autoRowHeight() {
            return this.availableHeight / this.nrow
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
        }
      })
      .views(self => ({
        /**
         * #getter
         * Screen row -> worker row, `-1` for a screen row the data has no cells
         * for. The cell arrays stay in the worker's numbering, which
         * `findCellIndex` binary-searches, so the hit test converts its row.
         */
        get rowUnmap(): Int32Array | undefined {
          const remap = self.rowRemap
          if (!remap) {
            return undefined
          }
          const out = new Int32Array(self.sources.length).fill(-1)
          for (let workerRow = 0; workerRow < remap.length; workerRow++) {
            const screenRow = remap[workerRow]!
            if (screenRow < out.length) {
              out[screenRow] = workerRow
            }
          }
          return out
        },
        /**
         * #getter
         * The hovered thing as the tooltip table reads it: the record's fields
         * over the hovered row's sample metadata. Undefined with `tooltip.show`
         * off.
         */
        get hoveredTooltipSource() {
          const { hoveredFeature, sourceMap } = self
          if (!hoveredFeature || !self.showTooltips) {
            return undefined
          }
          const source = sourceMap.get(hoveredFeature.name)
          return source ? { ...source, ...hoveredFeature } : hoveredFeature
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Order the rows by their genotype at one variant, then at the other
         * records spanning its reference interval (a site split one record
         * per ALT), then by how far each row agrees with its neighbours to
         * either side. Sorts `editableSources`, so the order written names
         * every row.
         */
        sortByGenotype(featureId: string) {
          const { cellData } = self
          const sources = self.editableSources
          // fewer than two rows has nothing to order, and `setRowOrder` would
          // drop the cluster tree
          let sorted: ProcessedSource[] | undefined
          if (cellData && sources.length > 1) {
            const { sites, genotypeCodesByFeatureId } =
              getOrderedGenotypeCodes(cellData)
            sorted = sortSourcesAroundVariant({
              sources,
              sampleNames: cellData.sampleNames,
              genotypeDict: cellData.genotypeDict,
              sites,
              genotypeCodesByFeatureId,
              anchorFeatureId: featureId,
              phased: self.unit === 'haplotype',
            })
            if (sorted) {
              self.setRowOrder(sorted)
            }
          }
          return sorted !== undefined
        },
      }))
      .actions(self => ({
        /**
         * #action
         * `sortByGenotype` at a genomic column, the declarative `sortRowsBy`
         * entry point. Anchors on the record a click there picks
         * (`pickVariantCell`): the shortest covering the column, the later of
         * two as short. Returns whether it sorted, so `sortRowsBy` stays set
         * for the fetch that brings a record to the column. `refName` arrives
         * canonical; a record's is whatever the file spelled.
         */
        sortRowsByGenotypeAt(refName: string, pos: number) {
          const features = self.cellData?.simplifiedFeatures
          if (
            !features ||
            loadedRegionIndexAt(self.loadedRegions, refName, pos) === undefined
          ) {
            return false
          }
          let hit: { id: string; length: number } | undefined
          for (const { id, data } of features) {
            const { start, end } = data
            if (
              typeof start === 'number' &&
              typeof end === 'number' &&
              start <= pos &&
              pos < end &&
              end - start <= (hit?.length ?? Infinity) &&
              canonicalizeViewRefName(self, String(data.refName)) === refName
            ) {
              hit = { id, length: end - start }
            }
          }
          return hit ? self.sortByGenotype(hit.id) : false
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The width the columns are laid out in: the rounded **content**
         * width, so they still fill the drawn matrix when the genome doesn't
         * reach across the viewport. Not `canvasWidthPx`, the viewport box a
         * span maps bp into — the LD display's triangle takes the same width
         * for the same reason.
         */
        get matrixWidth() {
          return self.view.totalWidthPxWithoutBorders
        },
        // Resolved geometry, never undefined. "The view isn't measured yet" is
        // the mixin-wide `canRender` gate, and "no payload" falls out of an
        // empty cell map — neither is a nullable state.
        get renderState() {
          return {
            canvasWidth: self.atGenomicPositions
              ? self.canvasWidthPx
              : this.matrixWidth,
            canvasHeight: self.availableHeight,
            rowHeight: self.effectiveRowHeight,
            scrollTop: self.scrollTop,
          }
        },
      }))
      .actions(self => {
        const superApplyPlot = self.applyPlot
        const superApplyDisplaySettings = self.applyDisplaySettings
        // The unit decides what a row is called, so everything naming rows
        // goes stale together, whichever write moved it: the menu, Edit plot,
        // a share link or an agent. Not a reaction, which an undo's
        // applySnapshot would fire mid-restore. `restate` writes again what
        // the write said of the rows, which names them at the new unit.
        function resettingRowsOnUnitChange<T>(
          write: () => T,
          restate?: () => void,
        ) {
          const before = self.unit
          const result = write()
          if (self.unit !== before) {
            self.resetRowArrangement()
            restate?.()
          }
          return result
        }
        return {
          /**
           * #action
           */
          setUnit(unit: VariantUnit) {
            resettingRowsOnUnitChange(() => {
              setConf(self, 'unit', unit)
            })
          },
          /**
           * #action
           * `BaseDisplay`'s, resetting the row arrangement when it moves
           * `unit`.
           */
          applyPlot(...args: Parameters<typeof superApplyPlot>) {
            resettingRowsOnUnitChange(() => {
              superApplyPlot(...args)
            })
          },
          /**
           * #action
           * `BaseDisplay`'s, resetting the row arrangement when it moves
           * `unit`, and then writing the `rows` and `rowColor` the settings
           * state, which name the rows at the new unit.
           */
          applyDisplaySettings(
            settings: Record<string, unknown>,
            options?: { allowSetters?: boolean },
          ) {
            const { rows, rowColor } = settings
            return resettingRowsOnUnitChange(
              () => superApplyDisplaySettings(settings, options),
              () => {
                superApplyDisplaySettings({
                  ...(rows === undefined ? {} : { rows }),
                  ...(rowColor === undefined ? {} : { rowColor }),
                })
              },
            )
          },
        }
      })
      .views(self => {
        const { trackMenuItems: superTrackMenuItems } = self
        return {
          /**
           * #method
           */
          trackMenuItems(): MenuItem[] {
            return [
              ...superTrackMenuItems(),
              ...variantTrackMenuItems(
                self as LinearMultiSampleVariantDisplayModel,
              ),
              ...editPlotMenuItems(self),
            ]
          },
          /**
           * #method
           * Items for the right-click menu, built from the record in
           * `contextMenuInfo`.
           */
          contextMenuItems(): MenuItem[] {
            return variantContextMenuItems(
              self as LinearMultiSampleVariantDisplayModel,
            )
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The rows; with no rows the records' drawn stack on screen, as a
         * feature track scrolls what `fixed` or a capped `grow` cannot show.
         */
        get scrollContentHeight() {
          return self.recordsOnly
            ? maxBottom(self.recordsLaidOutDataMap, self.recordsOnScreenIds)
            : self.rowsContentHeight
        },
        /**
         * #getter
         */
        get scrollViewportHeight() {
          return self.recordsOnly
            ? self.topBands.recordsHeight
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
      }))
      .views(self => ({
        /**
         * #getter
         * Opt into RegionTooLargeMixin's byte gate.
         */
        get gateEnabled() {
          return true
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
            self.recordsOnly &&
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

        /**
         * #getter
         * Both layouts fill the track with rows, so an overlapping track label
         * would sit on top of a sample's genotypes.
         */
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * `fetchNeeded` declines until `sourcesBase` lands, so the retry
         * contract is judged on the run that follows
         * (`FetchMixin.awaitingPrerequisite`).
         */
        get awaitingPrerequisite(): boolean {
          return !self.sourcesBase
        },
      }))
      .actions(self => ({
        clearDisplaySpecificData() {
          self.setCellData(undefined)
        },

        // the payload is one matrix over every visible region, so nothing stale
        // is left to draw under
        clearSettingsBakedData() {
          self.clearDisplaySpecificData()
        },

        // Ignores `needed`: one RPC returns every visible region, so the set
        // derived here is both what it is sent and what the commit names.
        async fetchNeeded(_needed: IndexedRegion[]) {
          if (!self.sourcesBase) {
            return
          }
          const view = self.host
          const { variantLayout } = self
          const regions = fetchRegionsForLayout(
            view,
            onTrackAssembly(self),
            variantLayout,
          )
          if (regions.length === 0) {
            return
          }
          // resolved before the await, so the RPC sends what is marked loaded
          const args = rpcArgs(self)
          const fetchedAt =
            variantLayout === 'columns' ? view.bpPerPx : undefined
          const { bpPerPx } = view
          const { maxFeatureDensity } = self
          await fetchRegionsBatched(self, regions, {
            call: (batch, ctx) =>
              ctx.callRpc('MultiSampleVariantGetCellData', {
                ...args,
                regions: batch.map(r => r.region),
                displayedRegionIndices: batch.map(r => r.displayedRegionIndex),
                bpPerPx,
                maxFeatureDensity,
              }),
            onComplete: (issued, result) => {
              self.commitGateMeasurements(
                recordCountMeasurements(regions, result),
                issued,
              )
            },
            commit: result => {
              self.setCellData(
                result,
                regions.map(r => r.displayedRegionIndex),
                fetchedAt,
              )
            },
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * How the held payload's alt cells paint (`paintCellColors`).
         */
        get cellPaintOptions() {
          return {
            phased: self.unit === 'haplotype',
            shade: self.shadeByDosage,
            valuesRead: self.cellHueValuesRead,
          }
        },
        /**
         * #getter
         * Each fetched region's records' alpha factors where they share
         * pixels at genomic positions (`recordDensityAlpha`), so a zoomed-out
         * row shades by the share of its records that are alt instead of
         * filling wherever any is
         */
        get regionRecordAlpha() {
          const { cellData } = self
          const out = new Map<number, Float32Array | undefined>()
          if (cellData && self.variantLayout === 'genomic') {
            const bpPerPx = densityRung(self.host.bpPerPx)
            for (const k in cellData.perRegionCellData) {
              const data = cellData.perRegionCellData[k]!
              out.set(
                Number(k),
                recordDensityAlpha(data.featurePositions, bpPerPx),
              )
            }
          }
          return out
        },
        /**
         * #getter
         * Each fetched region's cell colors through the current
         * `encoding.color`, faded where records share pixels. Apart from the
         * rows, so a reorder repaints nothing, and a recolor re-places nothing
         * and refetches nothing.
         */
        get regionCellColors() {
          const { cellData, cellHue } = self
          const options = this.cellPaintOptions
          const alpha = this.regionRecordAlpha
          const out = new Map<number, Uint32Array>()
          if (cellData) {
            for (const k in cellData.perRegionCellData) {
              const data = cellData.perRegionCellData[k]!
              out.set(
                Number(k),
                fadeCellColors(
                  paintCellColors(data, cellHue, options),
                  data.cellFeatureIndices,
                  data.numCells,
                  alpha.get(Number(k)),
                ),
              )
            }
          }
          return out
        },
        /**
         * #getter
         * Each fetched region with its rows placed on screen. A computed apart
         * from the colors, so a recolor leaves it standing.
         */
        get placedRegionRows() {
          const { cellData, rowRemap } = self
          const out = new Map<number, Placed<VariantCellData>>()
          // never identity placement: the worker's row order is its own
          if (cellData && rowRemap) {
            for (const k in cellData.perRegionCellData) {
              out.set(
                Number(k),
                placeVariantRows(cellData.perRegionCellData[k]!, rowRemap),
              )
            }
          }
          return out
        },
        /**
         * #getter
         * Each fetched region's cells as the `cell` mark's attributes:
         * the record's span and glyph, which the payload holds once per
         * record, dealt to each of its cells. Off `cellData` alone, since
         * neither a reorder nor a recolor moves a cell's span.
         */
        get regionCellGlyphs() {
          const { cellData } = self
          const out = new Map<number, CellGlyphs>()
          if (cellData) {
            for (const k in cellData.perRegionCellData) {
              out.set(Number(k), cellGlyphs(cellData.perRegionCellData[k]!))
            }
          }
          return out
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Each fetched region placed (`placedRegionRows`) and painted
         * (`regionCellColors`), the cells both layouts draw. A reorder or a
         * recolor changes an entry's identity and `installUpload` re-uploads
         * with no RPC. A computed, because the overlay draws in an effect where
         * nothing is tracked.
         */
        get paintedRegionRows() {
          const { placedRegionRows, regionCellColors } = self
          const out = new Map<number, Placed<VariantCellData>>()
          for (const [k, placed] of placedRegionRows) {
            out.set(k, { ...placed, cellColors: regionCellColors.get(k)! })
          }
          return out
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The one walk of the payload every genomic-position consumer reads:
         * `paintedRegionRows` with the `cell` mark's attributes.
         */
        get perRegionCellMap() {
          const { paintedRegionRows, regionCellGlyphs } = self
          const out = new Map<number, Placed<VariantCellData> & CellGlyphs>()
          for (const [k, painted] of paintedRegionRows) {
            out.set(k, { ...painted, ...regionCellGlyphs.get(k)! })
          }
          return out
        },
        /**
         * #getter
         * Column pitch and origin in viewport pixels: `left` is where the
         * content starts when it doesn't reach the left viewport edge. The
         * connector lines, their hit test and the crosshair column all key off
         * this, so columns, lines and clicks stay pixel-aligned.
         */
        get columnGeometry() {
          const n = self.cellData?.simplifiedFeatures.length ?? 0
          return {
            n,
            columnWidth: n ? self.matrixWidth / n : 0,
            left: Math.max(0, -self.host.offsetPx),
          }
        },
        /**
         * #getter
         * The one block the column layout draws: the whole canvas, spanning
         * the column indices. One column wide when there are none, since the
         * GPU backend skips a block with no span and the canvas would never
         * count as painted.
         */
        get matrixBlocks(): VariantMatrixRenderBlock[] {
          return [
            {
              displayedRegionIndex: 0,
              start: 0,
              end: Math.max(this.columnGeometry.n, 1),
              screenStartPx: 0,
              screenEndPx: self.matrixWidth,
              reversed: false,
            },
          ]
        },
      }))
      .views(self => ({
        /**
         * #getter
         * One connector per column, **by column**, in viewport pixels: `mx`
         * the column centre, `gx` the variant's position on the ruler,
         * `label` what the hover tooltip shows. `undefined` where the variant's
         * refName has left the view. Indexed rather than filtered, so the
         * crosshair can ask of one column what the drawn field asks of all.
         * Column and data index are one number: the worker ships the variants
         * in screen order.
         */
        get connectorCoordsByColumn(): (ConnectorCoord | undefined)[] {
          const features = self.cellData?.simplifiedFeatures ?? []
          const locusX = locusViewportXFor(self)
          const { columnWidth, left } = self.columnGeometry
          return features.map(({ data }, i) => {
            const gx = locusX(String(data.refName), Number(data.start))
            return gx === undefined
              ? undefined
              : {
                  mx: left + (i + 0.5) * columnWidth,
                  gx,
                  label: data.name as string | undefined,
                }
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The connector lines that draw: those with a genomic x.
         */
        get connectorLineCoords(): ConnectorCoord[] {
          return self.connectorCoordsByColumn.filter(
            coord => coord !== undefined,
          )
        },
        /**
         * #method
         * The connector for the column under `screenX` (the crosshair), or
         * undefined off the ends and over a column with no genomic x.
         */
        connectorLineAtScreenX(screenX: number): ConnectorCoord | undefined {
          const { n, columnWidth, left } = self.columnGeometry
          const screenCol = Math.floor((screenX - left) / columnWidth)
          return screenCol >= 0 && screenCol < n
            ? self.connectorCoordsByColumn[screenCol]
            : undefined
        },
      }))
      // separate block so these see perRegionCellMap
      .views(self => ({
        /**
         * #getter
         * The box of the hovered genotype cell or record, for the chrome's
         * highlight: a record is the box plugin-features laid out and the band
         * painted, at the top.
         */
        get hoverInk(): HighlightRect[] {
          const record = self.hoveredRecord
          const region =
            record &&
            self.host.visibleRegions.find(
              r => r.displayedRegionIndex === record.displayedRegionIndex,
            )
          return record
            ? region
              ? [
                  {
                    ...spanRect(
                      makeBpMapper(region),
                      record.feature.startBp,
                      record.feature.endBp,
                      1,
                    ),
                    top: record.feature.topPx - self.recordsScrollTop,
                    height: record.feature.bottomPx - record.feature.topPx,
                  },
                ]
              : []
            : this.genotypeHoverInk
        },
        /**
         * #getter
         * The box of the hovered genotype cell: its instance through the cell
         * mark's ink, moved down by the bands above the rows.
         */
        get genotypeHoverInk(): HighlightRect[] {
          const { hoveredCell: cell, hoveredMatrixCell: matrixCell } = self
          if (matrixCell) {
            const { left } = self.columnGeometry
            const top = self.rowsTopOffset
            return inkOfInstances(
              VARIANT_MATRIX_MARKS,
              self.matrixBlocks,
              index => self.paintedRegionRows.get(index),
              self.renderState,
              () => [{ mark: 0, index: matrixCell.cellIndex }],
            ).map(r => shiftInk(r, left, top))
          }
          if (cell) {
            const region = self.renderBlocks.find(
              b => b.displayedRegionIndex === cell.displayedRegionIndex,
            )
            const [ink] = inkOfInstances(
              VARIANT_MARKS,
              self.renderBlocks,
              idx => self.perRegionCellMap.get(idx),
              self.renderState,
              idx =>
                idx === cell.displayedRegionIndex
                  ? [{ mark: 0, index: cell.cellIndex }]
                  : undefined,
            )
            if (!ink || !region) {
              return []
            }
            return [{ ...ink, top: ink.top + self.rowsTopOffset }]
          }
          return []
        },
        /**
         * #getter
         * A wash and a border: the cell colors are the data.
         */
        get highlightStyle(): HighlightStyle {
          return 'box'
        },
        /**
         * #getter
         * Per-region spatial index over feature intervals, for the hit-test. One
         * entry per variant, not per cell — see computeVariantCells.
         */
        get featureIndices() {
          const out = new Map<number, Flatbush>()
          for (const [regionIdx, region] of self.perRegionCellMap) {
            out.set(regionIdx, Flatbush.from(region.featureIndexData))
          }
          return out
        },
      }))
      .views(self => ({
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
      }))
      .views(self => ({
        /**
         * #getter
         * `LegendMixin`'s hook: the records band's SV classes, the cell
         * coloring and the row color key. With no rows and no
         * `encoding.color` the records paint one color and nothing is keyed,
         * as on a feature track.
         */
        get colorScales(): ColorScale[] {
          const recordsUncolored =
            self.recordsOnly && self.colorEncoding === undefined
          return [
            ...self.recordsColorScales,
            ...(recordsUncolored
              ? []
              : getVariantColorScales({
                  unit: self.unit,
                  hasSecondaryAlt: self.hasSecondaryAlt,
                  hasAltWithoutPhaseSet: self.hasAltWithoutPhaseSet,
                  hasUnphased: self.hasUnphased,
                  hasNoCall: self.hasNoCall,
                  paintedDomain: self.paintedDomain,
                  shadeByDosage: self.shadeByDosage,
                  color: self.colorEncoding,
                  colorSlots: heldColorSlots(self, self.colorEncoding),
                  ramp: self.cellHue.ramp,
                  colorTitle: withPreset(
                    self.colorSetting,
                    FEATURE_FIELD_PRESETS,
                  ).legend.title,
                })),
            ...self.rowColorScales,
          ]
        },
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          if (self.atGenomicPositions) {
            const { renderSvg } = await import('./renderSvg.tsx')
            return renderSvg(self, opts)
          }
          const { renderSvg } = await import('./matrix/renderMatrixSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The layout's chrome hands over its backend; a layout switch mounts
         * the other chrome, whose backend replaces this one. The upload
         * lifecycle is installed once, so its cells and its render follow the
         * backend attached rather than the setting: until the other chrome's
         * backend arrives, the old one is sent nothing it cannot draw.
         */
        startRenderingBackend(backend: VariantLayoutBackend) {
          self.setBackendDrawsColumns(backend.columns)
          installUpload<number, Placed<VariantCellData>, VariantLayoutBackend>(
            self,
            backend,
            {
              cells: () =>
                self.backendDrawsColumns
                  ? self.paintedRegionRows
                  : self.perRegionCellMap,
              // the width follows the backend, not the setting, which the
              // outgoing backend still sees for one flush after a switch
              render: b =>
                b.columns
                  ? b.renderBlocks(self.matrixBlocks, self.paintedRegionRows, {
                      ...self.renderState,
                      canvasWidth: self.matrixWidth,
                    })
                  : b.renderBlocks(self.renderBlocks, self.perRegionCellMap, {
                      ...self.renderState,
                      canvasWidth: self.canvasWidthPx,
                    }),
            },
          )
        },
      }))
      .actions(self => ({
        afterAttach() {
          runLazyAfterAttach(
            self,
            async () =>
              (await import('./setupMultiSampleVariantAutoruns.ts'))
                .setupMultiSampleVariantAutoruns,
          )
          // read only from untracked pointer handlers, so held alive here
          autorunOnReadyView(
            self,
            () => {
              void self.recordsFlatbushIndexes
            },
            { name: 'RecordsHitIndexes' },
          )
        },
      }))
  )
}

export type LinearMultiSampleVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiSampleVariantDisplayModel =
  Instance<LinearMultiSampleVariantDisplayStateModel>

export default stateModelFactory
