import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  SimpleFeature,
  clamp,
  getContainingTrack,
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  addDisposer,
  cast,
  getEnv,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import {
  TreeSidebarMixin,
  applyColorPalette,
  buildSpatialIndex,
  computeClusterHierarchy,
} from '@jbrowse/tree-sidebar'
import deepEqual from 'fast-deep-equal'
import { autorun } from 'mobx'

import {
  GENOTYPE_SPLITTER,
  INTERNAL_SOURCE_KEYS,
  VARIANT_FEATURE_WIDGET,
} from './constants.ts'
import { buildSampleIndex, decodeGenotypes } from './genotypeCodec.ts'
import { expandSourcesToHaplotypes, getSources } from './getSources.ts'
import {
  variantContextMenuItems,
  variantShowSubmenuItems,
  variantTrackMenuItems,
} from './multiSampleVariantMenuItems.ts'
import { getVariantLegendSections } from './variantLegend.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { SharedVariantConfigModel } from './SharedVariantConfigSchema.ts'
import type { ProcessedSource, Source } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region, RpcStatus } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  ByteEstimateConfig,
  FetchContext,
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
  console.warn(
    `colorBy attribute "${colorBy}" not found in sample metadata. ` +
      `Available attributes: ${Object.keys(sources[0] ?? {}).join(', ')}`,
  )
  return undefined
}

type SetSlotFn = (slotName: string, value: unknown) => void

// Config slots ported onto the *other* variant display's config when the
// user switches display type via the track menu (see getPortableSettings).
const PORTABLE_CONFIG_KEYS = [
  'renderingMode',
  'minorAlleleFrequencyFilter',
  'maxMissingnessFilter',
  'showSidebarLabels',
  'showTree',
  'showBranchLength',
  'referenceDrawingMode',
  'colorBy',
  'groupBy',
  'featureColor',
] as const

function encodeGenotype(gt: string) {
  const alleles = gt.split(GENOTYPE_SPLITTER)
  let nonRefCount = 0
  let uncalledCount = 0
  for (const allele of alleles) {
    if (allele === '.') {
      uncalledCount++
    } else if (allele !== '0') {
      nonRefCount++
    }
  }
  return uncalledCount === alleles.length ? -1 : nonRefCount
}

// Sort `sources` by per-sample genotype, descending (more non-ref alleles
// first). Sources in phased mode carry haplotype-keyed `name` (e.g.
// "HG001 HP0"); the genotype map is keyed by sample name, so look up via
// `sampleName` rather than `name`. A missing genotype ranks -1 (last), matching
// a fully-uncalled call. Rank is computed once per source (not per comparison)
// so the comparator doesn't re-split genotype strings O(S·logS) times.
export function sortSourcesByGenotype(
  sources: ProcessedSource[],
  genotypes: Record<string, string>,
): ProcessedSource[] {
  return sources
    .map(source => {
      const gt = genotypes[source.sampleName]
      return { source, rank: gt === undefined ? -1 : encodeGenotype(gt) }
    })
    .sort((a, b) => b.rank - a.rank)
    .map(d => d.source)
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
  console.warn(
    `groupBy attribute "${groupBy}" not found in sample metadata. ` +
      `Available attributes: ${Object.keys(sources[0] ?? {}).join(', ')}`,
  )
  return undefined
}

// Apply the active colorBy palette and groupBy ordering in one pass, the shared
// arrangement every layout-resetting action wants: color first, then group the
// colored rows so a track can set both and get grouped-and-colored together.
// Returns `[]` when neither applies, the "no arrangement" layout. Keeping this
// in one place is why setSources/setColorBy/setGroupBy/clearLayout can't drift
// apart (e.g. recoloring silently dropping an active grouping).
function arrangeSources(
  colorBy: string,
  groupBy: string,
  sources: Source[],
): Source[] {
  const colored = maybeApplyColorByPalette(colorBy, sources)
  return maybeApplyGroupBy(groupBy, colored ?? sources) ?? colored ?? []
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
      },
      displayedRegionIndex: vr.displayedRegionIndex,
    }))
  }
  return view.bufferedVisibleRegions
}

// Module-local helper for the variant cell data RPC call. Takes the resolved
// rpcProps object (rather than `self`) so TS infers the payload shape from
// the model's rpcProps view without a structural cast. `mode` comes from the
// per-subclass cellDataMode that's bound at factory call time. `regions` is the
// already-resolved fetch set so the RPC fetches exactly what fetchNeeded marked
// as loaded (no second view read across the async boundary).
async function callMultiSampleVariantCellData(args: {
  node: IAnyStateTreeNode
  adapterConfig: AnyConfigurationModel
  regions: { region: Region; displayedRegionIndex: number }[]
  rpcProps: {
    sources: ProcessedSource[]
    minorAlleleFrequencyFilter: number
    maxMissingnessFilter: number
    filters?: SerializableFilterChain
    renderingMode: string
    referenceDrawingMode: string
    featureColor: string
  }
  mode: 'regular' | 'matrix'
  statusCallback: (status: RpcStatus) => void
  ctx: FetchContext
}): Promise<CellDataResult> {
  const { node, adapterConfig, regions, rpcProps, mode, statusCallback, ctx } =
    args
  const sessionId = getRpcSessionId(node)
  return getSession(node).rpcManager.call(
    sessionId,
    'MultiSampleVariantGetCellData',
    {
      regions: regions.map(r => r.region),
      displayedRegionIndices: regions.map(r => r.displayedRegionIndex),
      ...rpcProps,
      mode,
      adapterConfig,
      stopToken: ctx.stopToken,
      statusCallback,
    },
  )
}

function getGenotypeMapForFeature(
  cellData: CellDataResult | undefined,
  featureId: string,
) {
  if (cellData) {
    if (cellData.mode === 'regular') {
      for (const regionData of Object.values(cellData.perRegionCellData)) {
        const result = regionData.featureGenotypeMap[featureId]
        if (result) {
          return result
        }
      }
      return undefined
    }
    return cellData.featureData.find(f => f.featureId === featureId)
  }
  return undefined
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
 * `LinearGenomeView`'s `init`: set it to run the real "Cluster by genotype"
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
        TreeSidebarMixin<Source>(),
        types.model({
          type: types.string,
          configuration: ConfigurationReference(configSchema),
          // Raw per-row height in px; `0` means fit-to-display-height (rows
          // divide the available height). The resolved value is the
          // `effectiveRowHeight` getter — consumers read that, never this.
          rowHeight: types.stripDefault(types.number, 0),
          jexlFilters: types.stripDefault(
            types.maybe(types.array(types.string)),
            undefined,
          ),
          lineZoneHeight: types.stripDefault(types.number, 0),
          // Transient declarative launch spec, same idea as LinearGenomeView's
          // `init`: session/config sets this to run the real "Cluster by
          // genotype" RPC once automatically (no dialog), applied by
          // getMultiSampleVariantClusterAutorun and cleared afterwards so a
          // saved session never re-triggers it.
          runClustering: types.maybe(types.boolean),
        }),
      )
      // Legacy props from old BaseLinearDisplay snapshots (blockState,
      // showTooltips, the removed lengthCutoffFilter, display-instance
      // height/heightOverride) need no handling — MST drops unknown snapshot
      // keys, and length filtering is now a general jexl filter
      // (`jexl:get(feature,'end')-get(feature,'start')<N`).
      .volatile(() => ({
        /**
         * #volatile
         */
        showLegend: true,
        /**
         * #volatile
         * Ids of legend sections the user has individually closed (e.g.
         * 'genotypes' / 'group'); reset when the whole legend is re-shown.
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
        // bpPerPx the current cellData was fetched at. Matrix mode lays columns
        // out by feature index across the full width, so the displayed feature
        // set is the visible region at *this* zoom; a zoom change invalidates
        // the cache even when the viewport is still spatially covered. See the
        // isCacheValid override below.
        loadedBpPerPx: undefined as number | undefined,
        // Bumped by reload() to retrigger the sources autorun. Sources is a
        // one-shot fetch (per adapter, not per viewport), so it doesn't go
        // through FetchMixin and can't watch fetchGeneration — that would
        // refetch sources on every viewport change. This counter is its
        // dedicated user-reload signal.
        reloadCount: 0,
        pendingClusterTree: undefined as string | undefined,
      }))
      .actions(self => ({
        setCellData(data: CellDataResult | undefined) {
          self.cellData = data
          if (self.pendingClusterTree !== undefined) {
            self.clusterTree = self.pendingClusterTree
            self.pendingClusterTree = undefined
          }
        },
        setContextMenuFeature(feature?: Feature) {
          self.contextMenuFeature = feature
        },
        setLoadedBpPerPx(bpPerPx: number | undefined) {
          self.loadedBpPerPx = bpPerPx
        },
      }))
      .views(self => ({
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
         * #getter
         * Returns the rendering mode config slot value
         */
        get renderingMode(): string {
          return getConf(self, 'renderingMode')
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
      // MultiRegionDisplayMixin: it's enabled automatically because
      // getByteEstimateConfig() below returns a config (the pre-flight captures
      // the estimate and short-circuits the download server-side; afterAttach
      // clears the estimate on chromosome nav). Byte-only — no density axis.
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
      .actions(self => ({
        /**
         * #action
         */
        setJexlFilters(f?: string[]) {
          // normalize empty to undefined so the field has a single stripped state
          self.jexlFilters = f?.length ? cast(f) : undefined
        },
        /**
         * #action
         */
        setShowLegend(s: boolean) {
          self.showLegend = s
          // Re-showing the legend restores any individually-closed sections.
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
              getSession(self).notifyError(`${e}`, e)
            })
        },
        /**
         * #action
         */
        setRowHeight(arg: number) {
          self.rowHeight = arg
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
            const next = arrangeSources(self.colorBy, self.groupBy, sources)
            if (next.length) {
              self.layout = next
            }
          }
        },
        /**
         * #action
         * Recolor sample rows by a metadata attribute (e.g. 'population'), or
         * pass '' to clear the coloring. Persists the arrangement as the layout
         * and records the choice in the `colorBy` config slot so it survives a
         * data refetch and serializes into the session. Re-applies `groupBy` in
         * the same pass so recoloring doesn't drop an existing grouping.
         */
        setColorBy(colorBy: string) {
          self.configuration.setSlot('colorBy', colorBy)
          const sources = self.sourcesVolatile
          if (sources) {
            self.layout = arrangeSources(colorBy, self.groupBy, sources)
          }
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
          self.configuration.setSlot('groupBy', groupBy)
          const sources = self.sourcesVolatile
          if (sources) {
            self.layout = arrangeSources(self.colorBy, groupBy, sources)
          }
        },
        /**
         * #action
         * Restore the configured default arrangement — empties the layout
         * and clears the cluster tree, then re-applies the `colorBy` palette
         * if one is configured. Overrides the mixin's `clearLayout` so the
         * user gets the same starting state they had on initial load.
         */
        clearLayout() {
          self.clusterTree = undefined
          const sources = self.sourcesVolatile
          self.layout = sources
            ? arrangeSources(self.colorBy, self.groupBy, sources)
            : []
        },
        /**
         * #action
         */
        setMafFilter(arg: number) {
          self.configuration.setSlot('minorAlleleFrequencyFilter', arg)
        },
        /**
         * #action
         */
        setMaxMissingnessFilter(arg: number) {
          self.configuration.setSlot('maxMissingnessFilter', arg)
        },
        setShowSidebarLabels(arg: boolean) {
          self.configuration.setSlot('showSidebarLabels', arg)
        },
        setShowTree(arg: boolean) {
          self.configuration.setSlot('showTree', arg)
        },
        setShowBranchLength(arg: boolean) {
          self.configuration.setSlot('showBranchLength', arg)
        },
        // Sets `layout` and stashes the cluster tree as pending — the tree
        // only applies once the matching cellData arrives, see `setCellData`.
        // Distinct from the mixin's `setLayoutAndClusterTree` (which applies
        // the tree immediately) so the rendered tree never references rows
        // that don't yet have data.
        setLayoutAndPendingClusterTree(layout: Source[], tree: string) {
          self.layout = layout
          self.pendingClusterTree = tree
        },
        setRunClustering(arg?: boolean) {
          self.runClustering = arg
        },
        /**
         * #action
         */
        setPhasedMode(arg: string) {
          if (self.renderingMode !== arg) {
            self.layout = []
            self.clusterTree = undefined
          }
          self.configuration.setSlot('renderingMode', arg)
        },
        /**
         * #action
         * Enable fit-to-display-height mode: `rowHeight = 0` makes
         * `effectiveRowHeight` divide `availableHeight` across the rows.
         */
        setFitToHeight() {
          self.rowHeight = 0
          self.scrollTop = 0
        },
        /**
         * #action
         * Override resizeHeight to scale a pinned row height proportionally when
         * the display is vertically resized. Rows live in `availableHeight`
         * (`height - lineZoneHeight`), not the full height, so scale by the
         * available-height ratio — otherwise the visible fraction of rows drifts
         * on resize whenever `lineZoneHeight` is non-zero (the matrix display).
         */
        resizeHeight(distance: number) {
          const oldHeight = self.height
          const newHeight = Math.max(oldHeight + distance, 20)
          const oldAvailableHeight = oldHeight - self.lineZoneHeight
          self.configuration.setSlot('height', newHeight)
          if (self.rowHeight > 0 && oldAvailableHeight > 0) {
            self.rowHeight =
              (self.rowHeight * (newHeight - self.lineZoneHeight)) /
              oldAvailableHeight
          }
          return newHeight - oldHeight
        },
        /**
         * #action
         */
        setReferenceDrawingMode(arg: string) {
          self.configuration.setSlot('referenceDrawingMode', arg)
        },
        /**
         * #action
         * Set the per-variant cell color override (jexl string or CSS color), or
         * '' to restore default genotype coloring. A fetch input — recomputes
         * cells in the worker.
         */
        setFeatureColor(arg: string) {
          self.configuration.setSlot('featureColor', arg)
        },
      }))
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
          return self.jexlFilters?.length
            ? new SerializableFilterChain({
                filters: [...self.jexlFilters],
                jexl: getEnv<{ pluginManager: PluginManager }>(self)
                  .pluginManager.jexl,
              })
            : undefined
        },

        get showSidebarLabels(): boolean {
          return getConf(self, 'showSidebarLabels')
        },

        get showTree(): boolean {
          return getConf(self, 'showTree')
        },

        get showBranchLength(): boolean {
          return getConf(self, 'showBranchLength')
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
          if (!self.subtreeFilter?.length) {
            return base
          }
          const filterSet = new Set(self.subtreeFilter)
          // Use s.name (not s.sampleName): phased clustering stores haplotype
          // names ("HG001 HP0") as tree leaves and subtreeFilter contains those
          // names. In alleleCount mode s.name === s.sampleName, so both work.
          return base.filter(s => filterSet.has(s.name))
        },
      }))
      .views(self => ({
        /**
         * #getter
         * sourcesBase expanded for phased rendering when sampleInfo is available.
         * Sources already carrying HP (from clustering) pass through unchanged.
         */
        get sources() {
          const base = self.sourcesBase
          if (!base || self.renderingMode !== 'phased') {
            return base
          }
          const sampleInfo = self.sampleInfo
          if (!sampleInfo) {
            return base
          }
          return expandSourcesToHaplotypes({ sources: base, sampleInfo })
        },
        /**
         * #getter
         * Layout-merged, phased-expanded view for the Edit Color/Arrangement
         * dialog. Does NOT apply the subtree filter — submitting the dialog
         * persists every row back to `layout`, so filtered samples must be
         * present or they would be wiped from layout on submit.
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
      }))
      .views(self => ({
        // Payload for MultiSampleVariantGetCellData. SettingsInvalidate watches
        // this — any change clears loaded data and triggers a refetch. Uses
        // sourcesBase (not sources) to avoid reading sampleInfo, which comes from
        // the fetch result and would cause an infinite invalidation loop.
        rpcProps() {
          return {
            sources: self.sourcesBase,
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            maxMissingnessFilter: self.maxMissingnessFilter,
            filters: self.filters,
            renderingMode: self.renderingMode,
            referenceDrawingMode: self.referenceDrawingMode,
            featureColor: self.featureColor,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get sourceMap() {
          return self.sources
            ? Object.fromEntries(
                self.sources.map((source: Source) => [source.name, source]),
              )
            : undefined
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
        // Row-height model: keep `rowHeight`, `autoRowHeight`,
        // `effectiveRowHeight`, and the proportional `resizeHeight` in sync
        // across related displays.
        /**
         * #getter
         * Available height for rows (total height minus lineZoneHeight).
         * Floored at 0: `lineZoneHeight` (matrix only, user-draggable up to
         * 1000 independently of `height`) can exceed a shrunk display height.
         * Every consumer treats this as a real pixel dimension (canvas
         * height, CSS `height`, scroll viewport height), so it must never go
         * negative.
         */
        get availableHeight() {
          return Math.max(0, self.height - self.lineZoneHeight)
        },
        /**
         * #getter
         */
        get nrow() {
          return Math.max(1, self.sources?.length ?? 0)
        },

        /**
         * #getter
         */
        get autoRowHeight() {
          return this.availableHeight / this.nrow
        },

        /**
         * #getter
         * Resolved per-row height. `rowHeight === 0` means auto-fit (computed
         * from availableHeight / nrow); any positive value is a user-pinned
         * height. `resizeHeight` scales pinned values proportionally so manual +
         * display-resize stay in sync without snap-back fuzziness. Every consumer
         * reads this, never the raw `rowHeight` property.
         *
         * Floored at 1px only when non-positive: `availableHeight` floors at
         * 0 (see above), so `autoRowHeight` can still be exactly 0 when
         * `lineZoneHeight` swallows the whole display — dividing by it
         * elsewhere (`/ effectiveRowHeight` in applyRowResizeWheel, the
         * renderers) would propagate NaN/Infinity. A resolved getter must never hand
         * back a degenerate value. The floor must not catch legitimate
         * sub-1px auto-fit heights (many-sample tracks squeezed into a short
         * display) — that's the normal case `hasOverflow` relies on staying
         * false for.
         */
        get effectiveRowHeight() {
          const height =
            self.rowHeight === 0 ? this.autoRowHeight : self.rowHeight
          return height > 0 ? height : 1
        },
        /**
         * #getter
         */
        get hierarchy() {
          return computeClusterHierarchy(
            self.root,
            self.sources?.length ?? 0,
            this.effectiveRowHeight * this.nrow,
            self.treeAreaWidth,
            self.showBranchLength,
          )
        },
      }))
      .views(self => ({
        get spatialIndex() {
          return buildSpatialIndex(self.hierarchy)
        },
        /**
         * #getter
         */
        get hoveredTooltipSource() {
          const { hoveredGenotype, sourceMap } = self
          if (!hoveredGenotype) {
            return undefined
          }
          const source = sourceMap?.[hoveredGenotype.name]
          return source ? { ...source, ...hoveredGenotype } : undefined
        },
      }))
      .actions(self => ({
        sortByGenotype(featureId: string) {
          const { cellData } = self
          const sources = self.sourcesWithoutLayout
          if (cellData && sources) {
            const info = getGenotypeMapForFeature(cellData, featureId)
            if (info) {
              const genotypes = decodeGenotypes(
                cellData.genotypeDict,
                cellData.sampleNames,
                info.genotypeCodes,
              )
              self.setLayout(sortSourcesByGenotype(sources, genotypes))
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
         */
        get canDisplayLabels() {
          return self.effectiveRowHeight >= 6 && self.showSidebarLabels
        },
        /**
         * #getter
         */
        get totalHeight() {
          return self.effectiveRowHeight * self.nrow
        },
        /**
         * #getter
         * Whether the rows are taller than the viewport, i.e. the display
         * scrolls. Drives native-scroll gating in displays that scroll their
         * rows in a native overflow container (the plain display); auto-fit
         * mode keeps this false since `rowHeight` derives from `availableHeight`.
         */
        get hasOverflow(): boolean {
          return this.totalHeight > self.availableHeight
        },
        /**
         * #getter
         * Max valid `scrollTop`: how far the rows can scroll before the bottom
         * row reaches the viewport floor. Zero when the rows fit.
         */
        get scrollableHeight() {
          return Math.max(0, this.totalHeight - self.availableHeight)
        },
        /**
         * #getter
         */
        get featuresReady() {
          return !!self.featuresVolatile
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
            }
          }
          return {
            jexlFilters: self.jexlFilters,
            clusterTree: self.clusterTree,
            treeAreaWidth: self.treeAreaWidth,
            layout: self.layout,
            height: self.height,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * Legend split into independently-closable sections: the genotype/cell
         * coloring and (when colorBy is set) the sample-grouping coloring shown
         * on the sidebar row labels. Dismissed sections are filtered out.
         */
        legendSections(): LegendSection[] {
          return getVariantLegendSections({
            renderingMode: self.renderingMode,
            hasSecondaryAlt: self.hasSecondaryAlt,
            hasUnphased: self.hasUnphased,
            hasNoCall: self.hasNoCall,
            featureColor: self.featureColor,
            svTypeColors: self.svTypeColors,
            colorBy: self.colorBy,
            sources: self.sources,
          }).filter(s => !self.dismissedLegendSections.includes(s.id))
        },
      }))
      .actions(self => ({
        // Clamp into the valid range so a row-height shrink or a display-resize
        // (which lowers scrollableHeight while scrollTop sits at the old bottom)
        // can't strand scrollTop past the content. The matrix display has no DOM
        // overflow container to self-correct it, so the clamp must live here.
        setScrollTop(scrollTop: number) {
          self.scrollTop = clamp(scrollTop, 0, self.scrollableHeight)
        },

        clearDisplaySpecificData() {
          // hasPhased / sampleInfo / featuresVolatile are derived from cellData
          // via getters, so clearing cellData clears all of them.
          self.cellData = undefined
          self.loadedBpPerPx = undefined
        },

        // Matrix mode draws columns by feature index across the full width, so
        // the set of features belongs to the visible region at the *current*
        // zoom — zooming in/out changes which features show even when the
        // viewport stays spatially inside loaded data, so cached cells at a
        // different bpPerPx are stale (wiggle uses the same strict-zoom rule,
        // adr-008). Regular mode draws each variant at its genomic position, so
        // spatial coverage alone suffices and the default (always valid) holds.
        isCacheValid(_displayedRegionIndex: number) {
          if (cellDataMode !== 'matrix' || self.loadedBpPerPx === undefined) {
            return true
          }
          const view = getContainingView(self) as LinearGenomeViewModel
          return view.bpPerPx === self.loadedBpPerPx
        },

        getByteEstimateConfig(): ByteEstimateConfig {
          return {
            adapterConfig: self.adapterConfig,
            visibleBp: (getContainingView(self) as LinearGenomeViewModel)
              .visibleBp,
          }
        },

        // Ignores `needed` and refetches all visible regions because the
        // cellData RPC payload is monolithic — one call returns data covering
        // all visible regions, so partial refetches don't fit. Other LGV
        // displays pass `needed` directly to fetchRegions for per-region
        // caching of rpcDataMap entries.
        async fetchNeeded(
          _needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          if (self.isMinimized || !self.sourcesBase) {
            return
          }
          const view = getContainingView(self) as LinearGenomeViewModel
          const regions = fetchRegionsForMode(view, cellDataMode)
          if (regions.length === 0) {
            return
          }
          const bpPerPx = view.bpPerPx
          // The override narrows sources to ProcessedSource[]: the guard above
          // proves self.sourcesBase is defined here, but rpcProps()'s own read
          // of it is typed ProcessedSource[] | undefined.
          const sources = self.sourcesBase
          const rpcProps = { ...self.rpcProps(), sources }
          await self.fetchRegions(regions, async (ctx: FetchContext) => {
            const result = await callMultiSampleVariantCellData({
              node: self,
              adapterConfig: self.adapterConfig,
              regions,
              rpcProps,
              mode: cellDataMode,
              statusCallback: self.makeStatusCallback(),
              ctx,
            })
            if (!ctx.isStale() && isAlive(self)) {
              self.setCellData(result)
              self.setLoadedBpPerPx(bpPerPx)
            }
          })
        },
      }))
      .actions(self => ({
        reload() {
          // Bump reloadCount so the sources autorun re-fires; clearAllRpcData
          // clears error/regionTooLarge and bumps fetchGeneration to retrigger
          // the cellData fetch via FetchVisibleRegions.
          self.reloadCount++
          self.clearAllRpcData()
        },
      }))
      .actions(self => ({
        afterAttach() {
          // Drop the cached byte estimate on chromosome navigation:
          // displayedRegionIndex is reused across chromosomes, so a stale
          // estimate would gate the new region against the wrong stats and, since
          // FetchVisibleRegions gates on !regionTooLarge, wedge the banner. The
          // estimate intentionally survives viewport-change clears (no flicker on
          // pan); this hook is the one path that clears it. Mirrors canvas/maf.
          onDisplayedRegionsChange(self, () => {
            self.setFeatureDensityStats(undefined)
          })
          // Keep scrollTop within the content by construction. A row-height
          // shrink or a display drag-resize lowers scrollableHeight, and the
          // matrix display scrolls a canvas with no native overflow container
          // to self-correct — so re-clamp reactively here rather than making
          // every geometry-changing action remember to call setScrollTop.
          addDisposer(
            self,
            autorun(() => {
              if (self.scrollTop > self.scrollableHeight) {
                self.setScrollTop(self.scrollableHeight)
              }
            }),
          )
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
                getSession(self).notifyError(`${e}`, e)
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
