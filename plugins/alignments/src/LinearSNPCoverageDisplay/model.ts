import { lazy } from 'react'

import VisibilityIcon from '@mui/icons-material/Visibility'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getContainingView } from '@jbrowse/core/util'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
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
        drawInterbaseCounts: types.maybe(types.boolean),
        /**
         * #property
         */
        drawIndicators: types.maybe(types.boolean),
        /**
         * #property
         */
        drawArcs: types.maybe(types.boolean),
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

          const { drawArcs, drawInterbaseCounts, drawIndicators } = self
          return self.rendererType.configSchema.create(
            {
              ...configBlob,
              drawInterbaseCounts:
                drawInterbaseCounts ?? configBlob.drawInterbaseCounts,
              drawIndicators: drawIndicators ?? configBlob.drawIndicators,
              drawArcs: drawArcs ?? configBlob.drawArcs,
            },
            getEnv(self),
          )
        },
        /**
         * #getter
         */
        get drawArcsSetting() {
          return (
            self.drawArcs ?? readConfObject(this.rendererConfig, 'drawArcs')
          )
        },
        /**
         * #getter
         */
        get drawInterbaseCountsSetting() {
          return (
            self.drawInterbaseCounts ??
            readConfObject(this.rendererConfig, 'drawInterbaseCounts')
          )
        },
        /**
         * #getter
         */
        get drawIndicatorsSetting() {
          return (
            self.drawIndicators ??
            readConfObject(this.rendererConfig, 'drawIndicators')
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
      toggleShowIndicators() {
        self.drawIndicators = !self.drawIndicatorsSetting
      },
      /**
       * #action
       */
      toggleShowInterbaseCounts() {
        self.drawInterbaseCounts = !self.drawInterbaseCountsSetting
      },
      /**
       * #action
       */
      toggleShowArcs() {
        self.drawArcs = !self.drawArcsSetting
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
              const vals = await getUniqueModifications({
                self,
                adapterConfig: getConf(self.parentTrack, 'adapter'),
                blocks: staticBlocks,
              })
              if (isAlive(self)) {
                self.updateVisibleModifications(vals)
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
        get renderReady() {
          const superProps = superRenderProps()
          return !superProps.notReady && self.modificationsReady
        },

        /**
         * #getter
         */
        get ready() {
          return this.renderReady
        },
        /**
         * #method
         */
        renderProps() {
          const { colorBy, visibleModifications } = self
          return {
            ...superRenderProps(),
            notReady: !this.ready,
            colorBy,
            visibleModifications: Object.fromEntries(
              visibleModifications.toJSON(),
            ),
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
        get needsScalebar() {
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
              checked: self.drawIndicatorsSetting,
              onClick: () => {
                self.toggleShowIndicators()
              },
            },
            {
              label: 'Show insertion/clipping counts',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.drawInterbaseCountsSetting,
              onClick: () => {
                self.toggleShowInterbaseCounts()
              },
            },
            {
              label: 'Show arcs',
              icon: VisibilityIcon,
              type: 'checkbox',
              checked: self.drawArcsSetting,
              onClick: () => {
                self.toggleShowArcs()
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
