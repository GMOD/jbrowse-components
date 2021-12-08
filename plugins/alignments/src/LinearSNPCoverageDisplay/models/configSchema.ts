import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

export default function SNPCoverageConfigFactory(pluginManager: PluginManager) {
  const SNPCoverageRendererConfigSchema = pluginManager.getRendererType(
    'SNPCoverageRenderer',
  ).configSchema

  return ConfigurationSchema(
    'LinearSNPCoverageDisplay',
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
      maxDisplayedBpPerPx: {
        type: 'number',
        description: 'maximum bpPerPx that is displayed in the view',
        defaultValue: 100,
      },
      headroom: {
        type: 'number',
        description:
          'round the upper value of the domain scale to the nearest N',
        defaultValue: 0,
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: SNPCoverageRendererConfigSchema,
      }),
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
