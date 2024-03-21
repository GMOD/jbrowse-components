import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FormatDetails
 * generally exists on the tracks in the config.json or as a 'session' config as
 * configuration.formatDetails
 */
export function FormatDetailsConfigSchemaFactory() {
  return ConfigurationSchema('FormatDetails', {
    /**
     * #slot configuration.formatDetails.depth
     */
    depth: {
      defaultValue: 2,
      description:
        'depth to iterate the formatDetails->subfeatures callback on subfeatures (used for example to only apply the callback to the first layer of subfeatures)',
      type: 'number',
    },

    /**
     * #slot configuration.formatDetails.feature
     */
    feature: {
      contextVariable: ['feature'],
      defaultValue: {},
      description: 'adds extra fields to the feature details',
      type: 'frozen',
    },

    /**
     * #slot configuration.formatDetails.maxDepth
     */
    maxDepth: {
      defaultValue: 10000,
      description: 'hide subfeatures greater than a certain depth',
      type: 'number',
    },

    /**
     * #slot configuration.formatDetails.subfeatures
     */
    subfeatures: {
      contextVariable: ['feature'],
      defaultValue: {},
      description: 'adds extra fields to the subfeatures of a feature',
      type: 'frozen',
    },
  })
}
