import { types, cast, getEnv, getSnapshot } from 'mobx-state-tree'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import {
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
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
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
          }),
        ),
      }),
    )
    .volatile(() => ({
      modificationTagMap: {},
    }))
    .actions(self => ({
      setModificationTagMap(elt: Record<string, string>) {
        self.modificationTagMap = elt
      },
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
      setColorBy(colorBy?: { type: string; tag?: string }) {
        self.colorBy = cast(colorBy)
      },
    }))
    .views(self => ({
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', self.rendererTypeName]) || {}

        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            drawInterbaseCounts:
              self.drawInterbaseCounts === undefined
                ? configBlob.drawInterbaseCounts
                : self.drawInterbaseCounts,
            drawIndicators:
              self.drawIndicators === undefined
                ? configBlob.drawIndicators
                : self.drawIndicators,
          },
          getEnv(self),
        )
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
      get renderProps() {
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          notReady: !self.ready,
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          config: self.rendererConfig,
          scaleOpts: self.scaleOpts,
          resolution: self.resolution,
          height: self.height,
          ticks: self.ticks,
          displayCrossHatches: self.displayCrossHatches,
          filters: self.filters,
          modificationTagMap: JSON.parse(
            JSON.stringify(self.modificationTagMap),
          ),

          // must use getSnapshot because otherwise changes to e.g. just the
          // colorBy.type are not read
          colorBy: self.colorBy ? getSnapshot(self.colorBy) : undefined,
        }
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
        // here, and are already have 'snpinfo' are passed through
        get filters() {
          let filters: string[] = []
          if (self.filterBy) {
            const { flagInclude, flagExclude } = self.filterBy
            filters = [
              `jexl:get(feature,'snpinfo') != undefined ? true : ` +
                `((get(feature,'flags')&${flagInclude})==${flagInclude}) && ` +
                `!((get(feature,'flags')&${flagExclude}))`,
            ]

            if (self.filterBy.tagFilter) {
              const { tag, value } = self.filterBy.tagFilter
              filters.push(
                `jexl:get(feature,'snpinfo') != undefined ? true : ` +
                  `"${value}" =='*' ? getTag(feature,"${tag}") != undefined : ` +
                  `getTag(feature,"${tag}") == "${value}"`,
              )
            }
            if (self.filterBy.readName) {
              const { readName } = self.filterBy
              filters.push(
                `jexl:get(feature,'snpinfo') != undefined ? true : ` +
                  `get(feature,'name') == "${readName}"`,
              )
            }
          }
          return new SerializableFilterChain({ filters })
        },
      }
    })

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
