import { types, cast } from 'mobx-state-tree'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
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

      get filters() {
        let filters: string[] = []
        if (self.filterBy) {
          const { flagInclude, flagExclude } = self.filterBy
          filters = [
            `function(f) {
                const flags = f.get('flags');
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
              const tag = tags?tags["${tag}"]:f.get("${tag}");
              return tag == "${value}";
              }`)
          }
          if (self.filterBy.readName) {
            const { readName } = self.filterBy
            // use eqeq instead of eqeqeq for number vs string comparison
            filters.push(`function(f) {
              const name = f.get('name')
              return name?name == "${readName}":true
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
