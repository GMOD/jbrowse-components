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
      contextVariable: ['config'],
      defaultValue: {},
      description: 'formats configuration object in about dialog',
      type: 'frozen',
    },
    /**
     * #slot configuration.formatAbout.hideUris
     */

    hideUris: {
      defaultValue: false,
      type: 'boolean',
    },
  })
}
