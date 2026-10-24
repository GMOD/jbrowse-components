import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULT_X2 } from './markVocabulary.ts'

/**
 * #config MarkLocus
 * #category display
 * A mark's far end as a position that may lie on another sequence: `pos`,
 * the feature field holding its coordinate, and `refName`, the field holding
 * the sequence it lies on, as a paired record states its mate. A field name written
 * directly on the encoding sets `pos`, on the feature's sequence.
 * Left unwritten behind a `mate` step, it is the other end the step found.
 *
 * #example
 * A BEDPE-like file whose second end sits in separate columns:
 * ```js
 * {
 *   mark: 'link',
 *   encoding: { x2: { refName: 'chrom2', pos: 'start2' } },
 * }
 * ```
 */
export const markLocusSchema = ConfigurationSchema(
  'MarkLocus',
  {
    /**
     * #slot pos
     * The feature field, or jexl expression over `feature`, giving the
     * position in bp.
     */
    pos: {
      type: 'featureField',
      defaultValue: DEFAULT_X2,
      description: 'position field',
    },
    /**
     * #slot refName
     * The feature field holding the sequence the position lies on. Empty is
     * the feature's own.
     */
    refName: {
      type: 'featureField',
      defaultValue: '',
      description: 'sequence field; empty is the feature’s own',
    },
  },
  { shorthand: 'pos', writes: 'whole', closed: true },
)
