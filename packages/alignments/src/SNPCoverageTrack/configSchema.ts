import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default (pluginManager: PluginManager) => {
  const SNPCoverageRendererConfigSchema = pluginManager.getRendererType(
    'SNPCoverageRenderer',
  ).configSchema

  return ConfigurationSchema(
    'SNPCoverageTrack',
    {
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['local']),
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
      },
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: SNPCoverageRendererConfigSchema,
      }),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}
