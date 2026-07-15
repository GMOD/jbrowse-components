import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MotifListAdapter
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
