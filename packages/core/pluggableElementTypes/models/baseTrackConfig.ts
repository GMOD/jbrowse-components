/* eslint-disable @typescript-eslint/no-explicit-any */
import clone from 'clone'
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
      textSearching: ConfigurationSchema('textSearching', {
        indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID'],
        },
        indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        },
        textSearchAdapter: pluginManager.pluggableConfigSchemaType(
          'text search adapter',
        ),
      }),
      displays: types.map(pluginManager.pluggableConfigSchemaType('display')),

      formatDetails: ConfigurationSchema('FormatDetails', {
        feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        },
        subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        },
        depth: {
          type: 'number',
          defaultValue: 2,
          description: 'depth to iterate on subfeatures',
        },
      }),
    },
    {
      preProcessSnapshot: s => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snap = clone(s) as any
        const displays = Array.isArray(snap.displays)
          ? Object.fromEntries(
              snap.displays.map((d: { type: string }) => [d.type, d]),
            )
          : snap.displays || {}

        if (snap.trackId !== 'placeholderId') {
          // Gets the displays on the track snapshot and the possible displays
          // from the track type and adds any missing possible displays to the
          // snapshot
          const trackType = pluginManager.getTrackType(snap.type)
          trackType.displayTypes.forEach(d => {
            displays[d.name] = displays[d.name] || {
              displayId: `${snap.trackId}-${d.name}`,
              type: d.name,
              priority: -1,
            }
          })
        }
        return {
          ...snap,
          displays,
        }
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
