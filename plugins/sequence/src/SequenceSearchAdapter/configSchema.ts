import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SequenceSearchAdapter
 * #trackType FeatureTrack
 *
 * Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
 * track is displayed against. Setting it by hand pins the scan to one sequence
 * source and silently desyncs the track if the assembly's sequence changes.
 *
 * #example
 * `search` is a regular expression matched against the assembly's own sequence,
 * so a track needs no file of its own. This one finds canonical polyadenylation
 * signals on both strands:
 * ```js
 * {
 *   type: 'SequenceSearchAdapter',
 *   search: 'AATAAA',
 * }
 * ```
 *
 * #example one strand only
 * Both strands are scanned by default. Turn one off where the motif is
 * strand-specific, so the track does not report the reverse-complement hit as a
 * second site:
 * ```js
 * {
 *   type: 'SequenceSearchAdapter',
 *   search: 'GGTAAG',
 *   searchReverse: false,
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'SequenceSearchAdapter',
  {
    /**
     * #slot
     */
    search: {
      type: 'string',
      defaultValue: '',
      description: 'Search string or regex to search for',
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
     * report matches on the reference as written (the plus strand)
     */
    searchForward: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     * also search the reverse complement, reporting those hits on the minus
     * strand. Turn it off for a motif that is only meaningful in one
     * orientation, or to halve the work on a palindromic pattern
     */
    searchReverse: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     * match regardless of case, so soft-masked (lowercase) repeat regions are
     * searched too. Turn it off to search only unmasked sequence
     */
    caseInsensitive: {
      type: 'boolean',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export type SequenceSearchAdapterConfig = Instance<typeof configSchema>

export default configSchema
