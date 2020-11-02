/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import PluginManager from '../../PluginManager'

export function createBaseTrackConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'BaseTrack',
    {
      name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      },
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      },
      description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      },
      category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      },
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),
      // see corresponding entry in circular-view ChordTrack
      // no config slot editor exists for this at the time being
      // configRelationships: {
      //   type: 'configRelationships',
      //   model: types.array(
      //     types.model('Relationship', {
      //       type: types.string,
      //       target: types.maybe(types.reference(base)),
      //     }),
      //   ),
      //   defaultValue: [],
      // },
    },
    {
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
      actions: (self: any) => ({
        afterCreate() {
          const displayTypes = new Set()
          self.displays.forEach((d: any) => d && displayTypes.add(d.type))
          const trackType = pluginManager.getTrackType(self.type)
          trackType.displayTypes.forEach(displayType => {
            if (!displayTypes.has(displayType.name)) {
              self.addDisplayConf({
                displayId: `${self.trackId}-${displayType.name}`,
                type: displayType.name,
              })
            }
          })
        },
        addDisplayConf(displayConf: { type: string; displayId: string }) {
          const { type } = displayConf
          if (!type) throw new Error(`unknown display type ${type}`)
          const display = self.displays.find(
            (d: any) => d && d.displayId === displayConf.displayId,
          )
          if (display) {
            return display
          }
          const length = self.displays.push(displayConf)
          return self.displays[length - 1]
        },
      }),
    },
  )
}

export type BaseTrackConfigModel = ReturnType<typeof createBaseTrackConfig>
export type BaseTrackConfig = Instance<BaseTrackConfigModel>
