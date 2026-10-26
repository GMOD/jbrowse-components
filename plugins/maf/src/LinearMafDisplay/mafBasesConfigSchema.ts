import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { MAF_BASES_FIELDS } from './rowPlan.ts'

/**
 * #config MafBases
 * #category display
 * The MAF display's `alignments.bases` layer, a cell per position over the
 * rows, as alignments' `pileup.bases`: `show` turns it on and
 * `encoding.color` names what it paints. `base` paints every base in its
 * color with its letter. `codon` paints each codon by its amino-acid change
 * against the reference, with the amino acid's letter, from the reading
 * frames of the MAF adapter's `framesAdapter`, at base level. The mismatches
 * do not draw while the layer does.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { bases: { show: true } } }
 * ```
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   alignments: { bases: { show: true, encoding: { color: 'codon' } } },
 * }
 * ```
 */
export const mafBasesConfigSchema = ConfigurationSchema(
  'MafBases',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the per-position layer over the rows',
    },
    /**
     * #slot encoding
     * The layer's channels: `encoding.color`, the per-position variable.
     */
    encoding: ConfigurationSchema(
      'MafBasesEncoding',
      {
        /**
         * #slot encoding.color
         * The per-position variable the layer paints: `base` or `codon`.
         */
        color: ConfigurationSchema(
          'MafBasesColor',
          {
            /**
             * #slot encoding.color.field
             */
            field: {
              type: 'stringEnum',
              model: types.enumeration('MafBasesField', [...MAF_BASES_FIELDS]),
              defaultValue: 'base',
              description:
                'the per-position variable: base, every base in its color, or codon, each codon by its amino-acid change',
            },
          },
          { shorthand: 'field', writes: 'whole', closed: true, plot: true },
        ),
      },
      encodingOptions,
    ),
  },
  { closed: true, plot: true },
)
