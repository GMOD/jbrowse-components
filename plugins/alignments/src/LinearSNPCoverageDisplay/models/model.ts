import { types } from 'mobx-state-tree'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'

import { getContainingView } from '@jbrowse/core/util'

import { getConf } from '@jbrowse/core/configuration'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import Tooltip from '../components/Tooltip'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types
    .compose(
      'LinearSNPCoverageDisplay',
      linearWiggleDisplayModelFactory(configSchema),
      types.model({
        type: types.literal('LinearSNPCoverageDisplay'),
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1536),
          }),
          {},
        ),
      }),
    )
    .actions(self => ({
      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },
      setFilterBy(filter: any) {
        self.filterBy = filter
      },
    }))
    .views(self => ({
      get TooltipComponent() {
        return Tooltip
      },

      get filters() {
        console.log('f1')
        const { flagInclude, flagExclude } = self.filterBy
        return self.filterBy
          ? [
              `function(feature) {
                const flags = feature.get('flags')
                return (((flags&${flagInclude})===${flagInclude}) && !(flags&${flagExclude}))
              }`,
            ]
          : undefined
      },

      get scaleOpts() {
        return {
          domain: self.domain,
          stats: self.stats,
          autoscaleType: getConf(self, 'autoscale'),
          scaleType: getConf(self, 'scaleType'),
          inverted: getConf(self, 'inverted'),
        }
      },

      get renderProps() {
        const config = self.rendererType.configSchema.create(
          getConf(self, ['renderers', self.rendererTypeName]) || {},
        )
        console.log('r2')
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          notReady: !self.ready,
          height: self.height,
          displayModel: self,
          scaleOpts: self.scaleOpts,
          filters: self.filters,
          config,
        }
      },
      get adapterConfig() {
        const subadapter = getConf(self.parentTrack, 'adapter')
        return {
          type: 'SNPCoverageAdapter',
          subadapter,
        }
      },

      get rendererTypeName() {
        return rendererTypes.get('snpcoverage')
      },

      get needsScalebar() {
        return true
      },

      get contextMenuItems() {
        return []
      },
    }))

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
