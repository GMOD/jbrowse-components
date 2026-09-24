import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MarkLocus
 * #category display
 * A mark's far end as a position that may lie on another sequence: `pos`,
 * the feature field holding its coordinate, and `chrom`, the field holding
 * its refName, as a paired record states its mate. Writing a field name
 * directly on the encoding lands in `pos`, on the feature's own sequence.
 *
 * #example
 * ```js
 * {
 *   mark: 'link',
 *   encoding: { x2: { chrom: 'mate.refName', pos: 'mate.start' } },
 *   transform: [{ type: 'mate' }],
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
      defaultValue: 'end',
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
