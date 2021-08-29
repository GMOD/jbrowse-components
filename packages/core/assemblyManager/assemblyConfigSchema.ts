import { ConfigurationSchema } from '../configuration'
import { types } from 'mobx-state-tree'
import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'BaseAssembly',
    {
      aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      },
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')
        .configSchema,

      refNameColors: {
        type: 'stringArray',
        defaultValue: [],
        description:
          'Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.',
      },
      refNameAliases: ConfigurationSchema(
        'RefNameAliases',
        {
          adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        },
        {
          preProcessSnapshot: snap => {
            // allow refNameAliases to be unspecified
            // @ts-ignore
            if (!snap.adapter) {
              return { adapter: { type: 'RefNameAliasAdapter' } }
            }
            return snap
          },
        },
      ),
      cytoBandFile: ConfigurationSchema(
        'RefNameAliases',
        {
          adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        },
        {
          preProcessSnapshot: snap => {
            // allow refNameAliases to be unspecified
            // @ts-ignore
            if (!snap.adapter) {
              return { adapter: { type: 'CytobandAdapter' } }
            }
            return snap
          },
        },
      ),
      displayName: {
        type: 'string',
        defaultValue: '',
        description:
          'A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"',
      },
    },
    {
      explicitIdentifier: 'name',
    },
  )
}
