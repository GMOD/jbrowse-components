import { lazy } from 'react'

import { fromNewick } from '@gmod/hclust'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { set1 } from '@jbrowse/core/ui/colors'
import {
  SimpleFeature,
  getContainingTrack,
  getSession,
} from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import { linearBareDisplayStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
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
import { cluster, hierarchy } from '../d3-hierarchy2/index.ts'

import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from './components/types.ts'
import type { SampleInfo, Source } from './types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// lazies
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const MAFFilterDialog = lazy(() => import('./components/MAFFilterDialog.tsx'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog.tsx'))
const ClusterDialog = lazy(
  () => import('./components/MultiVariantClusterDialog/ClusterDialog.tsx'),
)
const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog.tsx'),
)

/**
 * #stateModel MultiVariantBaseModel
 * extends
 * - [LinearBareDisplay](../linearbaredisplay)
 */
export default function MultiVariantBaseModelF(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      linearBareDisplayStateModelFactory(configSchema),
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
      }),
    )
    .volatile(() => ({
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
        | { genotype: string; name: string }
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
    }))
    .views(self => ({
      /**
       * #getter
       * Returns the effective rendering mode, falling back to config
       */
      get renderingMode(): string {
        return self.renderingModeSetting ?? getConf(self, 'renderingMode')
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
      setRowHeight(arg: number | 'auto') {
        self.rowHeightMode = arg
      },
      /**
       * #action
       */
      setHoveredGenotype(arg?: { genotype: string; name: string }) {
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
          self.layout.some((source, idx) => source.name !== layout[idx]?.name)

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
       * #getter
       */
      get activeFilters() {
        // config jexlFilters are deferred evaluated so they are prepended with
        // jexl at runtime rather than being stored with jexl in the config
        return (
          self.jexlFilters ??
          getConf(self, 'jexlFilters').map((r: string) => `jexl:${r}`)
        )
      },
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
        return self.sourcesVolatile
          ? getSources({
              sources: self.sourcesVolatile,
              layout: self.layout.length ? self.layout : undefined,
              renderingMode: self.renderingMode,
              sampleInfo: self.sampleInfo,
            })
          : undefined
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
        return hierarchy(tree, (d: ClusterHierarchyNode) => d.children)
          .sum((d: ClusterHierarchyNode) => (d.children ? 0 : 1))
          .sort((a: ClusterHierarchyNode, b: ClusterHierarchyNode) =>
            ascending(a.data.height || 1, b.data.height || 1),
          )
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
                self.sources.map(source => [source.name, source]),
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
            config: self.rendererConfig,
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
                {
                  label: 'Minor allele frequency',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      MAFFilterDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
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
            filters: self.activeFilters,
          }),
        }
      },
      /**
       * #method
       */
      renderingProps() {
        return {
          displayModel: self,
          async onFeatureClick(_: React.MouseEvent, featureId: string) {
            const session = getSession(self)
            const { rpcManager } = session
            try {
              const sessionId = getRpcSessionId(self)
              const track = getContainingTrack(self)

              const { feature } = (await rpcManager.call(
                sessionId,
                'MultiVariantGetFeatureDetails',
                {
                  featureId,
                  sessionId,
                  trackInstanceId: track.id,
                  rendererType: self.rendererTypeName,
                },
              )) as { feature: SimpleFeatureSerialized | undefined }

              if (isAlive(self) && feature) {
                self.selectFeature(new SimpleFeature(feature))
              }
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
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
          let maxAltAlleles = 1
          const features = self.featuresVolatile
          if (features) {
            for (const feature of features) {
              const alt = feature.get('ALT') as string[] | undefined
              if (alt && alt.length > maxAltAlleles) {
                maxAltAlleles = alt.length
              }
            }
          }
          const items: LegendItem[] = [
            { color: REFERENCE_COLOR, label: 'Reference' },
            { color: set1[0], label: 'Alt allele 1' },
          ]
          if (maxAltAlleles >= 2) {
            items.push({ color: set1[1], label: 'Alt allele 2' })
          }
          if (maxAltAlleles >= 3) {
            items.push({ color: set1[2], label: 'Alt allele 3' })
          }
          items.push({ color: UNPHASED_COLOR, label: 'Unphased' })
          return items
        }
        return [
          { color: REFERENCE_COLOR, label: 'Homozygous reference' },
          { color: getAltColorForDosage(0.5), label: 'Heterozygous alt' },
          { color: getAltColorForDosage(1), label: 'Homozygous alt' },
          { color: OTHER_ALT_COLOR, label: 'Other alt allele' },
          { color: NO_CALL_COLOR, label: 'No call' },
        ]
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
      } as typeof snap
    })
}

export type MultiVariantBaseStateModel = ReturnType<
  typeof MultiVariantBaseModelF
>
export type MultiVariantBaseModel = Instance<MultiVariantBaseStateModel>
