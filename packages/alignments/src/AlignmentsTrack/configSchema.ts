import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

const configModelFactory = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'AlignmentsTrack',
    {
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['local']),
        description: 'performs SNP Coverage local autoscaling',
      },
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the SNP coverage y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the SNP coverage y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']),
        description: 'The type of scale to use for SNP coverage',
        defaultValue: 'linear',
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup', 'svg']),
        defaultValue: 'pileup',
      },
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )
}

export type AlignmentsConfigModel = ReturnType<typeof configModelFactory>
export default configModelFactory
