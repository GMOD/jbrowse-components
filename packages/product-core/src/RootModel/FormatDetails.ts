import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FormatDetails
 * generally exists on the tracks in the config.json or as a 'session' config as
 * configuration.formatDetails
 */
export function FormatDetailsConfigSchemaFactory() {
  return ConfigurationSchema('FormatDetails', {
    /**
     * #slot configuration.formatDetails.feature
     */
    feature: {
      type: 'frozen',
      description: 'adds extra fields to the feature details',
      defaultValue: {},
      contextVariable: ['feature'],
    },
    /**
     * #slot configuration.formatDetails.subfeatures
     */
    subfeatures: {
      type: 'frozen',
      description: 'adds extra fields to the subfeatures of a feature',
      defaultValue: {},
      contextVariable: ['feature'],
    },
    /**
     * #slot configuration.formatDetails.depth
     */
    depth: {
      type: 'number',
      defaultValue: 2,
      description:
        'depth to iterate the formatDetails->subfeatures callback on subfeatures (used for example to only apply the callback to the first layer of subfeatures)',
    },
    /**
     * #slot configuration.formatDetails.maxDepth
     */
    maxDepth: {
      type: 'number',
      defaultValue: 10000,
      description: 'hide subfeatures greater than a certain depth',
    },
  })
}
