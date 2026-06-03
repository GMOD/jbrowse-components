import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { set1 } from '@jbrowse/core/ui/colors'
import {
  SimpleFeature,
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
import CategoryIcon from '@mui/icons-material/Category'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import HeightIcon from '@mui/icons-material/Height'
import SortIcon from '@mui/icons-material/Sort'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import deepEqual from 'fast-deep-equal'

import {
  GENOTYPE_SPLITTER,
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  REFERENCE_COLOR,
  UNPHASED_COLOR,
  getAltColorForDosage,
} from './constants.ts'
import { expandSourcesToHaplotypes, getSources } from './getSources.ts'
import { createMAFFilterMenuItem } from './mafFilterUtils.ts'

import type { ProcessedSource, Source } from './types.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type {
  ByteEstimateConfig,
  FetchContext,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Apply the `colorBy` config palette the first time sources arrive — but only
// when the user hasn't already set a layout. Returns the colored sources, or
// undefined when there's nothing to apply (no colorBy config, or sources lack
// the requested attribute).
function maybeApplyColorByPalette(
  configuration: AnyConfigurationModel,
  sources: Source[],
): Source[] | undefined {
  const colorBy = getConf({ configuration }, 'colorBy') as string
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

// lazies
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog.tsx'))

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

const ClusterDialog = lazy(
  () =>
    import('./components/MultiSampleVariantClusterDialog/ClusterDialog.tsx'),
)
const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog.tsx'),
)

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

// Module-local helper for the variant cell data RPC call. Takes the resolved
// rpcProps object (rather than `self`) so TS infers the payload shape from
// the model's rpcProps view without a structural cast. `mode` comes from the
// per-subclass cellDataMode that's bound at factory call time.
async function callMultiSampleVariantCellData(args: {
  node: IAnyStateTreeNode
  adapterConfig: AnyConfigurationModel
  rpcProps: {
    sources: ProcessedSource[]
    minorAlleleFrequencyFilter: number
    filters?: SerializableFilterChain
    renderingMode: string
    referenceDrawingMode: string
  }
  mode: 'regular' | 'matrix'
  setStatusMessage: (msg?: string) => void
  ctx: FetchContext
}) {
  const { node, adapterConfig, rpcProps, mode, setStatusMessage, ctx } = args
  const view = getContainingView(node) as LinearGenomeViewModel
  const allBuffered = view.bufferedVisibleRegions
  const sessionId = getRpcSessionId(node)
  return getSession(node).rpcManager.call(
    sessionId,
    'MultiSampleVariantGetCellData',
    {
      regions: allBuffered.map(r => r.region),
      displayedRegionIndices: allBuffered.map(r => r.displayedRegionIndex),
      ...rpcProps,
      mode,
      sessionId,
      adapterConfig,
      stopToken: ctx.stopToken,
      statusCallback: (msg: string) => {
        if (isAlive(node)) {
          setStatusMessage(msg)
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
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 */
export default function MultiSampleVariantBaseModelF(
  configSchema: AnyConfigurationSchemaType,
  cellDataMode: 'regular' | 'matrix',
) {
  return (
    types
      .compose(
        // Abstract base shared by both MultiLinearVariantDisplay and
        // LinearVariantMatrixDisplay. The name below is borrowed from the
        // matrix subclass for historical reasons. `type` is `types.string`
        // (not a literal) because the base is never registered or instantiated
        // directly — the concrete subclass that composes this always overrides
        // `type` with its own literal, and a plain string keeps those subclass
        // models assignable to this base type. Don't rename the subclass `type`
        // literals — they appear in stored session snapshots.
        'LinearVariantMatrixDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        ConfigOverrideMixin(),
        TreeSidebarMixin<Source>(),
        types.model({
          type: types.string,
          configuration: ConfigurationReference(configSchema),
          rowHeightMode: types.optional(types.number, 0),
          jexlFilters: types.maybe(types.array(types.string)),
          lineZoneHeight: types.optional(types.number, 0),
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
        let next = cleaned

        // Rewrite "height" from older snapshots to "heightOverride"
        if (next.height !== undefined && next.heightOverride === undefined) {
          const { height, ...rest } = next
          next = { ...rest, heightOverride: height }
        }

        return migrateOldSettingSnapshots(next)
      })
      .volatile(() => ({
        /**
         * #volatile
         */
        showLegend: true,
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
          return self.getConfWithOverride<string>('renderingMode')
        },

        get featureWidgetType() {
          return {
            type: 'VariantFeatureWidget',
            id: 'variantFeature',
          }
        },

        get fetchSizeLimit() {
          return (
            self.userByteSizeLimit ??
            self.getConfWithOverride<number>('fetchSizeLimit')
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        setJexlFilters(f?: string[]) {
          self.jexlFilters = cast(f)
        },
        /**
         * #action
         */
        setShowLegend(s: boolean) {
          self.showLegend = s
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
          // Apply the configured colorBy palette only when the user hasn't
          // already arranged the layout themselves.
          if (self.layout.length === 0) {
            const colored = maybeApplyColorByPalette(
              self.configuration,
              sources,
            )
            if (colored) {
              self.layout = colored
            }
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
            ? maybeApplyColorByPalette(self.configuration, sources)
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
        get minorAlleleFrequencyFilter() {
          return self.getConfWithOverride<number>('minorAlleleFrequencyFilter')
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

        get showSidebarLabels() {
          return self.getConfWithOverride<boolean>('showSidebarLabels')
        },

        get showTree() {
          return self.getConfWithOverride<boolean>('showTree')
        },

        get referenceDrawingMode(): string {
          const override = self.getOverride<string>('referenceDrawingMode')
          if (override !== undefined) {
            return override
          }
          return self.getConfWithOverride<boolean>('showReferenceAlleles')
            ? 'draw'
            : 'skip'
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
          )
        },
      }))
      .views(self => ({
        get spatialIndex() {
          return self.hierarchy ? buildSpatialIndex(self.hierarchy) : undefined
        },
      }))
      .actions(self => ({
        sortByGenotype(featureId: string) {
          const sources = self.sourcesWithoutLayout
          if (!sources) {
            return
          }
          const info = getGenotypeMapForFeature(self.cellData, featureId)
          if (!info) {
            return
          }
          self.setLayout(sortSourcesByGenotype(sources, info.genotypes))
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        showSubmenuItems() {
          return [
            {
              label: 'Show sidebar labels',
              type: 'checkbox',
              checked: self.showSidebarLabels,
              onClick: () => {
                self.setShowSidebarLabels(!self.showSidebarLabels)
              },
            },
            {
              label: `Show tree${!self.clusterTree ? ' (run clustering first)' : ''}`,
              type: 'checkbox',
              checked: self.showTree,
              disabled: !self.clusterTree,
              onClick: () => {
                self.setShowTree(!self.showTree)
              },
            },
            ...(self.subtreeFilter?.length
              ? [
                  {
                    label: 'Clear subtree filter',
                    onClick: () => {
                      self.setSubtreeFilter(undefined)
                    },
                  },
                ]
              : []),
            {
              label: 'Show legend',
              type: 'checkbox',
              checked: self.showLegend,
              onClick: () => {
                self.setShowLegend(!self.showLegend)
              },
            },
          ]
        },
      }))
      .views(self => {
        const { trackMenuItems: superTrackMenuItems } = self
        return {
          /**
           * #method
           */
          trackMenuItems() {
            return [
              ...superTrackMenuItems(),
              {
                label: 'Show...',
                icon: VisibilityIcon,
                type: 'subMenu',
                subMenu: self.showSubmenuItems(),
              },
              {
                label: 'Row height',
                icon: HeightIcon,
                subMenu: [
                  {
                    label: 'Manually set row height',
                    onClick: () => {
                      getSession(self).queueDialog(handleClose => [
                        SetRowHeightDialog,
                        {
                          model: self,
                          handleClose,
                        },
                      ])
                    },
                  },
                  {
                    label: 'Fit to display height',
                    onClick: () => {
                      self.setFitToHeight()
                    },
                  },
                ],
              },
              {
                label: 'Rendering mode',
                icon: SplitscreenIcon,
                subMenu: [
                  {
                    label: 'Allele count (dosage)',
                    helpText:
                      'Draws the color darker the more times this allele exists, so homozygous variants are darker than heterozygous. Works on polyploid also',
                    type: 'radio',
                    checked: self.renderingMode === 'alleleCount',
                    onClick: () => {
                      self.setPhasedMode('alleleCount')
                    },
                  },
                  {
                    label: `Phased${
                      self.hasPhased
                        ? ''
                        : !self.featuresVolatile
                          ? ' (checking for phased variants...)'
                          : ' (disabled, no phased variants found)'
                    }`,
                    helpText:
                      'Phased mode splits each sample into multiple rows representing each haplotype, and the phasing of the variants is used to color the variant in the individual haplotype rows. For example, a diploid sample SAMPLE1 will generate two rows SAMPLE1-HP0 and SAMPLE1 HP1 and a variant 1|0 will draw a box in the top row but not the bottom row',
                    disabled: !self.hasPhased,
                    checked: self.renderingMode === 'phased',
                    type: 'radio',
                    onClick: () => {
                      self.setPhasedMode('phased')
                    },
                  },
                ],
              },

              {
                label: 'Filter by',
                icon: ClearAllIcon,
                subMenu: [
                  createMAFFilterMenuItem(self),
                  {
                    label: 'Edit filters',
                    onClick: () => {
                      getSession(self).queueDialog(handleClose => [
                        AddFiltersDialog,
                        {
                          model: self,
                          handleClose,
                        },
                      ])
                    },
                  },
                ],
              },
              {
                label: 'Cluster by genotype',
                icon: CategoryIcon,
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    ClusterDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
              {
                label: 'Edit colors/arrangement...',
                disabled: !self.sourcesVolatile?.length,
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    SetColorDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
            ]
          },
          contextMenuItems(): MenuItem[] {
            const feat = self.contextMenuFeature
            if (!feat) {
              return []
            }
            return [
              {
                label: 'Open feature details',
                onClick: () => {
                  self.selectFeature(feat)
                },
              },
              {
                label: 'Copy to clipboard',
                onClick: async () => {
                  try {
                    const loc = `${feat.get('refName')}:${feat.get('start') + 1}..${feat.get('end')}`
                    const id = feat.get('name') || feat.id()
                    const { default: copy } =
                      await import('@jbrowse/core/util/copyToClipboard')
                    copy(`${id} ${loc}`)
                    getSession(self).notify('Copied to clipboard', 'info')
                  } catch (e) {
                    console.error(e)
                    getSession(self).notifyError(`${e}`, e)
                  }
                },
              },
              {
                label: 'Sort by genotype',
                icon: SortIcon,
                onClick: () => {
                  self.sortByGenotype(feat.id())
                },
              },
            ]
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
         */
        get featuresReady() {
          return !!self.featuresVolatile
        },
        /**
         * #method
         */
        getPortableSettings() {
          return {
            configOverrides: self.configOverrides,
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
         * Returns legend items for rendering colors based on current mode
         */
        legendItems(): LegendItem[] {
          if (self.renderingMode === 'phased') {
            const items: LegendItem[] = [
              { color: REFERENCE_COLOR, label: 'Reference' },
              { color: set1[0], label: 'Alt allele' },
            ]
            if (self.hasSecondaryAlt) {
              items.push({ color: set1[1], label: 'Other alt allele' })
            }
            if (self.hasUnphased) {
              items.push({ color: UNPHASED_COLOR, label: 'Unphased' })
            }
            return items
          }
          const items: LegendItem[] = [
            { color: REFERENCE_COLOR, label: 'Homozygous reference' },
            { color: getAltColorForDosage(0.5), label: 'Heterozygous alt' },
            { color: getAltColorForDosage(1), label: 'Homozygous alt' },
          ]
          if (self.hasSecondaryAlt) {
            items.push({ color: OTHER_ALT_COLOR, label: 'Other alt allele' })
          }
          items.push({ color: NO_CALL_COLOR, label: 'No call' })
          return items
        },
      }))
      .actions(self => ({
        clearDisplaySpecificData() {
          // hasPhased / sampleInfo / featuresVolatile are derived from cellData
          // via getters, so clearing cellData clears all of them.
          self.cellData = undefined
        },

        getByteEstimateConfig(): ByteEstimateConfig | null {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return null
          }
          return {
            adapterConfig: self.adapterConfig,
            fetchSizeLimit: self.getConfWithOverride<number>('fetchSizeLimit'),
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
          const allBuffered = (getContainingView(self) as LinearGenomeViewModel)
            .bufferedVisibleRegions
          if (allBuffered.length === 0) {
            return
          }
          const sources = self.sourcesBase
          const rpcProps = { ...self.rpcProps(), sources }
          await self.fetchRegions(allBuffered, async (ctx: FetchContext) => {
            const result = await callMultiSampleVariantCellData({
              node: self,
              adapterConfig: self.adapterConfig,
              rpcProps,
              mode: cellDataMode,
              setStatusMessage: self.setStatusMessage,
              ctx,
            })
            if (!ctx.isStale() && isAlive(self)) {
              self.setCellData(result)
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
      .postProcessSnapshot(snap => {
        const {
          layout,
          rowHeightMode,
          jexlFilters,
          clusterTree,
          treeAreaWidth,
          subtreeFilter,
          ...rest
        } = snap
        return {
          ...rest,
          ...(layout.length ? { layout } : {}),
          ...(rowHeightMode !== 0 ? { rowHeightMode } : {}),
          ...(jexlFilters?.length ? { jexlFilters } : {}),
          ...(clusterTree !== undefined ? { clusterTree } : {}),
          ...(treeAreaWidth !== 80 ? { treeAreaWidth } : {}),
          ...(subtreeFilter?.length ? { subtreeFilter } : {}),
        }
      })
  )
}

export type MultiSampleVariantBaseStateModel = ReturnType<
  typeof MultiSampleVariantBaseModelF
>
export type MultiSampleVariantBaseModel =
  Instance<MultiSampleVariantBaseStateModel>
