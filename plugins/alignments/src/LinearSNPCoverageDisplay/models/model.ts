import { types, cast } from 'mobx-state-tree'
import { getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import {
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import Tooltip from '../components/Tooltip'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) =>
  types
    .compose(
      'LinearSNPCoverageDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearSNPCoverageDisplay'),
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1536),
            readName: types.maybe(types.string),
            tagFilter: types.maybe(
              types.model({ tag: types.string, value: types.string }),
            ),
          }),
          {},
        ),
      }),
    )
    .actions(self => ({
      setConfig(configuration: AnyConfigurationModel) {
        self.configuration = configuration
      },
      setFilterBy(filter: {
        flagInclude: number
        flagExclude: number
        readName?: string
        tagFilter?: { tag: string; value: string }
      }) {
        self.filterBy = cast(filter)
      },
    }))
    .views(self => ({
      get TooltipComponent() {
        return Tooltip
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

      // The SNPCoverage filters are called twice because the BAM/CRAM features
      // pass filters and then the SNPCoverage score features pass through
      // here, and those have no name/flags/tags so those are passed thru
      get filters() {
        let filters: string[] = []
        if (self.filterBy) {
          const { flagInclude, flagExclude } = self.filterBy
          filters = [
            `function(f) {
                const flags = f.get('');
                if(f.get('snpinfo')) return true
                return ((flags&${flagInclude})===${flagInclude}) && !(flags&${flagExclude});
              }`,
          ]

          if (self.filterBy.tagFilter) {
            const { tag, value } = self.filterBy.tagFilter
            // use eqeq instead of eqeqeq for number vs string comparison
            filters.push(`function(f) {
              const tags = f.get('tags');
              if(f.get('snpinfo')) return true
              const val = tags ? tags["${tag}"]:f.get("${tag}")
              return "${value}"==='*'? val !== undefined :val == "${value}";
              }`)
          }
          if (self.filterBy.readName) {
            const { readName } = self.filterBy

            filters.push(`function(f) {
              const name = f.get('name')
              if(f.get('snpinfo')) return true
              return name == "${readName}"
              }`)
          }
        }
        return filters
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
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          notReady: !self.ready,
          height: self.height,
          displayModel: self,
          scaleOpts: this.scaleOpts,
          filters: self.filters,
          config,
        }
      },
    }))

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
