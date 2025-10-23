import { lazy } from 'react'

import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getContainingView } from '@jbrowse/core/util'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observable } from 'mobx'
import { cast, getEnv, isAlive, types } from 'mobx-state-tree'

import { getUniqueModifications } from '../shared/getUniqueModifications'
import { createAutorun, getColorForModification } from '../util'

import type {
  ColorBy,
  FilterBy,
  ModificationType,
  ModificationTypeWithColor,
} from '../shared/types'
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
    .volatile(() => ({
      /**
       * #volatile
       */
      visibleModifications: observable.map<string, ModificationTypeWithColor>(
        {},
      ),
      /**
       * #volatile
       */
      simplexModifications: new Set<string>(),
      /**
       * #volatile
       */
      modificationsReady: false,
    }))
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

      /**
       * #action
       */
      updateVisibleModifications(uniqueModifications: ModificationType[]) {
        for (const modification of uniqueModifications) {
          if (!self.visibleModifications.has(modification.type)) {
            self.visibleModifications.set(modification.type, {
              ...modification,
              color: getColorForModification(modification.type),
            })
          }
        }
      },
      /**
       * #action
       */
      setSimplexModifications(simplex: string[]) {
        self.simplexModifications = new Set(simplex)
      },
    }))
    .views(self => {
      const { adapterProps: superAdapterProps } = self
      return {
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
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setModificationsReady(flag: boolean) {
        self.modificationsReady = flag
      },
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
                console.log('[LinearSNPCoverageDisplay] Received modifications:', modifications)
                console.log('[LinearSNPCoverageDisplay] Received simplex:', simplexModifications)
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
}

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
