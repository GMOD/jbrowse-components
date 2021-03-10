import { types, cast } from 'mobx-state-tree'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
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
        drawInterbaseCounts: types.maybe(types.boolean),
        drawIndicators: types.maybe(types.boolean),
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
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', self.rendererTypeName]) || {}

        return self.rendererType.configSchema.create({
          ...configBlob,
          drawInterbaseCounts:
            self.drawInterbaseCounts === undefined
              ? configBlob.drawInterbaseCounts
              : self.drawInterbaseCounts,
          drawIndicators:
            self.drawIndicators === undefined
              ? configBlob.drawIndicators
              : self.drawIndicators,
        })
      },
      get drawInterbaseCountsSetting() {
        return self.drawInterbaseCounts !== undefined
          ? self.drawInterbaseCounts
          : readConfObject(this.rendererConfig, 'drawInterbaseCounts')
      },
      get drawIndicatorsSetting() {
        return self.drawIndicators !== undefined
          ? self.drawIndicators
          : readConfObject(this.rendererConfig, 'drawIndicators')
      },
    }))
    .actions(self => ({
      toggleDrawIndicators() {
        self.drawIndicators = !self.drawIndicatorsSetting
      },
      toggleDrawInterbaseCounts() {
        self.drawInterbaseCounts = !self.drawInterbaseCountsSetting
      },
    }))

    .views(self => {
      const { trackMenuItems } = self
      return {
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

        get extraTrackMenuItems() {
          return [
            {
              label: 'Draw insertion/clipping indicators',
              type: 'checkbox',
              checked: self.drawIndicatorsSetting,
              onClick: () => {
                self.toggleDrawIndicators()
              },
            },
            {
              label: 'Draw insertion/clipping counts',
              type: 'checkbox',
              checked: self.drawInterbaseCountsSetting,
              onClick: () => {
                self.toggleDrawInterbaseCounts()
              },
            },
          ]
        },
        get trackMenuItems() {
          return [
            ...trackMenuItems,
            ...self.composedTrackMenuItems,
            ...this.extraTrackMenuItems,
          ]
        },
        // The SNPCoverage filters are called twice because the BAM/CRAM features
        // pass filters and then the SNPCoverage score features pass through
        // here, and those have no name/flags/tags so those are passed thru
        get filters() {
          let filters: string[] = []
          if (self.filterBy) {
            const { flagInclude, flagExclude } = self.filterBy
            filters = [
              `jexl:feature|getData('snpinfo') != undefined ? true : ((feature|getData('flags')&${flagInclude})==${flagInclude}) && !(feature|getData('flags')&${flagExclude})`,
            ]

            if (self.filterBy.tagFilter) {
              const { tag, value } = self.filterBy.tagFilter
              filters.push(
                `jexl:feature|getData('snpinfo') ? true : "${value}" =='*' ? (feature|getData('tags') ? feature|getData('tags')["${tag}"] : feature|getData("${tag}")) != undefined\n
                : (feature|getData('tags') ? feature|getData('tags')["${tag}"] : feature|getData("${tag}")) == "${value}")`,
              )
            }
            if (self.filterBy.readName) {
              const { readName } = self.filterBy
              filters.push(
                `jexl:feature|getData('snpinfo') ? true : feature|getData('name') == "${readName}"`,
              )
            }
          }
          return filters
        },
      }
    })

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
