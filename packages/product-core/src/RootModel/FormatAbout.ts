import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FormatAbout
 * #category root
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
     * leave file locations out of every About dialog in the session, for a
     * deployment that would rather not show users where the data sits. A track
     * can set the same slot on its own `formatAbout`.
     */
    hideUris: {
      type: 'boolean',
      defaultValue: false,
    },
  })
}
