import { types, cast, getEnv, getSnapshot } from 'mobx-state-tree'

// jbrowse
import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConf,
  readConfObject,
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

// locals
import Tooltip from '../components/Tooltip'
import { FilterModel } from '../../shared'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

/**
 * #stateModel LinearSNPCoverageDisplay
 * extends `LinearWiggleDisplay`
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
      }),
    )

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
      setFilterBy(filter: {
        flagInclude: number
        flagExclude: number
        readName?: string
        tagFilter?: { tag: string; value: string }
      }) {
        self.filterBy = cast(filter)
      },
      /**
       * #action
       */
      setColorBy(colorBy?: { type: string; tag?: string }) {
        self.colorBy = cast(colorBy)
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
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          const { colorBy, filterBy } = self
          return {
            ...superProps,

            // must use getSnapshot because otherwise changes to e.g.
            // just the colorBy.type are not read
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
      }
    })
}

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
