import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { normalizeChannel } from './colorConfigSchema.ts'

/**
 * The beta name of `sort`, which hosted hub configs jb2hubs generated still
 * write on `facet` and `rows`.
 */
export const retiredOrderSpelling = {
  domain: (sort: unknown) => ({ sort }),
}

/** The `facet` object as written: a field, and the order its sections stack in. */
export interface FacetSetting {
  field: string
  sort: readonly string[]
  hidden?: readonly string[]
}

/**
 * #config Facet
 * #category display
 * The `facet` setting of the feature, multi-sample variant, multi-row and
 * alignments displays: one labelled section of the track per value of a field. A string
 * is the field; the object adds the order. The mark display's `MarkFacet`
 * adds the steps each section runs. On the multi-sample variant displays the
 * field is a sample attribute from the samples file, such as `population`,
 * and it bands the sample rows by its value, with no chip.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', facet: 'strand' }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   facet: { field: 'gene_biotype', sort: ['protein_coding', 'lncRNA'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   facet: { field: 'tags.HP', sort: ['1', '2'] },
 * }
 * ```
 */
export const facetConfigSchema = ConfigurationSchema(
  'Facet',
  {
    /**
     * #slot field
     * The feature field whose values each get a labelled section of the
     * track: a field name, a dotted path into a structured field
     * (`INFO.SVTYPE`, a read's `tags.HP`), a `jexl:` expression, or
     * `strand`. A feature with no value stacks last, under `field: none`
     * (`(no value)` for a `jexl:` field, whose sections show the value alone).
     * The multi-sample variant displays read a sample attribute instead, and
     * the multi-row display `group`, its `rowGroups`.
     * The alignments displays also take a read dimension here:
     * `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`,
     * `mapq`, `mateRefName` or `mateAssembly`. Writing `facet: "strand"`
     * sets this slot.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description:
        'feature field (or jexl expression) to facet over, one labelled section per value; `strand` for one per strand, and empty for no sections',
    },
    /**
     * #slot sort
     * The values whose sections stack first, in order, as Vega-Lite's `sort`
     * lists them: the rest follow sorted, and none is dropped. Empty stacks
     * every section sorted, and a `strand` facet forward, reverse, then
     * unstranded (`1`, `-1`, `0`).
     */
    sort: {
      type: 'stringArray',
      defaultValue: [],
      description: 'values whose sections stack first, in order',
    },
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
    retired: retiredOrderSpelling,
    preProcessSnapshot: snap => normalizeChannel(snap, 'facet'),
  },
)

/** The facet as read back: undefined while ungrouped. */
export function facetSettingOf(snapshot: {
  field: string
  sort: readonly string[]
}): FacetSetting | undefined {
  return snapshot.field
    ? { field: snapshot.field, sort: snapshot.sort }
    : undefined
}
