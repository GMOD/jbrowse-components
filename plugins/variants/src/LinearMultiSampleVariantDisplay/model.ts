import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  canonicalizeViewRefName,
  getNotificationSink,
  openFeatureWidget,
  SimpleFeature,
} from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import {
  CATEGORICAL_FIELD_PRESETS,
  colorNotices,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import Flatbush from '@jbrowse/core/util/flatbush'
import { carryGroupDomain } from '@jbrowse/core/util/groupKeys'
import { readFor } from '@jbrowse/core/util/installPrerequisiteFetch'
import {
  baseJexlFilters,
  configuredJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorEncodingOf,
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
import { getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  HEIGHT_MULTIPLIERS,
  MIN_FIT_BOX_PX,
  buildFeatureFlatbushIndex,
  computeLaidOutData,
  createContentHeightProbe,
  labelFontSize,
  minDrawnBoxHeight,
  resolveFitLadder,
  scaleLaidOutData,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from '@jbrowse/plugin-canvas'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import {
  makeBpMapper,
  pxPerBpOf,
  spanRect,
} from '@jbrowse/render-core/canvas2dUtils'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances, shiftInk } from '@jbrowse/render-core/marks'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  keptRows,
  loadedRegionIndexAt,
} from '@jbrowse/tree-sidebar'

import { cellHueField, cellHueOf, sameHueRead } from '../shared/cellHue.ts'
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
import { sortSourcesAroundVariant } from './anchoredHaplotypeSort.ts'
import { cellGlyphs } from './components/cellGlyphs.ts'
import { drawnCellHeightPx } from './components/shaders/variant.js.generated.ts'
import { variantCellSpanPx } from './components/variantCellSpan.ts'
import {
  anyMarkerPossibleForBlock,
  variantInsertionChannels,
} from './components/variantInsertions.ts'
import { VARIANT_MARKS } from './components/variantMarks.ts'
import {
  densityRung,
  fadeCellColors,
  recordDensityAlpha,
} from './densityFade.ts'
import { laneDisplayConfig } from './laneDisplayConfig.ts'
import { buildLaneRenderData } from './laneRenderData.ts'
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
import { getVariantColorScales } from './variantLegend.ts'
import {
  VARIANT_LANE_BOUNDS,
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
import type { InsertionChannels } from '@jbrowse/alignments-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
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
  FlatbushRegionIndexes,
  HitFeatureResult,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
  ShowLabelsMode,
} from '@jbrowse/plugin-canvas'
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

// What an anchored sort needs: the features in genomic order
// (`simplifiedFeatures`) and each one's interned codes, which live per region.
function getOrderedGenotypeCodes(cellData: CellDataResult) {
  const genotypeCodesByFeatureId = new Map<string, Uint32Array>()
  for (const regionData of Object.values(cellData.perRegionCellData)) {
    for (const info of regionData.featureInfo) {
      genotypeCodesByFeatureId.set(info.featureId, info.genotypeCodes)
    }
  }
  return {
    featureIds: cellData.simplifiedFeatures.map(f => f.id),
    genotypeCodesByFeatureId,
  }
}

function warnUnknownArrangementAttributes(
  self: { rowColorAttribute: string; facet: FacetSetting | undefined },
  sources: Source[],
) {
  const { rowColorAttribute } = self
  if (
    rowColorAttribute &&
    !sources.some(source => rowColorAttribute in source)
  ) {
    warnMissingAttribute('rowColor', rowColorAttribute, sources)
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
 * plugin-canvas's own `featureHeight` default, so a lane mark and the same
 * record in a `LinearVariantDisplay` start from one height.
 */
const LANE_FEATURE_HEIGHT = 10

/**
 * `compact` fits two labeled rows in a 40px band, and leaves the fit ladder
 * room to grow a sparse window up to normal size.
 */
const LANE_DISPLAY_MODE = 'compact' as const

/** No pins in a band: the feature there is the display's, not the lane's. */
const NO_PINNED_FEATURES: ReadonlySet<string> = new Set()

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
 * `unit`, `rowColor`, `rows` and `minorAlleleFrequencyFilter` are
 * config (see the display's config schema), read at runtime through `getConf`
 * and written as session edits to the track's config — they are NOT plain MST
 * properties. Set them in a track's `displays` array to change the default:
 * ```js
 * displays: [
 *   {
 *     type: 'LinearMultiSampleVariantDisplay',
 *     displayId: 'my-cohort',
 *     unit: 'haplotype',
 *     rowColor: 'population',
 *     rows: { domain: ['NA12878', 'NA12891'] },
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
 * 1. the adapter's samples (`adapterSamples`) are focused by `rows.kept`,
 *    which is the set the fetch asks for (`sourcesBase`, `sampleFilter`),
 * 2. phased mode expands each sample to its haplotypes (`expandedRows`), and
 *    `rows.domain` orders, `rows.labels` relabels and each row carries its
 *    resolved `rowColor` (`editableSources`, the dialog's list), each from
 *    `TreeSidebarMixin` over this display's hooks,
 * 3. the focus narrows those (`clusterableSources`, what a run clusters),
 * 4. `facet` stacks those in bands (`bandedSources`), each band's rows in their
 *    arranged order,
 * 5. the result is `sources`, each row's `rowColor` its label bar.
 *
 * **The `rowColor` palette wins over a color the row already carried**, a
 * `samplesTsv` `color` column: a channel bound to a variable beats a per-row
 * constant, so "Color by… → (none)" is what hands the row back its own color.
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
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        LegendMixin(),
        ColorWritesMixin(),
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
         * payload itself cannot say: a region with no variants gets no
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
         * shared tooltip slot has no reason to carry the cell's instance.
         */
        hoveredCell: undefined as HoveredCell | undefined,
        /**
         * #volatile
         * The lane mark under the pointer — plugin-canvas's own hit, so
         * `hoverInk` lands on the box the lane painted.
         */
        hoveredLaneMark: undefined as HitFeatureResult | undefined,
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
          setHoveredLaneMark(mark?: HitFeatureResult) {
            self.hoveredLaneMark = mark
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
            self.hoveredLaneMark = undefined
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
           * The payload's record behind a cell or a lane mark.
           */
          featureInfoById(featureId: string) {
            return self.cellData
              ? recordsOf(self.cellData).info.get(featureId)
              : undefined
          },
          /**
           * #method
           * The payload's positional record behind a cell or a lane mark.
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
         * The filters the `filter` config slot holds.
         */
        configuredFilters(): string[] {
          return configuredJexlFilters(self)
        },
        /**
         * #method
         * What the track's config declares for `filter`, which "Clear all
         * filters" returns to.
         */
        baseFilters(): string[] {
          return baseJexlFilters(self)
        },
        /**
         * #method
         * The record a click on the rows, the lane or the matrix resolved to,
         * positional fields only: its genotypes live in the cell payload.
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
         * Whether any visible variant carries a SnpEff/VEP annotation, gating
         * the "Color by...→Consequence impact" menu option.
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
         * gating the "Color by...→Phase set" menu option.
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
         * Whether an insertion draws as a marker sized by its inserted bp, or
         * at the 2px floor like a SNP. The marker overlay, the hover
         * highlight and the click target all read it through
         * `variantCellSpanPx`, so the three agree.
         */
        get showInsertionGlyphs(): boolean {
          return getConf(self, 'showInsertionGlyphs')
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
         * Whether the variant lane, a strip of the records themselves above the
         * genotype rows, is drawn: at genomic positions only, where it lines
         * up with the cells under it.
         */
        get showVariantLane(): boolean {
          return this.atGenomicPositions && getConf(self, 'showVariantLane')
        },
        /**
         * #getter
         * Configured height of the variant lane. Raw: what the band spends is
         * `topBands.laneHeight`.
         */
        get variantLaneHeight(): number {
          return getConf(self, 'variantLaneHeight')
        },
        /**
         * #getter
         * Which label kinds the variant lane asks for; what it draws is
         * `laneRenderedLabels`.
         */
        get variantLaneLabels(): ShowLabelsMode {
          return getConf(self, 'variantLaneLabels')
        },

        /**
         * #getter
         */
        get showRowSeparators(): boolean {
          return getConf(self, 'showRowSeparators')
        },
        /**
         * #getter
         * Whether a hover draws the tooltip table. The crosshairs, the
         * hovered-cell highlight and `hoveredFeature` keep working with it off.
         */
        get showTooltips(): boolean {
          return getConf(self, 'showTooltips')
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
            domain: getConf(self, ['facet', 'domain']),
          })
        },
        /**
         * #getter
         * The `color` object as written, `value` raw: a `jexl:` callback is the
         * worker's to evaluate per variant.
         */
        get colorSetting(): ColorSetting {
          const { color } = self.configuration
          return {
            value: color.value,
            field: color.field,
            scale: getConf(self, ['color', 'scale']),
            domain: getConf(self, ['color', 'domain']),
            range: getConf(self, ['color', 'range']),
            labels: getConf(self, ['color', 'labels']),
            title: getConf(self, ['color', 'title']),
          }
        },
        /**
         * #getter
         * What the `color` object's slots say together that it cannot paint as
         * written, and `rowBandingNotices`, for the corner notice.
         */
        get notices(): string[] {
          return [
            ...colorNotices(this.colorSetting, CATEGORICAL_FIELD_PRESETS),
            ...self.rowBandingNotices,
          ]
        },
        /**
         * #getter
         * What the alt cells' hue paints: undefined for the genotype colors,
         * a CSS color or `jexl:` callback, or a field through its categorical
         * or threshold scale (`shared/cellHue.ts`).
         */
        get colorEncoding() {
          return colorEncodingOf(this.colorSetting)
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
        return {
          /**
           * #action
           */
          setFilter(f?: string[]) {
            setConf(self, 'filter', f ?? self.baseFilters())
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
           */
          selectFeature(feature: Feature) {
            fetchMetadata()
              .then(descriptions => {
                if (isAlive(self)) {
                  openFeatureWidget(self, feature.toJSON(), {
                    widget: self.featureWidgetType,
                    extra: { descriptions },
                  })
                }
              })
              .catch((e: unknown) => {
                console.error(e)
                getNotificationSink(self).notifyError(`${e}`, e)
              })
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
            const domain = self.rowDomain
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
           * Recolor sample rows by a metadata attribute (e.g. 'population'), or
           * pass '' for None, through the mixin's `setRowColorChoice`. The
           * tint is resolved on every read of `sources`, so a recolor moves no
           * rows and drops no cluster tree.
           */
          setRowColorField(field: string) {
            self.setRowColorChoice(field)
            warnUnknownArrangementAttributes(self, self.adapterSamples ?? [])
          },
          /**
           * #action
           * Band the sample rows so each value of a metadata attribute (e.g.
           * 'population') is contiguous, or pass '' to clear the facet. Writes
           * the `facet` object, keeping a declared band order while the field
           * is the one already banding, which is the whole of it: the banding
           * is applied on every read of `bandedSources`, over the arranged
           * order.
           */
          setFacet(field: string) {
            setConf(
              self,
              'facet',
              carryGroupDomain<{ field: string; domain?: readonly string[] }>(
                field ? { field } : undefined,
                self.facet,
              ) ?? {},
            )
            warnUnknownArrangementAttributes(self, self.adapterSamples ?? [])
          },
          /**
           * #action
           */
          setMafFilter(arg: number) {
            setConf(self, 'minorAlleleFrequencyFilter', arg)
          },
          /**
           * #action
           */
          setMaxMissingnessFilter(arg: number) {
            setConf(self, 'maxMissingnessFilter', arg)
          },
          /**
           * #action
           */
          setUnit(unit: VariantUnit) {
            const renamesRows = self.unit !== unit
            setConf(self, 'unit', unit)
            if (renamesRows) {
              // the unit decides what a row is called, so everything naming
              // rows goes stale together
              self.resetRowArrangement()
            }
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
            setConf(self, 'showRowSeparators', arg)
          },
          /**
           * #action
           */
          setShowTooltips(arg: boolean) {
            setConf(self, 'showTooltips', arg)
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
           * Switch the variant lane on or off; it takes its space from the
           * rows.
           */
          setShowVariantLane(arg: boolean) {
            setConf(self, 'showVariantLane', arg)
          },
          /**
           * #action
           * Resize the variant lane, clamped here because a drag can deliver
           * any number and a band dragged shut has to stay grabbable.
           */
          setVariantLaneHeight(arg: number) {
            setConf(
              self,
              'variantLaneHeight',
              clampBandHeight(self.variantLaneHeight, arg, VARIANT_LANE_BOUNDS),
            )
          },
          /**
           * #action
           */
          setVariantLaneLabels(arg: ShowLabelsMode) {
            setConf(self, 'variantLaneLabels', arg)
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
           */
          setBackendDrawsColumns(arg: boolean) {
            self.backendDrawsColumns = arg
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         */
        get minorAlleleFrequencyFilter(): number {
          return getConf(self, 'minorAlleleFrequencyFilter')
        },

        /**
         * #getter
         * Max fraction of no-call genotypes a variant may have before it's
         * hidden; 1 keeps every variant
         */
        get maxMissingnessFilter(): number {
          return getConf(self, 'maxMissingnessFilter')
        },

        /**
         * #getter
         * The jexl filter expressions as the RPC's `filters` arg.
         */
        get filters() {
          const filters = self.configuredFilters()
          return filters.length
            ? new SerializableFilterChain({
                filters,
                jexl: getEnv<{ pluginManager: PluginManager }>(self)
                  .pluginManager.jexl,
              })
            : undefined
        },

        get referenceDrawingMode(): string {
          return getConf(self, 'referenceDrawingMode')
        },

        /**
         * #getter
         * Distinct sample-metadata attributes (from samplesTsv) the user can
         * color rows by — every key the sources carry except internal plumbing.
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
         * "Color by..." offers.
         */
        get rowColorFields(): readonly string[] {
          return this.colorByAttributes
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the adapter's samples as rows, each
         * answering to its sample name, a samplesTsv `color` column the row's
         * own color.
         */
        get discoveredRows(): ProcessedSource[] {
          return (self.adapterSamples ?? []).map(source => ({
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
                domain: self.rowDomain,
              })
            : rows
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The adapter's samples narrowed to the focus, `rows.kept`: the row set
         * the fetch asks for, so it must not read `samplePloidy`. `undefined`
         * until the samples land, a transition that wakes the fetch autorun
         * (reference/FETCH_KEYS.md).
         */
        get sourcesBase(): Source[] | undefined {
          const sources = self.adapterSamples
          return sources && keptRows(sources, self.rowFocus, self.rowAlias)
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
         * Whether the declarative `runClustering: true` path may fire.
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
        // compared by value, so editing the key's title or labels repaints
        // nothing
        const hueInput = stableIdentityComputed(() => ({
          encoding: paintedColorEncoding(self.colorEncoding),
          keptField: self.colorSetting.field,
        }))
        return {
          /**
           * #getter
           * Where the alt cells' hue comes from: what the worker reads and how
           * the main thread paints it (`cellHueOf`).
           */
          get cellHue() {
            const { encoding, keptField } = hueInput.get()
            return cellHueOf(
              encoding,
              keptField,
              heldColorSlots(self, encoding),
            )
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
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            maxMissingnessFilter: self.maxMissingnessFilter,
            filters: self.filters,
            unit: self.unit,
            color: self.cellHue.read,
            referenceDrawingMode: self.atGenomicPositions
              ? self.referenceDrawingMode
              : 'draw',
          }
        },
        /**
         * #getter
         * Whether the held payload's color values were read for the current
         * `color`; one read for another paints as though it read none.
         */
        get cellHueValuesRead() {
          return sameHueRead(self.cellData?.colorRead, self.cellHue.read)
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
           * never fall back to identity, the worker's order is its own.
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
           * The bands stacked above the rows — the variant lane and the
           * connector-line zone — resolved once. Both the layout below and the
           * painters read this, never their own sum: see `variantTopBands.ts`.
           */
          get topBands() {
            return variantTopBandsGeometry({
              showVariantLane: self.showVariantLane,
              variantLaneHeight: self.variantLaneHeight,
              variantLaneLabels: self.variantLaneLabels,
              lineZoneHeight: self.lineZoneHeight,
            })
          },
          /**
           * #getter
           * `TreeSidebarMixin`'s hook: the variant lane and the connector-line
           * zone, which `rowsTopOffset` stacks the focus chip's line under.
           */
          get rowsHeaderHeight() {
            return this.topBands.bottom
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
         * over the hovered row's sample metadata. A lane hover names no row and
         * is the record's fields alone. Undefined with `showTooltips` off.
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
         * Order the rows by their genotype at one variant, ties broken by how
         * far each row agrees with its neighbours to either side. Sorts
         * `editableSources`, so the order written names every row.
         */
        sortByGenotype(featureId: string) {
          const { cellData } = self
          const sources = self.editableSources
          // fewer than two rows has nothing to order, and `setRowOrder` would
          // drop the cluster tree
          let sorted: ProcessedSource[] | undefined
          if (cellData && sources.length > 1) {
            const { featureIds, genotypeCodesByFeatureId } =
              getOrderedGenotypeCodes(cellData)
            sorted = sortSourcesAroundVariant({
              sources,
              sampleNames: cellData.sampleNames,
              genotypeDict: cellData.genotypeDict,
              featureIds,
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
         * entry point. Returns whether it sorted, so `sortRowsBy` stays set for
         * the fetch that brings a record to the column. `refName` arrives
         * canonical; a record's is whatever the file spelled.
         */
        sortRowsByGenotypeAt(refName: string, pos: number) {
          const features = self.cellData?.simplifiedFeatures
          const hit =
            features &&
            loadedRegionIndexAt(self.loadedRegions, refName, pos) !== undefined
              ? features.find(({ data }) => {
                  const { start, end } = data
                  return (
                    typeof start === 'number' &&
                    typeof end === 'number' &&
                    start <= pos &&
                    pos < end &&
                    canonicalizeViewRefName(self, String(data.refName)) ===
                      refName
                  )
                })
              : undefined
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
           * Items for the right-click menu, built from the record
           * `contextMenuInfo` carries.
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
         */
        get scrollContentHeight() {
          return self.rowsContentHeight
        },
        /**
         * #getter
         */
        get scrollViewportHeight() {
          return self.availableHeight
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
          await fetchRegionsBatched(self, regions, {
            call: (batch, ctx) =>
              ctx.callRpc('MultiSampleVariantGetCellData', {
                ...args,
                regions: batch.map(r => r.region),
                displayedRegionIndices: batch.map(r => r.displayedRegionIndex),
              }),
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
         * Each fetched region's cell colors through the current `color`,
         * faded where records share pixels. Apart from the rows, so a reorder
         * repaints nothing, and a recolor re-places nothing and refetches
         * nothing.
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
         * Each fetched region's lane colors, which neither shading nor the
         * phased mode moves.
         */
        get regionFeatureColors() {
          const { cellData, cellHue, cellHueValuesRead } = self
          const out = new Map<number, Uint32Array>()
          if (cellData) {
            for (const k in cellData.perRegionCellData) {
              const data = cellData.perRegionCellData[k]!
              out.set(
                Number(k),
                paintFeatureColors(data, cellHue, cellHueValuesRead),
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
         * Each fetched region's cells as the `cell` mark's own attributes:
         * the record's span and glyph, which the payload carries once per
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
         * `paintedRegionRows` with the `cell` mark's attributes and, while
         * `showInsertionGlyphs` is on, the insertion markers' channels.
         */
        get perRegionCellMap() {
          const { paintedRegionRows, regionCellGlyphs, showInsertionGlyphs } =
            self
          const out = new Map<
            number,
            Placed<VariantCellData> &
              CellGlyphs & { insertions?: InsertionChannels }
          >()
          for (const [k, painted] of paintedRegionRows) {
            out.set(k, {
              ...painted,
              ...regionCellGlyphs.get(k)!,
              insertions: showInsertionGlyphs
                ? variantInsertionChannels(painted)
                : undefined,
            })
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
         * The box of the hovered genotype cell or lane mark, for the
         * chrome's highlight. A cell is its instance through the cell mark's
         * ink, moved down by the bands above the rows, and widened to the
         * insertion marker where one paints over it; a lane mark is the box
         * plugin-canvas laid out and painted, in the lane at the top.
         */
        get hoverInk(): HighlightRect[] {
          const {
            hoveredCell: cell,
            hoveredLaneMark: lane,
            hoveredMatrixCell: matrixCell,
          } = self
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
            const toX = makeBpMapper(region)
            const marker = variantCellSpanPx({
              x1: toX(cell.genomicStart),
              x2: toX(cell.genomicEnd),
              insertedBp: cell.insertedBp,
              insertionsWiden: self.showInsertionGlyphs,
              pxPerBp: pxPerBpOf(region),
              drawnRowHeight: ink.height,
            })
            return [
              {
                ...ink,
                ...(marker.drawsMarker
                  ? { left: marker.left, width: marker.width }
                  : {}),
                top: ink.top + self.rowsTopOffset,
              },
            ]
          }
          if (lane) {
            const region = self.host.visibleRegions.find(
              r => r.displayedRegionIndex === lane.displayedRegionIndex,
            )
            if (!region) {
              return []
            }
            const { feature } = lane
            const { left, width } = spanRect(
              makeBpMapper(region),
              feature.startBp,
              feature.endBp,
              1,
            )
            return [
              {
                left,
                top: feature.topPx,
                width,
                height: feature.bottomPx - feature.topPx,
              },
            ]
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
         * Per-region cell data for the insertion counts' overlay, or
         * undefined when no marker can draw in this window, which unmounts the
         * overlay rather than repainting it empty on every pan frame.
         */
        get insertionGlyphRegions() {
          return this.drawsInsertionMarkers ? self.perRegionCellMap : undefined
        },
        /**
         * #getter
         * Whether insertion markers draw in the current window, which keys the
         * marker in the legend. Asked of the painter's own blocks
         * (`anyMarkerPossibleForBlock`): "the window holds an insertion" keys a
         * callset of short indels that never draws one.
         */
        get drawsInsertionMarkers(): boolean {
          if (!self.showInsertionGlyphs || !self.atGenomicPositions) {
            return false
          }
          // `effectiveRowHeight` directly: `renderState` carries `scrollTop`,
          // and would walk every feature per wheel frame
          const drawnRowHeight = drawnCellHeightPx(self.effectiveRowHeight)
          for (const block of self.renderBlocks) {
            const region = self.perRegionCellMap.get(block.displayedRegionIndex)
            if (
              region?.numCells &&
              anyMarkerPossibleForBlock(region, block, drawnRowHeight)
            ) {
              return true
            }
          }
          return false
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
        /**
         * #getter
         * The plugin-canvas display config the lane's band is laid out with. See
         * `laneDisplayConfig` — a literal, because a band has no config schema.
         */
        get laneDisplayConfig() {
          return laneDisplayConfig({
            labels: self.variantLaneLabels,
            featureHeight: LANE_FEATURE_HEIGHT,
          })
        },
        /**
         * #getter
         * The label size the lane's marks are lettered at — plugin-canvas's, for
         * the lane's display mode, so the width its packer reserved is the width
         * the text draws at.
         */
        get laneFontSize() {
          return labelFontSize(LANE_DISPLAY_MODE)
        },
      }))
      // separate block so the lane chain reads its siblings off `self`
      .views(self => ({
        /**
         * #getter
         * The lane's marks as plugin-canvas render data, one entry per fetched
         * region, empty while the band is off. Keyed off the fetched payload
         * and the **displayed regions'** bounds, never the row-placed map or
         * `visibleRegions`, which would rebuild it per reorder or per frame.
         */
        get laneRenderDataMap(): ReadonlyMap<number, LayoutRegionData> {
          const out = new Map<number, LayoutRegionData>()
          // the payload is read only once the band is on, so an arrival
          // wakes nothing downstream while it is off
          const cellData =
            self.canRender && self.topBands.laneHeight > 0
              ? self.cellData
              : undefined
          if (cellData) {
            const config = self.laneDisplayConfig
            const { jexl } = getEnv<{ pluginManager: PluginManager }>(
              self,
            ).pluginManager
            const { displayedRegions } = self.view
            const featureColors = self.regionFeatureColors
            for (const k in cellData.perRegionCellData) {
              const displayedRegionIndex = Number(k)
              const data = cellData.perRegionCellData[k]!
              const region = displayedRegions[displayedRegionIndex]
              if (region && data.featureInfo.length) {
                out.set(
                  displayedRegionIndex,
                  buildLaneRenderData({
                    data: {
                      ...data,
                      featureColors: featureColors.get(displayedRegionIndex)!,
                    },
                    region: {
                      displayedRegionIndex,
                      assemblyName: region.assemblyName,
                      refName: region.refName,
                      start: region.start,
                      end: region.end,
                    },
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
         * What the lane's packer reads, minus the label reservation each fit
         * rung varies. `coarseBpPerPx`, so packing does not recompute per frame
         * of a zoom.
         */
        get laneLayoutInputs(): Omit<
          LayoutInputs,
          'showLabels' | 'showDescriptions'
        > {
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
            displayMode: LANE_DISPLAY_MODE,
            pinnedFeatureIds: NO_PINNED_FEATURES,
            // one row: the band's records share pixels, and the packer drops a
            // label that would overprint a kept one (VARIANTS_DISPLAY.md)
            flattenRows: true,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * One fit candidate: the lane's row packed with the given label
         * reservation. Non-incremental, a band holding thousands of marks.
         */
        laneLayoutAt(
          showLabels: boolean,
          showDescriptions: boolean,
        ): Map<number, FeatureDataResult> {
          return computeLaidOutData(self.laneRenderDataMap, {
            ...self.laneLayoutInputs,
            showLabels,
            showDescriptions,
          })
        },
        /**
         * #getter
         * Inputs for the `decimated` rung, whose whitespace factor is solved
         * against the band height. Descriptions are already gone by that rung.
         */
        get laneDecimatedInputs(): LabelRoomFactorFreeInputs {
          return {
            ...self.laneLayoutInputs,
            showLabels: self.topBands.wantsName,
            showDescriptions: false,
            labelDecimation: 'fitWidth',
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The rung the lane keeps and the scale that fills the band with it:
         * plugin-canvas's fit ladder, run against `laneHeight`.
         */
        get laneFitStage() {
          const bodies = () => self.laneLayoutAt(false, false)
          const full = self.laneLayoutAt(
            self.topBands.wantsName,
            self.topBands.wantsDescription,
          )
          const labelsOnly = () =>
            self.topBands.wantsDescription
              ? self.laneLayoutAt(self.topBands.wantsName, false)
              : full
          const decimated = () => {
            // the solve and the commit pack through one builder
            const factor = self.topBands.wantsName
              ? solveLabelRoomFactor(
                  createContentHeightProbe(
                    self.laneRenderDataMap,
                    self.laneDecimatedInputs,
                  ),
                  self.topBands.laneHeight,
                )
              : undefined
            return factor === undefined
              ? labelsOnly()
              : computeLaidOutData(self.laneRenderDataMap, {
                  ...self.laneDecimatedInputs,
                  labelRoomFactor: factor,
                })
          }
          const shortestBox = minDrawnBoxHeight(full)
          const names = {
            showLabels: self.topBands.wantsName,
            showDescriptions: false,
            dropBelowLabelRows: false,
          }
          return resolveFitLadder(
            [
              {
                level: 'full',
                reserved: {
                  ...names,
                  showDescriptions: self.topBands.wantsDescription,
                },
                layout: () => full,
              },
              { level: 'labels', reserved: names, layout: labelsOnly },
              { level: 'decimated', reserved: names, layout: decimated },
              {
                level: 'bodies',
                reserved: { ...names, showLabels: false },
                layout: bodies,
              },
            ],
            self.topBands.laneHeight,
            // the floor a track's squeeze bottoms out at
            squeezeFloorScale(shortestBox, MIN_FIT_BOX_PX),
            // a sparse band fills up to normal feature height
            1 / HEIGHT_MULTIPLIERS[LANE_DISPLAY_MODE],
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * What the lane's painter, its labels and its hit test all read: the
         * resolved stack, scaled only when the fit grew or squeezed it.
         */
        get laneLaidOutDataMap(): ReadonlyMap<number, FeatureDataResult> {
          const { layout, scale } = self.laneFitStage
          return scale === 1 ? layout : scaleLaidOutData(layout, scale)
        },
        /**
         * #getter
         * The band's drawn height: the kept rung's stack, scaled, at most
         * `laneHeight`.
         */
        get laneContentHeight() {
          const { contentHeight, scale } = self.laneFitStage
          return Math.min(self.topBands.laneHeight, contentHeight * scale)
        },
        /**
         * #getter
         * Which label kinds the lane actually paints: what the kept rung
         * reserved, so a box never reserves width for a description the band
         * had no room to draw.
         */
        get laneRenderedLabels() {
          const { showLabels, showDescriptions } = self.laneFitStage
          return { showLabels, showDescriptions }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-region hit index over the lane's laid-out marks, off the stack
         * that was painted and the RENDERED label flags, a label's overhang
         * being part of its hit box. Its dependencies are debounced, so the
         * `LaneHitIndexes` autorun holds it alive across pointer frames.
         */
        get laneFlatbushIndexes() {
          const { showLabels, showDescriptions } = self.laneRenderedLabels
          const { reversedRegions } = self.laneLayoutInputs
          const bpPerPx = self.view.coarseBpPerPx
          const out = new Map<number, FlatbushRegionIndexes>()
          for (const [displayedRegionIndex, data] of self.laneLaidOutDataMap) {
            out.set(displayedRegionIndex, {
              feature: buildFeatureFlatbushIndex(
                data.flatbushItems,
                data.floatingLabelsData,
                bpPerPx,
                reversedRegions.has(displayedRegionIndex),
                { showLabels, showDescriptions, fontSize: self.laneFontSize },
              ),
              // A VCF record has no subfeatures, so `layoutBox` emits none and
              // there is no second index to search.
              subfeature: null,
            })
          }
          return out
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `LegendMixin`'s hook: the cell coloring, the insertion marker where
         * one is drawn, and the row color key. Whether the marker is keyed
         * is `drawsInsertionMarkers`' answer, the painter's own test on the
         * painter's own blocks.
         */
        get colorScales(): ColorScale[] {
          return [
            ...getVariantColorScales({
              unit: self.unit,
              hasSecondaryAlt: self.hasSecondaryAlt,
              hasAltWithoutPhaseSet: self.hasAltWithoutPhaseSet,
              hasUnphased: self.hasUnphased,
              hasNoCall: self.hasNoCall,
              paintedDomain: self.paintedDomain,
              shadeByDosage: self.shadeByDosage,
              color: self.colorEncoding,
              colorSlots: heldColorSlots(self, self.colorEncoding),
              colorTitle: withPreset(
                self.colorSetting,
                CATEGORICAL_FIELD_PRESETS,
              ).title,
              insertionMarkers: self.drawsInsertionMarkers,
            }),
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
              void self.laneFlatbushIndexes
            },
            { name: 'LaneHitIndexes' },
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
