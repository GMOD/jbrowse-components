import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config CrisprGuideAdapter
 */

const configSchema = ConfigurationSchema(
  'CrisprGuideAdapter',
  {
    /**
     * #slot
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
