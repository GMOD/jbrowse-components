import { types, cast, getEnv, getSnapshot, isAlive } from 'mobx-state-tree'
import { observable } from 'mobx'

// jbrowse
import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConf,
  readConfObject,
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'

// locals
import Tooltip from '../components/Tooltip'
import { FilterModel, IFilter, getUniqueModificationValues } from '../../shared'
import { createAutorun, modificationColors } from '../../util'
import { randomColor } from '../../util'

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
        filterBy: types.optional(FilterModel, {}),
        /**
         * #property
         */
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
          }),
        ),
        /**
         * #property
         */
        jexlFilters: types.optional(types.array(types.string), []),
      }),
    )
    .volatile(() => ({
      modificationTagMap: observable.map<string, string>({}),
      modificationsReady: false,
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
      setFilterBy(filter: IFilter) {
        self.filterBy = cast(filter)
      },
      /**
       * #action
       */
      setColorBy(colorBy?: { type: string; tag?: string }) {
        self.colorBy = cast(colorBy)
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
      updateModificationColorMap(uniqueModifications: string[]) {
        uniqueModifications.forEach(value => {
          if (!self.modificationTagMap.has(value)) {
            self.modificationTagMap.set(
              value,
              modificationColors[value] || randomColor(),
            )
          }
        })
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get rendererConfig() {
          const configBlob =
            getConf(self, ['renderers', self.rendererTypeName]) || {}

          return self.rendererType.configSchema.create(
            {
              ...configBlob,
              drawInterbaseCounts:
                self.drawInterbaseCounts ?? configBlob.drawInterbaseCounts,
              drawIndicators: self.drawIndicators ?? configBlob.drawIndicators,
              drawArcs: self.drawArcs ?? configBlob.drawArcs,
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
            self.featureDensityStatsReady &&
            !self.regionTooLarge &&
            !self.error
          )
        },

        get renderReady() {
          const superProps = superRenderProps()
          return !superProps.notReady && self.modificationsReady
        },

        get ready() {
          return this.renderReady
        },

        /**
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          const { colorBy, filterBy, modificationTagMap } = self
          return {
            ...superProps,
            notReady: !this.ready,
            filters: self.filters,
            modificationTagMap: Object.fromEntries(modificationTagMap.toJSON()),

            // must use getSnapshot because otherwise changes to e.g. just the
            // colorBy.type are not read
            colorBy: colorBy ? getSnapshot(colorBy) : undefined,
            filterBy: filterBy ? getSnapshot(filterBy) : undefined,
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
      toggleDrawIndicators() {
        self.drawIndicators = !self.drawIndicatorsSetting
      },
      /**
       * #action
       */
      toggleDrawInterbaseCounts() {
        self.drawInterbaseCounts = !self.drawInterbaseCountsSetting
      },
      /**
       * #action
       */
      toggleDrawArcs() {
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
              const adapter = getConf(self.parentTrack, 'adapter')
              const vals = await getUniqueModificationValues(
                self,
                adapter,
                colorBy,
                staticBlocks,
              )
              if (isAlive(self)) {
                self.updateModificationColorMap(vals)
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
      const { trackMenuItems: superTrackMenuItems } = self
      return {
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
              label: 'Draw insertion/clipping indicators',
              type: 'checkbox',
              checked: self.drawIndicatorsSetting,
              onClick: () => self.toggleDrawIndicators(),
            },
            {
              label: 'Draw insertion/clipping counts',
              type: 'checkbox',
              checked: self.drawInterbaseCountsSetting,
              onClick: () => self.toggleDrawInterbaseCounts(),
            },
            {
              label: 'Draw arcs',
              type: 'checkbox',
              checked: self.drawArcsSetting,
              onClick: () => self.toggleDrawArcs(),
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
