import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { defaultFilterFlags } from '../shared/util'
import type PluginManager from '@jbrowse/core/PluginManager'

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
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['local']),
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
      },
      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      },
      /**
       * #slot
       */
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      /**
       * #slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },
      /**
       * #slot
       */
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },
      /**
       * #slot
       */
      multiTicks: {
        type: 'boolean',
        description: 'Display multiple values for the ticks',
        defaultValue: false,
      },
      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: pluginManager.getRendererType(
          'SNPCoverageRenderer',
        )!.configSchema,
      }),
      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        description: 'color scheme to use',
        defaultValue: {
          type: 'normal',
        },
      },

      /**
       * #slot
       */
      filterBy: {
        type: 'frozen',
        description: 'default filters to use',
        defaultValue: defaultFilterFlags,
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
