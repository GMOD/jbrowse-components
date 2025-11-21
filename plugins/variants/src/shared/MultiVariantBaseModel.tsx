import { lazy } from 'react'

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
import deepEqual from 'fast-deep-equal'
import { cast, types } from 'mobx-state-tree'

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
        showSidebarLabelsSetting: true,

        /**
         * #property
         */
        renderingMode: types.optional(types.string, 'alleleCount'),

        /**
         * #property
         * used only if autoHeight is false
         */
        rowHeightSetting: types.optional(types.number, 8),

        /**
         * #property
         * used only if autoHeight is false
         */
        autoHeight: true,

        /**
         * #property
         */
        lengthCutoffFilter: Number.MAX_SAFE_INTEGER,

        /**
         * #property
         */
        jexlFilters: types.maybe(types.array(types.string)),

        /**
         * #property
         */
        referenceDrawingMode: 'skip',
        /**
         * #property
         */
        clusterTree: types.frozen(),
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
      setRowHeight(arg: number) {
        self.rowHeightSetting = arg
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
      setFeatures(f: Feature[]) {
        self.featuresVolatile = f
      },
      /**
       * #action
       */
      setLayout(layout: Source[]) {
        self.layout = layout
      },
      /**
       * #action
       */
      clearLayout() {
        self.layout = []
        self.clusterTree = cast(undefined)
      },
      /**
       * #action
       */
      setClusterTree(tree: unknown) {
        self.clusterTree = cast(tree)
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
      setPhasedMode(arg: string) {
        self.renderingMode = arg
      },
      /**
       * #action
       */
      setAutoHeight(arg: boolean) {
        self.autoHeight = arg
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
        const { hierarchy } = require('d3-hierarchy')
        const { ascending } = require('d3-array')
        const tree = self.clusterTree
        return tree
          ? hierarchy(tree, (d: any) => d.children)
              .sum((d: any) => (d.children ? 0 : 1))
              .sort((a: any, b: any) =>
                ascending(a.data.height || 1, b.data.height || 1),
              )
          : undefined
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
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
         */
        get rowHeight() {
          const { sources, autoHeight, rowHeightSetting, height } = self
          return autoHeight ? height / (sources?.length || 1) : rowHeightSetting
        },
        /**
         * #getter
         */
        get totalHeight() {
          return self.sources ? self.sources.length * this.rowHeight : 1
        },
        /**
         * #getter
         */
        get hierarchy() {
          const { cluster } = require('d3-hierarchy')
          const r = self.root
          if (r) {
            const treeAreaWidth = 80
            const clust = cluster()
              .size([this.totalHeight, treeAreaWidth])
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
            displayModel: self,
            config: self.rendererConfig,
          }
        },
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
              label: 'Reference mode',
              type: 'subMenu',
              subMenu: [
                {
                  label:
                    'Fill background grey, skip reference allele mouseovers (helps with large overlapping SVs)',
                  type: 'radio',
                  checked: self.referenceDrawingMode === 'skip',
                  onClick: () => {
                    self.setReferenceDrawingMode('skip')
                  },
                },
                {
                  label:
                    "Don't fill background grey, only draw actual reference alleles as grey",
                  type: 'radio',
                  checked: self.referenceDrawingMode === 'draw',
                  onClick: () => {
                    self.setReferenceDrawingMode('draw')
                  },
                },
              ],
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
