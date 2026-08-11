import { ConfigurationSchema } from './configurationSchema.ts'

/**
 * #config FormatAbout
 * #category root
 * jexl callbacks that add, rewrite or hide fields in a track's About dialog.
 * The same schema hangs off every track and off the session as
 * `configuration.formatAbout`, which applies to every track at once. Where both
 * are set the track's object is spread over the session's, so a track can
 * override individual keys the global callback added.
 *
 * #example
 * On a track. The callback's variable is `config`, not `feature`, since the
 * dialog shows the track's own configuration rather than a feature:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes',
 *   name: 'Genes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/genes.gff.gz',
 *   },
 *   formatAbout: {
 *     hideUris: true,
 *     config: "jexl:{Source:'GENCODE v44', adapter:undefined}",
 *   },
 * }
 * ```
 */
export function FormatAboutConfigSchemaFactory() {
  return ConfigurationSchema('FormatAbout', {
    /**
     * #slot formatAbout.config
     * callback returning an object of fields to merge over the config shown
     */
    config: {
      type: 'frozen',
      description: 'formats configuration object in about dialog',
      defaultValue: {},
      contextVariable: ['config'],
    },

    /**
     * #slot formatAbout.hideUris
     * leave file locations out of the About dialog, for a deployment that would
     * rather not show users where the data sits. Hides URIs and local paths
     * alike, drops the "Copy config" button, and suppresses the File info panel
     * — a BAM's `@SQ UR:` and `@PG CL:` lines are locations too. "Show ref
     * names" stays, since it exposes none. The two tiers are OR'd, so a
     * session-wide `true` cannot be turned back on by a track. It hides the
     * locations from the dialog only, not from `config.json`
     */
    hideUris: {
      type: 'boolean',
      defaultValue: false,
    },
  })
}
