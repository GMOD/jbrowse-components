import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { set1 } from '@jbrowse/core/ui/colors'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
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
import { TreeSidebarMixin, clusterLayout } from '@jbrowse/tree-sidebar'
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
import { getSources, makeHaplotypeSources } from './getSources.ts'
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
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ByteEstimateConfig,
  FetchContext,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

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

// Module-local helper for the variant cell data RPC call. Kept here (not an
// MST action) so the RPC payload shape is easy to read at the call site. self
// is typed structurally because cellDataMode is defined on each subclass
// (MultiVariantDisplay = 'regular', MultiVariantMatrixDisplay = 'matrix').
async function callMultiSampleVariantCellData(
  self: {
    adapterConfig: AnyConfigurationModel
    cellDataMode: 'regular' | 'matrix'
    rpcProps: {
      sources: ProcessedSource[]
      minorAlleleFrequencyFilter: number
      lengthCutoffFilter: number
      renderingMode: string
      referenceDrawingMode: string
    }
    setStatusMessage: (msg?: string) => void
  },
  ctx: FetchContext,
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const allBuffered = view.bufferedVisibleRegions
  const sessionId = getRpcSessionId(self)
  return getSession(self).rpcManager.call(
    sessionId,
    'MultiSampleVariantGetCellData',
    {
      regions: allBuffered.map(r => r.region),
      displayedRegionIndices: allBuffered.map(r => r.displayedRegionIndex),
      ...self.rpcProps,
      mode: self.cellDataMode,
      sessionId,
      adapterConfig: self.adapterConfig,
      stopToken: ctx.stopToken,
      statusCallback: (msg: string) => {
        if (isAlive(self)) {
          self.setStatusMessage(msg)
        }
      },
    },
  )
}

function getGenotypeMapForFeature(
  cellData: CellDataResult | undefined,
  featureId: string,
) {
  if (!cellData) {
    return undefined
  }
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

/**
 * #stateModel MultiSampleVariantBaseModel
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 */
export default function MultiSampleVariantBaseModelF(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      ConfigOverrideMixin(),
      TreeSidebarMixin<Source>(),
      types.model({
        type: types.literal('LinearVariantMatrixDisplay'),
        configuration: ConfigurationReference(configSchema),
        rowHeightMode: types.optional(types.number, 0),
        lengthCutoffFilter: types.optional(
          types.number,
          Number.MAX_SAFE_INTEGER,
        ),
        jexlFilters: types.maybe(types.array(types.string)),
        lineZoneHeight: types.optional(types.number, 0),
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplay snapshots
      const { blockState, showLegend, showTooltips, ...cleaned } = snap
      snap = cleaned

      // Rewrite "height" from older snapshots to "heightPreConfig"
      if (snap.height !== undefined && snap.heightPreConfig === undefined) {
        const { height, ...rest } = snap
        snap = { ...rest, heightPreConfig: height }
      }

      return migrateOldSettingSnapshots(snap)
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
      featureUnderMouseVolatile: undefined as Feature | undefined,
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
       * Tracks whether the colorBy config has been applied (to avoid
       * re-applying on every source update)
       */
      colorByApplied: false,
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
       */
      get featuresVolatile(): Feature[] | undefined {
        return self.cellData?.simplifiedFeatures.map(f => new SimpleFeature(f))
      },
      /**
       * #getter
       */
      get hasPhased() {
        return self.cellData?.hasPhased ?? false
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
        session.setSelection(feature)
        if (isSessionModelWithWidgets(session)) {
          const { type, id } = self.featureWidgetType
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const adapterConfig = getConf(track, 'adapter')
          session.rpcManager
            .call(getRpcSessionId(self), 'CoreGetMetadata', { adapterConfig })
            .then(descriptions => {
              if (isAlive(self)) {
                session.showWidget(
                  session.addWidget(type, id, {
                    featureData: feature.toJSON(),
                    view,
                    track,
                    descriptions,
                  }),
                )
              }
            })
            .catch((e: unknown) => {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            })
        }
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
      setColorByApplied(value: boolean) {
        self.colorByApplied = value
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
        if (!deepEqual(sources, self.sourcesVolatile)) {
          self.sourcesVolatile = sources
        }
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
      setLayoutAndClusterTree(layout: Source[], tree?: string) {
        self.layout = layout
        if (tree !== undefined) {
          self.pendingClusterTree = tree
        } else {
          self.clusterTree = undefined
          self.pendingClusterTree = undefined
        }
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
        self.heightPreConfig = newHeight
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

      /**
       * #getter
       * Original adapter order, no layout reordering. Reads sampleInfo
       * (cellData-derived) for phased expansion — safe in React components
       * and user actions, never put in rpcProps (would cause infinite loop).
       */
      get sourcesWithoutLayout() {
        return self.sourcesVolatile
          ? getSources({
              sources: self.sourcesVolatile,
              renderingMode: self.renderingMode,
              sampleInfo: self.sampleInfo,
            })
          : undefined
      },
      /**
       * #getter
       * Layout-ordered, subtree-filtered, never haplotype-expanded.
       * Does NOT read sampleInfo — safe to use in rpcProps. Three-getter
       * hierarchy: sourcesBase → sources (adds phased expansion) →
       * sourcesWithoutLayout (no layout, reads sampleInfo for phased).
       */
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
        return base.filter(s => filterSet.has(s.sampleName))
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
        return base.flatMap(s =>
          s.HP !== undefined
            ? [s]
            : makeHaplotypeSources(s, sampleInfo[s.sampleName]?.maxPloidy ?? 2),
        )
      },
    }))
    .views(self => ({
      // Payload for MultiSampleVariantGetCellData. SettingsInvalidate watches
      // this — any change clears loaded data and triggers a refetch. Uses
      // sourcesBase (not sources) to avoid reading sampleInfo, which comes from
      // the fetch result and would cause an infinite invalidation loop.
      get rpcProps() {
        return {
          sources: self.sourcesBase,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
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
       */
      get rowHeight() {
        if (self.rowHeightMode === 0) {
          return this.autoRowHeight
        }
        return Math.abs(self.rowHeightMode - this.autoRowHeight) < 0.01
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
        return clusterLayout(r, this.rowHeight * this.nrow, self.treeAreaWidth)
      },
    }))
    .views(self => ({
      get featureNearestCenter() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const centerInfo = view.centerLineInfo
        const features = self.featuresVolatile
        if (!centerInfo || !features?.length) {
          return undefined
        }
        const { coord, refName } = centerInfo
        let bestFeature = features[0]!
        let bestDist = Infinity
        for (const f of features) {
          if (f.get('refName') === refName) {
            const start = f.get('start')
            const end = f.get('end')
            const mid = (start + end) / 2
            const dist = Math.abs(mid - coord)
            if (dist < bestDist) {
              bestDist = dist
              bestFeature = f
            }
          }
        }
        return bestFeature
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
        const sorted = [...sources].sort((a, b) => {
          const ga = info.genotypes[a.name] ?? './.'
          const gb = info.genotypes[b.name] ?? './.'
          return encodeGenotype(gb) - encodeGenotype(ga)
        })
        self.setLayout(sorted, true)
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
              label: 'Sort by genotype',
              icon: SortIcon,
              onClick: () => {
                const feat = self.featureNearestCenter
                if (feat) {
                  self.sortByGenotype(feat.id())
                }
              },
            },
            {
              label: 'Edit group colors/arrangement...',
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
                  const { default: copy } = await import('copy-to-clipboard')
                  await copy(`${id} ${loc}`)
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

      get isDisplayLoading() {
        return (
          !self.error &&
          !self.regionTooLarge &&
          (!self.cellData || self.isLoading)
        )
      },
      /**
       * #method
       */
      getPortableSettings() {
        return {
          configOverrides: self.configOverrides,
          lengthCutoffFilter: self.lengthCutoffFilter,
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
          let hasSecondaryAlt = false
          let hasUnphased = false
          const features = self.featuresVolatile
          if (features) {
            for (const feature of features) {
              const alt = feature.get('ALT') as string[] | undefined
              if (alt && alt.length > 1) {
                hasSecondaryAlt = true
              }
              if (!hasUnphased) {
                const genotypes = feature.get('genotypes') as
                  | Record<string, string>
                  | undefined
                if (genotypes) {
                  for (const key in genotypes) {
                    if (genotypes[key]?.includes('/')) {
                      hasUnphased = true
                      break
                    }
                  }
                }
              }
              if (hasSecondaryAlt && hasUnphased) {
                break
              }
            }
          }
          const items: LegendItem[] = [
            { color: REFERENCE_COLOR, label: 'Reference' },
            { color: set1[0], label: 'Alt allele' },
          ]
          if (hasSecondaryAlt) {
            items.push({ color: set1[1], label: 'Other alt allele' })
          }
          if (hasUnphased) {
            items.push({ color: UNPHASED_COLOR, label: 'Unphased' })
          }
          return items
        }
        let hasSecondaryAlt = false
        if (self.featuresVolatile) {
          for (const f of self.featuresVolatile) {
            const alt = f.get('ALT') as string[] | undefined
            if (alt && alt.length > 1) {
              hasSecondaryAlt = true
              break
            }
          }
        }
        const items: LegendItem[] = [
          { color: REFERENCE_COLOR, label: 'Homozygous reference' },
          { color: getAltColorForDosage(0.5), label: 'Heterozygous alt' },
          { color: getAltColorForDosage(1), label: 'Homozygous alt' },
        ]
        if (hasSecondaryAlt) {
          items.push({ color: OTHER_ALT_COLOR, label: 'Other alt allele' })
        }
        items.push({ color: NO_CALL_COLOR, label: 'No call' })
        return items
      },
    }))
    .views(self => ({
      get adapterConfigSnapshot() {
        return getConf(getContainingTrack(self), 'adapter') as Record<
          string,
          unknown
        >
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
          adapterConfig: self.adapterConfigSnapshot,
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
        if (self.isMinimized || !self.rpcProps.sources) {
          return
        }
        const allBuffered = (getContainingView(self) as LinearGenomeViewModel)
          .bufferedVisibleRegions
        if (allBuffered.length === 0) {
          return
        }
        // cellDataMode is defined per-subclass; cast widens self structurally
        const helperSelf = self as unknown as Parameters<
          typeof callMultiSampleVariantCellData
        >[0]
        await self.fetchRegions(allBuffered, async (ctx: FetchContext) => {
          const result = await callMultiSampleVariantCellData(helperSelf, ctx)
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        layout,
        rowHeightMode,
        lengthCutoffFilter,
        jexlFilters,
        clusterTree,
        treeAreaWidth,
        subtreeFilter,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(layout.length ? { layout } : {}),
        ...(rowHeightMode !== 0 ? { rowHeightMode } : {}),
        ...(lengthCutoffFilter !== Number.MAX_SAFE_INTEGER
          ? { lengthCutoffFilter }
          : {}),
        ...(jexlFilters?.length ? { jexlFilters } : {}),
        ...(clusterTree !== undefined ? { clusterTree } : {}),
        ...(treeAreaWidth !== 80 ? { treeAreaWidth } : {}),
        ...(subtreeFilter?.length ? { subtreeFilter } : {}),
      } as typeof snap
    })
}

export type MultiSampleVariantBaseStateModel = ReturnType<
  typeof MultiSampleVariantBaseModelF
>
export type MultiSampleVariantBaseModel =
  Instance<MultiSampleVariantBaseStateModel>
