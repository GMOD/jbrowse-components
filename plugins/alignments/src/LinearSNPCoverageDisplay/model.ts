import { lazy } from 'react'

import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getContainingView } from '@jbrowse/core/util'
import { cast, getEnv, isAlive, types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { SharedModificationsMixin } from '../shared/SharedModificationsMixin'
import { getUniqueModifications } from '../shared/getUniqueModifications'
import { createAutorun } from '../util'

import type { ColorBy, FilterBy } from '../shared/types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// lazies
const Tooltip = lazy(() => import('./components/Tooltip'))

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
       * Returns colorBy from parent if nested, else own colorBy
       */
      get colorBy() {
        const parent = self.parentDisplay
        return parent?.colorBy ?? self.colorBySetting ?? getConf(self, 'colorBy')
      },

      /**
       * #getter
       * Returns filterBy from parent if nested, else own filterBy
       */
      get filterBy() {
        const parent = self.parentDisplay
        return parent?.filterBy ?? self.filterBySetting ?? getConf(self, 'filterBy')
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
          const configBlob =
            getConf(self, ['renderers', self.rendererTypeName]) || {}

          const { showArcs, showInterbaseCounts, showInterbaseIndicators } =
            self
          return self.rendererType.configSchema.create(
            {
              ...configBlob,
              showInterbaseCounts:
                showInterbaseCounts ?? configBlob.showInterbaseCounts,
              showInterbaseIndicators:
                showInterbaseIndicators ?? configBlob.showInterbaseIndicators,
              showArcs: showArcs ?? configBlob.showArcs,
            },
            getEnv(self),
          )
        },
        /**
         * #getter
         */
        get showArcsSetting() {
          return (
            self.showArcs ?? readConfObject(this.rendererConfig, 'showArcs')
          )
        },
        /**
         * #getter
         */
        get showInterbaseCountsSetting() {
          return (
            self.showInterbaseCounts ??
            readConfObject(this.rendererConfig, 'showInterbaseCounts')
          )
        },
        /**
         * #getter
         */
        get showInterbaseIndicatorsSetting() {
          return (
            self.showInterbaseIndicators ??
            readConfObject(this.rendererConfig, 'showInterbaseIndicators')
          )
        },

        /**
         * #getter
         */
        get autorunReady() {
          const view = getContainingView(self) as LGV
          return (
            view.initialized &&
            self.statsReadyAndRegionNotTooLarge &&
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
    }))
    .actions(self => ({
      afterAttach() {
        // Only run modifications autorun if not nested in a parent display
        // (parent LinearAlignmentsDisplay handles it for nested displays)
        if (self.parentDisplay) {
          // Nested display - parent handles modifications
          return
        }

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
        trackMenuItems: superTrackMenuItems,
      } = self
      return {
        /**
         * #getter
         * Returns effective modifications (from parent if nested, else own)
         */
        get effectiveVisibleModifications() {
          const parent = self.parentDisplay
          return parent?.visibleModifications ?? self.visibleModifications
        },

        /**
         * #getter
         * Returns effective simplex modifications (from parent if nested, else own)
         */
        get effectiveSimplexModifications() {
          const parent = self.parentDisplay
          return parent?.simplexModifications ?? self.simplexModifications
        },

        /**
         * #getter
         * Returns effective modifications ready flag (from parent if nested, else own)
         */
        get effectiveModificationsReady() {
          const parent = self.parentDisplay
          return parent?.modificationsReady ?? self.modificationsReady
        },

        /**
         * #getter
         */
        renderReady() {
          const superProps = superRenderProps()
          return !superProps.notReady && this.effectiveModificationsReady
        },

        /**
         * #method
         */
        renderProps() {
          const { colorBy } = self
          const visibleModifications = this.effectiveVisibleModifications
          const simplexModifications = this.effectiveSimplexModifications
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
          return {
            type: 'SNPCoverageAdapter',
            subadapter,
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
            ...superTrackMenuItems(),
            {
              label: 'Show insertion/clipping indicators',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showInterbaseIndicatorsSetting,
              onClick: () => {
                self.setShowInterbaseIndicators(
                  !self.showInterbaseIndicatorsSetting,
                )
              },
            },
            {
              label: 'Show insertion/clipping counts',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showInterbaseCountsSetting,
              onClick: () => {
                self.setShowInterbaseCounts(!self.showInterbaseCountsSetting)
              },
            },
            {
              label: 'Show arcs',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.showArcsSetting,
              onClick: () => {
                self.setShowArcs(!self.showArcsSetting)
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
}

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
