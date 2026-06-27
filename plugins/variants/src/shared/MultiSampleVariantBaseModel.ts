import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  SimpleFeature,
  clamp,
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  migrateOldSettingSnapshots,
} from '@jbrowse/plugin-linear-genome-view'
import {
  TreeSidebarMixin,
  applyColorPalette,
  buildSpatialIndex,
  clusterLayout,
} from '@jbrowse/tree-sidebar'
import deepEqual from 'fast-deep-equal'

import { GENOTYPE_SPLITTER, VARIANT_FEATURE_WIDGET } from './constants.ts'
import { buildSampleIndex, decodeGenotypes } from './genotypeCodec.ts'
import { expandSourcesToHaplotypes, getSources } from './getSources.ts'
import {
  variantContextMenuItems,
  variantShowSubmenuItems,
  variantTrackMenuItems,
} from './multiSampleVariantMenuItems.ts'
import { getVariantLegendSections } from './variantLegend.ts'

import type { ProcessedSource, Source } from './types.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  ByteEstimateConfig,
  FetchContext,
  LegendSection,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Apply a `colorBy` palette to the sample sources. Returns the colored sources,
// or undefined when there's nothing to apply (no colorBy attribute, or sources
// lack the requested attribute). `colorBy` is the resolved value (config default
// or runtime override) so the same palettizing drives both initial load and the
// interactive "Color samples by" menu.
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

// Sample-metadata keys that aren't user-facing grouping attributes — internal
// row plumbing (identity, haplotype index, rendering color/label). Everything
// else a samplesTsv carries (population, sex, superpopulation, …) is offered as
// a "Color samples by" choice.
const NON_COLORBY_KEYS = new Set([
  'name',
  'sampleName',
  'HP',
  'baseUri',
  'color',
  'label',
  'labelColor',
])

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
// `sampleName` rather than `name`.
export function sortSourcesByGenotype(
  sources: ProcessedSource[],
  genotypes: Record<string, string>,
): ProcessedSource[] {
  return [...sources].sort((a, b) => {
    const ga = genotypes[a.sampleName] ?? './.'
    const gb = genotypes[b.sampleName] ?? './.'
    return encodeGenotype(gb) - encodeGenotype(ga)
  })
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
    filters?: SerializableFilterChain
    renderingMode: string
    referenceDrawingMode: string
  }
  mode: 'regular' | 'matrix'
  setStatusMessage: (status?: RpcStatus) => void
  ctx: FetchContext
}): Promise<CellDataResult> {
  const {
    node,
    adapterConfig,
    regions,
    rpcProps,
    mode,
    setStatusMessage,
    ctx,
  } = args
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
      statusCallback: (status: RpcStatus) => {
        if (isAlive(node)) {
          setStatusMessage(status)
        }
      },
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
 * #category display
 *
 * #example
 * `renderingMode`, `colorBy`, and `minorAlleleFrequencyFilter` are config slots
 * (see `SharedVariantConfigSchema`) read at runtime through
 * `getConfWithOverride` — they are NOT plain MST properties. How you preset one
 * depends on whether you're writing a track *config* or a display *instance*
 * snapshot:
 *
 * In a track's `displays` array (config schema), set the slot directly to
 * change the default:
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
 * In a display *instance* snapshot (a session / `displaySnapshot`), set it
 * flat — exactly what a saved session serializes:
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantMatrixDisplay',
 *   renderingMode: 'phased',
 * }
 * ```
 */
export default function MultiSampleVariantBaseModelF(
  configSchema: AnyConfigurationSchemaType,
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
        ConfigOverrideMixin([
          'renderingMode',
          'fetchSizeLimit',
          'minorAlleleFrequencyFilter',
          'showSidebarLabels',
          'showTree',
          'showBranchLength',
          'referenceDrawingMode',
          'showReferenceAlleles',
          'colorBy',
        ]),
        TreeSidebarMixin<Source>(),
        types.model({
          type: types.string,
          configuration: ConfigurationReference(configSchema),
          rowHeightMode: types.stripDefault(types.number, 0),
          jexlFilters: types.stripDefault(
            types.maybe(types.array(types.string)),
            undefined,
          ),
          lineZoneHeight: types.stripDefault(types.number, 0),
        }),
      )
      // Migration boundary: input is a legacy snapshot whose shape predates
      // the current model, output must match the current ModelCreationType.
      // MST can't express that bidirectional reshape, so `any` is the honest
      // type here — narrowing with `as` casts would just relocate the escape
      // hatch.
      .preProcessSnapshot((snap: any) => {
        if (!snap) {
          return snap
        }

        // Strip properties from old BaseLinearDisplay snapshots, plus
        // lengthCutoffFilter (removed — length filtering is now done with
        // general jexl filters, e.g. `jexl:get(feature,'end')-get(feature,'start')<N`).
        const {
          blockState,
          showLegend,
          showTooltips,
          lengthCutoffFilter,
          ...cleaned
        } = snap
        // height/heightPreConfig → heightOverride is handled centrally by
        // TrackHeightMixin's migration, so it passes through untouched here.
        return migrateOldSettingSnapshots(cleaned)
      })
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
        sourcesLoadingStopToken: undefined as StopToken | undefined,
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
         */
        get sampleInfo() {
          return self.cellData?.sampleInfo
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Returns the effective rendering mode, falling back to config
         */
        get renderingMode(): string {
          return self.getConfWithOverride('renderingMode')
        },

        /**
         * #getter
         * The effective sample-grouping attribute (config default or runtime
         * override). Drives the sidebar row coloring and the legend's group
         * section; '' means no grouping.
         */
        get colorBy(): string {
          return self.getConfWithOverride('colorBy')
        },

        get featureWidgetType() {
          return VARIANT_FEATURE_WIDGET
        },

        get fetchSizeLimit(): number {
          return (
            self.userByteSizeLimit ?? self.getConfWithOverride('fetchSizeLimit')
          )
        },
      }))
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
          const session = getSession(self)
          session.rpcManager
            .call(getRpcSessionId(self), 'CoreGetMetadata', {
              adapterConfig: self.adapterConfig,
            })
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
              session.notifyError(`${e}`, e)
            })
        },
        /**
         * #action
         */
        setRowHeight(arg: number) {
          self.rowHeightMode = arg
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
        setSourcesLoading(token: StopToken) {
          if (self.sourcesLoadingStopToken) {
            stopStopToken(self.sourcesLoadingStopToken)
          }
          self.sourcesLoadingStopToken = token
        },
        /**
         * #action
         */
        setSources(sources: Source[]) {
          if (deepEqual(sources, self.sourcesVolatile)) {
            return
          }
          self.sourcesVolatile = sources
          // Apply the colorBy palette only when the user hasn't already
          // arranged the layout themselves.
          if (self.layout.length === 0) {
            const colored = maybeApplyColorByPalette(self.colorBy, sources)
            if (colored) {
              self.layout = colored
            }
          }
        },
        /**
         * #action
         * Recolor sample rows by a metadata attribute (e.g. 'population'), or
         * pass '' to clear the grouping. Persists the colored arrangement as the
         * layout and records the choice as a `colorBy` override so it survives a
         * data refetch and serializes into the session.
         */
        setColorBy(colorBy: string) {
          self.setOverride('colorBy', colorBy)
          const sources = self.sourcesVolatile
          if (sources) {
            const colored = maybeApplyColorByPalette(colorBy, sources)
            self.layout = colored ?? []
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
          const colored = sources
            ? maybeApplyColorByPalette(self.colorBy, sources)
            : undefined
          self.layout = colored ?? []
        },
        /**
         * #action
         */
        setMafFilter(arg: number) {
          self.setOverride('minorAlleleFrequencyFilter', arg)
        },
        setShowSidebarLabels(arg: boolean) {
          self.setOverride('showSidebarLabels', arg)
        },
        setShowTree(arg: boolean) {
          self.setOverride('showTree', arg)
        },
        setShowBranchLength(arg: boolean) {
          self.setOverride('showBranchLength', arg)
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
        /**
         * #action
         */
        setPhasedMode(arg: string) {
          if (self.renderingMode !== arg) {
            self.layout = []
            self.clusterTree = undefined
          }
          self.setOverride('renderingMode', arg)
        },
        /**
         * #action
         * Toggle auto height mode. When turning off, uses default of 10px per row.
         */
        setFitToHeight() {
          self.rowHeightMode = 0
          self.scrollTop = 0
        },
        /**
         * #action
         * Override resizeHeight to scale row heights proportionally when
         * the display is vertically resized
         */
        resizeHeight(distance: number) {
          const oldHeight = self.height
          const newHeight = Math.max(self.height + distance, 20)
          self.heightOverride = newHeight
          if (self.rowHeightMode > 0) {
            self.rowHeightMode = self.rowHeightMode * (newHeight / oldHeight)
          }
          return newHeight - oldHeight
        },
        /**
         * #action
         */
        setReferenceDrawingMode(arg: string) {
          self.setOverride('referenceDrawingMode', arg)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Returns the effective minor allele frequency filter, falling back to config
         */
        get minorAlleleFrequencyFilter(): number {
          return self.getConfWithOverride('minorAlleleFrequencyFilter')
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
            ? new SerializableFilterChain({ filters: [...self.jexlFilters] })
            : undefined
        },

        get showSidebarLabels(): boolean {
          return self.getConfWithOverride('showSidebarLabels')
        },

        get showTree(): boolean {
          return self.getConfWithOverride('showTree')
        },

        get showBranchLength(): boolean {
          return self.getConfWithOverride('showBranchLength')
        },

        get referenceDrawingMode(): string {
          return (
            self.getOverride<string>('referenceDrawingMode') ??
            (self.getConfWithOverride('showReferenceAlleles') ? 'draw' : 'skip')
          )
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
              if (!NON_COLORBY_KEYS.has(key)) {
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
            filters: self.filters,
            renderingMode: self.renderingMode,
            referenceDrawingMode: self.referenceDrawingMode,
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
        // Row-height model: keep `rowHeightMode`, `autoRowHeight`, `rowHeight`,
        // and the proportional `resizeHeight` in sync across related displays.
        /**
         * #getter
         * Available height for rows (total height minus lineZoneHeight)
         */
        get availableHeight() {
          return self.height - self.lineZoneHeight
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
         * rowHeightMode === 0 means auto-fit (computed from availableHeight /
         * nrow); any positive value is a user-pinned height. `resizeHeight`
         * scales pinned values proportionally so manual + display-resize stay
         * in sync without snap-back fuzziness.
         */
        get rowHeight() {
          return self.rowHeightMode === 0
            ? this.autoRowHeight
            : self.rowHeightMode
        },
        /**
         * #getter
         */
        get hierarchy() {
          const r = self.root
          if (!r || !self.sources?.length) {
            return undefined
          }
          return clusterLayout(
            r,
            this.rowHeight * this.nrow,
            self.treeAreaWidth,
            self.showBranchLength,
          )
        },
      }))
      .views(self => ({
        get spatialIndex() {
          return self.hierarchy ? buildSpatialIndex(self.hierarchy) : undefined
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
          return self.rowHeight >= 6 && self.showSidebarLabels
        },
        /**
         * #getter
         */
        get totalHeight() {
          return self.rowHeight * (self.sources?.length ?? 1)
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
         */
        getPortableSettings() {
          return {
            ...self.configOverrides,
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

        getByteEstimateConfig(): ByteEstimateConfig | null {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return null
          }
          return {
            adapterConfig: self.adapterConfig,
            fetchSizeLimit: self.getConfWithOverride('fetchSizeLimit'),
            userByteSizeLimit: self.userByteSizeLimit,
            visibleBp: view.visibleBp,
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
              setStatusMessage: self.setStatusMessage,
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
