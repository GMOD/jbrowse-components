import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULT_X2 } from './markVocabulary.ts'

/**
 * #config MarkLocus
 * #category display
 * A mark's far end as a position that may lie on another sequence: `pos`,
 * the feature field holding its coordinate, and `chrom`, the field holding
 * its refName, as a paired record states its mate. Writing a field name
 * directly on the encoding lands in `pos`, on the feature's own sequence.
 * Left unwritten behind a `mate` step, it is the other end the step found.
 *
 * #example
 * A BEDPE-like file whose second end sits in its own columns:
 * ```js
 * {
 *   mark: 'link',
 *   encoding: { x2: { chrom: 'chrom2', pos: 'start2' } },
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
     * #slot chrom
     * The feature field holding the sequence the position lies on. Empty is
     * the feature's own.
     */
    chrom: {
      type: 'featureField',
      defaultValue: '',
      description: 'sequence field; empty is the feature’s own',
    },
  },
  { shorthand: 'pos', closed: true },
)
