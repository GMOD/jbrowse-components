import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  canonicalizeViewRefName,
  getDialogHost,
  getEnv,
  getSession,
  SimpleFeature,
} from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import {
  lowerBoundOf,
  predicatesOf,
  upperBoundOf,
  withLowerBound,
  withUpperBound,
} from '@jbrowse/core/util/fieldPredicate'
import Flatbush from '@jbrowse/core/util/flatbush'
import { readFor } from '@jbrowse/core/util/installPrerequisiteFetch'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '@jbrowse/core/util/isoformRank'
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
import { paintedColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { fetchRegionsBatched } from '@jbrowse/display-kit/fetchEachRegion'
import {
  containingHost,
  onTrackAssembly,
} from '@jbrowse/display-kit/foundationView'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import {
  createFeatureDetailsOpener,
  FeatureGateMixin,
  FeatureHighlightModel,
  featureHighlightListActions,
  featureSpanRegion,
  fetchFeatureDetails,
} from '@jbrowse/plugin-features/band'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances, shiftInk } from '@jbrowse/render-core/marks'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  loadedRegionIndexAt,
  narrowRows,
} from '@jbrowse/tree-sidebar'

import { cellHueField, cellHueOf, sameHueRead } from '../shared/cellHue.ts'
import {
  HIDDEN_ROW,
  INTERNAL_SOURCE_KEYS,
  VARIANT_DISPLAY,
  VARIANT_FEATURE_WIDGET,
  clampConnectorsHeight,
  connectorsBandStack,
} from '../shared/constants.ts'
import { locusViewportXFor } from '../shared/genomicViewportX.ts'
import { buildSampleIndex } from '../shared/genotypeCodec.ts'
import {
  entryAliasOf,
  haplotypeNameCollisions,
  parseRowName,
  resolveSampleName,
} from '../shared/getSources.ts'
import { CellSolidColorDialog } from '../shared/lazyDialogs.ts'
import { isSiteField } from '../shared/minorAlleleFrequencyUtils.ts'
import {
  sitesBySpan,
  sortSourcesAroundVariant,
} from './anchoredHaplotypeSort.ts'
import { cellGlyphs } from './components/cellGlyphs.ts'
import { withClickedSample } from './components/enrichFeatureFromClick.ts'
import { tooltipPlainText } from './components/getTooltipRows.ts'
import { VARIANT_MARKS } from './components/variantMarks.ts'
import { DEFAULT_VARIANT_DISPLAY_HEIGHT } from './configSchema.ts'
import {
  densityRung,
  fadeCellColors,
  recordDensityAlpha,
} from './densityFade.ts'
import {
  NO_KEYED_VARIANTS,
  keyedVariantsFetched,
  keyedVariantsInWindows,
} from './keyedVariants.ts'
import { loadedRegionIndexOverlapping } from './loadedRegionIndexOverlapping.ts'
import { VARIANT_MATRIX_MARKS } from './matrix/variantMatrixMarks.ts'
import { colorKeysOf, paintCellColors } from './paintCells.ts'
import { mapPayloadRegions } from './payloadRegions.ts'
import { placeVariantRows } from './placeVariantRows.ts'
import {
  installRecordsOpeningHeight,
  recordsBandActions,
  recordsColorScaleViews,
  recordsKeyViews,
  recordsLayoutActions,
  recordsLayoutViews,
  recordsOpeningHeightActions,
  recordsRenderViews,
  recordsSettingsViews,
} from './recordsBandViews.ts'
import { recordCountMeasurements } from './recordsDensityGate.ts'
import { recordsHighlightViews } from './recordsHighlightViews.ts'
import {
  variantContextMenuItems,
  variantTrackMenuItems,
} from './variantDisplayMenuItems.ts'
import { variantDataColorScales } from './variantLegend.ts'
import {
  variantColorSettingViews,
  variantDrawnRowViews,
  variantGenotypeRowViews,
  variantGenotypesShowViews,
  variantRowConfigViews,
  variantRowHookViews,
} from './variantRowViews.ts'

import type { SimplifiedVariantFeature } from '../VariantRPC/analyzeVariants.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { VariantRowsField } from '../shared/constants.ts'
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
import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { MatrixHoveredCell } from './matrix/VariantMatrixComponent.tsx'
import type {
  VariantMatrixRenderBlock,
  VariantMatrixRenderingBackend,
} from './matrix/variantMatrixRenderingBackendTypes.ts'
import type { Placed } from './placeVariantRows.ts'
import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type { CanonicalTranscripts } from '@jbrowse/core/util/isoformRank'
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
  FeatureMenuHit,
  HitFeatureResult,
} from '@jbrowse/plugin-features/band'
import type { SvgSidebarProps } from '@jbrowse/tree-sidebar'

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
    warnMissingAttribute('rows.color', rowColorField, sources)
  }
  const field = self.facet?.field
  if (field && !sources.some(source => field in source)) {
    warnMissingAttribute('facet', field, sources)
  }
}

// A sample named as another's haplotype row, `X HP1` beside `X`, shares that
// row's name in phased mode
function warnHaplotypeNameCollisions(samples: readonly string[]) {
  const collisions = haplotypeNameCollisions(samples)
  if (collisions.length > 0) {
    console.warn(
      `Sample ${collisions.map(name => `"${name}"`).join(', ')} is also the name of another sample's haplotype row, so in phased mode the name is ambiguous: an order, label, color or focus naming it may mean that sample or the other sample's haplotype`,
    )
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

/** The mark under the pointer, by the band it sits in. */
export type VariantHover =
  | { kind: 'cell'; cell: HoveredCell }
  | { kind: 'record'; record: HitFeatureResult }
  | { kind: 'matrixCell'; cell: MatrixHoveredCell }

/**
 * The GPU program each layout draws with, tagged so the one upload lifecycle
 * sends each payload to the backend that can draw it.
 */
export type VariantLayoutBackend =
  | (VariantRenderingBackend & { columns: false })
  | (VariantMatrixRenderingBackend & { columns: true })

/**
 * #stateModel LinearVariantDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 * The variant display: a VCF's records stacked as a feature track stacks
 * them, over one genotype row per sample, with the feature widget on a click
 * on a record or a cell. With no sample rows the records are the display.
 *
 * #example
 * `rows` and `filter` are
 * config (see the display's config schema), read at runtime through `getConf`
 * and written as session edits to the track's config — they are not plain MST
 * properties. Set them in a track's `displays` array to change the default:
 * ```js
 * displays: [
 *   {
 *     type: 'LinearVariantDisplay',
 *     displayId: 'my-cohort',
 *     rows: {
 *       field: 'haplotype',
 *       sort: ['NA12878', 'NA12891'],
 *       color: 'population',
 *     },
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
 *     type: 'LinearVariantDisplay',
 *     runClustering: true,
 *   },
 * ]
 * ```
 *
 * ## How the rows are arranged
 *
 * The arrangement is config: `rows` holds the order, the labels, the colors
 * pinned on rows, the cluster tree with its provenance and the focus, each by
 * row name at the mode's granularity — a sample in allele-count mode, a
 * haplotype (`"<sample> HP<n>"`) in phased mode, where a sample name stands
 * for its haplotypes. A drag, the arrangement dialog, "Sort rows by genotype here" and
 * a clustering run write it; the rows are derived from it on every read:
 *
 * 1. `rows.filter` and then `rows.kept` narrow the adapter's samples
 *    (`adapterSamples`) to the set the fetch asks for (`sourcesBase`,
 *    `sampleFilter`),
 * 2. phased mode expands each sample to its haplotypes (`expandedRows`), and
 *    `rows.sort` orders them, `rows.labels` relabels them and each row has
 *    its resolved color (`editableSources`, the dialog's list), each from
 *    `TreeSidebarMixin` over this display's hooks,
 * 3. the same narrowing narrows those (`clusterableSources`, what a run
 *    clusters),
 * 4. `facet` stacks those in bands (`bandedSources`), each band's rows in their
 *    arranged order,
 * 5. the result is `sources`, each row's resolved color its label bar.
 *
 * **`rows.color` wins over a color the row already has**, a `samplesTsv`
 * `color` column: a channel bound to a variable beats a per-row constant, so
 * "Color by… → (none)" restores the row's color from that column. A color
 * the dialog pins on a row (`rows.colors`) wins over both.
 *
 * **The `facet` bands win over a tree**: a band draws the clade of the tree
 * whose leaves are exactly its rows in order, and a clustering run under bands
 * clusters each band apart and writes one forest. A whole-cohort tree under a
 * facet set afterwards draws where a band happens to be a clade, and the hint
 * counts the bands without one.
 */
export function stateModelFactory(
  configSchema: LinearVariantDisplayConfigModel,
) {
  return (
    types
      .compose(
        VARIANT_DISPLAY,
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
          type: types.literal(VARIANT_DISPLAY),
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * The records a search hit, a right-click or the `highlight=`
           * param boxes on the records band, as on a feature track.
           */
          featureHighlights: types.stripDefault(
            types.array(FeatureHighlightModel),
            [],
          ),
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
         * The mark under the pointer, in whichever band it sits: a genotype
         * cell, a record on the records band or a matrix cell. One slot, so
         * a hover in one band ends the last one's highlight.
         */
        hovered: undefined as VariantHover | undefined,
        /**
         * #volatile
         * Whether the attached backend draws columns, so the upload sends it
         * the payload it can draw across the swap a layout change makes.
         */
        backendDrawsColumns: false,
        /**
         * #volatile
         * The records-only height this display opened at
         * (`settleRecordsOpeningHeight`), held while no `height` is written.
         */
        openingHeight: undefined as number | undefined,
        /**
         * #volatile
         * The records band's height over rows at its opening
         * (`settleRecordsBandHeight`), held while no `records.height` is
         * written.
         */
        openingRecordsHeight: undefined as number | undefined,
      }))
      .actions(self => {
        const { clearHoveredFeature: superClearHoveredFeature } = self
        return {
          /**
           * #action
           */
          setHovered(hovered?: VariantHover) {
            self.hovered = hovered
          },
          /**
           * #action
           * `StoredHoverMixin`'s clears the tooltip; the highlight boxes go
           * with it.
           */
          clearHoveredFeature() {
            superClearHoveredFeature()
            self.hovered = undefined
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The genotype cell under the pointer.
         */
        get hoveredCell() {
          return self.hovered?.kind === 'cell' ? self.hovered.cell : undefined
        },
        /**
         * #getter
         * The record under the pointer on the records band, plugin-features's
         * hit result, so `hoverInk` lights the box the band painted.
         */
        get hoveredRecord() {
          return self.hovered?.kind === 'record'
            ? self.hovered.record
            : undefined
        },
        /**
         * #getter
         * The matrix cell under the pointer, in the equal-width column layout.
         */
        get hoveredMatrixCell() {
          return self.hovered?.kind === 'matrixCell'
            ? self.hovered.cell
            : undefined
        },
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
      .views(self => variantRowConfigViews(self))
      .views(self => variantGenotypesShowViews(self))
      .views(self => variantColorSettingViews(self))
      .views(self => ({
        /**
         * #getter
         * Whether `genotypesShowDefault` is the answer rather than a guess
         * made before the samples loaded, and the track entry the display
         * came from leaves `genotypes.show` unset. Only then is a value equal
         * to the default the same state as unset.
         */
        get genotypesShowClearable(): boolean {
          const { genotypes } = baseDisplayConfig(self)
          return (
            self.adapterSamples !== undefined &&
            (!(
              typeof genotypes === 'object' &&
              genotypes !== null &&
              'show' in genotypes
            ) ||
              genotypes.show === undefined)
          )
        },
        /**
         * #getter
         */
        get showRowSeparators(): boolean {
          return getConf(self, ['rows', 'axis', 'grid'])
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
         * `rowBandingNotices`, `rowNarrowingNotices`, and each `filter` field
         * no loaded variant carries, pointing at `rows.filter` where it is a
         * row attribute.
         */
        get liveNotices(): string[] {
          return [
            ...self.rowBandingNotices,
            ...self.rowNarrowingNotices,
            ...(self.cellData?.unreadFilterFields ?? []).map(field =>
              self.unreadFilterFieldNotice(field, 'variant'),
            ),
          ]
        },
        /**
         * #getter
         * The field the alt cells paint by, '' while they paint the genotype
         * colors or a constant.
         */
        get colorField(): string {
          return cellHueField(self.colorEncoding) ?? ''
        },

        get featureWidgetType() {
          return VARIANT_FEATURE_WIDGET
        },
        /**
         * #getter
         * The noun the feature menu rows name a record by: "Zoom to
         * variant".
         */
        get featureNoun() {
          return 'variant'
        },
        /**
         * #getter
         * The sequence dialog's isoform tags; a record has no isoforms, so
         * the defaults.
         */
        get canonicalTranscripts(): CanonicalTranscripts {
          return DEFAULT_CANONICAL_TRANSCRIPTS
        },
        /**
         * #method
         * The right-clicked record as the hit plugin-features's feature menu
         * rows act on, in the displayed region the hit was drawn in, else the
         * first loaded one it overlaps.
         */
        recordMenuHit(
          feature: Feature,
          drawnIn?: number,
        ): FeatureMenuHit | undefined {
          const start: number = feature.get('start')
          const displayedRegionIndex =
            drawnIn !== undefined
              ? drawnIn
              : loadedRegionIndexOverlapping(
                  self.loadedRegions,
                  canonicalizeViewRefName(self, feature.get('refName')),
                  start,
                  feature.get('end'),
                )
          return displayedRegionIndex === undefined
            ? undefined
            : {
                item: {
                  featureId: feature.id(),
                  startBp: start,
                  endBp: feature.get('end'),
                  name: feature.get('name'),
                  type: feature.get('type'),
                },
                displayedRegionIndex,
              }
        },
      }))
      .views(self => variantGenotypeRowViews(self))
      .views(self => variantDrawnRowViews(self))
      .views(self => ({
        /**
         * #getter
         * The `connectors` band's height above the columns, taken from the
         * rows' slot height so they keep their floor; 0 at genomic
         * positions, where nothing needs connecting.
         */
        get connectorsHeight(): number {
          return connectorsBandStack(self.fitTargetHeight, {
            active:
              !self.atGenomicPositions && getConf(self, ['connectors', 'show']),
            height: getConf(self, ['connectors', 'height']),
          }).reserved.connectors
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the VCF lists its samples, so a
         * `rows.kept` name no sample has is named.
         */
        get rowsListedUpFront(): boolean {
          return true
        },
      }))
      .views(recordsKeyViews)
      .views(recordsSettingsViews)
      .actions(self => {
        const fetchMetadata = createAdapterMetadataFetch(self)
        const openDetails = createFeatureDetailsOpener(self)
        const superSetRowColorChoice = self.setRowColorChoice
        // Queried over the record's first base, which finds it as surely as
        // its span does without reading a 5 Mb SV's whole span.
        function adapterRecordOf(feature: Feature, signal?: AbortSignal) {
          const refName = canonicalizeViewRefName(self, feature.get('refName'))
          const region = self.view.displayedRegions.find(
            r => r.refName === refName,
          )
          const start = feature.get('start')
          return region
            ? fetchFeatureDetails(
                getSession(self),
                getRpcSessionId(self),
                self.adapterConfig,
                feature.id(),
                featureSpanRegion(
                  region,
                  start,
                  Math.min(feature.get('end'), start + 1),
                ),
                { signal },
              )
            : Promise.resolve(undefined)
        }
        // a click in flight is aborted by the next one for the same
        // consumer, so the last click wins; each consumer holds its own, so
        // the details widget and the split view never abort each other
        function latestFullRecord() {
          let clickInFlight: AbortController | undefined
          return async (feature: Feature) => {
            clickInFlight?.abort()
            const click = new AbortController()
            clickInFlight = click
            const full = await adapterRecordOf(feature, click.signal)
            checkAbortSignal(click.signal)
            return full ? withClickedSample(full, feature) : feature
          }
        }
        const detailsRecordOf = latestFullRecord()
        const fullRecordOf = latestFullRecord()
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
            void openDetails(() => detailsRecordOf(feature))
          },
          /**
           * #action
           */
          clearSelection() {
            getSession(self).clearSelection()
          },
          /**
           * #action
           * A drawn record as the adapter holds it, INFO and every sample
           * included, as LinearBasicDisplay's `fetchFullFeature` answers its
           * feature menu's copy and sequence rows.
           */
          async fetchFullFeature(
            featureId: string,
            _displayedRegionIndex: number,
            opts: { signal?: AbortSignal } = {},
          ) {
            const feature = self.featureById(featureId)
            return feature ? adapterRecordOf(feature, opts.signal) : undefined
          },
          /**
           * #action
           * Where the sequence dialog's pointer is, which a feature track
           * boxes on its glyph. A record's sequence is its REF span, so
           * nothing here draws it.
           */
          setSequenceHoverPosition(_pos: SequenceHoverPosition | undefined) {},
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
            warnHaplotypeNameCollisions([...names])
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
           */
          setShowReference(arg: boolean) {
            setConf(self, ['genotypes', 'reference', 'show'], arg)
          },
          /**
           * #action
           */
          setShowRowSeparators(arg: boolean) {
            setConf(self, ['rows', 'axis', 'grid'], arg)
          },
          /**
           * #action
           */
          setShowTooltips(arg: boolean) {
            setConf(self, ['tooltip', 'show'], arg)
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
          setConnectorsHeight(n: number) {
            setConf(
              self,
              ['connectors', 'height'],
              clampConnectorsHeight(
                self.fitTargetHeight,
                self.connectorsHeight,
                n,
              ),
            )
          },
          /**
           * #action
           * Draw the genotype rows, or the records alone. In columns this
           * swaps the backend as `setVariantLayout` does, so it clears the
           * render error the same way. A value the slot resolves to unset is
           * cleared rather than written, since a written `false` keeps the
           * band's look over rows (ADR-254). That holds only once the samples
           * are known and the track entry the display came from sets no
           * `genotypes.show`: a value the entry sets is written, so returning
           * to it leaves no delta against it.
           */
          setShowGenotypes(arg: boolean) {
            setConf(
              self,
              ['genotypes', 'show'],
              self.genotypesShowClearable && arg === self.genotypesShowDefault
                ? undefined
                : arg,
            )
            self.setRenderError(undefined)
          },
          /**
           * #action
           */
          setBackendDrawsColumns(arg: boolean) {
            self.backendDrawsColumns = arg
          },
          /**
           * #action
           * The records band repainted its own canvas, the one a ring
           * samples: counted as a paint so the ring takes the new picture,
           * which the rows' backend never repaints for. `canvasDrawn` stays
           * that backend's answer.
           */
          markRecordsBandPainted() {
            self.paintCount += 1
          },
        }
      })
      .actions(recordsBandActions)
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

        /**
         * #getter
         * `genotypes.reference.show`: each reference call draws as a cell,
         * rather than the rows' grey fill standing in for it.
         */
        get showReference(): boolean {
          return getConf(self, ['genotypes', 'reference', 'show'])
        },

        /**
         * #getter
         * `TreeSidebarMixin`'s hook: a haplotype row's `sampleName`, `HP` and `sole`,
         * which the arrangement dialog lists as no column.
         */
        get internalRowFields(): readonly string[] {
          return ['sampleName', 'HP', 'sole']
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the samplesTsv attributes, the ones
         * "Color by" and "Group by" offer — every key the samples carry but
         * the internal plumbing.
         */
        get rowColorFields(): readonly string[] {
          const keys = new Set<string>()
          for (const source of self.adapterSamples ?? []) {
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
         * `TreeSidebarMixin`'s hook: a tree clustered per haplotype hides in
         * sample mode, and says so.
         */
        get finerTreeHint(): { text: string; title: string } {
          return {
            text: 'Tree hidden — clustered per haplotype',
            title:
              'The tree was clustered on haplotype rows. Show rows per haplotype to draw it, or re-run clustering per sample. Click to dismiss.',
          }
        },
      }))
      .views(self => variantRowHookViews(self))
      .views(self => ({
        /**
         * #getter
         * The adapter's samples narrowed by `rowNarrowing`, `rows.filter`
         * over their samplesTsv attributes and then `rows.kept`: the row set
         * the fetch asks for, so it must not read `samplePloidy`. The
         * attributes arrive with the sample list, so the filter never runs
         * ahead of them. `undefined`
         * until the samples land; that transition wakes the fetch autorun
         * (reference/FETCH_KEYS.md).
         */
        get sourcesBase(): Source[] | undefined {
          const sources = self.adapterSamples
          return (
            sources &&
            (self.drawsGenotypeRows
              ? narrowRows(sources, {
                  kept: self.rowFocus ?? [],
                  filter: self.rowFilter,
                  rowAlias: entryAliasOf(sources),
                })
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
            (self.rowsField !== 'haplotype' || !!self.samplePloidy)
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
        // `showReference` is one at genomic positions only: columns draw
        // every reference cell.
        rpcProps() {
          return {
            layout: self.variantLayout,
            sampleFilter: self.sampleFilter,
            siteFilter: self.siteFilter,
            filters: self.filters,
            rowsField: self.rowsField,
            color: self.cellHueRead,
            recordFields: self.recordFieldReads,
            showReference: !self.atGenomicPositions || self.showReference,
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
      .views(self => {
        const keyWindows = stableIdentityComputed(() =>
          self.view.initialized
            ? keyWindowsOf(self.view.settledDynamicBlocks)
            : [],
        )
        return {
          /**
           * #getter
           * The bp each displayed region shows once a pan settles, which the
           * key lists what is present in. Compared by value, so a pan that
           * settles where it was rebuilds no key.
           */
          get keyWindows() {
            return keyWindows.get()
          },
          /**
           * #getter
           * What the key lists, read off the variants on screen at genomic
           * positions (the fetch is wider than the view) and off every
           * fetched variant in columns, which fetch only what is shown.
           */
          get keyedVariants() {
            const { cellData } = self
            return cellData
              ? self.atGenomicPositions
                ? keyedVariantsInWindows(
                    cellData.perRegionCellData,
                    this.keyWindows,
                  )
                : keyedVariantsFetched(
                    Object.values(cellData.perRegionCellData),
                  )
              : NO_KEYED_VARIANTS
          },
          /**
           * #getter
           * Whether a variant on screen painted a secondary-alt cell, which
           * keys the "Other alt allele" legend entry. Painted, not possible.
           */
          get hasSecondaryAlt() {
            return this.keyedVariants.hasSecondaryAlt
          },
          /**
           * #getter
           * Whether phase-set coloring painted an alt cell on screen whose
           * call names no phase set, which keys that cell's plain hue.
           */
          get hasAltWithoutPhaseSet() {
            return this.keyedVariants.hasAltWithoutPhaseSet
          },
          /**
           * #getter
           * Whether a variant on screen painted a black unphased cell (drives
           * the "Unphased" legend entry).
           */
          get hasUnphased() {
            return this.keyedVariants.hasUnphased
          },
          /**
           * #getter
           * Whether a variant on screen painted a no-call cell (drives the "No
           * call" legend entry).
           */
          get hasNoCall() {
            return this.keyedVariants.hasNoCall
          },
          /**
           * #getter
           * The cell scale's domain values painted on screen — the impact
           * tiers or SV classes the legend lists: every record's while the
           * records band paints them, which covers each alt cell's, else
           * those an alt cell was painted for.
           */
          get paintedDomain(): string[] {
            const { altColorValues, recordColorValues } = this.keyedVariants
            return self.cellHueValuesRead
              ? colorKeysOf(
                  self.showRecords && !self.recordsColorBySvClass
                    ? recordColorValues
                    : altColorValues,
                  self.cellHue,
                )
              : []
          },
        }
      })
      .views(recordsRenderViews)
      .views(recordsColorScaleViews)
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
           * Height left for the rows under the bands above them, floored at 0:
           * every consumer treats it as a pixel dimension. None while no row
           * draws.
           */
          get availableHeight() {
            return self.drawsGenotypeRows
              ? Math.max(0, self.height - self.rowsTopOffset)
              : 0
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
      .views(recordsLayoutViews)
      .views(self => ({
        /**
         * #getter
         * Whether a config, a session or a user's act wrote `height`.
         */
        get heightWritten() {
          return getConf(self, 'height') !== undefined
        },
        /**
         * #getter
         * `height` as written, else, with no rows, the height the track
         * opened at, else the default. Overrides
         * `TrackHeightMixin.configuredHeight`, so a drag, `fit` and the
         * grow-exit bake start from the height on screen.
         */
        get configuredHeight(): number {
          return (
            getConf(self, 'height') ??
            (self.recordsOnly ? self.openingHeight : undefined) ??
            DEFAULT_VARIANT_DISPLAY_HEIGHT
          )
        },
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
      }))
      .views(self => ({
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
            : (self.rowsHidden ? 0 : sized) + self.topBands.addedHeight
        },
      }))
      .actions(recordsLayoutActions)
      .actions(self => {
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
      })
      .actions(recordsOpeningHeightActions)
      .views(recordsHighlightViews)
      .actions(featureHighlightListActions)
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
         * #method
         * A hit as the tooltip table reads it: the record's fields over the
         * hit row's sample metadata.
         */
        tooltipSourceOf(hit: VariantHoverFields) {
          const source = self.sourceMap.get(hit.name)
          return source ? { ...source, ...hit } : hit
        },
        /**
         * #method
         * The tooltip a hit shows, as plain text, for "Copy tooltip text";
         * undefined with `tooltip.show` off.
         */
        tooltipTextOf(hit: VariantHoverFields) {
          return self.showTooltips
            ? tooltipPlainText(this.tooltipSourceOf(hit))
            : undefined
        },
        /**
         * #getter
         * The hovered thing as the tooltip table reads it. Undefined with
         * `tooltip.show` off.
         */
        get hoveredTooltipSource() {
          const { hoveredFeature } = self
          return hoveredFeature && self.showTooltips
            ? this.tooltipSourceOf(hoveredFeature)
            : undefined
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
              phased: self.rowsField === 'haplotype',
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
      .actions(self => ({
        /**
         * #action
         * What one row is, `rows.field`. A haplotype row answers to its
         * sample's name, so the arrangement carries across the switch either
         * way and a read interprets it at the field in force.
         */
        setRowsField(field: VariantRowsField) {
          setConf(self, ['rows', 'field'], field)
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
              ...variantTrackMenuItems(self as LinearVariantDisplayModel),
              ...editPlotMenuItems(self),
            ]
          },
          /**
           * #method
           * Items for the right-click menu, built from the record in
           * `contextMenuInfo`.
           */
          contextMenuItems(): MenuItem[] {
            return variantContextMenuItems(self as LinearVariantDisplayModel)
          },
        }
      })
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
         * Genotype rows fill the track, so an overlapping track label would
         * sit on top of a sample's genotypes. With none the records band is
         * the track and takes the offset as a feature track does, while its
         * sections' chips sit where the label would.
         */
        get prefersOffset() {
          return self.drawsGenotypeRows || self.recordsFacet !== undefined
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
            phased: self.rowsField === 'haplotype',
            valuesRead: self.cellHueValuesRead,
          }
        },
        /**
         * #getter
         * The power-of-two zoom the density fade is computed at, so a zoom
         * inside one rung repaints and re-uploads no cell.
         */
        get densityRung() {
          return densityRung(self.host.bpPerPx)
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
          return cellData && self.atGenomicPositions
            ? mapPayloadRegions(cellData, data =>
                recordDensityAlpha(data.featurePositions, this.densityRung),
              )
            : new Map<number, Float32Array | undefined>()
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
          return mapPayloadRegions(cellData, (data, index) =>
            fadeCellColors(
              paintCellColors(data, cellHue, options),
              data.cellFeatureIndices,
              data.numCells,
              alpha.get(index),
            ),
          )
        },
        /**
         * #getter
         * Each fetched region with its rows placed on screen. A computed apart
         * from the colors, so a recolor leaves it standing.
         */
        get placedRegionRows() {
          const { cellData, rowRemap } = self
          // never identity placement: the worker's row order is its own
          return rowRemap
            ? mapPayloadRegions(cellData, data =>
                placeVariantRows(data, rowRemap),
              )
            : new Map<number, Placed<VariantCellData>>()
        },
        /**
         * #getter
         * Each fetched region's cells as the `cell` mark's attributes:
         * the record's span and glyph, which the payload holds once per
         * record, dealt to each of its cells. Off `cellData` alone, since
         * neither a reorder nor a recolor moves a cell's span.
         */
        get regionCellGlyphs() {
          return mapPayloadRegions(self.cellData, data => cellGlyphs(data))
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
         * The band record the hover box lights: the one a menu opened on
         * while it is open, else the one under the pointer, as
         * LinearBasicDisplay's `hoverBoxFeature` picks.
         */
        get litRecordId() {
          return (
            self.contextMenuInfo?.bandRecordId ??
            self.hoveredRecord?.feature.featureId
          )
        },
        /**
         * #getter
         * The box of the lit record, over its glyph and its labels as
         * LinearBasicDisplay boxes a feature, else of the hovered genotype
         * cell.
         */
        get hoverInk(): HighlightRect[] {
          const id = this.litRecordId
          return id === undefined
            ? this.genotypeHoverInk
            : self.recordsInk([id])
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
            return inkOfInstances(
              VARIANT_MARKS,
              self.renderBlocks,
              idx => self.perRegionCellMap.get(idx),
              self.renderState,
              idx =>
                idx === cell.displayedRegionIndex
                  ? [{ mark: 0, index: cell.cellIndex }]
                  : undefined,
            )
              .slice(0, 1)
              .map(ink => shiftInk(ink, 0, self.rowsTopOffset))
          }
          return []
        },
        /**
         * #getter
         * A record shades as a feature track's feature does; a cell takes a
         * wash and a border, since the cell colors are the data.
         */
        get highlightStyle(): HighlightStyle {
          return this.litRecordId === undefined ? 'box' : 'shade'
        },
        /**
         * #getter
         * Per-region spatial index over feature intervals, for the hit-test. One
         * entry per variant, not per cell — see computeVariantCells. Off the
         * payload alone, since neither a reorder nor a recolor moves a span.
         */
        get featureIndices() {
          return mapPayloadRegions(self.cellData, data =>
            Flatbush.from(data.featureIndexData),
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `LegendMixin`'s hook: the records band's SV classes, the cell
         * coloring while `cellColorKeyed`, and the row color key.
         */
        get colorScales(): ColorScale[] {
          return [
            ...variantDataColorScales({
              recordsColorScales: self.recordsColorScales,
              cellColorKeyed: self.cellColorKeyed,
              drawsGenotypeRows: self.drawsGenotypeRows,
              colorSetting: self.colorSetting,
              cells: () => ({
                rowsField: self.rowsField,
                hasSecondaryAlt: self.hasSecondaryAlt,
                hasAltWithoutPhaseSet: self.hasAltWithoutPhaseSet,
                hasUnphased: self.hasUnphased,
                hasNoCall: self.hasNoCall,
                paintedDomain: self.paintedDomain,
                color: self.colorEncoding,
                colorSlots: heldColorSlots(self, self.colorEncoding),
                ramp: self.cellHue.ramp,
              }),
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
              (await import('./setupVariantDisplayAutoruns.ts'))
                .setupVariantDisplayAutoruns,
          )
          // read only from untracked pointer handlers, so held alive here
          autorunOnReadyView(
            self,
            () => {
              void self.recordsFlatbushIndexes
            },
            { name: 'RecordsHitIndexes' },
          )
          installRecordsOpeningHeight(self)
        },
      }))
  )
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>

export default stateModelFactory
