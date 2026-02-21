import { lazy } from 'react'

import { fromNewick } from '@gmod/hclust'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { set1 } from '@jbrowse/core/ui/colors'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import { TrackHeightMixin } from '@jbrowse/plugin-linear-genome-view'
import CategoryIcon from '@mui/icons-material/Category'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import HeightIcon from '@mui/icons-material/Height'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { ascending } from '@mui/x-charts-vendor/d3-array'
import deepEqual from 'fast-deep-equal'

import {
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  REFERENCE_COLOR,
  UNPHASED_COLOR,
  getAltColorForDosage,
} from './constants.ts'
import { getSources } from './getSources.ts'
import { createMAFFilterMenuItem } from './mafFilterUtils.ts'
import { cluster, hierarchy } from '../d3-hierarchy2/index.ts'

import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from './components/types.ts'
import type { SampleInfo, Source } from './types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// lazies
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog.tsx'))

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

const ClusterDialog = lazy(
  () => import('./components/MultiVariantClusterDialog/ClusterDialog.tsx'),
)
const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog.tsx'),
)

/**
 * #stateModel MultiVariantBaseModel
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 */
export default function MultiVariantBaseModelF(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantMatrixDisplay'),

        /**
         * #property
         */
        layout: types.optional(types.frozen<Source[]>(), []),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         * When undefined, falls back to config value
         */
        minorAlleleFrequencyFilterSetting: types.maybe(types.number),

        /**
         * #property
         * When undefined, falls back to config value
         */
        showSidebarLabelsSetting: types.maybe(types.boolean),

        /**
         * #property
         * When undefined, falls back to config value
         */
        showTreeSetting: types.maybe(types.boolean),

        /**
         * #property
         * When undefined, falls back to config value
         */
        renderingModeSetting: types.maybe(types.string),

        /**
         * #property
         * Controls row height: 'auto' calculates from available height,
         * or a number specifies manual pixel height per row
         */
        rowHeightMode: types.optional(
          types.union(types.literal('auto'), types.number),
          'auto',
        ),

        /**
         * #property
         */
        lengthCutoffFilter: types.optional(
          types.number,
          Number.MAX_SAFE_INTEGER,
        ),

        /**
         * #property
         */
        jexlFilters: types.maybe(types.array(types.string)),

        /**
         * #property
         * When undefined, falls back to config value (showReferenceAlleles)
         */
        referenceDrawingModeSetting: types.maybe(types.string),
        /**
         * #property
         */
        clusterTree: types.maybe(types.string),
        /**
         * #property
         */
        treeAreaWidth: types.optional(types.number, 80),
        /**
         * #property
         * Height reserved for elements above the main display (e.g., connecting lines in matrix view)
         */
        lineZoneHeight: types.optional(types.number, 0),
        /**
         * #property
         * Filter to show only a subtree of samples
         */
        subtreeFilter: types.maybe(types.array(types.string)),
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

      return snap
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      showLegend: true,
      /**
       * #volatile
       */
      regionTooLarge: false,
      /**
       * #volatile
       */
      regionTooLargeReason: '',
      /**
       * #volatile
       */
      sourcesLoadingStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       */
      simplifiedFeaturesStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       */
      featureUnderMouseVolatile: undefined as Feature | undefined,
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
      featuresVolatile: undefined as Feature[] | undefined,
      /**
       * #volatile
       */
      hasPhased: false,
      /**
       * #volatile
       */
      sampleInfo: undefined as undefined | Record<string, SampleInfo>,
      /**
       * #volatile
       */
      hoveredGenotype: undefined as
        | (Record<string, unknown> & { genotype: string; name: string })
        | undefined,
      /**
       * #volatile
       */
      hoveredTreeNode: undefined as HoveredTreeNode | undefined,
      /**
       * #volatile
       */
      treeCanvas: undefined as HTMLCanvasElement | undefined,
      /**
       * #volatile
       */
      mouseoverCanvas: undefined as HTMLCanvasElement | undefined,
      webglCellData: undefined as unknown,
      webglCellDataLoading: false,
    }))
    .actions(self => ({
      setWebGLCellData(data: unknown) {
        self.webglCellData = data
      },
      setWebGLCellDataLoading(val: boolean) {
        self.webglCellDataLoading = val
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Returns the effective rendering mode, falling back to config
       */
      get renderingMode(): string {
        return (
          self.renderingModeSetting ?? getConf(self as any, 'renderingMode')
        )
      },

      get featureWidgetType() {
        return {
          type: 'VariantFeatureWidget',
          id: 'variantFeature',
        }
      },

      get featureDensityStatsReadyAndRegionNotTooLarge() {
        return !self.regionTooLarge
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
      setRegionTooLarge(val: boolean, reason?: string) {
        self.regionTooLarge = val
        self.regionTooLargeReason = reason ?? ''
      },
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
        if (isSessionModelWithWidgets(session)) {
          const { rpcManager } = session
          const sessionId = getRpcSessionId(self)
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const adapterConfig = getConf(track, 'adapter')
          const { type, id } = self.featureWidgetType
          rpcManager
            .call(sessionId, 'CoreGetMetadata', { adapterConfig })
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
      setRowHeight(arg: number | 'auto') {
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
      setHoveredTreeNode(node?: HoveredTreeNode) {
        self.hoveredTreeNode = node
      },
      /**
       * #action
       */
      setTreeCanvasRef(ref: HTMLCanvasElement | null) {
        self.treeCanvas = ref || undefined
      },
      /**
       * #action
       */
      setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
        self.mouseoverCanvas = ref || undefined
      },
      /**
       * #action
       */
      setTreeAreaWidth(width: number) {
        self.treeAreaWidth = width
      },
      /**
       * #action
       */
      setFeatures(f: Feature[]) {
        self.featuresVolatile = f
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
      setLayout(layout: Source[], clearTree = true) {
        const orderChanged =
          clearTree &&
          self.clusterTree &&
          self.layout.length === layout.length &&
          self.layout.some(
            (source: Source, idx: number) => source.name !== layout[idx]?.name,
          )

        self.layout = layout
        if (orderChanged) {
          self.clusterTree = undefined
        }
      },
      /**
       * #action
       */
      clearLayout() {
        self.layout = []
        self.clusterTree = undefined
      },
      /**
       * #action
       */
      setClusterTree(tree?: string) {
        self.clusterTree = tree
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
      setSimplifiedFeaturesLoading(token: StopToken) {
        if (self.simplifiedFeaturesStopToken) {
          stopStopToken(self.simplifiedFeaturesStopToken)
        }
        self.simplifiedFeaturesStopToken = token
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
        self.minorAlleleFrequencyFilterSetting = arg
      },
      /**
       * #action
       */
      setShowSidebarLabels(arg: boolean) {
        self.showSidebarLabelsSetting = arg
      },
      /**
       * #action
       */
      setShowTree(arg: boolean) {
        self.showTreeSetting = arg
      },
      /**
       * #action
       */
      setSubtreeFilter(names?: string[]) {
        self.subtreeFilter = names ? cast(names) : undefined
      },
      /**
       * #action
       */
      setPhasedMode(arg: string) {
        const currentMode =
          self.renderingModeSetting ?? getConf(self, 'renderingMode')
        if (currentMode !== arg) {
          self.layout = []
          self.clusterTree = undefined
        }
        self.renderingModeSetting = arg
      },
      /**
       * #action
       * Toggle auto height mode. When turning off, uses default of 10px per row.
       */
      setAutoHeight(auto: boolean) {
        self.rowHeightMode = auto ? 'auto' : 10
      },
      /**
       * #action
       */
      setHasPhased(arg: boolean) {
        self.hasPhased = arg
      },
      /**
       * #action
       */
      setSampleInfo(arg: Record<string, SampleInfo>) {
        if (!deepEqual(arg, self.sampleInfo)) {
          self.sampleInfo = arg
        }
      },
      /**
       * #action
       */
      setReferenceDrawingMode(arg: string) {
        self.referenceDrawingModeSetting = arg
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get autoHeight() {
        return self.rowHeightMode === 'auto'
      },

      /**
       * #getter
       * Returns the effective minor allele frequency filter, falling back to config
       */
      get minorAlleleFrequencyFilter() {
        return (
          self.minorAlleleFrequencyFilterSetting ??
          getConf(self, 'minorAlleleFrequencyFilter')
        )
      },

      /**
       * #getter
       * Returns the effective showSidebarLabels setting, falling back to config
       */
      get showSidebarLabels() {
        return (
          self.showSidebarLabelsSetting ?? getConf(self, 'showSidebarLabels')
        )
      },

      /**
       * #getter
       * Returns the effective showTree setting, falling back to config
       */
      get showTree() {
        return self.showTreeSetting ?? getConf(self, 'showTree')
      },

      /**
       * #getter
       * Returns the effective reference drawing mode, derived from config showReferenceAlleles
       */
      get referenceDrawingMode(): string {
        if (self.referenceDrawingModeSetting !== undefined) {
          return self.referenceDrawingModeSetting
        }
        const showRef = getConf(self, 'showReferenceAlleles')
        return showRef ? 'draw' : 'skip'
      },

      /**
       * #method
       */
      activeFilters() {
        // config jexlFilters are deferred evaluated so they are prepended with
        // jexl at runtime rather than being stored with jexl in the config
        return (
          self.jexlFilters ??
          getConf(self, 'jexlFilters').map((r: string) => `jexl:${r}`)
        )
      },

      /**
       * #getter
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
       */
      get sources() {
        let result = self.sourcesVolatile
          ? getSources({
              sources: self.sourcesVolatile,
              layout: self.layout.length ? self.layout : undefined,
              renderingMode: self.renderingMode,
              sampleInfo: self.sampleInfo,
            })
          : undefined

        // Filter to subtree if filter is active
        // Use baseName for phased mode where sources have names like "SAMPLE HP0"
        if (result && self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          result = result.filter(s => filterSet.has(s.baseName ?? s.name))
        }
        return result
      },
      /**
       * #getter
       */
      get root() {
        const newick = self.clusterTree
        if (!newick) {
          return undefined
        }
        const tree = fromNewick(newick)
        let root = hierarchy(tree, (d: ClusterHierarchyNode) => d.children)
          .sum((d: ClusterHierarchyNode) => (d.children ? 0 : 1))
          .sort((a: ClusterHierarchyNode, b: ClusterHierarchyNode) =>
            ascending(a.data.height || 1, b.data.height || 1),
          )

        // If subtree filter is active, find the matching subtree
        if (self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          const getLeafNames = (node: ClusterHierarchyNode): string[] => {
            if (!node.children?.length) {
              return [node.data.name]
            }
            return node.children.flatMap(child => getLeafNames(child))
          }
          const findSubtree = (
            node: ClusterHierarchyNode,
          ): ClusterHierarchyNode | undefined => {
            const leafNames = getLeafNames(node)
            if (
              leafNames.length === filterSet.size &&
              leafNames.every(name => filterSet.has(name))
            ) {
              return node
            }
            if (node.children) {
              for (const child of node.children) {
                const found = findSubtree(child)
                if (found) {
                  return found
                }
              }
            }
            return undefined
          }
          const subtree = findSubtree(root)
          if (subtree) {
            root = subtree
          }
        }
        return root
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self

      return {
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
          return self.sources?.length || 1
        },

        /**
         * #getter
         */
        get rowHeight() {
          return self.rowHeightMode === 'auto'
            ? this.availableHeight / this.nrow
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
          const clust = cluster()
          clust.size([this.rowHeight * this.nrow, self.treeAreaWidth])
          clust.separation(() => 1)
          clust(r)
          return r
        },
        /**
         * #method
         */
        adapterProps() {
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
          }
        },
      }
    })
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
              subMenu: [
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
                  label: 'Show reference alleles',
                  helpText:
                    'When this setting is off, the background is colored solid grey and only ALT alleles are colored on top of it. This makes it easier to see potentially overlapping structural variants',
                  type: 'checkbox',
                  checked: self.referenceDrawingMode !== 'skip',
                  onClick: () => {
                    self.setReferenceDrawingMode(
                      self.referenceDrawingMode === 'skip' ? 'draw' : 'skip',
                    )
                  },
                },
                {
                  label: 'Show legend',
                  type: 'checkbox',
                  checked: self.showLegend,
                  onClick: () => {
                    self.setShowLegend(!self.showLegend)
                  },
                },
              ],
            },
            {
              label: 'Row height',
              icon: HeightIcon,
              subMenu: [
                {
                  label: 'Manually set row height',
                  disabled: self.autoHeight,
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
                  label: 'Auto-adjust to display height',
                  type: 'checkbox',
                  checked: self.autoHeight,
                  onClick: () => {
                    self.setAutoHeight(!self.autoHeight)
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
        return self.rowHeight * (self.sources?.length || 1)
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
        // Note: rowHeightMode is intentionally excluded because Matrix and
        // Regular displays have different defaults
        return {
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          showSidebarLabelsSetting: self.showSidebarLabelsSetting,
          showTree: self.showTree,
          renderingMode: self.renderingMode,
          lengthCutoffFilter: self.lengthCutoffFilter,
          jexlFilters: self.jexlFilters,
          referenceDrawingMode: self.referenceDrawingMode,
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
       */
      renderProps() {
        const superProps = self.adapterProps()
        return {
          ...superProps,
          notReady: superProps.notReady || !self.sources || !self.featuresReady,
          height: self.height,
          totalHeight: self.totalHeight,
          renderingMode: self.renderingMode,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
          rowHeight: self.rowHeight,
          sources: self.sources,
          scrollTop: self.scrollTop,
          referenceDrawingMode: self.referenceDrawingMode,
          filters: new SerializableFilterChain({
            filters: self.activeFilters(),
          }),
        }
      },
      /**
       * #method
       */
      renderingProps() {
        return {
          displayModel: self,
          onFeatureClick(_: React.MouseEvent, featureId: string) {
            const features = self.featuresVolatile
            if (features) {
              const feature = features.find(f => f.id() === featureId)
              if (feature && isAlive(self)) {
                self.selectFeature(feature)
              }
            }
          },
        }
      },
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
        const hasSecondaryAlt = self.featuresVolatile?.some(f => {
          const alt = f.get('ALT') as string[] | undefined
          return alt && alt.length > 1
        })
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
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { setupMultiVariantAutoruns } =
              await import('./setupMultiVariantAutoruns.ts')
            setupMultiVariantAutoruns(self)
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
        minorAlleleFrequencyFilterSetting,
        showSidebarLabelsSetting,
        showTreeSetting,
        renderingModeSetting,
        rowHeightMode,
        lengthCutoffFilter,
        jexlFilters,
        referenceDrawingModeSetting,
        clusterTree,
        treeAreaWidth,
        lineZoneHeight,
        subtreeFilter,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(layout.length ? { layout } : {}),
        ...(minorAlleleFrequencyFilterSetting !== undefined
          ? { minorAlleleFrequencyFilterSetting }
          : {}),
        ...(showSidebarLabelsSetting !== undefined
          ? { showSidebarLabelsSetting }
          : {}),
        ...(showTreeSetting !== undefined ? { showTreeSetting } : {}),
        ...(renderingModeSetting !== undefined ? { renderingModeSetting } : {}),
        ...(rowHeightMode !== 'auto' ? { rowHeightMode } : {}),
        ...(lengthCutoffFilter !== Number.MAX_SAFE_INTEGER
          ? { lengthCutoffFilter }
          : {}),
        ...(jexlFilters?.length ? { jexlFilters } : {}),
        ...(referenceDrawingModeSetting !== undefined
          ? { referenceDrawingModeSetting }
          : {}),
        ...(clusterTree !== undefined ? { clusterTree } : {}),
        ...(treeAreaWidth !== 80 ? { treeAreaWidth } : {}),
        ...(lineZoneHeight ? { lineZoneHeight } : {}),
        ...(subtreeFilter?.length ? { subtreeFilter } : {}),
      } as typeof snap
    })
}

export type MultiVariantBaseStateModel = ReturnType<
  typeof MultiVariantBaseModelF
>
export type MultiVariantBaseModel = Instance<MultiVariantBaseStateModel>
