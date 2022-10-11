import { addDisposer, types, cast, getEnv, getSnapshot } from 'mobx-state-tree'
import { observable, autorun } from 'mobx'
import {
  getConf,
  readConfObject,
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView } from '@jbrowse/core/util'

// locals
import Tooltip from '../components/Tooltip'
import { getUniqueModificationValues } from '../../shared'

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
        drawArcs: types.maybe(types.boolean),
        filterBy: types.optional(
          types.model({
            flagInclude: types.optional(types.number, 0),
            flagExclude: types.optional(types.number, 1540),
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
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
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
        get drawArcsSetting() {
          return (
            self.drawArcs ?? readConfObject(this.rendererConfig, 'drawArcs')
          )
        },
        get drawInterbaseCountsSetting() {
          return (
            self.drawInterbaseCounts ??
            readConfObject(this.rendererConfig, 'drawInterbaseCounts')
          )
        },
        get drawIndicatorsSetting() {
          return (
            self.drawIndicators ??
            readConfObject(this.rendererConfig, 'drawIndicators')
          )
        },

        get modificationsReady() {
          return self.colorBy?.type === 'modifications'
            ? Object.keys(JSON.parse(JSON.stringify(self.modificationTagMap)))
                .length > 0
            : true
        },

        renderProps() {
          const superProps = superRenderProps()
          const { colorBy, filterBy, modificationTagMap } = self
          return {
            ...superProps,
            notReady: superProps.notReady || !this.modificationsReady,
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
      toggleDrawIndicators() {
        self.drawIndicators = !self.drawIndicatorsSetting
      },
      toggleDrawInterbaseCounts() {
        self.drawInterbaseCounts = !self.drawInterbaseCountsSetting
      },
      toggleDrawArcs() {
        self.drawArcs = !self.drawArcsSetting
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                const { colorBy } = self
                const view = getContainingView(self) as LGV

                if (
                  !view.initialized ||
                  !self.estimatedStatsReady ||
                  self.regionTooLarge
                ) {
                  return
                }
                const { staticBlocks } = view
                if (colorBy?.type === 'modifications') {
                  const adapter = getConf(self.parentTrack, 'adapter')
                  self.updateModificationColorMap(
                    await getUniqueModificationValues(
                      self,
                      adapter,
                      colorBy,
                      staticBlocks,
                    ),
                  )
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
      const { trackMenuItems: superTrackMenuItems } = self
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

        contextMenuItems() {
          return []
        },

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

export type SNPCoverageDisplayModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
