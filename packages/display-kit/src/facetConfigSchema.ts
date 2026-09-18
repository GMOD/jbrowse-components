import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The `facet` object as written: a field, and the order its sections stack in. */
export interface FacetSetting {
  field: string
  domain: readonly string[]
}

const FACET_KEYS = new Set(['field', 'domain'])

/**
 * A key the object does not declare, or a `domain` with no `field` to order,
 * is refused here rather than dropped, so a config carries no order for a
 * facet it does not have. A `domain` written as numbers is carried as strings.
 */
export function normalizeFacet(
  snap: Record<string, unknown> = {},
): Record<string, unknown> {
  const obj = { ...snap }
  const unknown = Object.keys(obj).filter(key => !FACET_KEYS.has(key))
  if (unknown.length > 0) {
    throw new Error(`facet takes field and domain, not ${unknown.join(', ')}`)
  }
  if (obj.domain !== undefined && !Array.isArray(obj.domain)) {
    throw new Error('facet.domain is a list')
  }
  const domain = Array.isArray(obj.domain) ? obj.domain.map(String) : undefined
  if (domain?.length && !obj.field) {
    throw new Error('facet.domain orders the sections of a field: name one')
  }
  return domain ? { ...obj, domain } : obj
}

/**
 * #config Facet
 * #category display
 * The `facet` setting of the feature, mark, multi-sample variant and
 * alignments displays: one labelled section of the track per value of a
 * field. A string is the field; the object adds the order.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', facet: 'strand' }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   facet: { field: 'gene_biotype', domain: ['protein_coding', 'lncRNA'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   facet: { field: 'tags.HP', domain: ['1', '2'] },
 * }
 * ```
 */
export const facetConfigSchema = ConfigurationSchema(
  'Facet',
  {
    /**
     * #slot field
     * The feature field each value of which packs its own labelled section
     * of the track: a field name, a dotted path into a structured field
     * (`INFO.SVTYPE`, a read's `tags.HP`), a `jexl:` expression, or
     * `strand`. A feature with no value stacks last, under `field: none`.
     * The alignments displays also take a read dimension here:
     * `firstOfPairStrand`, `pairOrientation`, `splitRead`, `mapq` or
     * `mateAssembly`. Writing `facet: "strand"` lands here.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        'feature field (or jexl expression) to group by, one labelled section per value; `strand` for one per strand',
    },
    /**
     * #slot domain
     * The values whose sections stack first, in order; the rest follow
     * sorted. Empty stacks every section sorted, and a `strand` facet
     * forward, reverse, then unstranded (`1`, `-1`, `0`).
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'values whose sections stack first, in order',
    },
  },
  { shorthand: 'field', preProcessSnapshot: normalizeFacet },
)

/** The facet as read back: undefined while ungrouped. */
export function facetSettingOf(snapshot: {
  field: string
  domain: readonly string[]
}): FacetSetting | undefined {
  return snapshot.field
    ? { field: snapshot.field, domain: snapshot.domain }
    : undefined
}
