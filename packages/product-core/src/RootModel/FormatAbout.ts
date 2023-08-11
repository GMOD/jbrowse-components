import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FormatAbout
 * generally exists on the config.json or root config as configuration.formatAbout
 */
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
