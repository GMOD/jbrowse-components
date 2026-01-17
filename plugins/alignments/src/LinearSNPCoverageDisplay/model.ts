import { lazy } from 'react'

import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { cast, getSnapshot, isAlive, types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import FilterListIcon from '@mui/icons-material/FilterList'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { SharedModificationsMixin } from '../shared/SharedModificationsMixin.ts'
import { getUniqueModifications } from '../shared/getUniqueModifications.ts'
import { getSNPCoverageLegendItems } from '../shared/legendUtils.ts'
import { isDefaultFilterFlags } from '../shared/util.ts'
import { createAutorun } from '../util.ts'

import type { ColorBy, FilterBy } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

// lazies
const Tooltip = lazy(() => import('./components/Tooltip.tsx'))
const FilterArcsByScoreDialog = lazy(
  () => import('./components/FilterArcsByScoreDialog.tsx'),
)

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

type LGV = LinearGenomeViewModel

/**
 * #stateModel LinearSNPCoverageDisplay
 * extends
 * - [LinearWiggleDisplay](../linearwiggledisplay)
 */
function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearSNPCoverageDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      SharedModificationsMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSNPCoverageDisplay'),
        /**
         * #property
         */
        showInterbaseCounts: types.maybe(types.boolean),
        /**
         * #property
         */
        showInterbaseIndicators: types.maybe(types.boolean),
        /**
         * #property
         */
        showArcs: types.maybe(types.boolean),
        /**
         * #property
         */
        minArcScore: types.optional(types.number, 0),
        /**
         * #property
         */
        filterBySetting: types.frozen<FilterBy | undefined>(),
        /**
         * #property
         */
        colorBySetting: types.frozen<ColorBy | undefined>(),
        /**
         * #property
         */
        jexlFilters: types.optional(types.array(types.string), []),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get colorBy() {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },

      /**
       * #getter
       */
      get filterBy() {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },
      /**
       * #action
       */
      setFilterBy(filter: FilterBy) {
        self.filterBySetting = {
          ...filter,
        }
      },
      /**
       * #action
       */
      setColorScheme(colorBy?: ColorBy) {
        self.colorBySetting = colorBy
          ? {
              ...colorBy,
            }
          : undefined
      },
      /**
       * #action
       */
      setJexlFilters(filters: string[]) {
        self.jexlFilters = cast(filters)
      },
    }))
    .views(self => {
      const { adapterProps: superAdapterProps } = self
      return {
        /**
         * #getter
         */
        get modificationThreshold() {
          return self.colorBy?.modifications?.threshold ?? 10
        },
        /**
         * #getter
         */
        get rendererConfig() {
          const { showArcs, showInterbaseCounts, showInterbaseIndicators } =
            self
          // @ts-ignore
          const conf = self.configuration.renderers?.[self.rendererTypeName]
          return {
            showInterbaseCounts:
              showInterbaseCounts ??
              readConfObject(conf, 'showInterbaseCounts'),
            showInterbaseIndicators:
              showInterbaseIndicators ??
              readConfObject(conf, 'showInterbaseIndicators'),
            showArcs: showArcs ?? readConfObject(conf, 'showArcs'),
          }
        },
        /**
         * #getter
         */
        get showArcsSetting() {
          return this.rendererConfig.showArcs
        },
        /**
         * #getter
         * Collect all skip features from rendered blocks for cross-region arc drawing
         * Uses a Map to deduplicate features that appear in multiple blocks
         * Only computed when showArcsSetting is true for performance
         * Filters out arcs with score below minArcScore
         */
        get skipFeatures(): Feature[] {
          if (!this.showArcsSetting) {
            return []
          }
          const { minArcScore } = self
          const skipFeaturesMap = new Map<string, Feature>()
          for (const block of self.blockState.values()) {
            if (block.features) {
              for (const feature of block.features.values()) {
                if (
                  feature.get('type') === 'skip' &&
                  (feature.get('score') ?? 1) >= minArcScore
                ) {
                  skipFeaturesMap.set(feature.id(), feature)
                }
              }
            }
          }
          return [...skipFeaturesMap.values()]
        },
        /**
         * #getter
         */
        get showInterbaseCountsSetting() {
          return this.rendererConfig.showInterbaseCounts
        },
        /**
         * #getter
         */
        get showInterbaseIndicatorsSetting() {
          return this.rendererConfig.showInterbaseIndicators
        },

        /**
         * #getter
         */
        get autorunReady() {
          const view = getContainingView(self) as LGV
          return (
            view.initialized &&
            self.featureDensityStatsReadyAndRegionNotTooLarge &&
            !self.error
          )
        },

        /**
         * #method
         */
        adapterProps() {
          const superProps = superAdapterProps()
          const { filters, filterBy } = self
          return {
            ...superProps,
            filters,
            filterBy,
            modificationThreshold: this.modificationThreshold,
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setShowInterbaseIndicators(arg: boolean) {
        self.showInterbaseIndicators = arg
      },
      /**
       * #action
       */
      setShowInterbaseCounts(arg: boolean) {
        self.showInterbaseCounts = arg
      },
      /**
       * #action
       */
      setShowArcs(arg: boolean) {
        self.showArcs = arg
      },
      /**
       * #action
       */
      setMinArcScore(arg: number) {
        self.minArcScore = arg
      },
    }))
    .actions(self => ({
      afterAttach() {
        createAutorun(
          self,
          async () => {
            self.setModificationsReady(false)
            if (!self.autorunReady) {
              return
            }
            const view = getContainingView(self) as LGV
            const { staticBlocks } = view
            const { colorBy } = self
            if (colorBy?.type === 'modifications') {
              const { modifications, simplexModifications } =
                await getUniqueModifications({
                  model: self,
                  adapterConfig: getConf(self.parentTrack, 'adapter'),
                  blocks: staticBlocks,
                })
              if (isAlive(self)) {
                self.updateVisibleModifications(modifications)
                self.setSimplexModifications(simplexModifications)
                self.setModificationsReady(true)
              }
            } else {
              self.setModificationsReady(true)
            }
          },
          { delay: 1000 },
        )
      },
    }))

    .views(self => {
      const {
        renderProps: superRenderProps,
        renderingProps: superRenderingProps,
        renderSvg: superRenderSvg,
        wiggleBaseTrackMenuItems,
      } = self
      return {
        /**
         * #getter
         */
        renderReady() {
          const superProps = superRenderProps()
          return !superProps.notReady && self.modificationsReady
        },

        /**
         * #method
         */
        renderProps() {
          const { colorBy, visibleModifications, simplexModifications } = self
          return {
            ...superRenderProps(),
            notReady: !this.renderReady(),
            colorBy,
            visibleModifications: Object.fromEntries(
              visibleModifications.toJSON(),
            ),
            simplexModifications: [...simplexModifications],
          }
        },

        /**
         * #method
         */
        renderingProps() {
          return {
            ...superRenderingProps(),
            displayModel: self,
          }
        },

        /**
         * #method
         * Custom renderSvg that includes sashimi arcs
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSNPCoverageSvg } =
            await import('./components/renderSvg.tsx')
          return renderSNPCoverageSvg(self, opts, superRenderSvg)
        },

        /**
         * #getter
         */
        get TooltipComponent() {
          return Tooltip
        },

        /**
         * #getter
         */
        get adapterConfig() {
          const subadapter = getConf(self.parentTrack, 'adapter')
          const view = getContainingView(self) as LGV
          const session = getSession(self)
          const { assemblyManager } = session
          const assemblyName = view.assemblyNames[0]
          const assembly = assemblyName
            ? assemblyManager.get(assemblyName)
            : undefined
          const sequenceAdapterConfig =
            assembly?.configuration?.sequence?.adapter
          const sequenceAdapter = sequenceAdapterConfig
            ? getSnapshot(sequenceAdapterConfig)
            : undefined
          return {
            type: 'SNPCoverageAdapter',
            subadapter,
            sequenceAdapter,
          }
        },

        /**
         * #getter
         */
        get rendererTypeName() {
          return rendererTypes.get('snpcoverage')
        },

        /**
         * #getter
         */
        get graphType() {
          return true
        },

        /**
         * #method
         */
        contextMenuItems() {
          return []
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...wiggleBaseTrackMenuItems(),
            {
              label: 'Show...',
              icon: VisibilityIcon,
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Show tooltips',
                  type: 'checkbox',
                  checked: self.showTooltipsEnabled,
                  onClick: () => {
                    self.setShowTooltips(!self.showTooltipsEnabled)
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
                {
                  label: 'Insertion/clipping indicators',
                  type: 'checkbox',
                  checked: self.showInterbaseIndicatorsSetting,
                  onClick: () => {
                    self.setShowInterbaseIndicators(
                      !self.showInterbaseIndicatorsSetting,
                    )
                  },
                },
                {
                  label: 'Insertion/clipping counts',
                  type: 'checkbox',
                  checked: self.showInterbaseCountsSetting,
                  onClick: () => {
                    self.setShowInterbaseCounts(
                      !self.showInterbaseCountsSetting,
                    )
                  },
                },
                {
                  label: 'Sashimi arcs',
                  type: 'checkbox',
                  checked: self.showArcsSetting,
                  onClick: () => {
                    self.setShowArcs(!self.showArcsSetting)
                  },
                },
              ],
            },
            {
              label: 'Filter arcs by score...',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterArcsByScoreDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },

        /**
         * #getter
         */
        get filters() {
          return new SerializableFilterChain({ filters: self.jexlFilters })
        },

        /**
         * #method
         * Returns legend items for SNP coverage display
         */
        legendItems(theme: Theme): LegendItem[] {
          return getSNPCoverageLegendItems(
            self.colorBy,
            self.visibleModifications,
            theme,
          )
        },
      }
    })
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (snap) {
        // @ts-expect-error
        const { colorBy, colorBySetting, filterBySetting, filterBy, ...rest } =
          snap
        return {
          ...rest,
          filterBySetting: filterBySetting || filterBy,
          colorBySetting: colorBySetting || colorBy,
        }
      }
      return snap
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        showInterbaseCounts,
        showInterbaseIndicators,
        showArcs,
        minArcScore,
        filterBySetting,
        colorBySetting,
        jexlFilters,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(showInterbaseCounts !== undefined ? { showInterbaseCounts } : {}),
        ...(showInterbaseIndicators !== undefined
          ? { showInterbaseIndicators }
          : {}),
        ...(showArcs !== undefined ? { showArcs } : {}),
        ...(minArcScore ? { minArcScore } : {}),
        ...(!isDefaultFilterFlags(filterBySetting) ? { filterBySetting } : {}),
        ...(colorBySetting !== undefined ? { colorBySetting } : {}),
        // mst types wrong, nullish needed
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        ...(jexlFilters?.length ? { jexlFilters } : {}),
      } as typeof snap
    })
}

export type SNPCoverageDisplayStateModel = ReturnType<typeof stateModelFactory>
export type SNPCoverageDisplayModel = Instance<SNPCoverageDisplayStateModel>

export default stateModelFactory
