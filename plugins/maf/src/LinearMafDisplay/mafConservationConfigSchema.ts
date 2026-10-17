import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { CONSERVATION_UNITS } from './conservationUnits.ts'

/**
 * #config MafConservation
 * #category display
 * The MAF display's `conservation` setting: the band of identity to the
 * reference drawn above the rows, its height, and the unit one bar stands
 * for.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', conservation: { show: true, unit: 'codon' } }
 * ```
 */
export const mafConservationConfigSchema = ConfigurationSchema(
  'MafConservation',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the conservation band',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 40,
      description: 'height of the conservation band in pixels',
    },
    /**
     * #slot
     * `codon` reads frames off the MAF adapter's `annotationAdapter`.
     */
    unit: {
      type: 'stringEnum',
      model: types.enumeration('MafConservationUnit', CONSERVATION_UNITS),
      defaultValue: 'base',
      description:
        'what one bar stands for: base, its percent identity, or codon, its amino-acid identity',
    },
  },
  { closed: true, plot: true },
)
