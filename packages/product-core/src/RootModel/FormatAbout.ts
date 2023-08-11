import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function FormatAboutConfigSchemaFactory() {
  return ConfigurationSchema('FormatAbout', {
    /**
     * #slot configuration.formatAbout.config
     */
    config: {
      type: 'frozen',
      description: 'formats configuration object in about dialog',
      defaultValue: {},
      contextVariable: ['config'],
    },
    /**
     * #slot configuration.formatAbout.hideUris
     */

    hideUris: {
      type: 'boolean',
      defaultValue: false,
    },
  })
}
