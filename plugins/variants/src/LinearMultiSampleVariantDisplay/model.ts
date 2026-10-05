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
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorEncodingOf,
  colorForField,
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

import { sortSourcesAroundVariant } from '../shared/anchoredHaplotypeSort.ts'
import { cellHueField, cellHueOf, sameHueRead } from '../shared/cellHue.ts'
import {
  HIDDEN_ROW,
  INTERNAL_SOURCE_KEYS,
  MULTI_SAMPLE_VARIANT_DISPLAY,
  VARIANT_FEATURE_WIDGET,
  clampLineZoneHeight,
} from '../shared/constants.ts'
import {
  densityRung,
  fadeCellColors,
  recordDensityAlpha,
} from '../shared/densityFade.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { buildSampleIndex } from '../shared/genotypeCodec.ts'
import {
  expandPhasedRows,
  parseRowName,
  resolveSampleName,
  rowAliasOf,
} from '../shared/getSources.ts'
import {
  variantContextMenuItems,
  variantTrackMenuItems,
} from '../shared/multiSampleVariantMenuItems.ts'
import {
  paintCellColors,
  paintFeatureColors,
  paintedColorKeys,
} from '../shared/paintCells.ts'
import { placeVariantRows } from '../shared/placeVariantRows.ts'
import { getVariantColorScales } from '../shared/variantLegend.ts'
import {
  VARIANT_LANE_BOUNDS,
  variantTopBandsGeometry,
} from '../shared/variantTopBands.ts'
import { cellGlyphs } from './components/cellGlyphs.ts'
import { drawnCellHeightPx } from './components/shaders/variant.js.generated.ts'
import { variantCellSpanPx } from './components/variantCellSpan.ts'
import {
  anyMarkerPossibleForBlock,
  variantInsertionChannels,
} from './components/variantInsertions.ts'
import { VARIANT_MARKS } from './components/variantMarks.ts'
import { laneDisplayConfig } from './laneDisplayConfig.ts'
import { buildLaneRenderData } from './laneRenderData.ts'
import { VARIANT_MATRIX_MARKS } from './matrix/variantMatrixMarks.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { VariantUnit } from '../shared/constants.ts'
import type { Placed } from '../shared/placeVariantRows.ts'
import type {
  ProcessedSource,
  Source,
  VariantContextMenuInfo,
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

// One spelling of "the config names an attribute the metadata doesn't have", for
// the two settings that take one. Called from the actions that set them and
// from `setSources`, which is where a config-declared attribute first meets the
// metadata; never from a computed, which must not console.warn per menu render.
// Silent on an empty source list: that is the pre-load state, not a bad config,
// and warning there printed an attribute list that was empty because there was
// nothing to list yet.
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

// Loaded features in genomic order plus their interned genotype codes: what an
// anchored sort needs. `simplifiedFeatures` is the single ordered list spanning
// every fetched region, while the codes live in each region's payload.
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

// Warn about both arrangement attributes at once, from the three actions that
// can newly pair one with a source list: the load, and each setter.
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

// Regions to fetch + render, by layout. At genomic positions each variant draws
// at its span, so off-screen buffered features simply clip — use the
// half-screen-buffered regions for smooth scrolling. Columns are laid out by
// feature index across the *visible* width, so including buffered features
// would cram off-screen variants into the viewport and draw connector lines to
// off-screen genomic positions — use the visible regions only.
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
          // carried, not dropped: matrix columns are laid out in the order the
          // worker returns features, and inside a reversed region screen x rises
          // as bp falls, so the worker cannot put the columns in screen order
          // without it (orderByScreenPosition).
          reversed: vr.reversed,
        },
        displayedRegionIndex: vr.displayedRegionIndex,
      }))
  }
  return view.bufferedVisibleRegions.filter(b => onTrack(b.region.assemblyName))
}

/**
 * The unscaled height a lane mark is packed at, before the fit ladder scales the
 * kept stack to fill the band.
 *
 * plugin-canvas's own `featureHeight` default, so a lane mark and the same record
 * in a `LinearVariantDisplay` start from one number — the band's compactness
 * comes from the display mode and the fit, not from a second height.
 */
const LANE_FEATURE_HEIGHT = 10

/**
 * The lane packs in `compact`, with bodies at 0.6x and label text shrunk to
 * match, so a 40px band holds two labeled rows where `normal` holds one.
 * `compact` also gives the fit ladder room to GROW a sparse window: the lane's
 * grow ceiling is `1 / 0.6`, so a handful of records fills the band at up to
 * normal size.
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
 * tree with its provenance and the focus, and `rowColor` the colours, each by
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
 * **The `rowColor` palette wins over a colour the row already carried**, a
 * `samplesTsv` `color` column: a channel bound to a variable beats a per-row
 * constant, so "Color by… → (none)" is what hands the row back its own colour.
 * `rowColor` holds one field's values, so a dialog colour set under the palette
 * turns every row's colour into a `name` pair.
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
        RowHeightMixin(),
        StoredHoverMixin<VariantHoverFields>(),
        TreeSidebarMixin<ProcessedSource>(),
        ContextMenuMixin<VariantContextMenuInfo>(),
        types.model({
          type: types.literal(MULTI_SAMPLE_VARIANT_DISPLAY),
          configuration: ConfigurationReference(configSchema),
          // `runClustering` / `clusterRegion` are TreeSidebarMixin's — they
          // trigger a run whose output is that mixin's `rows`.
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
         *
         * Single source of truth for fetched per-display data. samplePloidy
         * and the summary flags are derived from this via getters —
         * fetchNeeded only needs to call setCellData(result).
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
         * The genotype cell under the pointer, as `hoverInk` lights it.
         * Beside `hoveredFeature` (the tooltip) rather than folded into it:
         * the tooltip is the shared cross-display slot, and the box needs the
         * cell's instance that slot has no reason to carry.
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
      .views(self => ({
        get view() {
          return containingLgv(self)
        },
        /**
         * #method
         * Whether the held payload was fetched for this region. A batched
         * fetch marks only the regions it issued as loaded, but replaces the
         * whole payload — so a region an earlier batch loaded keeps its
         * `loadedRegions` entry with nothing behind it, and without this
         * check reads as cache-valid and draws blank. In matrix mode, also
         * whether it was fetched at the zoom on screen (`cellDataBpPerPx`).
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
          const hit = self.cellData?.simplifiedFeatures.find(
            f => f.id === featureId,
          )
          return hit && new SimpleFeature(hit)
        },
        /**
         * #getter
         * Whether any called genotype is phased or haploid, which gates the
         * "Phased" rendering mode. The painter's rule, `isPhasedOrHaploid` (no
         * `/`), rather than "any `|`": a pangenome callset is haploid per
         * assembly path and `vg deconstruct` writes bare `0`/`1`/`23`, a file
         * with no `|` anywhere that phased mode renders correctly.
         */
        get hasPhasedOrHaploid() {
          return self.cellData?.hasPhasedOrHaploid ?? false
        },
        /**
         * #getter
         * Whether the worker painted a secondary-alt cell (drives the "Other
         * alt allele" legend entry). Painted, not possible: a multiallelic site
         * nobody carries the second alt at raised this when the color was
         * nowhere in the fetched cell data.
         */
        get hasSecondaryAlt() {
          return self.cellData?.hasSecondaryAlt ?? false
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
         * Whether a hover draws the tooltip table. Only the tooltip: the
         * crosshairs, the hovered-cell highlight and `hoveredFeature` (the
         * cross-display hover channel) all keep working with it off, which is
         * the point — the reader who turns it off wants the rows uncovered, not
         * the pointer silenced.
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
         * What the alt cells' hue paints: undefined for the genotype colours,
         * a CSS colour or `jexl:` callback, or a field through its categorical
         * or threshold scale (`shared/cellHue.ts`).
         */
        get colorEncoding() {
          return colorEncodingOf(this.colorSetting)
        },
        /**
         * #getter
         * The field the alt cells paint by, '' while they paint the genotype
         * colours or a constant.
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
            // dataset's: an adapter edit swapped the cohort out from under it,
            // and the tree beside it names rows that are gone. The same reset
            // `setUnit` takes when it renames the rows. Keyed on total
            // mismatch — a partial overlap is the same cohort with samples
            // added or removed, and the reader's order survives that.
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
              // The unit decides what a row is *called*, a sample name or a
              // "HG001 HP0" haplotype name, so the order, the labels, the
              // tints, the tree and the focus naming its leaves all go stale
              // together.
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
           * Paint the alt cells by a field, or by the genotype colours with
           * `''`, which keeps the field under `scale: 'none'` for the way
           * back. A fetch input only where it names a different field.
           */
          setColorField(field: string) {
            setConf(self, 'color', colorForField(self.colorSetting, field))
          },
          /**
           * #action
           * Replace the whole `color` object, as the field dialog does when it
           * writes cut points with the field.
           */
          setColor(color: Record<string, unknown>) {
            setConf(self, 'color', color)
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
           * Switch the variant lane on or off. The rows resize with it, because
           * `availableHeight` subtracts the band, so the lane takes its space
           * from the plot and the track keeps its height.
           */
          setShowVariantLane(arg: boolean) {
            setConf(self, 'showVariantLane', arg)
          },
          /**
           * #action
           * Resize the variant lane, clamped. Clamped in the setter rather than
           * at read time for the same reason `setLineZoneHeight` is: a drag can
           * deliver any number, and a band dragged shut has to stay grabbable.
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
         * Returns the minor allele frequency filter config slot value
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
         * The jexl filter expressions (from the Edit filters dialog) as a
         * SerializableFilterChain, ready to pass as the RPC `filters` arg.
         * MultiSampleVariantGet{CellData,GenotypeMatrix,ClusterGenotypeMatrix}
         * all extend RpcMethodTypeWithFiltersAndRenameRegions, which serializes
         * this to string[] and rebuilds it in the worker with pluginManager.jexl.
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
         * and a row's colour shows only on its label bar.
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
         * own colour.
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
         * The adapter's samples narrowed to the focus, `rows.kept` — a
         * haplotype named there keeps its sample. The row set the fetch asks
         * for, and so it must not read `samplePloidy` (see `sampleFilter`).
         * `undefined` until the samples land: `sampleFilter` and `fetchNeeded`
         * both read it, and its `undefined` → list transition wakes the fetch
         * autorun (reference/FETCH_KEYS.md §"The global-fetch trigger list must
         * be read unconditionally"). `sources` is the resolved list.
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
         * and the arrangement dialog both need. Phased mode draws haplotypes,
         * which needs `samplePloidy`; that arrives with `cellData`, later than
         * the header-only `adapterSamples`. Before it a clustering run builds
         * a sample-level tree whose leaves ("HG001") never match the expanded
         * haplotype rows ("HG001 HP0"), and the dialog writes a sample order.
         */
        get clusteringReady() {
          return (
            !!self.adapterSamples &&
            (self.unit !== 'haplotype' || !!self.samplePloidy)
          )
        },
        /**
         * #getter
         * Whether there is anything to cluster: clustering reorders rows, so it
         * needs at least two rows to put in an order. An empty list is "none"
         * and "the sample list hasn't landed yet" alike — both mean "not now",
         * which is why one boolean answers for both and the menu's help text
         * asks `adapterSamples` itself which of the two it is.
         *
         * **The rows on screen**, which is the list the run clusters
         * (`clusterableSources`) and so the row set the tree comes back
         * describing. Counting the unfiltered list instead offered — and let
         * the declarative path fire — a run over a clade focused down to one
         * row.
         */
        get hasClusterableRows() {
          return self.clusterableSources.length > 1
        },
        /**
         * #getter
         * Whether the declarative `runClustering: true` path may fire: the
         * inputs have landed AND there are rows worth ordering. Both halves are
         * named booleans rather than one expression at the autorun, so each can
         * be read — and tested — on its own.
         *
         * The dialog gates on the same pair, spelled at its own call site: the
         * menu row that opens it carries `hasClusterableRows` too, but a
         * subtree filter applied while the dialog is open can take the rows
         * away underneath it.
         */
        get autoClusterReady() {
          return this.clusteringReady && this.hasClusterableRows
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Which samples the worker should emit rows for, as a **set** — sorted
         * and deduped, so only a membership change can move it. Row order is not
         * a fetch input here; reference/FETCH_KEYS.md §"Row order is not a fetch input",
         * has the why and how the three row displays each do it.
         *
         * `undefined` means the sources haven't loaded, and is deliberately not
         * reused for "all of them". `fetchNeeded` declines until `sourcesBase`
         * exists and this key changing is the only thing that wakes it, so
         * collapsing the two would leave it unchanged when sources landed and
         * wedge the display with nothing drawn.
         *
         * Reads `sourcesBase`, the focused samples before phased expansion,
         * never `sources`, for the loop reason below: expansion reads
         * `samplePloidy`, a fetch result. A focus naming haplotypes asks for their
         * samples, and the worker expands them itself.
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
        // Payload for MultiSampleVariantGetCellData. SettingsInvalidate watches
        // this — any change clears loaded data and triggers a refetch.
        //
        // Only settings the *worker* reads belong here, and nothing fetch-derived
        // may appear (`sampleFilter` reads `sourcesBase`, not `sources`, because
        // `sources` reads `samplePloidy` — a fetch result — and would loop).
        // `referenceDrawingMode` is one at genomic positions only, where the
        // worker drops reference cells under 'skip'; columns always draw them,
        // so a toggle there refetches nothing.
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
         * Whether the held payload's colour values were read for the current
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
           * sampleName -> column index into each feature's interned
           * `genotypeCodes`. Used by the tooltips to decode a hovered cell's
           * genotype (see genotypeCodec.ts).
           *
           * **Rebuilt per pointer frame, not per `cellData` change.** Its only
           * readers are the two layouts' hit tests, which run in React pointer
           * handlers where nothing is tracked — and MobX discards an unobserved
           * computed's value as it hands it over. So a hover walks every sample in
           * the callset, ~60×/s, on a cohort VCF.
           *
           * A keep-alive autorun is the fix the canvas displays use
           * (`CanvasHitIndexes`, and see packages/display-kit/CLAUDE.md), and it
           * does not work here yet: it evaluates this before any payload has
           * landed, and several suites stub the cell-data RPC with a catch-all
           * that resolves a bare `[]`, so `cellData` is truthy with no
           * `sampleNames` and the reaction throws. Making it holdable means giving
           * those stubs a real payload shape first; the getter itself is fine.
           */
          get genotypeSampleIndex() {
            return self.cellData
              ? buildSampleIndex(self.cellData.sampleNames)
              : undefined
          },
          /**
           * #getter
           * Worker row -> screen row, the client half of taking row order out of
           * the RPC (see `sampleFilter`). The cells arrive numbered against the
           * worker's `rowNames` list, and `rowRemap` maps each to the row the
           * user is looking at. Rebuilding it is all a reorder costs, and a
           * change that moves no row hands back the previous array, so the
           * placed cells and their upload stay as they are.
           *
           * A worker row the display isn't drawing maps to `HIDDEN_ROW` rather than
           * being dropped: at that index every painter's own Y-cull puts the cell
           * far below the canvas, so the sentinel needs no special case on either
           * backend, in the glyph overlay, or in the SVG export. (It stays rare —
           * the *set* is still a fetch input, so normally every row shipped is a
           * row drawn.)
           *
           * Undefined until data lands. Consumers that draw cells must treat that
           * as "nothing to draw yet" rather than falling back to identity: the
           * worker's order is arbitrary, so identity would paint rows under the
           * wrong sample names.
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
           * Available height for rows (total height minus whatever the bands
           * above them take). Floored at 0: `lineZoneHeight` (matrix only,
           * user-draggable up to 1000 independently of `height`) can exceed a
           * shrunk display height on its own, and the variant lane adds to it.
           * Every consumer treats this as a real pixel dimension (canvas
           * height, CSS `height`, scroll viewport height), so it must never go
           * negative.
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
           * What fit-to-display-height divides between the rows, and the reason
           * `RowHeightMixin`'s non-positive floor is reachable at all here:
           * `availableHeight` floors at 0, so a `lineZoneHeight` that swallows
           * the whole display makes this exactly 0.
           *
           * A **fixed** height goes the other way and is used as-is however many
           * samples there are — the rows area is a scroll viewport, so rows that
           * don't fit cost scroll extent rather than a resize.
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
         * Screen row -> worker row, the inverse of `rowRemap`; `-1` for a screen
         * row this window's data has no cells for (a sample the display draws
         * but whose genotypes never appear in the fetched variants).
         *
         * The hit test needs this direction, and needs it separately, because the
         * cell arrays stay in the worker's numbering: they are sorted by
         * `(featureIndex, rowIndex)` and `findCellIndex` binary-searches that
         * order, which remapping the array in place would destroy. Converting the
         * one row the cursor is over is O(1) and keeps the search O(log n).
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
         * The hovered thing as the tooltip table reads it: the record's fields,
         * with the hovered sample row's metadata attributes merged underneath
         * them so a cohort colored by a `samplesTsv` column reports that column
         * too.
         *
         * A hover naming no row falls through to the record's fields alone, and
         * the variant lane's tooltip is always that case: its marks are
         * records, so `buildVariantLaneHit` leaves `name` empty and there is no
         * source to find here. A *cell* hover always finds one, because both
         * hit tests take the name off `sources`, and `sourceMap` is built from
         * `sources`.
         *
         * `showTooltips` is gated here rather than in the component, so the one
         * getter feeding the tooltip is the one place that answers "is there a
         * tooltip" — the hit test, `hoveredFeature` and the hovered-cell
         * highlight go on reading `hoveredFeature` and are unaffected.
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
         * Order the rows by their genotype at one variant, breaking ties by how
         * far each row agrees with its neighbours to either side of it. With
         * the flanking tiebreak, rows sharing the anchor allele sit together,
         * and their shared block frays outward at the recombination
         * breakpoints that end it.
         *
         * Sorts `editableSources`, the rows at the mode's granularity with no
         * focus, so the order written to `rows.domain` names every row.
         */
        sortByGenotype(featureId: string) {
          const { cellData } = self
          const sources = self.editableSources
          // Fewer than two rows has nothing to order, and the write is not a
          // harmless no-op: `setRowOrder` drops the cluster tree whenever the row
          // set changes. The same decline the other "sort rows here" actions
          // make in `sortRowsAtColumn`.
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
         * `sortByGenotype` at a genomic column rather than a record: the
         * declarative `sortRowsBy` entry point, for a session that wants a
         * cohort to open sorted at a locus. The variant is the loaded record
         * covering the column; a column no record covers leaves the rows
         * alone, the rule every "sort rows here" shares (`rowSortColumn.ts`).
         *
         * **Returns whether it sorted**, so `sortRowsBy` stays set when it did
         * not. The shared gate only checks that a region covers the
         * column, and this display additionally needs a record there — a
         * session naming a variant-free column would otherwise clear its own
         * trigger and leave the rows unsorted with nothing left to re-fire it
         * once a record loads (`setupRowSortAutorun`).
         *
         * `refName` arrives canonical — the autorun normalizes it — while a
         * record's refName is whatever the file spelled, so the comparison
         * canonicalizes the record's side.
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
         * Opt into RegionTooLargeMixin's byte gate: `fetchNeeded` passes
         * `resolvedByteLimit()` to `MultiSampleVariantGetCellData`, whose first
         * await on the adapter is the index estimate — so an over-budget
         * viewport is refused before a single genotype is downloaded.
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
         * Retry here is two-stage: the sources autorun reads the same
         * `reloadCounter` bump `reload()` makes for the region fetch, and
         * `fetchNeeded` below declines until `sourcesBase` lands. So the retry
         * contract is judged on the run that follows, not on the declining one
         * — see `FetchMixin.awaitingPrerequisite`.
         *
         * Strictly narrower than the declines it explains, so it defers
         * judgement on this decline only: `FetchVisibleRegions` also declines
         * when every visible block is already covered, and that one is judged as
         * soon as `sourcesBase` is in hand. Not `fetchNeeded`'s own empty-region
         * return — the autorun only calls it with a non-empty `needed`, which
         * means the view has visible regions, so that branch is unreachable from
         * there.
         */
        get awaitingPrerequisite(): boolean {
          return !self.sourcesBase
        },
      }))
      .actions(self => ({
        clearDisplaySpecificData() {
          self.setCellData(undefined)
        },

        // The row set is a setting and the payload is one matrix over every
        // visible region, so there is no per-region replacement for stale cells
        // to draw under — see the hook.
        clearSettingsBakedData() {
          self.clearDisplaySpecificData()
        },

        // Ignores `needed` and refetches all visible regions because the
        // cellData RPC payload is monolithic — one call returns data covering
        // all visible regions, so partial refetches don't fit. That is why the
        // region list is `fetchRegionsBatched`'s argument: the set this display
        // derives is both what the RPC is sent and what the commits name.
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
          // Resolved before the await, so the RPC sends exactly what
          // `fetchNeeded` is about to mark loaded — no second view read across
          // the async boundary.
          const args = rpcArgs(self)
          const fetchedAt =
            variantLayout === 'columns' ? view.bpPerPx : undefined
          // One RPC serves every region, so the whole batch is held or none of
          // it is, and `fetchRegionsBatched` marks them loaded together.
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
         * Each fetched region's cell colours through the current `color`,
         * faded where records share pixels. Apart from the rows, so a reorder
         * repaints nothing, and a recolour re-places nothing and refetches
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
         * Each fetched region's lane colours, which neither shading nor the
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
         * from the colours, so a recolour leaves it standing.
         */
        get placedRegionRows() {
          const { cellData, rowRemap } = self
          const out = new Map<number, Placed<VariantCellData>>()
          // No rowRemap means no data has landed: an empty map is the same
          // "nothing to draw" every consumer already handles. Never fall back to
          // identity placement — the worker's row order is its own.
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
         * neither a reorder nor a recolour moves a cell's span.
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
         * (`regionCellColors`): the cells both layouts draw, which the
         * columns upload as they are. This is the display's "derived region
         * map" in the sense of ARCHITECTURE.md's re-upload-without-refetch
         * pattern: a reorder or a recolour changes each entry's identity,
         * `installUpload` sees the change and re-uploads, and no RPC is
         * involved.
         *
         * A computed returning a plain Map, for the same reason the multi-row
         * display's is: the overlay draws inside an effect, where nothing it
         * reads is tracked, so the read has to happen here for a refetch to
         * repaint.
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
         * `paintedRegionRows` with the `cell` mark's attributes dealt from
         * the records (`regionCellGlyphs`), and the insertion markers'
         * channels while `showInsertionGlyphs` is on. So "does the glyph
         * overlay see the same regions, and the same rows and colours, as
         * the canvas" has a single answer — the payload is the
         * `VariantUploadData` the cells and the markers upload, and carries
         * `featureIndexData` for the hit-test index plus
         * `cellWorkerRowIndices` for its lookup.
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
         * the column indices.
         */
        get matrixBlocks(): VariantMatrixRenderBlock[] {
          return [
            {
              displayedRegionIndex: 0,
              start: 0,
              end: this.columnGeometry.n,
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
         * A wash and a border: the cell colours are the data.
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
         * Whether this display is drawing insertion markers in the current
         * window, which is what puts the marker's explanation in the legend.
         *
         * The condition is `anyMarkerPossibleForBlock`, on the painter's own
         * blocks, because the two cheaper approximations are wrong on real
         * figures. "The window holds an insertion" puts the entry on a callset
         * of short indels, which can never draw a marker at any zoom. "The
         * window holds a *long* insertion" puts one on any view zoomed out far
         * enough that even a long bar falls under the 2px cell floor; that was
         * three of the fourteen committed figures carrying this display, each
         * gaining one entry and no glyph.
         *
         * The insertion mark's gate reads the unsnapped span, so the answer
         * holds still under a sub-pixel pan and a single-frame export needs no
         * settling.
         */
        get drawsInsertionMarkers(): boolean {
          if (!self.showInsertionGlyphs || !self.atGenomicPositions) {
            return false
          }
          // `effectiveRowHeight` read directly, never through `renderState`:
          // that object also carries `scrollTop`, so depending on it walked
          // every feature again per wheel-scroll frame. `canvasWidthPx` is not
          // read at all — it enters the painter's answer only through the snap
          // phase, which is exactly what this getter declines to depend on.
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
        /**
         * #method
         * The record behind a lane mark, by feature id. plugin-canvas's hit test
         * answers with an id (its payload carries no VCF fields), and the tooltip
         * and the click both want the record — so this is the one place that
         * crosses back, over `featureInfo`, the same records the genotype
         * cells' hit test reads.
         */
        laneFeatureInfo(featureId: string) {
          const { cellData } = self
          if (cellData) {
            for (const data of Object.values(cellData.perRegionCellData)) {
              const info = data.featureInfo.find(f => f.featureId === featureId)
              if (info) {
                return info
              }
            }
          }
          return undefined
        },
      }))
      // separate block so the lane chain reads its siblings off `self`
      .views(self => ({
        /**
         * #getter
         * The lane's marks as plugin-canvas render data, one entry per fetched
         * region — the payload that display's own RPC produces, built here from
         * records this display already parsed. Empty when the band is off, so
         * every getter below it does no work.
         *
         * See `buildLaneRenderData` for why this is main-thread and costs no
         * second fetch. A MobX computed, rebuilt when the payload or the label
         * mode or the lane colours change: keyed off the fetched
         * `perRegionCellData` and `regionFeatureColors`, not the row-placed
         * `perRegionCellMap`, since a record's mark does not move with the
         * rows, and off the **displayed regions'** bounds, never
         * `visibleRegions`, which the LGV rebuilds on every pan and zoom frame.
         * Either would re-run the whole chain below — SimpleFeature per
         * record, jexl color eval, packing, label solves — per reorder or per
         * frame.
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
         * What the lane's packer reads, minus the label reservation each fit rung
         * varies. One source, so the rungs cannot drift on zoom or orientation.
         *
         * `coarseBpPerPx`, the 500ms-debounced one, for the reason
         * `LinearBasicDisplay` uses it: row packing must not recompute on every
         * frame of a smooth zoom. Reversal off `displayedRegions` — stable
         * across pan frames — for the reason `laneRenderDataMap` gives.
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
            // The band is a fixed 40px holding a whole callset, so its records
            // are meant to share pixels rather than each claim a row: stacking
            // them honestly needs 68px, which costs the band every name through
            // the fit ladder. Names survive because this flattens the rows
            // without `displayMode: 'collapsed'`'s label suppression; the
            // packer drops a record's labels where they would overprint a
            // kept one.
            flattenRows: true,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * One fit candidate: the lane's row packed with the given label
         * reservation. plugin-canvas's packer, so a label is placed by the
         * layout that reserved room for it, and paint order is the order the
         * hit test resolves by.
         *
         * Non-incremental, unlike that display's four memos: those exist so a
         * GPU upload diff stays small across a pan over a stack of hundreds of
         * thousands of features. A band holds thousands and repaints whole.
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
         * The rung the lane keeps and the scale that fills the band with it —
         * plugin-canvas's fit ladder, run against `laneHeight` instead of a track
         * height. Names and descriptions if they fit; else descriptions dropped;
         * else names kept only where they have room; else bodies alone, squeezed
         * and scrolled-off if even that overflows.
         *
         * This is the whole of "compact": the band never grows, so what adapts is
         * how much of each record the band spends its pixels on — which is the
         * question `LinearVariantDisplay` in fit mode already answers.
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
            // The solve and the commit pack through one builder, so the stack
            // measured cannot differ from the stack kept — plugin-canvas's rule,
            // and the reason its own probe is a getter.
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
            // the same floor a track's squeeze bottoms out at, and the same one
            // every variant painter here already draws to (`variantCellSpanPx`)
            squeezeFloorScale(shortestBox, MIN_FIT_BOX_PX),
            // the display mode's compact ratio inverted: a sparse band fills up
            // to normal feature height and no further
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
         * The band's own drawn height — the kept rung's stack, scaled. Less than
         * `laneHeight` on a sparse window (the surplus is bottom whitespace, so a
         * relayout packs back against the top rather than jumping to a re-centred
         * offset) and equal to it whenever the fit had to work.
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
         * Per-region hit index over the lane's laid-out marks — plugin-canvas's,
         * built off the same stack it painted, so the box under the cursor is the
         * box the pick returns. Its label overhang is part of the hit box there,
         * which is why this reads the RENDERED label flags and not the mode's.
         *
         * Uses Canvas's `flatbushIndexes` dependencies: keyed off
         * `laneLaidOutDataMap` and the DEBOUNCED `coarseBpPerPx`, never
         * `visibleRegions` (per-frame fresh) or the live block width, so the
         * `LaneHitIndexes` autorun can hold it alive without per-frame rebuilds.
         * Without that subscription its only reader is the hit test, running
         * untracked in pointer handlers, so MobX would discard the value and
         * rebuild a Hilbert-sorted Flatbush with a text measurement per mark on
         * every pointer frame over the band.
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
         * one is drawn, and the row colour key. Whether the marker is keyed
         * is `drawsInsertionMarkers`' answer, the painter's own test on the
         * painter's own blocks.
         */
        get colorScales(): ColorScale[] {
          return [
            ...getVariantColorScales({
              unit: self.unit,
              hasSecondaryAlt: self.hasSecondaryAlt,
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
      }))
      // separate block so renderSvg's `self` sees perRegionCellMap/renderBlocks
      // and insertionGlyphRegions
      .views(self => ({
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
              (await import('../shared/setupMultiSampleVariantAutoruns.ts'))
                .setupMultiSampleVariantAutoruns,
          )
          // The hit test reads this only from untracked pointer handlers, so
          // without an observer MobX discards the computed per read — the
          // CanvasHitIndexes rule (packages/display-kit/CLAUDE.md), earned
          // here by the getter's debounced, non-per-frame dependency set.
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
