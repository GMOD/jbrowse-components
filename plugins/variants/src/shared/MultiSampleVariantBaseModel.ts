import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { categoricalPalette } from '@jbrowse/core/ui/colors'
import {
  canonicalizeViewRefName,
  getNotificationSink,
  openFeatureWidget,
  SimpleFeature,
} from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { readFor } from '@jbrowse/core/util/installPrerequisiteFetch'
import {
  activeJexlFilters,
  configuredJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorEncodingOf,
  colorForField,
} from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { fetchRegionsBatched } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { cast, getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  focusRowGroup,
  keptRows,
  loadedRegionIndexAt,
  rowFieldValue,
  valuesByCount,
} from '@jbrowse/tree-sidebar'

import { sortSourcesAroundVariant } from './anchoredHaplotypeSort.ts'
import { cellHueField } from './cellHue.ts'
import {
  HIDDEN_ROW,
  INTERNAL_SOURCE_KEYS,
  MULTI_SAMPLE_VARIANT_DISPLAY,
  VARIANT_FEATURE_WIDGET,
} from './constants.ts'
import { buildSampleIndex } from './genotypeCodec.ts'
import {
  expandPhasedRows,
  ploidyBySample,
  parseRowName,
  resolveSampleName,
  rowAliasOf,
} from './getSources.ts'
import {
  variantContextMenuItems,
  variantShowSubmenuItems,
  variantTrackMenuItems,
} from './multiSampleVariantMenuItems.ts'
import { getVariantColorScales } from './variantLegend.ts'
import { variantTopBandsGeometry } from './variantTopBands.ts'

import type { LinearMultiSampleVariantDisplayConfigModel } from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { ProcessedSource, Source } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ShowLabelsMode } from '@jbrowse/plugin-canvas'
import type {
  IdentityChannel,
  RowAlias,
  RowBanding,
  RowColorDeal,
  RowColorEntries,
} from '@jbrowse/tree-sidebar'

type CellDataMode = CellDataResult['mode']

type VariantHoverFields = Record<string, unknown> & {
  genotype: string
  name: string
}

// The `rowColor` attribute's palette, its values ranked by how many adapter
// rows carry each. Ranked over the drawn rows instead, a subtree focus or the
// haplotype expansion would re-rank the values and recolor everything left on
// screen. `undefined` is "nothing to color by": no attribute painting, or one
// no source carries.
export function attributeColorDeal<S extends Source>(
  field: string,
  entries: { domain: readonly string[]; range: readonly string[] },
  sources: readonly Source[],
): RowColorDeal<S> | undefined {
  if (!field || !sources.some(source => field in source)) {
    return undefined
  }
  const valueOf = (row: object) => rowFieldValue(row, field)
  return {
    order: valuesByCount(sources.map(valueOf)),
    valueOf,
    domain: entries.domain,
    range: entries.range,
    palette: categoricalPalette,
  }
}

// Paint the palette onto the rows being drawn. The tint lands on `labelColor`,
// the channel tree-sidebar draws a row's label in: these displays paint their
// cells by genotype, so a row has no `color` of its own to spend.
//
// **The palette wins over whatever the row already carried**, a `samplesTsv`
// `color` column. See the class docstring for why.
export function applyAttributeColors<S extends Source>(
  rows: S[],
  colors: ReadonlyMap<string, string>,
): S[] {
  return rows.map(s => ({
    ...s,
    labelColor: colors.get(s.name) ?? s.labelColor,
  }))
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

/**
 * What a right-click on a genotype cell or a lane mark resolved to: the record
 * under it, already a `Feature`, plus where the menu opens.
 */
export interface VariantContextMenuInfo extends ContextMenuAnchor {
  feature: Feature
}

// The display-state arrangement these displays kept before `rows`. A loaded
// session's is lifted into `rows` before this model sees it (the DisplayType's
// `retiredState`), so this refuses a snapshot written some other way, which
// MST would otherwise open unarranged with nothing said.
const RETIRED_ARRANGEMENT_PROPS = [
  'layout',
  'clusterTree',
  'clusterProvenance',
  'subtreeFilter',
]

// Loaded features in genomic order plus their interned genotype codes: what an
// anchored sort needs. `simplifiedFeatures` is the single ordered list spanning
// every fetched region, while the codes live per-region in regular mode and in
// one flat array in matrix mode.
function getOrderedGenotypeCodes(cellData: CellDataResult) {
  const genotypeCodesByFeatureId = new Map<string, Uint32Array>()
  if (cellData.mode === 'regular') {
    for (const regionData of Object.values(cellData.perRegionCellData)) {
      for (const featureId in regionData.featureGenotypeMap) {
        genotypeCodesByFeatureId.set(
          featureId,
          regionData.featureGenotypeMap[featureId]!.genotypeCodes,
        )
      }
    }
  } else {
    for (const info of cellData.featureData) {
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

// Regions to fetch + render, by mode. Regular mode draws each variant at its
// genomic position, so off-screen buffered features simply clip — use the
// half-screen-buffered regions for smooth scrolling. Matrix mode lays columns
// out by feature index across the *visible* width, so including buffered
// features would cram off-screen variants into the viewport and draw connector
// lines to off-screen genomic positions — use the visible regions only.
function fetchRegionsForMode(
  view: RegionHost,
  mode: CellDataMode,
): IndexedRegion[] {
  if (mode === 'matrix') {
    return view.visibleRegions.map(vr => ({
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
  return view.bufferedVisibleRegions
}

/**
 * #stateModel MultiSampleVariantBaseModel
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 *
 * #example
 * `renderingMode`, `rowColor`, `rows` and `minorAlleleFrequencyFilter` are
 * config (see the display's config schema), read at runtime through `getConf`
 * and written as session edits to the track's config — they are NOT plain MST
 * properties. Set them in a track's `displays` array to change the default:
 * ```js
 * displays: [
 *   {
 *     type: 'LinearMultiSampleVariantDisplay',
 *     displayId: 'my-cohort',
 *     renderingMode: 'phased',
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
 * tree with its provenance and the focus, and `rowColor` the tint, each by row
 * name at the mode's granularity — a sample in allele-count mode, a haplotype
 * (`"<sample> HP<n>"`) in phased mode, where a sample name stands for its
 * haplotypes. A drag, the arrangement dialog, "Sort rows by genotype here" and
 * a clustering run write it; the rows are derived from it on every read:
 *
 * 1. the adapter's samples (`adapterSamples`) are focused by `rows.kept`,
 *    which is the set the fetch asks for (`sourcesBase`, `sampleFilter`),
 * 2. phased mode expands each sample to its haplotypes (`expandedRows`), and
 *    `rows.domain` orders, `rows.labels` relabels and the `rowColor` pairs
 *    tint them (`editableSources`, the dialog's list), each from
 *    `TreeSidebarMixin` over this display's hooks,
 * 3. the focus narrows those (`clusterableSources`, what a run clusters),
 * 4. `facet` stacks those in bands (`bandedSources`), each band's rows in their
 *    arranged order,
 * 5. the `rowColor` palette tints the result (`sources`).
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
export default function MultiSampleVariantBaseModelF(
  configSchema: LinearMultiSampleVariantDisplayConfigModel,
) {
  return (
    types
      .compose(
        'MultiSampleVariantBaseModel',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        LegendMixin(),
        RowHeightMixin(),
        StoredHoverMixin<VariantHoverFields>(),
        TreeSidebarMixin<ProcessedSource>(),
        ContextMenuMixin<VariantContextMenuInfo>(),
        types.model({
          type: types.string,
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * Runtime "Filter by..." override, already `jexl:`-prefixed. When set
           * (even to an empty list) it replaces the `jexlFilters` config slot;
           * when undefined the config default applies. See `JexlFilterModel`.
           *
           * The name is load-bearing: this used to be called `jexlFilters`, the
           * same name as the inherited config slot, so `self.jexlFilters` read
           * the property and the slot was live in no reader at all — a config
           * declaring filters on one of these tracks did nothing and said
           * nothing. `preProcessSnapshot` below carries the old name over.
           */
          jexlFiltersSetting: types.stripDefault(
            types.maybe(types.array(types.string)),
            undefined,
          ),
          // `runClustering` / `clusterRegion` are TreeSidebarMixin's — they
          // trigger a run whose output is that mixin's `rows`.
        }),
      )
      // Unknown keys in an old display snapshot (blockState, the removed
      // lengthCutoffFilter, display-instance height/heightOverride, a
      // pre-config-slot rowHeight) need no handling — MST drops them, and
      // length filtering is now a general jexl filter
      // (`jexl:get(feature,'end')-get(feature,'start')<N`).
      //
      // `showTooltips` is one of those keys again. It came back as a config slot
      // rather than the display-instance prop it was before the rewrite, so an
      // old session's copy names no prop and is dropped like the rest — the same
      // answer `height` and `rowHeight` got when they made the same move, and the
      // reason the slot defaults to the old prop's default. Only the value is
      // lost, never the session.
      //
      // `jexlFilters` is the exception, because it held a live value: a session
      // saved before the rename carries the user's filters under it, and being
      // dropped is silent. Prefixed on the way in, since the property stores the
      // runtime form and the old one stored whatever the dialog was handed.
      .preProcessSnapshot((snap: Record<string, unknown>) => {
        const retired =
          snap.type === MULTI_SAMPLE_VARIANT_DISPLAY
            ? RETIRED_ARRANGEMENT_PROPS.filter(key => key in snap)
            : []
        if (retired.length) {
          throw new Error(
            `${retired.join(', ')} on a ${String(snap.type)}: the row arrangement is the display config's \`rows\` object (domain, labels, tree, treeProvenance, kept) and its colours \`rowColor\`, written by the arrangement dialog, a clustering run or a session spec's \`rows\``,
          )
        }
        const { jexlFilters, ...rest } = snap
        return Array.isArray(jexlFilters)
          ? {
              ...rest,
              jexlFiltersSetting: (jexlFilters as string[]).map(
                ensureJexlPrefix,
              ),
            }
          : snap
      })
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
         * Single source of truth for fetched per-display data. sampleInfo,
         * featuresVolatile and the summary flags are derived from this via
         * getters — fetchNeeded only needs to call setCellData(result).
         */
        cellData: undefined as CellDataResult | undefined,
        /**
         * #volatile
         * The displayed regions the current `cellData` was fetched for. The
         * payload itself cannot say: a region with no variants gets no
         * `perRegionCellData` entry, and the matrix payload is flat.
         */
        cellDataRegionIndices: new Set<number>() as ReadonlySet<number>,
        /**
         * #volatile
         * The zoom the current `cellData` was fetched at, set in matrix mode
         * alone. Matrix columns are the features of exactly the span on
         * screen, so after a zoom inside the loaded span the held payload
         * still lays out features the view no longer shows. Undefined answers
         * at every zoom, as regular mode's position-drawn payload does.
         */
        cellDataBpPerPx: undefined as number | undefined,
      }))
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
         * where the previous batch's regions stop having data behind them.
         */
        setCellData(
          data: CellDataResult | undefined,
          displayedRegionIndices: Iterable<number> = [],
          bpPerPx?: number,
        ) {
          self.cellData = data
          self.cellDataRegionIndices = new Set(displayedRegionIndices)
          self.cellDataBpPerPx = bpPerPx
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
         * What the `jexlFilters` config slot alone declares, `jexl:`-prefixed.
         * In its own block ahead of every reader so they reach it through
         * `self`, the arrangement `LinearBasicDisplay` uses for the same pair.
         */
        configuredFilters(): string[] {
          return configuredJexlFilters(self)
        },
        /**
         * #getter
         * SimpleFeature instances derived from the simplifiedFeatures list in
         * the most recent cellData payload. Cached by MobX while cellData is
         * unchanged. Named `featuresVolatile` for backwards-compat with
         * consumers that originally read it as a volatile field.
         *
         * These carry ONLY positional fields (id/start/end/refName/name) — not
         * ALT or genotypes. Don't re-derive feature-level facts from them
         * (`.get('ALT')` etc. returns undefined); summary facts are computed in
         * the worker and exposed as scalars (hasPhasedOrHaploid/hasSecondaryAlt/
         * hasUnphased), and per-feature genotype info lives in the cell-data
         * featureGenotypeMap/featureData.
         */
        get featuresVolatile(): Feature[] | undefined {
          return self.cellData?.simplifiedFeatures.map(
            f => new SimpleFeature(f),
          )
        },
        /**
         * #method
         * The base feature a click enriches, by id — the one spelling of the
         * lookup all three pointer surfaces (rows, lane, matrix) resolve
         * through.
         */
        featureById(featureId: string) {
          return this.featuresVolatile?.find(f => f.id() === featureId)
        },
        /**
         * #getter
         * Whether any called genotype is phased or haploid, which gates the
         * "Phased" rendering mode. Wider than the payload's `hasPhased`, since
         * the painter's rule is `isPhasedOrHaploid` (no `/`), because
         * a pangenome callset is haploid per assembly path and `vg deconstruct`
         * writes bare `0`/`1`/`23` — a file with no `|` anywhere that phased
         * mode renders correctly. Gating the menu on `hasPhased` left that
         * rendering reachable only from the config slot.
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
         * The cell scale's domain values an alt cell was painted for in the
         * fetched cell data — the impact tiers or SV classes the legend lists.
         */
        get paintedDomain(): string[] {
          return self.cellData?.paintedDomain ?? []
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
        /**
         * #getter
         * The color assigned to each present SV type, built in the worker so the
         * legend swatches match the painted cells (drives the "SV type" legend
         * section).
         */
        get svTypeColors() {
          return self.cellData?.svTypeColors
        },
        /**
         * #getter
         */
        get sampleInfo() {
          return self.cellData?.sampleInfo
        },
      }))
      .views(self => {
        const ploidy = stableIdentityComputed(() =>
          ploidyBySample(self.sampleInfo),
        )
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
         * #method
         * The filters actually applied, `jexl:`-prefixed: the runtime override
         * when set, otherwise the config tier. In its own block after
         * `configuredFilters` so it reaches it through `self`, the arrangement
         * `LinearBasicDisplay` uses for the same pair.
         */
        activeFilters(): string[] {
          return activeJexlFilters(self)
        },
        /**
         * #getter
         * Returns the rendering mode config slot value
         */
        get renderingMode(): string {
          return getConf(self, 'renderingMode')
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
         * The payload shape the worker builds for `atGenomicPositions`: cells
         * per displayed region at their spans, or one matrix of columns over
         * the visible regions.
         */
        get cellDataMode(): CellDataMode {
          return this.atGenomicPositions ? 'regular' : 'matrix'
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
         * The sample-metadata attribute the rows are tinted by: `rowColor.field`
         * while it paints and names one, '' while it names `name`, the rows
         * themselves, or sits under `scale: 'none'`. Drives the sidebar row
         * coloring and the legend's group section.
         */
        get rowColorField(): string {
          const { field, scale } = self.rowColorSetting
          return field === 'name' || scale === 'none' ? '' : field
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
          }
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
         * A fetch input — the cells are colored in the worker.
         */
        get shadeByDosage(): boolean {
          return getConf(self, 'shadeByDosage')
        },

        get featureWidgetType() {
          return VARIANT_FEATURE_WIDGET
        },
      }))
      // The derived, self-releasing too-large banner is opt-in via
      // `gateEnabled` below: the cell-data RPC then measures the region set
      // before it downloads, and afterAttach clears the estimate on chromosome
      // nav. Byte-only — no density axis.
      .actions(self => {
        const fetchMetadata = createAdapterMetadataFetch(self)
        return {
          /**
           * #action
           */
          setJexlFilters(f?: string[]) {
            self.jexlFiltersSetting = cast(f)
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
            // `setPhasedMode` takes when it renames the rows. Keyed on total
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
           * pass '' to clear the coloring, which keeps the attribute under
           * `scale: 'none'` for the way back. Writes the `rowColor` object
           * through `colorForField`, so a new attribute starts with no
           * entries: those a reader set row by row belong to `name`. The tint
           * is resolved on every read of `sources`, so a recolor moves no rows
           * and drops no cluster tree.
           */
          setRowColorField(field: string) {
            if (field !== self.rowColorChoice) {
              setConf(
                self,
                'rowColor',
                colorForField(self.rowColorSetting, field),
              )
            }
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
            const current = self.facet
            setConf(
              self,
              'facet',
              field
                ? {
                    field,
                    domain: field === current?.field ? current.domain : [],
                  }
                : {},
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
          setPhasedMode(arg: string) {
            const renamesRows = self.renderingMode !== arg
            setConf(self, 'renderingMode', arg)
            if (renamesRows) {
              // The mode decides what a row is *called* — sample names in
              // allele-count mode, "HG001 HP0" haplotype names in phased — so
              // the order, the labels, the tints, the tree and the focus naming
              // its leaves all go stale together.
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
           * back. A fetch input.
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
           * Turn dosage shading on or off. A fetch input — recomputes cells in
           * the worker.
           */
          setShadeByDosage(arg: boolean) {
            setConf(self, 'shadeByDosage', arg)
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
          const filters = self.activeFilters()
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
         * Whether the "Show reference alleles" row belongs in the menu: at
         * genomic positions `skip` turns the gaps between variants into one
         * solid grey row that overlapping SVs read against, while columns
         * paint their reference cells the grey the background would be, so
         * the toggle moves nothing there.
         */
        get showsReferenceToggle(): boolean {
          return self.atGenomicPositions
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
         * #method
         * `TreeSidebarMixin`'s hook: the attribute's palette
         * (`attributeColorDeal`), none while `setting` names no attribute.
         */
        rowColorDealFor(
          setting: RowColorEntries,
        ): RowColorDeal<ProcessedSource> | undefined {
          return attributeColorDeal(
            setting.field === 'name' ? '' : setting.field,
            setting,
            self.adapterSamples ?? [],
          )
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
         * answering to its sample name, with a samplesTsv `color` column as the
         * label tint where the sample names none of its own.
         */
        get discoveredRows(): ProcessedSource[] {
          return (self.adapterSamples ?? []).map(source => {
            const labelColor = source.labelColor ?? source.color
            return {
              ...source,
              sampleName: resolveSampleName(source),
              ...(labelColor === undefined ? {} : { labelColor }),
            }
          })
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
         * `TreeSidebarMixin`'s hook: a `rowColor` entry tints the label, the
         * one channel a row has, since the cells paint by genotype.
         */
        get identityChannel(): IdentityChannel {
          return 'labelColor'
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the `facet` bands the rows by a samplesTsv
         * attribute; one no sample carries bands nothing.
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
          return self.renderingMode === 'phased'
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
         * for, and so it must not read `sampleInfo` (see `sampleFilter`).
         * `undefined` until the samples land.
         */
        get sourcesBase(): Source[] | undefined {
          const sources = self.adapterSamples
          return sources && keptRows(sources, self.rowFocus, self.rowAlias)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The display rows: `bandedSources` tinted by the `rowColor` palette.
         * A cross-band drag snaps back while the facet is on.
         *
         * **Resolved — an array, never `undefined`**, which is the shared
         * spelling across the row displays. `adapterSamples` and `sourcesBase`
         * keep their `undefined`, because there it is genuinely load-bearing:
         * `sampleFilter` and `fetchNeeded` both read `sourcesBase`, and its
         * `undefined` → list transition is what wakes the fetch autorun
         * (reference/FETCH_SKELETON.md §"The global-fetch trigger list must be
         * read unconditionally").
         */
        get sources(): ProcessedSource[] {
          const rows = self.bandedSources
          const colors = self.rowColorScale
          return colors.size ? applyAttributeColors(rows, colors) : rows
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the fetched inputs clustering needs are present yet. Phased
         * clustering clusters haplotypes, which needs per-sample ploidy from
         * `sampleInfo`; that arrives with `cellData`, later than the header-only
         * `adapterSamples`. Gating the auto-cluster run on this (not just
         * `adapterSamples`) stops it racing ahead and building a sample-level
         * tree whose leaves ("HG001") never match the expanded haplotype rows
         * ("HG001 HP0").
         */
        get clusteringReady() {
          return (
            !!self.adapterSamples &&
            (self.renderingMode !== 'phased' || !!self.sampleInfo)
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
         * `sampleInfo`, a fetch result. A focus naming haplotypes asks for their
         * samples, and the worker expands them itself.
         */
        get sampleFilter(): string[] | undefined {
          const base = self.sourcesBase
          return base?.map(resolveSampleName).sort()
        },
      }))
      .views(self => ({
        // Payload for MultiSampleVariantGetCellData. SettingsInvalidate watches
        // this — any change clears loaded data and triggers a refetch.
        //
        // Only settings the *worker* reads belong here, and nothing fetch-derived
        // may appear (`sampleFilter` reads `sourcesBase`, not `sources`, because
        // `sources` reads `sampleInfo` — a fetch result — and would loop).
        // `referenceDrawingMode` is added by the display at genomic positions
        // alone, where the worker drops reference cells under 'skip'.
        rpcProps() {
          return {
            mode: self.cellDataMode,
            sampleFilter: self.sampleFilter,
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            maxMissingnessFilter: self.maxMissingnessFilter,
            filters: self.filters,
            renderingMode: self.renderingMode,
            color: self.colorEncoding,
            shadeByDosage: self.shadeByDosage,
          }
        },
      }))
      .views(self => ({
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
         * readers are the two displays' hit tests, which run in React pointer
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
         * user is looking at. Rebuilding it is all a reorder costs.
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
          return out
        },
        // Row-height model: `rowHeight` (raw setting, 0 = fit) and
        // `effectiveRowHeight` (resolved) are `RowHeightMixin`'s; what this
        // display owes it is `autoRowHeight` below. See
        // agent-docs/reference/ROW_HEIGHT_AND_FIT.md.
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
         * Px reserved above the rows, and so where the rows begin. This is the
         * name `TreeSidebar`'s model contract reads (it positions the sidebar
         * against the rows, not against any one band), and what every component
         * offsetting itself past the bands takes.
         */
        get rowsTopOffset() {
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
          return Math.max(0, self.height - this.rowsTopOffset)
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
        get hierarchy() {
          return computeClusterHierarchy(
            self.root,
            self.sources,
            self.effectiveRowHeight * this.nrow,
            self.treeAreaWidth,
            self.showBranchLength,
            self.rowBands,
          )
        },
      }))
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
        get spatialIndex() {
          return buildSpatialIndex(self.hierarchy)
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
              phased: self.renderingMode === 'phased',
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
        /**
         * #action
         * Narrow the rows to one `rowColor` group, by the group's value — `''`
         * for the rows the attribute is blank on.
         */
        focusGroup(value: string) {
          // Before the samples land there is no group to focus, and an empty
          // pick would read as clearing the focus.
          if (self.adapterSamples) {
            focusRowGroup(
              self,
              self.editableSources,
              s => String(s[self.rowColorField] ?? '') === value,
            )
          }
        },
        /**
         * #action
         * The chrome's legend hook: a click on a row of the group scale
         * focuses that group; the cell-color scales name genotypes and stay
         * inert.
         */
        focusLegendEntry(scaleId: string, value: string) {
          if (scaleId === 'group') {
            this.focusGroup(value)
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        showSubmenuItems(): MenuItem[] {
          return variantShowSubmenuItems(self as MultiSampleVariantBaseModel)
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
              ...variantTrackMenuItems(self as MultiSampleVariantBaseModel),
            ]
          },
          /**
           * #method
           * Items for the right-click menu, built from the record
           * `contextMenuInfo` carries.
           */
          contextMenuItems(): MenuItem[] {
            return variantContextMenuItems(self as MultiSampleVariantBaseModel)
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         */
        get totalHeight() {
          return self.effectiveRowHeight * self.nrow
        },
        /**
         * #getter
         */
        get scrollContentHeight() {
          return this.totalHeight
        },
        /**
         * #getter
         */
        get scrollViewportHeight() {
          return self.availableHeight
        },
      }))
      .views(() => ({
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
         * Both displays fill the track with rows, so an overlapping track label
         * would sit on top of a sample's genotypes.
         */
        get prefersOffset() {
          return true
        },

        /**
         * #getter
         * Whether this display is drawing insertion markers in the current
         * window, which is what puts the marker's explanation in the legend.
         *
         * Declared here, returning false, so `colorScales` below can be
         * written once; the display overrides it with the painter's own
         * answer.
         */
        get drawsInsertionMarkers(): boolean {
          return false
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `LegendMixin`'s hook: the cell coloring, the insertion marker where
         * one is drawn, and (when `rowColor.field` is set) the sample-grouping coloring
         * shown on the sidebar row labels. Whether the marker is keyed is
         * `drawsInsertionMarkers`' answer, the painter's own test on the
         * painter's own blocks.
         */
        get colorScales(): ColorScale[] {
          return getVariantColorScales({
            renderingMode: self.renderingMode,
            hasSecondaryAlt: self.hasSecondaryAlt,
            hasUnphased: self.hasUnphased,
            hasNoCall: self.hasNoCall,
            paintedDomain: self.paintedDomain,
            shadeByDosage: self.shadeByDosage,
            color: self.colorEncoding,
            svTypeColors: self.svTypeColors,
            colorBy: self.rowColorField,
            sources: self.sources,
            groupOrder: this.rowColorKeyOrder,
            insertionMarkers: self.drawsInsertionMarkers,
          })
        },
        /**
         * #getter
         * The order the row colour key lists its values in: the bands' while
         * the rows are banded by the same attribute, so the key reads as the
         * rows do, else the palette's deal, which a focus never re-ranks.
         */
        get rowColorKeyOrder(): readonly string[] {
          const { rowBanding, rowBands, rowColorField } = self
          return rowBands.length && rowBanding?.field === rowColorField
            ? rowBanding.domain
            : [...self.dealtRowColors.keys()].filter(value => value !== '')
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
          const mode = self.cellDataMode
          const regions = fetchRegionsForMode(view, mode)
          if (regions.length === 0) {
            return
          }
          // Resolved before the await, so the RPC sends exactly what
          // `fetchNeeded` is about to mark loaded — no second view read across
          // the async boundary.
          const args = rpcArgs(self)
          const fetchedAt = mode === 'matrix' ? view.bpPerPx : undefined
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
      .actions(self => ({
        afterAttach() {
          runLazyAfterAttach(
            self,
            async () =>
              (await import('./setupMultiSampleVariantAutoruns.ts'))
                .setupMultiSampleVariantAutoruns,
          )
        },
      }))
  )
}

export type MultiSampleVariantBaseStateModel = ReturnType<
  typeof MultiSampleVariantBaseModelF
>
export type MultiSampleVariantBaseModel =
  Instance<MultiSampleVariantBaseStateModel>
