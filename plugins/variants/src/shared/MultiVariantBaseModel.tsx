import { lazy } from 'react'

import { fromNewick } from '@gmod/hclust'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getSession } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { linearBareDisplayStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
import CategoryIcon from '@mui/icons-material/Category'
import FilterListIcon from '@mui/icons-material/FilterList'
import HeightIcon from '@mui/icons-material/Height'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import VisibilityIcon from '@mui/icons-material/Visibility'
// @ts-expect-error
import { ascending } from '@mui/x-charts-vendor/d3-array'
import deepEqual from 'fast-deep-equal'
import { cast, types } from 'mobx-state-tree'

import { cluster, hierarchy } from '../d3-hierarchy2'
import { getSources } from './getSources'

import type { SampleInfo, Source } from './types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

// lazies
const SetColorDialog = lazy(() => import('./components/SetColorDialog'))
const MAFFilterDialog = lazy(() => import('./components/MAFFilterDialog'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog'))
const ClusterDialog = lazy(
  () => import('./components/MultiVariantClusterDialog/ClusterDialog'),
)
const SetRowHeightDialog = lazy(() => import('./components/SetRowHeightDialog'))

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
         */
        minorAlleleFrequencyFilter: types.optional(types.number, 0),

        /**
         * #property
         */
        showSidebarLabelsSetting: types.optional(types.boolean, true),

        /**
         * #property
         */
        showTree: types.optional(types.boolean, true),

        /**
         * #property
         */
        renderingMode: types.optional(types.string, 'alleleCount'),

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
         */
        referenceDrawingMode: types.optional(types.string, 'skip'),
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
      sourcesLoadingStopToken: undefined as string | undefined,
      /**
       * #volatile
       */
      simplifiedFeaturesStopToken: undefined as string | undefined,
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
      hoveredTreeNode: undefined as any,
      /**
       * #volatile
       */
      treeCanvas: undefined as HTMLCanvasElement | undefined,
      /**
       * #volatile
       */
      mouseoverCanvas: undefined as HTMLCanvasElement | undefined,
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
      setHoveredTreeNode(node: any) {
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
      setSourcesLoading(str: string) {
        if (self.sourcesLoadingStopToken) {
          stopStopToken(self.sourcesLoadingStopToken)
        }
        self.sourcesLoadingStopToken = str
      },
      /**
       * #action
       */
      setSimplifiedFeaturesLoading(str: string) {
        if (self.simplifiedFeaturesStopToken) {
          stopStopToken(self.simplifiedFeaturesStopToken)
        }
        self.simplifiedFeaturesStopToken = str
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
        self.minorAlleleFrequencyFilter = arg
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
        self.showTree = arg
      },
      /**
       * #action
       */
      setPhasedMode(arg: string) {
        self.renderingMode = arg
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
        self.referenceDrawingMode = arg
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
       */
      get activeFilters() {
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
      get preSources() {
        return self.layout.length ? self.layout : self.sourcesVolatile
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
        const sourcesWithLayout = self.layout.length
          ? self.layout
          : self.sourcesVolatile
        return sourcesWithLayout
          ? getSources({
              sources: sourcesWithLayout,
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
        return hierarchy(tree, (d: any) => d.children)
          .sum((d: any) => (d.children ? 0 : 1))
          .sort((a: any, b: any) =>
            ascending(a.data.height || 1, b.data.height || 1),
          )
      },
    }))
    .views(self => {
      const {
        renderProps: superRenderProps,
        renderingProps: superRenderingProps,
      } = self

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
        get totalHeight() {
          return self.rowHeightMode === 'auto'
            ? this.availableHeight
            : this.nrow * self.rowHeightMode
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
          if (r) {
            const clust = cluster()
              .size([this.totalHeight, self.treeAreaWidth])!
              // @ts-expect-error
              .separation(() => 1)
            clust(r)
            return r
          } else {
            return undefined
          }
        },
        /**
         * #method
         */
        adapterProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            rpcDriverName: self.rpcDriverName,
            config: self.rendererConfig,
          }
        },
        /**
         * #method
         * props for the renderer's React "Rendering" component - client-side
         * only, never sent to the worker
         */
        renderingProps() {
          return {
            ...superRenderingProps(),
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
              label: 'Show sidebar labels',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showSidebarLabelsSetting,
              onClick: () => {
                self.setShowSidebarLabels(!self.showSidebarLabelsSetting)
              },
            },
            {
              label: 'Show tree',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showTree,
              disabled: !self.clusterTree,
              onClick: () => {
                self.setShowTree(!self.showTree)
              },
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
                    !self.hasPhased
                      ? ' (disabled, no phased variants found)'
                      : ''
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
              label: 'Skip drawing reference alleles',
              helpText:
                'When this setting is on, the background is filled with grey, and then we skip drawing reference alleles. This helps drawing with drawing overlapping SVs. When this setting is off, each reference allele is colored grey',
              type: 'checkbox',
              checked: self.referenceDrawingMode === 'skip',
              onClick: () => {
                if (self.referenceDrawingMode === 'skip') {
                  self.setReferenceDrawingMode('draw')
                } else {
                  self.setReferenceDrawingMode('skip')
                }
              },
            },
            {
              label: 'Filter by',
              icon: FilterListIcon,
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
        return self.rowHeight >= 6 && self.showSidebarLabelsSetting
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
    }))
}

export type MultiVariantBaseStateModel = ReturnType<
  typeof MultiVariantBaseModelF
>
export type MultiVariantBaseModel = Instance<MultiVariantBaseStateModel>
