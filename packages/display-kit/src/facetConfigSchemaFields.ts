/**
 * The row facet's two slots, spread into the feature display's schema and the
 * mark display's, the two displays that facet features by a field of their
 * own.
 */
export const facetConfigSchemaFields = {
  /**
   * #slot
   * The feature field each value of which packs its own labelled section
   * of the track: a field name, a dotted path into a structured field
   * (`INFO.SVTYPE`), a `jexl:` expression, or `strand`. A feature with
   * no value stacks last, under `field: none`. Empty is ungrouped.
   */
  facetField: {
    type: 'string',
    defaultValue: '',
    description:
      'feature field (or jexl expression) to group by, one labelled section per value; `strand` for one per strand',
  },
  /**
   * #slot
   * The `facetField` values whose sections stack first, in order; the
   * rest follow sorted. Empty stacks every section sorted, and a `strand`
   * facet forward, reverse, then unstranded (`1`, `-1`, `0`).
   */
  facetDomain: {
    type: 'stringArray',
    defaultValue: [],
    description: 'facetField values whose sections stack first, in order',
  },
} as const
