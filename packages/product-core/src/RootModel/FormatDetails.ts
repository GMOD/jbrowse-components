import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FormatDetails
 * generally exists on the config.json or root config as configuration.formatDetails
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
      description: 'depth to iterate on subfeatures',
    },
  })
}
