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
      textSearchIndexingAttributes: {
        type: 'stringArray',
        description:
          'list of which feature attributes to index for text searching',
        defaultValue: ['Name', 'ID', 'Description'],
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      textSearchAdapter: pluginManager.pluggableConfigSchemaType(
        'text search adapter',
      ),
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
      preProcessSnapshot: s => {
        const snap = JSON.parse(JSON.stringify(s))
        const displayTypes = new Set()
        const { displays = [] } = snap
        if (snap.trackId !== 'placeholderId') {
          // Gets the displays on the track snapshot and the possible displays
          // from the track type and adds any missing possible displays to the
          // snapshot
          displays.forEach((d: any) => d && displayTypes.add(d.type))
          const trackType = pluginManager.getTrackType(snap.type)
          trackType.displayTypes.forEach(displayType => {
            if (!displayTypes.has(displayType.name)) {
              displays.push({
                displayId: `${snap.trackId}-${displayType.name}`,
                type: displayType.name,
              })
            }
          })
        }
        return { ...snap, displays }
      },
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
      actions: (self: any) => ({
        addDisplayConf(displayConf: { type: string; displayId: string }) {
          const { type } = displayConf
          if (!type) {
            throw new Error(`unknown display type ${type}`)
          }
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
