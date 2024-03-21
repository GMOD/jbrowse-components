import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

/**
 * #config SharedWiggleDisplay
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export default function sharedWiggleConfigFactory() {
  return ConfigurationSchema(
    'SharedWiggleDisplay',
    {
      /**
       * #slot
       */
      autoscale: {
        defaultValue: 'local',
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
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
      minimalTicks: {
        defaultValue: false,
        description: 'use the minimal amount of ticks',
        type: 'boolean',
      },

      /**
       * #slot
       */
      numStdDev: {
        defaultValue: 3,
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        type: 'number',
      },

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
