import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { MAF_COLOR_FIELDS } from './rowRenderings.ts'

/**
 * #config MafColor
 * #category display
 * The MAF display's `color`: what colours each species row's aligned cells.
 * `mismatch` paints a base only where it differs from the reference,
 * `base` every base, `identity` the mean identity to the reference on a
 * red-to-blue ramp, `chromosome` each block by the rank of its source
 * chromosome within the row, and `codon` each codon by its amino-acid change,
 * given an `annotationAdapter`. A string is the field.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', color: 'identity' }
 * ```
 * ```js
 * { type: 'LinearMafDisplay', color: 'identity', y: 'identity' }
 * ```
 */
export const mafColorConfigSchema = ConfigurationSchema(
  'MafColor',
  {
    /**
     * #slot field
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('MafColorField', [...MAF_COLOR_FIELDS]),
      defaultValue: 'mismatch',
      description:
        'what colours a cell: mismatch, base, identity, chromosome or codon',
    },
  },
  { shorthand: 'field', closed: true },
)
