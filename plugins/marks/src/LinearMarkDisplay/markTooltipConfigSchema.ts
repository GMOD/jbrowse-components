import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MarkTooltip
 * #category display
 * The mark display's `tooltip`, the box hovering a mark opens: whether it
 * `show`s, and the `field` naming the hovered feature on its first line,
 * above the locus and each channel's value. A bare string is the field.
 * Unwritten, the field is empty and the box names no feature, so a plot of
 * dense values, a Manhattan or a coverage, ships no string per mark.
 *
 * #example
 * ```js
 * { type: 'LinearMarkDisplay', tooltip: 'name' }
 * ```
 */
export const markTooltipConfigSchema = ConfigurationSchema(
  'MarkTooltip',
  {
    /**
     * #slot
     * Off, hovering a mark opens no box.
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'open the tooltip when the cursor rests on a mark',
    },
    /**
     * #slot
     * The field the box's first line reads off the feature the mark draws,
     * such as `name`, or a `jexl:` expression over `feature`; one that reads
     * nothing names the feature, else its ID, as a feature track's tooltip
     * does. Empty names nothing.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description:
        'the field naming the hovered feature, such as `name`, or a `jexl:` expression over `feature`; empty names nothing',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true },
)
