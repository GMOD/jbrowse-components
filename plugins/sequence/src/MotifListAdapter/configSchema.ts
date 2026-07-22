import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MotifListAdapter
 * Scans the reference for a list of named motifs, e.g. restriction enzyme
 * recognition sites.
 *
 * Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
 * track is displayed against. Setting it by hand pins the scan to one sequence
 * source and silently desyncs the track if the assembly's sequence changes.
 *
 * #example
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'restriction_enzymes',
 *   name: 'Restriction enzymes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'MotifListAdapter',
 *     motifs: 'EcoRI\tG^AATTC\nBamHI\tG^GATCC',
 *   },
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'MotifListAdapter',
  {
    /**
     * #slot
     * Newline-separated list of named motifs in REBASE notation, e.g.
     * `EcoRI  G^AATTC`. The name is optional and `^` optionally marks the
     * top-strand cut. Blank lines and `#` comments are ignored.
     */
    motifs: {
      type: 'text',
      defaultValue: '',
      description: 'Named motifs to search for, one per line',
    },
    /**
     * #slot
     * discouraged: leave unset. JBrowse supplies the assembly's sequence
     * adapter automatically; this override exists only for the rare case of
     * scanning a sequence other than the one the track is displayed against.
     */
    sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    },
    /**
     * #slot
     * ignored for palindromic motifs, which match both strands at once
     */
    searchForward: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     * ignored for palindromic motifs, which match both strands at once
     */
    searchReverse: {
      type: 'boolean',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export type MotifListAdapterConfig = Instance<typeof configSchema>

export default configSchema
