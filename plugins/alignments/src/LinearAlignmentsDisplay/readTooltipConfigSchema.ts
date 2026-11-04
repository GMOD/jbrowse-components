import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ReadTooltip
 * #category display
 * The alignments displays' `tooltip`: the `field` the read hover's first line
 * reads, spelt as `encoding.color` and `facet` spell one — a field, a path
 * (`mate.name`), a tag (`tags.HP`) or a `jexl:` expression over `feature`. A
 * bare string is the field. Unset, the first line is the read's name; a read
 * the field reads nothing on, or throws on, keeps its name too. Whenever the
 * first line is not the read's name, the hover adds a `Name:` line. The other
 * hovers (a mismatch inside a read, coverage, arcs, junctions) are unaffected.
 * The worker reads the field once per drawn read on each fetch, so a `jexl:`
 * expression on a deep BAM costs a little on every fetch.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', tooltip: 'tags.HP' }
 * ```
 * ```js
 * {
 *   type: 'LGVSyntenyDisplay',
 *   tooltip: "jexl:get(feature,'mate').name",
 * }
 * ```
 */
export const readTooltipConfigSchema = ConfigurationSchema(
  'ReadTooltip',
  {
    /**
     * #slot
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description:
        "the field the read hover's first line reads, such as `tags.HP` or `mate.name`, or a `jexl:` expression over `feature`; unset, the read's name",
    },
  },
  { shorthand: 'field', writes: 'members', closed: true },
)
