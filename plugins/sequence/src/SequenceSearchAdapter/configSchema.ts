import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SequenceSearchAdapter
 *
 * Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
 * track is displayed against. Setting it by hand pins the scan to one sequence
 * source and silently desyncs the track if the assembly's sequence changes.
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
     */
    searchForward: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     */
    searchReverse: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
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
