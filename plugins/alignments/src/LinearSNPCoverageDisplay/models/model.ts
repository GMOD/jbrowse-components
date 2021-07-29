import { addDisposer, types, cast, getEnv, getSnapshot } from 'mobx-state-tree'
import { observable, autorun } from 'mobx'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import {
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { getContainingView } from '@jbrowse/core/util'
import Tooltip from '../components/Tooltip'
import { getUniqueModificationValues } from '../../shared'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// using a map because it preserves order
const rendererTypes = new Map([['snpcoverage', 'SNPCoverageRenderer']])

type LGV = LinearGenomeViewModel

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
      modificationTagMap: observable.map({}),
    }))
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
      setColorBy(colorBy?: { type: string; tag?: string }) {
        self.colorBy = cast(colorBy)
      },

      updateModificationColorMap(uniqueModifications: string[]) {
        const colorPalette = ['red', 'blue', 'green', 'orange', 'purple']
        let i = 0

        uniqueModifications.forEach(value => {
          if (!self.modificationTagMap.has(value)) {
            const newColor = colorPalette[i++]
            self.modificationTagMap.set(value, newColor)
          }
        })
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

      get modificationsReady() {
        return self.colorBy?.type === 'modifications'
          ? Object.keys(JSON.parse(JSON.stringify(self.modificationTagMap)))
              .length > 0
          : true
      },
      get renderProps() {
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          notReady: !self.ready || !this.modificationsReady,
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
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const { colorBy } = self
                const { staticBlocks } = getContainingView(self) as LGV
                if (colorBy?.type === 'modifications') {
                  const vals = await getUniqueModificationValues(
                    self,
                    getConf(self.parentTrack, 'adapter'),
                    colorBy,
                    staticBlocks,
                  )
                  self.updateModificationColorMap(vals)
                }
              } catch (error) {
                console.error(error)
                self.setError(error)
              }
            },
            { delay: 1000 },
          ),
        )
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
