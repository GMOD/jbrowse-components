import { ConfigurationSchema } from './configurationSchema.ts'

/**
 * Levels of subfeature the `subfeatures` callback runs on when no tier sets
 * `depth`. Applied by the reader rather than as the slot's `defaultValue`, so
 * the slot can still read as unset and the session's value reach a track.
 */
export const DEFAULT_FORMAT_DETAILS_DEPTH = 2

/**
 * #config FormatDetails
 * #category root
 * jexl callbacks that add, rewrite or hide fields in the feature-details panel.
 * The same schema hangs off every track and off the session as
 * `configuration.formatDetails`, which applies to every track at once. Where
 * both are set, the callbacks merge with the track's object over the session's,
 * so a track can override individual keys the global callback added, and the
 * numeric slots take the track's value when the track sets one.
 *
 * #example
 * On a track. The callback returns an object merged over the feature: a new key
 * adds a row, an existing key rewrites it, and `undefined` hides it. A bare URL
 * is turned into a link for you, so no `<a>` markup is needed:
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
 *   formatDetails: {
 *     feature: "jexl:{ncbi:'https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name, phase:undefined}",
 *   },
 * }
 * ```
 */
export function FormatDetailsConfigSchemaFactory() {
  return ConfigurationSchema('FormatDetails', {
    /**
     * #slot formatDetails.feature
     * callback returning an object of fields to merge onto the clicked feature.
     * `track` is the track's config, so one session-wide callback can link out
     * per assembly or name the track. A plain object works too, for fields
     * that are the same on every feature
     */
    feature: {
      type: 'frozen',
      description: 'adds extra fields to the feature details',
      defaultValue: {},
      contextVariable: ['feature', 'track'],
    },
    /**
     * #slot formatDetails.subfeatures
     * the same, applied to each subfeature down to `depth`. `parent` is the
     * feature it sits in and `depth` how far down, 1 for a gene's transcript
     * and 2 for the transcript's exon
     */
    subfeatures: {
      type: 'frozen',
      description: 'adds extra fields to the subfeatures of a feature',
      defaultValue: {},
      contextVariable: ['feature', 'parent', 'depth', 'track'],
    },
    /**
     * #slot formatDetails.depth
     * how many levels of subfeature the `subfeatures` callback runs on,
     * defaulting to 2, which stops at a gene's transcripts rather than
     * descending into their exons and CDSs. A track's value wins over the
     * session's
     */
    depth: {
      type: 'maybeNumber',
      description:
        'levels of subfeature the formatDetails.subfeatures callback runs on, default 2',
    },
    /**
     * #slot formatDetails.maxDepth
     * how many levels of subfeature card the panel renders at all, which is a
     * separate question from how deep `subfeatures` formats. Unset means no
     * limit. A track's value wins over the session's
     */
    maxDepth: {
      type: 'maybeNumber',
      description: 'hide subfeatures nested deeper than this, default no limit',
    },
  })
}
