import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  getContainingTrack,
  getNotificationSink,
  getSession,
  openFeatureWidget,
  SimpleFeature,
} from '@jbrowse/core/util'
import {
  activeJexlFilters,
  configuredJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { cast, getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  LegendMixin,
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchRegionsBatched,
} from '@jbrowse/plugin-linear-genome-view'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  applyColorPalette,
  buildSpatialIndex,
  computeClusterHierarchy,
  filterRowsBySubtree,
  rowLabelsCarryText,
} from '@jbrowse/tree-sidebar'
import deepEqual from 'fast-deep-equal'

import { sortSourcesAroundVariant } from './anchoredHaplotypeSort.ts'
import {
  HIDDEN_ROW,
  INTERNAL_SOURCE_KEYS,
  VARIANT_FEATURE_WIDGET,
} from './constants.ts'
import { buildSampleIndex } from './genotypeCodec.ts'
import { expandSourcesToHaplotypes, getSources } from './getSources.ts'
import {
  variantContextMenuItems,
  variantShowSubmenuItems,
  variantTrackMenuItems,
} from './multiSampleVariantMenuItems.ts'
import { getVariantLegendSections } from './variantLegend.ts'
import {
  DEFAULT_VARIANT_LANE_HEIGHT,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { SharedVariantConfigModel } from './SharedVariantConfigSchema.ts'
import type { ProcessedSource, Source } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ShowLabelsMode } from '@jbrowse/plugin-canvas'
import type {
  LegendSection,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Apply a `colorBy` palette to the sample sources. Returns the colored sources,
// or undefined when there's nothing to apply (no colorBy attribute, or sources
// lack the requested attribute). `colorBy` is the resolved config-slot value so
// the same palettizing drives both initial load and the interactive "Color
// samples by" menu.
export function maybeApplyColorByPalette(
  colorBy: string,
  sources: Source[],
): Source[] | undefined {
  if (!colorBy) {
    return undefined
  }
  if (sources.some(source => colorBy in source)) {
    return applyColorPalette(sources, colorBy)
  }
  warnMissingAttribute('colorBy', colorBy, sources)
  return undefined
}

// One spelling of "the config names an attribute the metadata doesn't have", for
// the two settings that take one. Silent on an empty source list: that is the
// pre-load state, not a bad config, and warning there printed an attribute list
// that was empty because there was nothing to list yet.
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

type SetSlotFn = (slotName: string, value: unknown) => void

// Config slots ported onto the *other* variant display's config when the
// user switches display type via the track menu (see getPortableSettings).
// `featureColor` is deliberately absent — it is ported separately, raw.
const PORTABLE_CONFIG_KEYS = [
  'renderingMode',
  'minorAlleleFrequencyFilter',
  'maxMissingnessFilter',
  'showRowLabels',
  'showTree',
  'showBranchLength',
  'referenceDrawingMode',
  'colorBy',
  'groupBy',
] as const

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

// Group sample rows by a metadata attribute (e.g. 'super_pop'), so every member
// of a group is contiguous and a group-restricted genotype pattern reads as a
// solid band instead of being scattered across the matrix. Groups are ordered by
// size (largest first) rather than alphabetically — the big groups are the ones
// carrying visible structure, and a stable size order keeps the figure the same
// across reruns. Sources missing the attribute sort last, in their original
// order. Sorting is stable within a group, so a prior arrangement survives.
export function sortSourcesByAttribute<S extends Record<string, unknown>>(
  sources: S[],
  attribute: string,
): S[] {
  const counts = new Map<string, number>()
  for (const source of sources) {
    const v = source[attribute]
    if (typeof v === 'string') {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  const rank = new Map<string, number>()
  const ordered = [...counts.entries()].sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
  )
  for (let i = 0; i < ordered.length; i++) {
    rank.set(ordered[i]![0], i)
  }
  return sources
    .map((source, idx) => {
      const v = source[attribute]
      return {
        source,
        idx,
        rank: typeof v === 'string' ? rank.get(v)! : ordered.length,
      }
    })
    .sort((a, b) => (a.rank === b.rank ? a.idx - b.idx : a.rank - b.rank))
    .map(d => d.source)
}

// Reorder by `groupBy` when the attribute is present, else leave the order
// alone. Mirrors maybeApplyColorByPalette: an unset or unknown attribute is a
// no-op rather than an error, so a config naming a column the metadata doesn't
// have degrades to ungrouped instead of breaking the display.
export function maybeApplyGroupBy<S extends Record<string, unknown>>(
  groupBy: string,
  sources: S[],
): S[] | undefined {
  if (!groupBy) {
    return undefined
  }
  if (sources.some(source => groupBy in source)) {
    return sortSourcesByAttribute(sources, groupBy)
  }
  warnMissingAttribute('groupBy', groupBy, sources)
  return undefined
}

// Apply the active colorBy palette and groupBy ordering in one pass: color
// first, then group the colored rows so a track can set both and get
// grouped-and-colored together. Returns `[]` when neither applies, the "no
// arrangement" layout. Its one caller is `applyArrangement`, which is in turn
// the one thing setSources / setColorBy / setGroupBy / clearLayout / setPhasedMode
// all arrange through — which is why none of them can drift (a recolor dropping
// an active grouping, a mode switch dropping the coloring).
function arrangeSources(
  colorBy: string,
  groupBy: string,
  sources: Source[],
): Source[] {
  const colored = maybeApplyColorByPalette(colorBy, sources)
  return maybeApplyGroupBy(groupBy, colored ?? sources) ?? colored ?? []
}

// Drop the palette colors a previous `colorBy` wrote, leaving order and every
// other per-row override in place. Applied only to layout rows: the adapter
// sources can carry a color of their own (a `color` column in samplesTsv),
// which is not ours to strip.
function stripPaletteColors(rows: Source[]): Source[] {
  return rows.map(({ color: _color, ...rest }) => rest)
}

// The slice `applyArrangement` drives. Structural so the helper can live beside
// `arrangeSources` rather than inside the actions block that calls it.
interface ArrangeableModel {
  sourcesVolatile: Source[] | undefined
  layout: Source[]
  setLayout: (layout: Source[]) => void
}

/**
 * Re-apply the active `colorBy` palette and `groupBy` ordering and persist the
 * result as the layout. The single implementation behind `setColorBy` and
 * `setGroupBy`.
 *
 * With an arrangement already on screen it re-arranges **that**, not adapter
 * order: re-deriving from `sourcesVolatile` made "Color by… → Population"
 * silently discard a clustering run or a hand-made order, and in phased mode
 * halve the row count, since `layout` there holds haplotype rows where
 * `sourcesVolatile` holds samples.
 *
 * Persists through the mixin's `setLayout`, never a direct `self.layout =`, so
 * a loaded dendrogram is dropped exactly when the rows really do move — a
 * recolor over an unchanged order now keeps its tree, and a regroup correctly
 * loses it.
 */
function applyArrangement(
  self: ArrangeableModel,
  colorBy: string,
  groupBy: string,
) {
  const sources = self.sourcesVolatile
  if (!sources) {
    return
  }
  if (self.layout.length === 0) {
    // Nothing arranged yet, so adapter order is the thing to arrange. `[]` —
    // what `arrangeSources` returns when neither axis applies — is the right
    // answer here: it *means* "no arrangement".
    self.setLayout(arrangeSources(colorBy, groupBy, sources))
    return
  }
  // Merge the layout back over the adapter metadata that the palette and the
  // grouping read (`layout` is only an ordering/override hint).
  // `renderingMode: 'alleleCount'` is "merge, don't expand further" — the
  // layout rows already carry whatever granularity they were built at.
  const current = getSources({
    sources,
    layout: self.layout,
    renderingMode: 'alleleCount',
  })
  const base = colorBy ? current : stripPaletteColors(current)
  const next = arrangeSources(colorBy, groupBy, base)
  // Neither axis applies — but there is an arrangement here, and clearing both
  // must not throw away the order the user is looking at.
  self.setLayout(next.length ? next : base)
}

// Regions to fetch + render, by mode. Regular mode draws each variant at its
// genomic position, so off-screen buffered features simply clip — use the
// half-screen-buffered regions for smooth scrolling. Matrix mode lays columns
// out by feature index across the *visible* width, so including buffered
// features would cram off-screen variants into the viewport and draw connector
// lines to off-screen genomic positions — use the visible regions only.
function fetchRegionsForMode(
  view: LinearGenomeViewModel,
  mode: 'regular' | 'matrix',
): { region: Region; displayedRegionIndex: number }[] {
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
 * `renderingMode`, `colorBy`, and `minorAlleleFrequencyFilter` are config slots
 * (see `SharedVariantConfigSchema`) read at runtime through `getConf` and
 * written through `self.configuration.setSlot` — they are NOT plain MST
 * properties. Set them in a track's `displays` array to change the default:
 * ```js
 * displays: [
 *   {
 *     type: 'LinearMultiSampleVariantMatrixDisplay',
 *     displayId: 'my-matrix',
 *     renderingMode: 'phased',
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
 */
export default function MultiSampleVariantBaseModelF(
  configSchema: SharedVariantConfigModel,
  cellDataMode: 'regular' | 'matrix',
) {
  return (
    types
      .compose(
        // Abstract base shared by both LinearMultiSampleVariantDisplay and
        // LinearMultiSampleVariantMatrixDisplay. The name below is borrowed from the
        // matrix subclass for historical reasons. `type` is `types.string`
        // (not a literal) because the base is never registered or instantiated
        // directly — the concrete subclass that composes this always overrides
        // `type` with its own literal, and a plain string keeps those subclass
        // models assignable to this base type. Don't rename the subclass `type`
        // literals — they appear in stored session snapshots.
        'LinearMultiSampleVariantMatrixDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        LegendMixin(),
        RowHeightMixin(),
        TreeSidebarMixin<Source>(),
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
          // trigger a run whose output is that mixin's state.
        }),
      )
      // Unknown keys in an old display snapshot (blockState, showTooltips, the
      // removed lengthCutoffFilter, display-instance height/heightOverride, a
      // pre-config-slot rowHeight) need no handling — MST drops them, and
      // length filtering is now a general jexl filter
      // (`jexl:get(feature,'end')-get(feature,'start')<N`).
      //
      // `jexlFilters` is the exception, because it held a live value: a session
      // saved before the rename carries the user's filters under it, and being
      // dropped is silent. Prefixed on the way in, since the property stores the
      // runtime form and the old one stored whatever the dialog was handed.
      .preProcessSnapshot((snap: Record<string, unknown>) => {
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
         * Ids of legend sections the user has individually closed (e.g.
         * 'genotypes' / 'group'); reset when the whole legend is re-shown.
         * Stays volatile where `showLegend` did not: this is which sections a
         * reader collapsed in one sitting, not how the track is configured.
         */
        dismissedLegendSections: [] as string[],
        /**
         * #volatile
         */
        contextMenuFeature: undefined as Feature | undefined,
        /**
         * #volatile
         */
        sourcesVolatile: undefined as Source[] | undefined,
        /**
         * #volatile
         */
        hoveredGenotype: undefined as
          | (Record<string, unknown> & { genotype: string; name: string })
          | undefined,
        /**
         * #volatile
         *
         * Single source of truth for fetched per-display data. hasPhased,
         * sampleInfo, and featuresVolatile are derived from this via getters
         * — fetchNeeded only needs to call setCellData(result).
         */
        cellData: undefined as CellDataResult | undefined,
      }))
      .actions(self => ({
        setCellData(data: CellDataResult | undefined) {
          self.cellData = data
        },
        setContextMenuFeature(feature?: Feature) {
          self.contextMenuFeature = feature
        },
      }))
      .views(self => ({
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
         * the worker and exposed as scalars (hasPhased/hasSecondaryAlt/
         * hasUnphased), and per-feature genotype info lives in the cell-data
         * featureGenotypeMap/featureData.
         */
        get featuresVolatile(): Feature[] | undefined {
          return self.cellData?.simplifiedFeatures.map(
            f => new SimpleFeature(f),
          )
        },
        /**
         * #getter
         */
        get hasPhased() {
          return self.cellData?.hasPhased ?? false
        },
        /**
         * #getter
         * Whether any called genotype is phased or haploid, which is what gates
         * the "Phased" rendering mode. Wider than `hasPhased` on purpose: the
         * painter's rule is `isPhasedOrHaploid` (no `/`), because a pangenome
         * callset is haploid per assembly path and `vg deconstruct` writes bare
         * `0`/`1`/`23` — a file with no `|` anywhere that phased mode renders
         * correctly. Gating the menu on `hasPhased` left that rendering
         * reachable only from the config slot.
         */
        get hasPhasedOrHaploid() {
          return self.cellData?.hasPhasedOrHaploid ?? false
        },
        /**
         * #getter
         * Whether any visible site is multiallelic (drives the "Other alt
         * allele" legend entry). Computed in the worker since the simplified
         * features sent to the client don't carry ALT.
         */
        get hasSecondaryAlt() {
          return self.cellData?.hasSecondaryAlt ?? false
        },
        /**
         * #getter
         * Whether any genotype call is unphased (drives the "Unphased" legend
         * entry in phased mode).
         */
        get hasUnphased() {
          return self.cellData?.hasUnphased ?? false
        },
        /**
         * #getter
         * Whether any genotype is a no-call (drives the "No call" legend entry
         * in phased mode; allele-count mode always shows it).
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
         * Height of the connector-line zone above the rows; 0 for a display that
         * draws variants at their genomic positions and needs no connectors. On
         * the config rather than a bespoke property for the same reason `height`
         * is (see TrackHeightMixin): a drag-resize outlives the display
         * instance, so unticking and reticking the track keeps the zone the user
         * set. LD declares the same slot and the same clamped `setConf` setter.
         */
        get lineZoneHeight(): number {
          return getConf(self, 'lineZoneHeight')
        },

        /**
         * #getter
         * Whether the variant lane — a `LinearVariantDisplay`-style strip of the
         * records themselves, above the genotype rows — is drawn.
         *
         * False here, and overridden by the display that paints one. The band
         * geometry (`topBands`) is shared because every display's rows sit below
         * whatever is stacked on them, but the *slots* live on the subclass that
         * honors them: a display reserving a band it never fills would take the
         * height from its rows and draw nothing there.
         */
        get showVariantLane(): boolean {
          return false
        },

        /**
         * #getter
         * Configured height of the variant lane. Raw: it is spent only while
         * `showVariantLane` is on, and the resolved value every consumer reads
         * is `topBands.laneHeight`. Overridden alongside `showVariantLane`, off
         * a config slot — a drag outlives the display instance, same as
         * `lineZoneHeight`.
         */
        get variantLaneHeight(): number {
          return DEFAULT_VARIANT_LANE_HEIGHT
        },

        /**
         * #getter
         * Which label kinds the variant lane asks for. Overridden alongside the
         * two above by the display that paints one; whether the band has ROOM
         * for them is plugin-canvas's fit ladder's answer, not this slot's —
         * `laneRenderedLabels` is what actually gets drawn.
         */
        get variantLaneLabels(): ShowLabelsMode {
          return 'none'
        },

        /**
         * #getter
         * The effective sample-grouping attribute (config default or runtime
         * override). Drives the sidebar row coloring and the legend's group
         * section; '' means no grouping.
         */
        get colorBy(): string {
          return getConf(self, 'colorBy')
        },
        /**
         * #getter
         * Sample-metadata attribute the rows are grouped (reordered) by; ''
         * leaves the existing order alone.
         */
        get groupBy(): string {
          return getConf(self, 'groupBy')
        },
        /**
         * #getter
         * Optional per-variant cell color (jexl string or CSS color) applied to
         * alt-carrying cells; '' means default genotype coloring. Reads the raw
         * config value directly (not `getConf`, which evaluates a `jexl:...`
         * string immediately with no `feature` bound) — this crosses the RPC
         * boundary as-is and is evaluated once per feature in the worker (see
         * `makeFeatureColor` in `executeVariantCellData.ts`).
         */
        get featureColor(): string {
          return self.configuration.featureColor
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
        // VCF-header field descriptions (INFO/FORMAT) are static per adapter, so
        // fetch once and reuse the promise — every feature-widget open otherwise
        // round-trips the worker just to re-read the same header. Cleared on
        // failure so a later click retries.
        let metadataPromise: Promise<unknown> | undefined
        return {
          /**
           * #action
           */
          fetchMetadataDescriptions() {
            if (!metadataPromise) {
              metadataPromise = getSession(self)
                // The VCF header, already parsed by the fetch that put the
                // variant on screen and memoized here so repeated clicks reuse
                // one round trip. Nothing to narrate, and nothing a cancel
                // could save — the widget opens on the result.
                // eslint-disable-next-line no-restricted-syntax
                .rpcManager.call(getRpcSessionId(self), 'CoreGetMetadata', {
                  adapterConfig: self.adapterConfig,
                })
                .catch((e: unknown) => {
                  metadataPromise = undefined
                  throw e
                })
            }
            return metadataPromise
          },
        }
      })
      .actions(self => {
        const { setShowLegend: superSetShowLegend } = self
        return {
          /**
           * #action
           */
          setJexlFilters(f?: string[]) {
            self.jexlFiltersSetting = cast(f)
          },
          /**
           * #action
           * The one override of `LegendMixin`'s setter: this display keeps a
           * per-section dismissed list, and re-showing the whole legend restores
           * the sections closed inside it. The slot write stays the mixin's.
           */
          setShowLegend(s: boolean) {
            superSetShowLegend(s)
            if (s) {
              self.dismissedLegendSections = []
            }
          },
          /**
           * #action
           * Close a single legend section (leaving the others visible).
           */
          dismissLegendSection(id: string) {
            self.dismissedLegendSections = [...self.dismissedLegendSections, id]
          },
          /**
           * #action
           */
          selectFeature(feature: Feature) {
            self
              .fetchMetadataDescriptions()
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
          setHoveredGenotype(
            arg?: Record<string, unknown> & { genotype: string; name: string },
          ) {
            self.hoveredGenotype = arg
          },
          /**
           * #action
           */
          setSources(sources: Source[]) {
            if (deepEqual(sources, self.sourcesVolatile)) {
              return
            }
            self.sourcesVolatile = sources
            // Apply the colorBy palette and groupBy ordering only when the user
            // hasn't already arranged the layout themselves.
            if (self.layout.length === 0) {
              applyArrangement(self, self.colorBy, self.groupBy)
            }
          },
          /**
           * #action
           * Recolor sample rows by a metadata attribute (e.g. 'population'), or
           * pass '' to clear the coloring. Persists the arrangement as the layout
           * and records the choice in the `colorBy` config slot so it survives a
           * data refetch and serializes into the session. Re-applies `groupBy` in
           * the same pass so recoloring doesn't drop an existing grouping, and
           * recolors the rows in place (see `applyArrangement`) so it doesn't drop
           * an existing order either.
           */
          setColorBy(colorBy: string) {
            setConf(self, 'colorBy', colorBy)
            applyArrangement(self, colorBy, self.groupBy)
          },
          /**
           * #action
           * Reorder sample rows so each value of a metadata attribute (e.g.
           * 'population') is contiguous, or pass '' to clear the grouping.
           * Persists the arrangement as the layout and records the choice in the
           * `groupBy` config slot so it survives a data refetch and serializes
           * into the session. Re-applies `colorBy` in the same pass so grouping
           * doesn't drop an existing palette.
           */
          setGroupBy(groupBy: string) {
            setConf(self, 'groupBy', groupBy)
            applyArrangement(self, self.colorBy, groupBy)
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
              // allele-count mode, "HG001 HP0" haplotype names in phased — so the
              // layout, the tree built from it, and the subtree filter naming that
              // tree's leaves all go stale together. The filter is otherwise
              // independent of the tree (`filterRowsBySubtree` keys on `name` and
              // needs no tree, so a reorder leaves it perfectly valid); this is the
              // one action that renames the rows out from under it, and leaving it
              // set here matched nothing and blanked the display.
              //
              // Same reset as `clearLayout`, so the configured `colorBy` palette
              // and `groupBy` order come back on the new row names. Clearing
              // without re-arranging dropped the row coloring on every mode
              // switch while the menu still showed it checked — nothing else
              // re-seeds `layout` (`setSources` fires once per adapter).
              self.clearLayout()
            }
          },
          /**
           * #action
           * Enable fit-to-display-height mode: `rowHeight = 0` makes
           * `effectiveRowHeight` divide `availableHeight` across the rows.
           */
          setFitToHeight() {
            setConf(self, 'rowHeight', 0)
            self.scrollTop = 0
          },
          /**
           * #action
           * Drag-resize the track. In fit-to-display-height mode the new height
           * flows straight into `autoRowHeight`, so the rows stretch with the
           * drag. With a fixed `rowHeight` the rows keep the size the user
           * chose and the drag reveals more of them — scaling that value by the
           * same ratio instead would keep content and viewport locked together,
           * so dragging a track taller could not show one extra sample.
           */
          resizeHeight(distance: number) {
            const oldHeight = self.height
            const newHeight = Math.max(oldHeight + distance, MIN_DISPLAY_HEIGHT)
            setConf(self, 'height', newHeight)
            return newHeight - oldHeight
          },
          /**
           * #action
           */
          setReferenceDrawingMode(arg: string) {
            setConf(self, 'referenceDrawingMode', arg)
          },
          /**
           * #action
           * Set the per-variant cell color override (jexl string or CSS color), or
           * '' to restore default genotype coloring. A fetch input — recomputes
           * cells in the worker.
           */
          setFeatureColor(arg: string) {
            setConf(self, 'featureColor', arg)
          },
        }
      })
      .actions(self => {
        const superClearLayout = self.clearLayout
        return {
          /**
           * #action
           * Restore the configured default arrangement. The mixin's
           * `clearLayout` empties the layout and drops the tree plus the subtree
           * filter that named its leaves; with no layout left, `applyArrangement`
           * re-derives from adapter order — the same thing it does on first
           * load, so a reset and a fresh load can't come out different.
           */
          clearLayout() {
            superClearLayout()
            applyArrangement(self, self.colorBy, self.groupBy)
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
         * Distinct sample-metadata attributes (from samplesTsv) the user can
         * color rows by — every key the sources carry except internal plumbing.
         */
        get colorByAttributes(): string[] {
          const sources = self.sourcesVolatile
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

        // Four views on the source list, each with a different consumer:
        //
        // - sourcesWithoutLayout: adapter order, phased-expanded, no subtree
        //   filter. Used by clustering dialogs and sortByGenotype.
        // - sourcesBase: layout-ordered, subtree-filtered, NOT phased-expanded.
        //   Used by rpcProps — must not read sampleInfo (which is fetch-result-
        //   derived; reading it would loop SettingsInvalidate).
        // - sources: rendering view — sourcesBase + phased expansion (reads
        //   sampleInfo). Subtree-filtered, so only visible rows show up.
        // - editableSources: dialog view — like `sources` but without the
        //   subtree filter, so submit doesn't wipe filtered samples from
        //   `layout`.
        get sourcesWithoutLayout() {
          return self.sourcesVolatile
            ? getSources({
                sources: self.sourcesVolatile,
                renderingMode: self.renderingMode,
                sampleInfo: self.sampleInfo,
              })
            : undefined
        },
        get sourcesBase() {
          if (!self.sourcesVolatile) {
            return undefined
          }
          const base = getSources({
            sources: self.sourcesVolatile,
            layout: self.layout.length ? self.layout : undefined,
            renderingMode: 'alleleCount',
          })
          // filterRowsBySubtree keys on `name`, not `sampleName`: phased
          // clustering stores haplotype names ("HG001 HP0") as tree leaves and
          // that is what subtreeFilter holds.
          return filterRowsBySubtree(base, self.subtreeFilter)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The display rows: `sourcesBase` expanded for phased rendering when
         * sampleInfo is available. Sources already carrying HP (from clustering)
         * pass through unchanged.
         *
         * **Resolved — an array, never `undefined`**, which is the shared
         * spelling across the row displays (canvas's multi-row painting and
         * multi-wiggle already answered this way). `sourcesVolatile` and
         * `sourcesBase` keep their `undefined`, because there it is genuinely
         * load-bearing: `sampleFilter` and `fetchNeeded` both read
         * `sourcesBase`, and its `undefined` → list transition is what wakes the
         * fetch autorun (ARCHITECTURE.md §"The global-fetch trigger list must
         * be read unconditionally"). Nothing reads
         * *this* getter for that — every consumer immediately collapsed the
         * absent case with `?.length`, `?? []` or `?? 0`, so the option was
         * about eighteen defensive reads and no decision.
         */
        get sources(): ProcessedSource[] {
          const base = self.sourcesBase
          if (!base) {
            return []
          }
          const sampleInfo = self.sampleInfo
          if (self.renderingMode !== 'phased' || !sampleInfo) {
            return base
          }
          return expandSourcesToHaplotypes({ sources: base, sampleInfo })
        },
        /**
         * #getter
         * Layout-merged, phased-expanded view for the Edit Color/Arrangement
         * dialog. Does NOT apply the subtree filter — submitting the dialog
         * persists every row it was shown back to `layout`, so a filtered list
         * would submit the focused clade as the whole order and leave every
         * other sample appended after it. Same reason the other row displays'
         * `editableSources` sit upstream of `filterRowsBySubtree`.
         */
        get editableSources() {
          if (!self.sourcesVolatile) {
            return undefined
          }
          return getSources({
            sources: self.sourcesVolatile,
            layout: self.layout.length ? self.layout : undefined,
            renderingMode: self.renderingMode,
            sampleInfo: self.sampleInfo,
          })
        },
        /**
         * #getter
         * Whether the fetched inputs clustering needs are present yet. Phased
         * clustering clusters haplotypes, which needs per-sample ploidy from
         * `sampleInfo`; that arrives with `cellData`, later than the header-only
         * `sourcesVolatile`. Gating the auto-cluster run on this (not just
         * `sourcesVolatile`) stops it racing ahead and building a sample-level
         * tree whose leaves ("HG001") never match the expanded haplotype rows
         * ("HG001 HP0").
         */
        get clusteringReady() {
          return (
            !!self.sourcesVolatile &&
            (self.renderingMode !== 'phased' || !!self.sampleInfo)
          )
        },
        /**
         * #getter
         * Whether there is anything to cluster: clustering reorders rows, so it
         * needs at least two rows to put in an order. Undefined is not "none" —
         * it is the sample list not having landed yet — but both mean "not
         * now", which is why one boolean answers for both and the menu's help
         * text asks `sourcesWithoutLayout` itself which of the two it is.
         *
         * The unfiltered, haplotype-expanded list, because that is the row set
         * the tree comes back describing.
         */
        get hasClusterableRows() {
          const rows = self.sourcesWithoutLayout
          return rows !== undefined && rows.length > 1
        },
        /**
         * #getter
         * Whether the declarative `runClustering: true` path may fire: the
         * inputs have landed AND there are rows worth ordering. Both halves are
         * named booleans rather than one expression at the autorun, so each can
         * be read — and tested — on its own.
         *
         * The dialog gates on `clusteringReady` alone and needs no second half:
         * the menu row that opens it carries `hasClusterableRows`, so it cannot
         * be opened on a cohort too small to cluster in the first place.
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
         * a fetch input here; ARCHITECTURE.md §"Row order is not a fetch input",
         * has the why and how the three row displays each do it.
         *
         * Two local rules:
         *
         * - `undefined` means the sources haven't loaded, and is deliberately not
         *   reused for "all of them". `fetchNeeded` declines until `sourcesBase`
         *   exists and this key changing is the only thing that wakes it, so
         *   collapsing the two would leave it unchanged when sources landed and
         *   wedge the display with nothing drawn.
         * - Deduped because after a phased clustering run `sourcesBase` is
         *   haplotype-level, listing a sample once per haplotype. The worker
         *   takes samples and expands them itself, so a key that moved with
         *   ploidy would refetch on a rendering-mode round trip that changed no
         *   sample.
         *
         * Reads `sourcesBase`, never `sources`, for the loop reason below.
         */
        get sampleFilter(): string[] | undefined {
          const base = self.sourcesBase
          return base && [...new Set(base.map(s => s.sampleName))].sort()
        },
      }))
      .views(self => ({
        // Payload for MultiSampleVariantGetCellData. SettingsInvalidate watches
        // this — any change clears loaded data and triggers a refetch.
        //
        // Only settings the *worker* reads belong here, and nothing fetch-derived
        // may appear (`sampleFilter` reads `sourcesBase`, not `sources`, because
        // `sources` reads `sampleInfo` — a fetch result — and would loop).
        // `referenceDrawingMode` is deliberately absent: it changes the shipped
        // cells in regular mode (computeVariantCells drops reference cells when
        // 'skip'), so that display adds it back via super-capture, but the matrix
        // computes ref cells unconditionally and greys its background in CSS
        // instead.
        rpcProps() {
          return {
            sampleFilter: self.sampleFilter,
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            maxMissingnessFilter: self.maxMissingnessFilter,
            filters: self.filters,
            renderingMode: self.renderingMode,
            featureColor: self.featureColor,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Row name -> source, for the hover tooltip. A Map for the same reason
         * `getSources`' is: row names come from the file, and on a plain object
         * a sample called `constructor` resolves to something inherited rather
         * than to a miss.
         */
        get sourceMap() {
          return new Map(self.sources.map(source => [source.name, source]))
        },
        /**
         * #getter
         * sampleName -> column index into each feature's interned
         * `genotypeCodes`. Rebuilt only when cellData changes. Used by the
         * tooltips to decode a hovered cell's genotype (see genotypeCodec.ts).
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
         * worker's own `rowNames` list; this is what turns that into the row the
         * user is looking at, and rebuilding it is all a reorder costs.
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
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Screen row -> worker row, the inverse of `rowRemap`; `-1` for a screen
         * row this window's data has no cells for (a sample the layout draws but
         * whose genotypes never appear in the fetched variants).
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
         * Fills `BaseDisplay`'s cross-display hover hook with the genotype cell
         * under the pointer, so the view's `session.hovered` channel sees this
         * display like every other one.
         */
        get hoveredFeature() {
          return self.hoveredGenotype
        },
        /**
         * #getter
         * The hovered thing as the tooltip table reads it: the record's fields,
         * with the hovered sample row's metadata attributes merged underneath
         * them so a cohort colored by a `samplesTsv` column reports that column
         * too.
         *
         * A hover naming no row falls through to the record's fields alone, and
         * that is the variant lane's whole tooltip: its marks are records, so
         * `buildVariantLaneHit` leaves `name` empty precisely so there is no
         * source to find here. A *cell* hover always finds one — both hit tests
         * take the name off `sources`, which is what `sourceMap` is built from.
         */
        get hoveredTooltipSource() {
          const { hoveredGenotype, sourceMap } = self
          if (!hoveredGenotype) {
            return undefined
          }
          const source = sourceMap.get(hoveredGenotype.name)
          return source ? { ...source, ...hoveredGenotype } : hoveredGenotype
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Order the rows by their genotype at one variant, breaking ties by how
         * far each row agrees with its neighbours to either side of it. The
         * flanking tiebreak is what makes the local haplotype structure legible:
         * rows sharing the anchor allele sit together, and their shared block
         * frays outward at the recombination breakpoints that end it.
         *
         * Sorts the rows that are already on screen, so the palette color,
         * label and labelColor ride along and nothing has to be merged back.
         * Sorting adapter metadata instead discarded all three: **Color by… →
         * Population** then **Sort by genotype** reordered correctly and
         * blanked every sidebar swatch, with the menu still showing Population
         * ticked. Nothing re-seeds the palette afterwards — `setSources`
         * short-circuits on `deepEqual`, and `applyArrangement` is reachable
         * only from `setColorBy` / `setGroupBy` / `clearLayout` /
         * `setPhasedMode`.
         */
        sortByGenotype(featureId: string) {
          const { cellData } = self
          // `editableSources`, so the rows arrive already carrying the layout's
          // colors and labels and already at the rendering mode's granularity.
          // Merging a fresh order back against `layout` by name cannot work in
          // phased mode — the sorted rows are haplotypes ("S0 HP0") and the
          // layout is sample-level, so nothing matched and every swatch went
          // blank. Not subtree-filtered, so a hidden row keeps its overrides
          // instead of being dropped from `layout` for good.
          const sources = self.editableSources
          if (cellData && sources) {
            const { featureIds, genotypeCodesByFeatureId } =
              getOrderedGenotypeCodes(cellData)
            const sorted = sortSourcesAroundVariant({
              sources,
              sampleNames: cellData.sampleNames,
              genotypeDict: cellData.genotypeDict,
              featureIds,
              genotypeCodesByFeatureId,
              anchorFeatureId: featureId,
              phased: self.renderingMode === 'phased',
            })
            if (sorted) {
              self.setLayout(sorted)
            }
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
          contextMenuItems(): MenuItem[] {
            return variantContextMenuItems(self as MultiSampleVariantBaseModel)
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * Whether the sidebar rows draw their sample NAME, as opposed to the
         * bare color swatch `SvgSampleRowLabels` falls back to (and which stays
         * drawn either way — below the threshold the tint is the only thing
         * carrying row identity on a cohort track).
         *
         * `rowLabelsCarryText`, not a re-typed `>= 6`: the constant behind it is
         * exported precisely so each caller does not restate the comparison, and
         * restating it is how the answer drifts — tree-sidebar records
         * multi-wiggle doing exactly that. These displays render their own label
         * component rather than tree-sidebar's `SvgRowLabels`, which is what let
         * a second copy of the threshold live here at all; the question is still
         * the one shared question.
         */
        get canDisplayLabels() {
          return (
            rowLabelsCarryText(self.effectiveRowHeight) && self.showRowLabels
          )
        },
        /**
         * #getter
         */
        get totalHeight() {
          return self.effectiveRowHeight * self.nrow
        },
        /**
         * #getter
         * Max valid `scrollTop`: how far the rows can scroll before the bottom
         * row reaches the viewport floor. Zero when the rows fit — which auto-fit
         * mode always does, since `effectiveRowHeight` derives from
         * `availableHeight`. `scrollableHeight > 0` is therefore also the "does
         * this display scroll" answer; both displays scroll virtually (fixed
         * canvas + VerticalScrollbar overlay), so there is no native overflow
         * container to gate separately.
         */
        get scrollableHeight() {
          return Math.max(0, this.totalHeight - self.availableHeight)
        },
        /**
         * #method
         * Called by BaseTrackModel.replaceDisplay when switching between the
         * regular and matrix variant displays. The config-slot settings
         * (colorBy, renderingMode, etc.) now live on each display's own
         * config-schema node rather than a display-instance override map, so
         * porting them means writing directly into the *target* display's
         * config (via setSlot) rather than spreading them into the new
         * display's instance snapshot — hence the `newDisplayId` param. Only
         * genuine display-instance state (not config-backed) is returned for
         * the instance-snapshot spread.
         */
        getPortableSettings(newDisplayId?: string) {
          if (newDisplayId) {
            const displays = getContainingTrack(self).configuration
              .displays as { displayId: string; setSlot: SetSlotFn }[]
            const target = displays.find(d => d.displayId === newDisplayId)
            if (target) {
              for (const key of PORTABLE_CONFIG_KEYS) {
                target.setSlot(key, getConf(self, key))
              }
              // Raw, never through getConf: featureColor can hold a `jexl:...`
              // string, and getConf evaluates one on read with no `feature`
              // bound — so the consequence-impact preset
              // (`jexl:impactColor(feature)`) threw out of the display-type
              // switch instead of carrying the expression across.
              target.setSlot('featureColor', self.featureColor)
            }
          }
          return {
            jexlFiltersSetting: self.jexlFiltersSetting,
            clusterTree: self.clusterTree,
            treeAreaWidth: self.treeAreaWidth,
            layout: self.layout,
            height: self.height,
          }
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
         * Matrix mode draws columns by feature index across the full width, so
         * the set of features belongs to the visible region at the *current*
         * zoom — zooming in/out changes which features show even when the
         * viewport stays spatially inside loaded data, so cached cells at a
         * different bpPerPx are stale (wiggle uses the same strict-zoom rule,
         * adr-008). Regular mode draws each variant at its genomic position, so
         * spatial coverage alone suffices and the empty key holds every region
         * a fetch has loaded.
         *
         * A getter, not an action: as an action MobX untracks the `bpPerPx`
         * read and `FetchVisibleRegions` keeps a stale answer
         * (`isCacheValidTracking.test.ts`).
         */
        get regionFetchKey(): string {
          return cellDataMode === 'matrix' ? String(self.lgv.bpPerPx) : ''
        },

        /**
         * #getter
         * The insertion marker's color when this display is drawing insertion
         * markers, else undefined — which is what keeps the marker out of the
         * legend it does not appear in.
         *
         * Declared here, answering undefined, so `legendSections` below can be
         * written once: the matrix display draws no markers at all, and the
         * regular display overrides this with the theme color when its
         * `showInsertionGlyphs` slot is on and something visible actually
         * inserts bases. A gate the base owns and a subclass overrides, rather
         * than a flag threaded through every caller.
         */
        get insertionLegendColor(): string | undefined {
          return undefined
        },
      }))
      .views(self => ({
        /**
         * #method
         * Legend split into independently-closable sections: the genotype/cell
         * coloring and (when colorBy is set) the sample-grouping coloring shown
         * on the sidebar row labels. Dismissed sections are filtered out.
         *
         * `insertionColor` repaints the marker swatch without touching *whether*
         * one is shown — that stays `insertionLegendColor`'s answer, which is the
         * painter's own test on the painter's own blocks. Only the SVG export
         * passes it, and it has to: the export draws its glyphs with the palette
         * of the theme the user picked in the export dialog rather than the live
         * session's (the rule plugin-maf's export follows too), so a session that
         * themes `palette.insertion` would otherwise key an export in one color
         * and draw it in another.
         */
        legendSections(insertionColor?: string): LegendSection[] {
          const drawnColor = self.insertionLegendColor
          return getVariantLegendSections({
            renderingMode: self.renderingMode,
            hasSecondaryAlt: self.hasSecondaryAlt,
            hasUnphased: self.hasUnphased,
            hasNoCall: self.hasNoCall,
            featureColor: self.featureColor,
            svTypeColors: self.svTypeColors,
            colorBy: self.colorBy,
            sources: self.sources,
            insertionColor:
              drawnColor === undefined
                ? undefined
                : (insertionColor ?? drawnColor),
          }).filter(s => !self.dismissedLegendSections.includes(s.id))
        },

        /**
         * #getter
         * Retry here is two-stage: the sources autorun reads the same
         * `reloadCounter` bump `reload()` makes for the region fetch, and
         * `fetchNeeded` below declines until `sourcesBase` lands. So the retry
         * contract is judged on the run that follows, not on the declining one
         * — see `FetchMixin.awaitingPrerequisite`.
         *
         * Strictly narrower than the declines it explains, which is what makes it
         * a deferral rather than an opt-out: `FetchVisibleRegions` also declines
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
        // `setScrollTop` and the re-clamp autorun are TrackHeightMixin's, earned
        // by overriding `scrollableHeight` above — the matrix display has no DOM
        // overflow container to self-correct a stranded offset.

        clearDisplaySpecificData() {
          // hasPhased / sampleInfo / featuresVolatile are derived from cellData
          // via getters, so clearing cellData clears all of them.
          self.cellData = undefined
        },

        // Ignores `needed` and refetches all visible regions because the
        // cellData RPC payload is monolithic — one call returns data covering
        // all visible regions, so partial refetches don't fit. That is why the
        // region list is `fetchRegionsBatched`'s argument: the set this display
        // derives is both what the RPC is sent and what the commits name.
        async fetchNeeded(
          _needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          if (self.isMinimized || !self.sourcesBase) {
            return
          }
          const view = self.lgv
          const regions = fetchRegionsForMode(view, cellDataMode)
          if (regions.length === 0) {
            return
          }
          // Resolved before the await, so the RPC sends exactly what
          // `fetchNeeded` is about to mark loaded — no second view read across
          // the async boundary.
          const rpcProps = self.rpcProps()
          const { adapterConfig } = self
          // One RPC serves every region, so the whole batch is held or none of
          // it is, and `fetchRegionsBatched` marks them loaded together.
          await fetchRegionsBatched(self, regions, {
            call: (batch, ctx) =>
              ctx.callRpc('MultiSampleVariantGetCellData', {
                adapterConfig,
                regions: batch.map(r => r.region),
                displayedRegionIndices: batch.map(r => r.displayedRegionIndex),
                // Passed at the call rather than through `rpcProps()`: it
                // swings at the 20kb span tier and would otherwise be an RPC
                // cache key — see REGION_TOO_LARGE.md §"How the verdict is
                // built".
                byteLimit: self.resolvedByteLimit(),
                ...rpcProps,
                // bound at factory call time, per subclass
                mode: cellDataMode,
              }),
            commit: result => {
              self.setCellData(result)
            },
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Fills `BaseDisplay`'s hover-clear hook, which the fetch
         * foundation's reaction calls on every viewport change.
         *
         * The matrix is a sticky canvas, so a pan, a zoom or an internal
         * wheel-scroll fires no mousemove and no mouseleave, and
         * `hoveredGenotype` goes on naming a cell that has moved out from under
         * the pointer — the tooltip then reports another sample's genotype at
         * the cursor. `useVariantCanvasInteraction` only covers the cases where
         * the *pointer* moves.
         */
        clearHoveredFeature() {
          self.setHoveredGenotype(undefined)
        },

        afterAttach() {
          // Clear the hovered cell when the viewport moves under a stationary
          // cursor. The matrix is a sticky canvas, so a pan, a zoom or an
          // internal wheel-scroll fires no mousemove and no mouseleave, and
          // `hoveredGenotype` goes on naming a cell that has moved out from
          // under the pointer — the tooltip then reports another sample's
          // genotype at the cursor. `useVariantCanvasInteraction` only covers
          // the cases where the *pointer* moves, and `scrollTop` is the axis
          // where this shows worst, since the highlight derived from the hover
          // does follow the row and visibly separates from the tooltip.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const { setupMultiSampleVariantAutoruns } =
                await import('./setupMultiSampleVariantAutoruns.ts')
              if (!isAlive(self)) {
                return
              }
              setupMultiSampleVariantAutoruns(self)
            } catch (e) {
              if (isAlive(self)) {
                console.error(e)
                getNotificationSink(self).notifyError(`${e}`, e)
              }
            }
          })()
        },
      }))
  )
}

export type MultiSampleVariantBaseStateModel = ReturnType<
  typeof MultiSampleVariantBaseModelF
>
export type MultiSampleVariantBaseModel =
  Instance<MultiSampleVariantBaseStateModel>
