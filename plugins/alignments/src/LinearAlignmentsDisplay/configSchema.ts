import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearAlignmentsDisplay
 * #category display
 * configuration schema for the LinearAlignmentsDisplay
 */
export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearAlignmentsDisplay',
    {
      /**
       * #slot
       */
      featureHeight: {
        type: 'number',
        defaultValue: 7,
        description: 'Height of each feature (read) in pixels',
      },
      /**
       * #slot
       */
      featureSpacing: {
        type: 'number',
        defaultValue: 1,
        description: 'Spacing between features in pixels',
      },
      /**
       * #slot
       */
      arcLineWidth: {
        type: 'number',
        defaultValue: 1,
        description: 'Line width for paired-read arcs in pixels',
      },
      /**
       * #slot
       */
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description: 'Maximum height of the display in pixels',
      },
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 250,
      },
      /**
       * #slot
       */
      colorBy: {
        type: 'frozen',
        defaultValue: { type: 'normal' },
        description: 'Color scheme for reads',
      },
      /**
       * #slot
       */
      filterBy: {
        type: 'frozen',
        defaultValue: {
          flagInclude: 0,
          flagExclude: 1540,
        },
        description: 'Filter settings for reads',
      },
      /**
       * #slot
       */
      autoscale: {
        type: 'stringEnum',
        model: types.enumeration('Coverage autoscale type', [
          'local',
          'localsd',
        ]),
        defaultValue: 'local',
        description: 'Coverage autoscale type',
      },
      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'Minimum coverage depth bound',
      },
      /**
       * #slot
       */
      maxScore: {
        type: 'number',
        defaultValue: Number.MAX_VALUE,
        description: 'Maximum coverage depth bound',
      },
      /**
       * #slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Coverage scale type', ['linear', 'log']),
        defaultValue: 'linear',
        description: 'Coverage scale type (linear or log)',
      },
      /**
       * #slot
       */
      numStdDev: {
        type: 'number',
        defaultValue: 3,
        description: 'Number of standard deviations for localsd autoscale',
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
