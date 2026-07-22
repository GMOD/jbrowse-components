import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config CrisprGuideAdapter
 *
 * Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
 * track is displayed against. Setting it by hand pins the scan to one sequence
 * source and silently desyncs the track if the assembly's sequence changes.
 */

const configSchema = ConfigurationSchema(
  'CrisprGuideAdapter',
  {
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
     * PAM motif in IUPAC codes, e.g. NGG for SpCas9, TTTV for Cas12a
     */
    pam: {
      type: 'string',
      defaultValue: 'NGG',
    },
    /**
     * #slot
     * protospacer length in bp
     */
    guideLength: {
      type: 'number',
      defaultValue: 20,
    },
    /**
     * #slot
     * whether the PAM is 3' (Cas9) or 5' (Cas12a) of the protospacer
     */
    pamLocation: {
      type: 'stringEnum',
      model: types.enumeration('PamLocation', ['3prime', '5prime']),
      defaultValue: '3prime',
    },
    /**
     * #slot
     * distance in bp from the PAM-proximal end of the protospacer to the
     * predicted cut site (3 for SpCas9)
     */
    cutOffset: {
      type: 'number',
      defaultValue: 3,
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
  },
  { explicitlyTyped: true },
)

export type CrisprGuideAdapterConfig = Instance<typeof configSchema>

export default configSchema
