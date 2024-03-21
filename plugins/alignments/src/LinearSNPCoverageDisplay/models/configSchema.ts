import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearSNPCoverageDisplay
 *
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function SNPCoverageConfigFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearSNPCoverageDisplay',
    {
      /**
       * #slot
       */
      autoscale: {
        defaultValue: 'local',
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
        model: types.enumeration('Autoscale type', ['local']),
        type: 'stringEnum',
      },

      /**
       * #slot
       */
      inverted: {
        defaultValue: false,
        description: 'draw upside down',
        type: 'boolean',
      },

      /**
       * #slot
       */
      maxScore: {
        defaultValue: Number.MAX_VALUE,
        description: 'maximum value for the y-scale',
        type: 'number',
      },

      /**
       * #slot
       */
      minScore: {
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
        type: 'number',
      },

      /**
       * #slot
       */
      multiTicks: {
        defaultValue: false,
        description: 'Display multiple values for the ticks',
        type: 'boolean',
      },

      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: pluginManager.getRendererType(
          'SNPCoverageRenderer',
        ).configSchema,
      }),

      /**
       * #slot
       */
      scaleType: {
        defaultValue: 'linear',
        // todo zscale
        description: 'The type of scale to use',

        model: types.enumeration('Scale type', ['linear', 'log']),

        type: 'stringEnum',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
